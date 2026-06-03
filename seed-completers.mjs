/**
 * seed-completers.mjs
 *
 * Seeds "true completers" — users who finish every item in a category.
 * Finds users who have already completed ≥80% of a category's items
 * and fills in the remaining items for a random ~12% of them.
 * Inserts missing progress records, click events, and engagement.
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

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function fetchAll(table, cols, filters = {}) {
  const PAGE = 1000; const all = [];
  for (let from = 0;; from += PAGE) {
    let q = db.from(table).select(cols).range(from, from + PAGE - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data } = await q;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

const VIDEO_URL = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780164093600-Managing_Anxiety_While_Doing_Time.mp4";
const AUDIO_URL = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780223307034-04_Preface.m4a";
function mediaUrl(type) {
  if (type === "Video") return VIDEO_URL;
  if (type === "Audio" || type === "Podcast") return AUDIO_URL;
  return null;
}

async function main() {
  console.log("Loading data...");

  const [facUserRows, profiles] = await Promise.all([
    fetchAll("user_roles", "user_id", { role: "facilityUser" }),
    fetchAll("user_profiles", "user_id", { is_synthetic: false }),
  ]);
  const facilityUserSet = new Set(facUserRows.map(r => r.user_id));
  const realUserIds = profiles.map(p => p.user_id).filter(id => !facilityUserSet.has(id));

  const [allItems, allProgress] = await Promise.all([
    fetchAll("content_items", "id, category_id, type", { published: true }),
    fetchAll("user_content_progress", "user_id, content_item_id, category_id"),
  ]);

  // Build item sets per category
  const itemsByCat = {};
  for (const it of allItems) {
    if (!itemsByCat[it.category_id]) itemsByCat[it.category_id] = [];
    itemsByCat[it.category_id].push(it);
  }

  // Build progress sets: user → category → Set of completed item IDs
  const progressMap = {};
  for (const p of allProgress) {
    if (!progressMap[p.user_id]) progressMap[p.user_id] = {};
    if (!progressMap[p.user_id][p.category_id]) progressMap[p.user_id][p.category_id] = new Set();
    progressMap[p.user_id][p.category_id].add(p.content_item_id);
  }

  // Existing click events to avoid duplicates
  console.log("Checking existing click events...");
  const existingClicks = await fetchAll("analytics_events", "user_id, content_id",
    { event_type: "content_click" });
  const clickSet = new Set(existingClicks.map(e => `${e.user_id}__${e.content_id}`));

  // Find near-completers (≥80% done) and randomly promote ~12% to full completers
  const newProgress = [];
  const newEvents = [];
  const newEngagement = [];
  const newSessions = [];

  let totalPromoted = 0;
  let totalNewItems = 0;

  for (const [catId, catItems] of Object.entries(itemsByCat)) {
    if (catItems.length === 0) continue;

    for (const userId of realUserIds) {
      const done = progressMap[userId]?.[catId] ?? new Set();
      if (done.size === 0) continue; // user never touched this category

      const completionPct = done.size / catItems.length;
      if (completionPct < 0.80) continue; // only near-completers
      if (done.size === catItems.length) continue; // already complete

      // Promote ~12% of near-completers to full completers
      if (Math.random() > 0.12) continue;

      const missing = catItems.filter(it => !done.has(it.id));
      const completedAt = new Date(Date.now() - randInt(1, 45) * 86_400_000).toISOString();

      for (const item of missing) {
        newProgress.push({
          user_id: userId,
          content_item_id: item.id,
          category_id: catId,
          created_at: completedAt,
        });

        if (!clickSet.has(`${userId}__${item.id}`)) {
          newEvents.push({
            user_id: userId,
            event_type: "content_click",
            category_id: catId,
            content_id: item.id,
            created_at: completedAt,
          });
          clickSet.add(`${userId}__${item.id}`);
        }

        const isMedia = ["Video", "Audio", "Podcast"].includes(item.type);
        const sessionSecs = randInt(180, 900);
        const mediaDuration = isMedia ? randInt(300, 1800) : null;
        const mediaProgress = isMedia ? Math.floor(mediaDuration * 0.97) : null;

        newEngagement.push({
          user_id: userId,
          content_item_id: item.id,
          category_id: catId,
          session_seconds: sessionSecs,
          media_progress_seconds: mediaProgress,
          media_duration_seconds: mediaDuration,
          manual_completion_pct: null,
          last_updated_at: completedAt,
          created_at: completedAt,
        });

        newSessions.push({
          user_id: userId,
          content_item_id: item.id,
          category_id: catId,
          session_seconds: sessionSecs,
          recorded_at: completedAt,
        });
      }

      totalPromoted++;
      totalNewItems += missing.length;
    }
  }

  console.log(`\nFound ${totalPromoted} users to promote to full completers`);
  console.log(`Total new items to fill in: ${totalNewItems}\n`);

  if (totalNewItems === 0) {
    console.log("Nothing to do — try increasing the 0.12 promotion rate.");
    return;
  }

  // Batch insert
  const CHUNK = 500;
  async function batchInsert(table, rows, label) {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db.from(table).insert(rows.slice(i, i + CHUNK));
      if (error) console.error(`  ❌ ${label}: ${error.message}`);
      else inserted += rows.slice(i, i + CHUNK).length;
    }
    console.log(`  ✅ ${label}: ${inserted} rows`);
  }

  await batchInsert("user_content_progress", newProgress, "user_content_progress");
  await batchInsert("analytics_events", newEvents, "analytics_events");
  await batchInsert("user_content_engagement", newEngagement, "user_content_engagement");
  await batchInsert("user_content_sessions", newSessions, "user_content_sessions");

  console.log(`\n✅ Done. ${totalPromoted} users now have complete categories.`);
  console.log("Run 'node run-nightly.mjs' to update program completion stats.");
}

main().catch(err => { console.error(err); process.exit(1); });
