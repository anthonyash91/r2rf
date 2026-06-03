/**
 * seed-sessions.mjs
 *
 * Populates user_content_sessions from user_content_engagement for seeded users.
 * user_content_sessions is used by filtered time queries (by facility / date range).
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

async function main() {
  console.log("Loading engagement records for seeded users...");

  const [facUserRows, profiles] = await Promise.all([
    fetchAll("user_roles", "user_id", { role: "facilityUser" }),
    fetchAll("user_profiles", "user_id", { is_synthetic: false }),
  ]);
  const facilityUserSet = new Set(facUserRows.map((r) => r.user_id));
  const realUserIds = new Set(profiles.map((p) => p.user_id).filter((id) => !facilityUserSet.has(id)));

  const engagement = await fetchAll(
    "user_content_engagement",
    "user_id, content_item_id, category_id, session_seconds, last_updated_at, created_at"
  );
  const seededEngagement = engagement.filter((e) => realUserIds.has(e.user_id));
  console.log(`  Found ${seededEngagement.length} engagement records to convert\n`);

  // Check which (user, content_item) pairs already exist in user_content_sessions
  const existingSessions = await fetchAll("user_content_sessions", "user_id, content_item_id");
  const existingSet = new Set(existingSessions.map((s) => `${s.user_id}__${s.content_item_id}`));
  console.log(`  ${existingSet.size} sessions already exist — skipping those\n`);

  const rows = seededEngagement
    .filter((e) => !existingSet.has(`${e.user_id}__${e.content_item_id}`))
    .map((e) => ({
      user_id:          e.user_id,
      content_item_id:  e.content_item_id,
      category_id:      e.category_id,
      session_seconds:  e.session_seconds || 0,
      recorded_at:      e.last_updated_at ?? e.created_at,
    }));

  console.log(`Inserting ${rows.length} sessions into user_content_sessions...`);

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from("user_content_sessions").insert(rows.slice(i, i + CHUNK));
    if (error) console.error(`  ❌ Chunk error: ${error.message}`);
    else inserted += rows.slice(i, i + CHUNK).length;
    if ((i / CHUNK + 1) % 10 === 0) process.stdout.write(`  ${inserted}/${rows.length}...\r`);
  }

  console.log(`\n✅ Done. Inserted ${inserted} sessions into user_content_sessions.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
