/**
 * backfill-media-duration.mjs
 *
 * Fixes chapters/items that are missing a duration because they were saved
 * while Bunny was still transcoding (before the fix that patches duration
 * into the DB as soon as it's known — see git history). The file itself is
 * already fully uploaded and processed on Bunny's side; this script doesn't
 * touch Bunny at all except to ask it "how long is this video?" and writes
 * the answer into content_chapters.duration_seconds / content_items.duration.
 * No re-upload needed.
 *
 * --force also recalculates Stream-hosted chapters/items that already HAVE a
 * duration — for the separate bug where the value is just wrong (client-side
 * HTML5 <video>/<audio> probing can't read a duration from Bunny's .m3u8 HLS
 * URLs outside Safari, so any duration set that way could be stale/incorrect;
 * see the admin Duration field's recalculate button, which now uses this same
 * Bunny-API lookup instead). WARNING: --force overwrites any existing
 * duration text for every Stream-hosted item, including one an admin may
 * have manually customized — always --dry-run first to review before
 * applying.
 *
 * Usage:
 *   node backfill-media-duration.mjs                  # missing durations only
 *   node backfill-media-duration.mjs --force           # + recalculate existing ones too
 *   node backfill-media-duration.mjs --force --dry-run # preview --force's changes first
 *
 * Requires in the environment (or a .env file in the project root):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BUNNY_STREAM_LIBRARY_ID,
  BUNNY_STREAM_API_KEY,
} = process.env;

for (const [name, v] of Object.entries({
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BUNNY_STREAM_LIBRARY_ID,
  BUNNY_STREAM_API_KEY,
})) {
  if (!v) {
    console.error(`Missing ${name}.`);
    process.exit(1);
  }
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STREAM_VIDEO_ID_RE = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8(?:\?|#|$)/i;

function extractStreamVideoId(url) {
  const m = url?.match(STREAM_VIDEO_ID_RE);
  return m ? m[1] : null;
}

async function getBunnyDurationSeconds(videoId) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
    { headers: { AccessKey: BUNNY_STREAM_API_KEY } },
  );
  if (!res.ok) throw new Error(`Bunny API ${res.status}`);
  const json = await res.json();
  return typeof json.length === "number" && json.length > 0 ? json.length : null;
}

// Mirrors src/routes/admin.category.$id.tsx's formatMediaDuration.
function formatMediaDuration(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// Mirrors src/lib/duration.ts's actionWordForType + withActionWord.
function actionWordForType(type) {
  const t = (type ?? "").trim().toLowerCase();
  if (!t) return "";
  if (t.includes("video")) return "watch";
  if (t.includes("podcast") || t.includes("audio")) return "listen";
  return "";
}
function withActionWord(duration, type) {
  const d = (duration ?? "").trim();
  if (!d) return "";
  const verb = actionWordForType(type);
  return verb ? `${d} ${verb}` : d;
}

async function run() {
  console.log(dryRun ? "DRY RUN — no writes will be made.\n" : "Applying fixes.\n");
  if (force) console.log("--force: also recalculating chapters/items that already have a duration.\n");

  // ── Chapters ──────────────────────────────────────────────────────────
  let chapterQuery = db.from("content_chapters").select("id, title, file_url").not("file_url", "is", null);
  if (!force) chapterQuery = chapterQuery.is("duration_seconds", null);
  const { data: chapters, error: chErr } = await chapterQuery;
  if (chErr) { console.error("Failed to fetch chapters:", chErr.message); process.exit(1); }

  let chFixed = 0, chSkippedNotStream = 0, chFailed = 0;
  for (const ch of chapters ?? []) {
    const videoId = extractStreamVideoId(ch.file_url);
    if (!videoId) { chSkippedNotStream++; continue; } // not a Stream URL — unrelated to this bug
    try {
      const seconds = await getBunnyDurationSeconds(videoId);
      if (!seconds) { console.log(`  SKIP (Bunny reports no duration yet): "${ch.title}"`); chFailed++; continue; }
      console.log(`  Chapter "${ch.title}": ${seconds}s`);
      if (!dryRun) {
        const { error } = await db.from("content_chapters").update({ duration_seconds: seconds }).eq("id", ch.id);
        if (error) throw error;
      }
      chFixed++;
    } catch (e) {
      console.error(`  FAILED "${ch.title}": ${e.message}`);
      chFailed++;
    }
  }

  // ── Items (main file, no chapters) ───────────────────────────────────
  const { data: items, error: itErr } = await db
    .from("content_items")
    .select("id, title, type, url, duration")
    .not("url", "is", null);
  if (itErr) { console.error("Failed to fetch items:", itErr.message); process.exit(1); }

  let itFixed = 0, itSkippedNotStream = 0, itSkippedHasDuration = 0, itFailed = 0;
  for (const item of items ?? []) {
    if (!force && item.duration && item.duration.trim()) { itSkippedHasDuration++; continue; }
    const videoId = extractStreamVideoId(item.url);
    if (!videoId) { itSkippedNotStream++; continue; }
    try {
      const seconds = await getBunnyDurationSeconds(videoId);
      if (!seconds) { console.log(`  SKIP (Bunny reports no duration yet): "${item.title}"`); itFailed++; continue; }
      const formatted = withActionWord(formatMediaDuration(seconds), item.type);
      console.log(`  Item "${item.title}": ${formatted}`);
      if (!dryRun) {
        const { error } = await db.from("content_items").update({ duration: formatted }).eq("id", item.id);
        if (error) throw error;
      }
      itFixed++;
    } catch (e) {
      console.error(`  FAILED "${item.title}": ${e.message}`);
      itFailed++;
    }
  }

  console.log(`\nChapters: ${chFixed} fixed, ${chSkippedNotStream} not Stream-hosted, ${chFailed} failed/no-duration-yet.`);
  console.log(`Items: ${itFixed} fixed, ${itSkippedHasDuration} already had a duration, ${itSkippedNotStream} not Stream-hosted, ${itFailed} failed/no-duration-yet.`);
  if (dryRun) console.log("\nRe-run without --dry-run to apply.");
}

run().catch((e) => { console.error(e); process.exit(1); });
