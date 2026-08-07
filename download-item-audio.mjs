/**
 * download-item-audio.mjs
 *
 * Downloads every audio file (English + Spanish, item-level and all chapters)
 * for one content item to a local folder. Handles direct file URLs (Supabase
 * Storage or Bunny Storage) — a Bunny Stream URL (.../playlist.m3u8) is an
 * adaptive-bitrate stream, not a single downloadable file, and is skipped
 * with a warning rather than guessed at.
 *
 * Usage:
 *   node download-item-audio.mjs <itemId-or-category-url> [outputDir]
 *
 * Examples:
 *   node download-item-audio.mjs 3b2071c7-2a0c-4380-b61a-638802241a25
 *   node download-item-audio.mjs "https://your-app/category/alcoholics-anonymous#item-3b2071c7-2a0c-4380-b61a-638802241a25"
 *   node download-item-audio.mjs 3b2071c7-2a0c-4380-b61a-638802241a25 ./downloads
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * (or a .env file in the project root).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Load .env if present
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const rawArg = process.argv[2];
if (!rawArg) {
  console.error("Usage: node download-item-audio.mjs <itemId-or-category-url> [outputDir]");
  process.exit(1);
}
// Accept either a bare UUID or a full URL with a #item-{uuid} fragment.
const hashMatch = rawArg.match(/#item-([0-9a-f-]{36})/i);
const itemId = hashMatch ? hashMatch[1] : rawArg;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function isStreamUrl(url) {
  return !!url && /\/playlist\.m3u8(\?|#|$)/.test(url);
}

function extensionOf(url) {
  const clean = url.split("?")[0].split("#")[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "mp3";
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
  return buffer.length;
}

async function run() {
  const { data: item, error } = await db
    .from("content_items")
    .select("id, title, url, file_url, file_url_es, category_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) { console.error("Failed to fetch item:", error.message); process.exit(1); }
  if (!item) { console.error(`No content item found with id ${itemId}`); process.exit(1); }

  const { data: category } = await db
    .from("categories")
    .select("slug")
    .eq("id", item.category_id)
    .maybeSingle();

  const { data: chapters, error: chErr } = await db
    .from("content_chapters")
    .select("title, file_url, file_url_es, sort_order")
    .eq("content_item_id", itemId)
    .order("sort_order", { ascending: true });
  if (chErr) { console.error("Failed to fetch chapters:", chErr.message); process.exit(1); }

  const outRoot = process.argv[3] || "./downloads";
  const folderName = `${slugify(category?.slug ?? "category")}--${slugify(item.title)}`;
  const outDir = join(outRoot, folderName);
  const enDir = join(outDir, "english");
  const esDir = join(outDir, "spanish");
  await mkdir(enDir, { recursive: true });
  await mkdir(esDir, { recursive: true });

  console.log(`Item: "${item.title}" — ${chapters.length} chapter(s)`);
  console.log(`Saving to: ${outDir}\n`);

  // Queue every downloadable field: item-level file (main + ES), then every
  // chapter's EN/ES audio, in display order.
  const jobs = [];
  if (item.file_url) jobs.push({ label: "Main file", url: item.file_url, dir: enDir, index: 0 });
  else if (item.url) jobs.push({ label: "Main file", url: item.url, dir: enDir, index: 0 });
  if (item.file_url_es) jobs.push({ label: "Main file (ES)", url: item.file_url_es, dir: esDir, index: 0 });

  chapters.forEach((ch, i) => {
    const n = ch.sort_order ?? i + 1;
    if (ch.file_url) jobs.push({ label: ch.title, url: ch.file_url, dir: enDir, index: n });
    if (ch.file_url_es) jobs.push({ label: `${ch.title} (ES)`, url: ch.file_url_es, dir: esDir, index: n });
  });

  let downloaded = 0, skipped = 0, failed = 0;

  for (const job of jobs) {
    const filename = `${String(job.index).padStart(2, "0")}-${slugify(job.label)}.${extensionOf(job.url)}`;
    const destPath = join(job.dir, filename);

    if (isStreamUrl(job.url)) {
      console.log(`  SKIP (Bunny Stream, not a direct file): ${job.label}`);
      skipped++;
      continue;
    }

    try {
      const bytes = await downloadFile(job.url, destPath);
      console.log(`  Downloaded: ${filename} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
      downloaded++;
    } catch (e) {
      console.error(`  FAILED: ${job.label} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${downloaded} downloaded, ${skipped} skipped (Stream), ${failed} failed.`);
  console.log(`Files saved under: ${outDir}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
