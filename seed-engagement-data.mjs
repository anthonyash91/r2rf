/**
 * seed-engagement-data.mjs
 *
 * Seeds ratings, bookmarks, and rebuilds content_item_time_totals
 * for the 400 seeded test users.
 *
 * Usage:
 *   node seed-engagement-data.mjs
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

const rand  = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// ── Paginated fetch ───────────────────────────────────────────────────────────
async function fetchAll(table, columns, filters = {}) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns).range(from, from + PAGE - 1);
    for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
    const { data, error } = await q;
    if (error) { console.error(`fetchAll(${table}): ${error.message}`); break; }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

async function batchInsert(table, rows, label) {
  if (!rows.length) { console.log(`  ⏭️  ${label}: 0 rows`); return 0; }
  const CHUNK = 200; // smaller chunks so triggers don't time out
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) console.error(`  ❌ ${label} chunk error: ${error.message}`);
    else inserted += rows.slice(i, i + CHUNK).length;
  }
  console.log(`  ✅ ${label}: ${inserted} rows inserted`);
  return inserted;
}

async function main() {
  console.log("Loading seeded user progress data...");

  // Get all non-synthetic, non-facilityUser users
  const [facUserRows, profiles] = await Promise.all([
    fetchAll("user_roles", "user_id", { role: "facilityUser" }),
    fetchAll("user_profiles", "user_id", { is_synthetic: false }),
  ]);
  const facilityUserSet = new Set(facUserRows.map((r) => r.user_id));
  const realUserIds = new Set(profiles.map((p) => p.user_id).filter((id) => !facilityUserSet.has(id)));

  // Get all content progress records for real users
  const allProgress = await fetchAll("user_content_progress", "user_id, content_item_id, category_id");
  const userProgress = allProgress.filter((p) => realUserIds.has(p.user_id));

  // Get all engagement records for time totals rebuild
  const allEngagement = await fetchAll("user_content_engagement", "user_id, content_item_id, category_id, session_seconds");
  const userEngagement = allEngagement.filter((e) => realUserIds.has(e.user_id));

  console.log(`  ${realUserIds.size} real users, ${userProgress.length} completed items, ${userEngagement.length} engagement records\n`);

  // ── 1. Ratings ──────────────────────────────────────────────────────────────
  console.log("🌟 Seeding ratings (user_content_ratings)...");

  // Check existing ratings to avoid duplicates
  const existingRatings = await fetchAll("user_content_ratings", "user_id, content_item_id");
  const ratingSet = new Set(existingRatings.map((r) => `${r.user_id}__${r.content_item_id}`));

  // Group progress by user
  const progressByUser = {};
  for (const p of userProgress) {
    if (!progressByUser[p.user_id]) progressByUser[p.user_id] = [];
    progressByUser[p.user_id].push(p);
  }

  const ratingRows = [];
  for (const [userId, items] of Object.entries(progressByUser)) {
    // Rate 30-70% of completed items
    const rateCount = randInt(
      Math.floor(items.length * 0.30),
      Math.floor(items.length * 0.70)
    );
    const toRate = shuffle(items).slice(0, rateCount);

    for (const item of toRate) {
      const key = `${userId}__${item.content_item_id}`;
      if (ratingSet.has(key)) continue;
      ratingSet.add(key);
      // 68% helpful, 32% not helpful — realistic skew toward positive
      const rating = Math.random() < 0.68 ? 1 : -1;
      ratingRows.push({
        user_id: userId,
        content_item_id: item.content_item_id,
        rating,
        created_at: new Date(Date.now() - randInt(1, 60) * 86_400_000).toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  await batchInsert("user_content_ratings", ratingRows, "user_content_ratings");

  // ── 2. Bookmarks ─────────────────────────────────────────────────────────────
  console.log("\n🔖 Seeding bookmarks (user_content_bookmarks)...");

  const existingBookmarks = await fetchAll("user_content_bookmarks", "user_id, content_item_id");
  const bookmarkSet = new Set(existingBookmarks.map((b) => `${b.user_id}__${b.content_item_id}`));

  const bookmarkRows = [];
  for (const [userId, items] of Object.entries(progressByUser)) {
    // Bookmark 10-35% of completed items
    const bookmarkCount = randInt(
      Math.floor(items.length * 0.10),
      Math.floor(items.length * 0.35)
    );
    const toBookmark = shuffle(items).slice(0, bookmarkCount);

    for (const item of toBookmark) {
      const key = `${userId}__${item.content_item_id}`;
      if (bookmarkSet.has(key)) continue;
      bookmarkSet.add(key);
      bookmarkRows.push({
        user_id: userId,
        content_item_id: item.content_item_id,
        created_at: new Date(Date.now() - randInt(1, 90) * 86_400_000).toISOString(),
      });
    }
  }

  await batchInsert("user_content_bookmarks", bookmarkRows, "user_content_bookmarks");

  // ── 3. Rebuild content_item_time_totals ──────────────────────────────────────
  console.log("\n⏱️  Rebuilding content_item_time_totals...");

  // Sum session_seconds and count unique engagers per item
  const totalsMap = {};
  for (const e of userEngagement) {
    if (!totalsMap[e.content_item_id]) {
      totalsMap[e.content_item_id] = { total_session_seconds: 0, engager_count: 0 };
    }
    totalsMap[e.content_item_id].total_session_seconds += e.session_seconds || 0;
    totalsMap[e.content_item_id].engager_count++;
  }

  const timeRows = Object.entries(totalsMap).map(([content_item_id, stats]) => ({
    content_item_id,
    total_session_seconds: stats.total_session_seconds,
    engager_count: stats.engager_count,
    updated_at: new Date().toISOString(),
  }));

  // Upsert into content_item_time_totals
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < timeRows.length; i += CHUNK) {
    const { error } = await db
      .from("content_item_time_totals")
      .upsert(timeRows.slice(i, i + CHUNK), { onConflict: "content_item_id" });
    if (error) console.error(`  ❌ content_item_time_totals error: ${error.message}`);
    else upserted += timeRows.slice(i, i + CHUNK).length;
  }
  console.log(`  ✅ content_item_time_totals: ${upserted} items updated`);

  console.log(`
✅ Done.
   Ratings:   ${ratingRows.length}
   Bookmarks: ${bookmarkRows.length}
   Time totals rebuilt for ${timeRows.length} content items
`);
}

main().catch((err) => { console.error(err); process.exit(1); });
