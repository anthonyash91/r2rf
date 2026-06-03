/**
 * run-nightly.mjs
 *
 * Manually runs the full nightly analytics refresh:
 *   - facility_stats      (user counts, completion rates, time spent)
 *   - user_stats          (per-user totals and facility percentile)
 *   - analytics_retention (7d / 30d / 60d return rates)
 *   - analytics_weekly_growth (new signups + active users per week)
 *   - analytics_program_completion (per-category completion rates)
 *
 * Usage:
 *   node run-nightly.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const now = new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function upsertAll(table, rows, onConflict) {
  if (!rows.length) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) console.error(`  ❌ ${table} upsert error: ${error.message}`);
  }
}

// ── Paginated fetch (bypasses Supabase's 1000-row default limit) ─────────────
async function fetchAll(table, columns, filters = {}) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns).range(from, from + PAGE - 1);
    for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
    const { data, error } = await q;
    if (error) { console.error(`  ❌ fetchAll(${table}): ${error.message}`); break; }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

// ── Load source data ──────────────────────────────────────────────────────────
async function loadAll() {
  console.log("Loading source data...");

  const [facUserRows, profiles, logins, progress, engagement, items, categories] = await Promise.all([
    fetchAll("user_roles", "user_id", { role: "facilityUser" }),
    fetchAll("user_profiles", "user_id, facility, created_at", { is_synthetic: false }),
    fetchAll("user_logins", "user_id, login_date"),
    fetchAll("user_content_progress", "user_id, content_item_id, category_id"),
    fetchAll("user_content_engagement", "user_id, category_id, session_seconds"),
    fetchAll("content_items", "id, category_id", { published: true }),
    fetchAll("categories", "id", { published: true }),
  ]);

  const facilityUserSet = new Set(facUserRows.map((r) => r.user_id));
  const realProfiles = profiles.filter((p) => !facilityUserSet.has(p.user_id));

  console.log(`  Profiles: ${realProfiles.length}, Logins: ${logins.length}, Progress: ${progress.length}, Engagement: ${engagement.length}`);

  return { realProfiles, logins, progress, engagement, items, categories, facilityUserSet };
}

// ── facility_stats ────────────────────────────────────────────────────────────
async function refreshFacilityStats({ realProfiles, logins, progress, engagement }) {
  console.log("\n📊 Refreshing facility_stats...");

  const d7  = daysAgo(7);
  const d30 = daysAgo(30);

  // Index logins by user
  const loginsByUser = {};
  for (const l of logins) {
    if (!loginsByUser[l.user_id]) loginsByUser[l.user_id] = [];
    loginsByUser[l.user_id].push(l.login_date);
  }

  // Index progress by user
  const progressByUser = {};
  for (const p of progress) {
    if (!progressByUser[p.user_id]) progressByUser[p.user_id] = 0;
    progressByUser[p.user_id]++;
  }

  // Index session seconds by user
  const sessionByUser = {};
  for (const e of engagement) {
    if (!sessionByUser[e.user_id]) sessionByUser[e.user_id] = 0;
    sessionByUser[e.user_id] += e.session_seconds || 0;
  }

  // Total items per category (for completion rate)
  const { data: catItems } = await db.from("content_items").select("id, category_id").eq("published", true);
  const itemsInCat = {};
  for (const ci of catItems ?? []) {
    itemsInCat[ci.category_id] = (itemsInCat[ci.category_id] ?? 0) + 1;
  }
  const totalItems = Object.values(itemsInCat).reduce((a, b) => a + b, 0);

  // Progress by user+category
  const progByCatUser = {};
  for (const p of progress) {
    const key = `${p.user_id}__${p.category_id}`;
    if (!progByCatUser[key]) progByCatUser[key] = 0;
    progByCatUser[key]++;
  }

  // Group by facility
  const byFacility = {};
  for (const prof of realProfiles) {
    const fv = prof.facility;
    if (!fv) continue;
    if (!byFacility[fv]) byFacility[fv] = [];
    byFacility[fv].push(prof);
  }

  const rows = [];
  for (const [facilityValue, fProfiles] of Object.entries(byFacility)) {
    const userIds = fProfiles.map((p) => p.user_id);
    const totalUsers = userIds.length;

    let active7 = 0, active30 = 0, totalSession = 0, totalCompletions = 0;
    const completionRates = [];

    for (const uid of userIds) {
      const userLogins = loginsByUser[uid] ?? [];
      if (userLogins.some((d) => d >= d7))  active7++;
      if (userLogins.some((d) => d >= d30)) active30++;

      totalSession     += sessionByUser[uid] ?? 0;
      totalCompletions += progressByUser[uid] ?? 0;

      // Per-user completion rate (items completed / total available)
      const userCompleted = progressByUser[uid] ?? 0;
      if (totalItems > 0) {
        completionRates.push((userCompleted / totalItems) * 100);
      }
    }

    const avgCompletionRate = completionRates.length
      ? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length * 10) / 10
      : null;

    rows.push({
      facility_value:       facilityValue,
      total_users:          totalUsers,
      active_users_7d:      active7,
      active_users_30d:     active30,
      avg_completion_rate:  avgCompletionRate,
      total_session_seconds: totalSession,
      items_completed_total: totalCompletions,
      updated_at:           now,
    });
  }

  await upsertAll("facility_stats", rows, "facility_value");
  console.log(`  ✅ ${rows.length} facilities updated`);
}

// ── user_stats ────────────────────────────────────────────────────────────────
async function refreshUserStats({ realProfiles, logins, progress, engagement }) {
  console.log("\n👤 Refreshing user_stats...");

  const sessionByUser = {};
  for (const e of engagement) {
    sessionByUser[e.user_id] = (sessionByUser[e.user_id] ?? 0) + (e.session_seconds || 0);
  }

  const completedByUser = {};
  const startedCatsByUser = {};
  for (const p of progress) {
    completedByUser[p.user_id] = (completedByUser[p.user_id] ?? 0) + 1;
    if (!startedCatsByUser[p.user_id]) startedCatsByUser[p.user_id] = new Set();
    startedCatsByUser[p.user_id].add(p.category_id);
  }

  // Compute percentile per facility based on total_session_seconds
  const byFacility = {};
  for (const p of realProfiles) {
    if (!byFacility[p.facility]) byFacility[p.facility] = [];
    byFacility[p.facility].push(p.user_id);
  }

  const percentileMap = {};
  for (const [, uids] of Object.entries(byFacility)) {
    const sorted = [...uids].sort((a, b) => (sessionByUser[a] ?? 0) - (sessionByUser[b] ?? 0));
    sorted.forEach((uid, i) => {
      percentileMap[uid] = Math.round((i / Math.max(sorted.length - 1, 1)) * 100);
    });
  }

  const rows = realProfiles.map((p) => ({
    user_id:               p.user_id,
    items_completed:       completedByUser[p.user_id] ?? 0,
    items_started:         startedCatsByUser[p.user_id]?.size ?? 0,
    total_session_seconds: sessionByUser[p.user_id] ?? 0,
    facility_percentile:   percentileMap[p.user_id] ?? 0,
    updated_at:            now,
  }));

  await upsertAll("user_stats", rows, "user_id");
  console.log(`  ✅ ${rows.length} user stats updated`);
}

// ── analytics_retention ───────────────────────────────────────────────────────
// One row per facility: { facility_value, total_users, day7_rate, day30_rate, day60_rate }
async function refreshRetention({ realProfiles, logins }) {
  console.log("\n🔄 Refreshing analytics_retention...");

  const loginSetByUser = {};
  for (const l of logins) {
    if (!loginSetByUser[l.user_id]) loginSetByUser[l.user_id] = new Set();
    loginSetByUser[l.user_id].add(l.login_date);
  }

  const byFacility = { __all__: realProfiles };
  for (const p of realProfiles) {
    if (!byFacility[p.facility]) byFacility[p.facility] = [];
    byFacility[p.facility].push(p);
  }

  function retentionRate(fProfs, days) {
    const cutoff = daysAgo(days);
    const eligible = fProfs.filter((p) => p.created_at?.slice(0, 10) <= cutoff);
    const returned = eligible.filter((p) => {
      const userLogins = loginSetByUser[p.user_id] ?? new Set();
      const signup = p.created_at?.slice(0, 10) ?? "";
      return [...userLogins].some((d) => d > signup);
    });
    return eligible.length > 0 ? Math.round((returned.length / eligible.length) * 1000) / 10 : null;
  }

  const rows = Object.entries(byFacility).map(([facilityValue, fProfs]) => ({
    facility_value: facilityValue === "__all__" ? null : facilityValue,
    total_users:    fProfs.length,
    day7_rate:      retentionRate(fProfs, 7),
    day30_rate:     retentionRate(fProfs, 30),
    day60_rate:     retentionRate(fProfs, 60),
    updated_at:     now,
  }));

  await db.from("analytics_retention").delete().gte("updated_at", "2000-01-01");
  for (let i = 0; i < rows.length; i += 500) {
    await db.from("analytics_retention").insert(rows.slice(i, i + 500));
  }
  console.log(`  ✅ ${rows.length} retention rows updated`);
}

// ── analytics_weekly_growth ───────────────────────────────────────────────────
async function refreshWeeklyGrowth({ realProfiles, logins }) {
  console.log("\n📈 Refreshing analytics_weekly_growth...");

  // Last 12 weeks
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const end   = new Date(Date.now() - i * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    weeks.push({
      week_start: start.toISOString().slice(0, 10),
      week_end:   end.toISOString().slice(0, 10),
    });
  }

  const byFacility = { __all__: realProfiles };
  for (const p of realProfiles) {
    if (!byFacility[p.facility]) byFacility[p.facility] = [];
    byFacility[p.facility].push(p);
  }

  const loginsByUser = {};
  for (const l of logins) {
    if (!loginsByUser[l.user_id]) loginsByUser[l.user_id] = [];
    loginsByUser[l.user_id].push(l.login_date);
  }

  const rows = [];
  for (const [facilityValue, fProfs] of Object.entries(byFacility)) {
    for (const { week_start, week_end } of weeks) {
      const newSignups = fProfs.filter(
        (p) => p.created_at?.slice(0, 10) >= week_start && p.created_at?.slice(0, 10) < week_end
      ).length;

      const activeUsers = fProfs.filter((p) =>
        (loginsByUser[p.user_id] ?? []).some((d) => d >= week_start && d < week_end)
      ).length;

      rows.push({
        facility_value: facilityValue === "__all__" ? null : facilityValue,
        week_ending:  week_end,
        signups:      newSignups,
        active_users: activeUsers,
        updated_at:   now,
      });
    }
  }

  await db.from("analytics_weekly_growth").delete().gte("updated_at", "2000-01-01");
  for (let i = 0; i < rows.length; i += 500) {
    await db.from("analytics_weekly_growth").insert(rows.slice(i, i + 500));
  }
  console.log(`  ✅ ${rows.length} weekly growth rows updated`);
}

// ── analytics_program_completion ──────────────────────────────────────────────
// ── analytics_program_completion ──────────────────────────────────────────────
// Columns: category_id, facility_value, name, total_items, users_engaged,
//          users_completed, completion_rate, updated_at
async function refreshProgramCompletion({ realProfiles, progress, items, categories }) {
  console.log("\n🎓 Refreshing analytics_program_completion...");

  const itemsInCat = {};
  for (const it of items) {
    if (!itemsInCat[it.category_id]) itemsInCat[it.category_id] = new Set();
    itemsInCat[it.category_id].add(it.id);
  }

  // Progress by user+category: user_id → Set of completed item IDs
  const userCatProgress = {};
  for (const p of progress) {
    const key = `${p.user_id}__${p.category_id}`;
    if (!userCatProgress[key]) userCatProgress[key] = new Set();
    userCatProgress[key].add(p.content_item_id);
  }

  // Fetch category names
  const catNames = {};
  for (const c of categories) catNames[c.id] = c.name ?? c.id;

  // Also fetch full category name
  const { data: fullCats } = await db.from("categories").select("id, name").eq("published", true);
  for (const c of fullCats ?? []) catNames[c.id] = c.name;

  const byFacility = { __all__: realProfiles };
  for (const p of realProfiles) {
    if (!byFacility[p.facility]) byFacility[p.facility] = [];
    byFacility[p.facility].push(p);
  }

  const rows = [];
  for (const cat of categories) {
    const catItemSet = itemsInCat[cat.id] ?? new Set();
    if (!catItemSet.size) continue;

    for (const [facilityValue, fProfs] of Object.entries(byFacility)) {
      const userIds = fProfs.map((p) => p.user_id);
      let engaged = 0, completed = 0;

      for (const uid of userIds) {
        const key = `${uid}__${cat.id}`;
        const done = userCatProgress[key];
        if (!done || !done.size) continue;
        engaged++;
        if ([...catItemSet].every((id) => done.has(id))) completed++;
      }

      if (!engaged) continue;

      rows.push({
        category_id:    cat.id,
        facility_value: facilityValue === "__all__" ? null : facilityValue,
        name:           catNames[cat.id] ?? null,
        total_items:    catItemSet.size,
        users_engaged:  engaged,
        users_completed: completed,
        completion_rate: Math.round((completed / engaged) * 1000) / 10,
        updated_at:     now,
      });
    }
  }

  await db.from("analytics_program_completion").delete().gte("updated_at", "2000-01-01");
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("analytics_program_completion").insert(rows.slice(i, i + 500));
    if (error) console.error(`  ❌ program_completion error: ${error.message}`);
  }
  console.log(`  ✅ ${rows.length} program completion rows updated`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌙 Running full nightly analytics refresh...\n");

  // Call the real SQL function via the wrapper (TRUNCATEs first to bypass the REST API WHERE clause restriction)
  console.log("Calling refresh_nightly()...");
  const { error: rpcError } = await db.rpc("refresh_nightly");
  if (rpcError) {
    console.warn(`  ⚠️  refresh_nightly() failed: ${rpcError.message}`);
    console.log("  Falling back to JavaScript implementation...\n");
    const data = await loadAll();
    await refreshFacilityStats(data);
    await refreshUserStats(data);
    await refreshRetention(data);
    await refreshWeeklyGrowth(data);
    await refreshProgramCompletion(data);
  } else {
    console.log("  ✅ refresh_nightly() succeeded — all analytics tables refreshed.\n");
  }

  console.log("✅ Nightly refresh complete.");

  console.log("\n✅ Nightly refresh complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
