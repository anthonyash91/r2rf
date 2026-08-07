/**
 * migrate-storage-to-bunny.mjs
 *
 * One-off migration: copies every file in the Supabase Storage "content-files"
 * bucket (uploads/ and qa-screenshots/{runId}/{testId}/) to Bunny Storage,
 * then rewrites the database columns that reference the old Supabase public
 * URLs (content_items.url/file_url/file_url_es, content_chapters.file_url/
 * file_url_es, test_run_results.screenshot_url) to point at the new Bunny CDN
 * URLs instead.
 *
 * Does NOT delete the original Supabase files — that's a separate, later,
 * explicit cleanup step once you've verified the migrated content works
 * (video/audio playback + resume, PDF viewing, QA screenshots) in the live app.
 *
 * Idempotent: safe to re-run after a partial failure. Objects already present
 * on Bunny are skipped; DB rows already pointing at a Bunny URL are skipped.
 *
 * Usage:
 *   node migrate-storage-to-bunny.mjs --dry-run   # preview only, no writes
 *   node migrate-storage-to-bunny.mjs             # for real
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BUNNY_STORAGE_ZONE,
 * BUNNY_STORAGE_ENDPOINT, BUNNY_STORAGE_API_KEY, BUNNY_CDN_HOSTNAME in the
 * environment (or a .env file in the project root).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env if present
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
  BUNNY_STORAGE_ZONE,
  BUNNY_STORAGE_ENDPOINT,
  BUNNY_STORAGE_API_KEY,
  BUNNY_CDN_HOSTNAME,
} = process.env;

const missing = [
  ["SUPABASE_URL", SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
  ["BUNNY_STORAGE_ZONE", BUNNY_STORAGE_ZONE],
  ["BUNNY_STORAGE_ENDPOINT", BUNNY_STORAGE_ENDPOINT],
  ["BUNNY_STORAGE_API_KEY", BUNNY_STORAGE_API_KEY],
  ["BUNNY_CDN_HOSTNAME", BUNNY_CDN_HOSTNAME],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");
const BUCKET = "content-files";
const SUPABASE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const LIST_PAGE_SIZE = 100;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function bunnyObjectUrl(path) {
  return `https://${BUNNY_STORAGE_ENDPOINT}/${BUNNY_STORAGE_ZONE}/${path}`;
}
function bunnyPublicUrl(path) {
  return `https://${BUNNY_CDN_HOSTNAME}/${path}`;
}

async function existsOnBunny(path) {
  try {
    const res = await fetch(bunnyObjectUrl(path), {
      method: "HEAD",
      headers: { AccessKey: BUNNY_STORAGE_API_KEY },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function copyToBunny(path) {
  const { data: blob, error } = await db.storage.from(BUCKET).download(path);
  if (error) throw new Error(`download failed: ${error.message}`);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const res = await fetch(bunnyObjectUrl(path), {
    method: "PUT",
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
      "Content-Type": blob.type || "application/octet-stream",
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny upload failed (${res.status}): ${body}`);
  }
}

/** Recursively lists every file under prefix. Supabase's list() returns one
 * level at a time; folder placeholder entries (id === null) are recursed into. */
async function listAllObjects(prefix) {
  const results = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      console.error(`  List error at "${prefix || "/"}":`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        results.push(...(await listAllObjects(fullPath)));
      } else {
        results.push(fullPath);
      }
    }
    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }
  return results;
}

const URL_COLUMNS = [
  { table: "content_items", idColumn: "id", columns: ["url", "file_url", "file_url_es"] },
  { table: "content_chapters", idColumn: "id", columns: ["file_url", "file_url_es"] },
  { table: "test_run_results", idColumn: "id", columns: ["screenshot_url"] },
];

/** Rewrites Supabase public URLs to Bunny public URLs for every column in
 * URL_COLUMNS, but only for paths that were actually confirmed on Bunny
 * (the migratedPaths set) — never rewrites a URL to something that doesn't exist. */
async function rewriteUrls(migratedPaths) {
  let updatedRows = 0;
  for (const { table, idColumn, columns } of URL_COLUMNS) {
    const { data: rows, error } = await db.from(table).select([idColumn, ...columns].join(", "));
    if (error) {
      console.error(`  Fetch ${table} failed:`, error.message);
      continue;
    }
    for (const row of rows ?? []) {
      const patch = {};
      for (const col of columns) {
        const value = row[col];
        if (typeof value !== "string" || !value.startsWith(SUPABASE_PUBLIC_PREFIX)) continue;
        const path = decodeURIComponent(value.slice(SUPABASE_PUBLIC_PREFIX.length));
        if (!migratedPaths.has(path)) continue; // not confirmed on Bunny — leave untouched
        patch[col] = bunnyPublicUrl(path);
      }
      if (Object.keys(patch).length === 0) continue;
      if (!DRY_RUN) {
        const { error: upErr } = await db.from(table).update(patch).eq(idColumn, row[idColumn]);
        if (upErr) {
          console.error(`  Update failed for ${table} ${row[idColumn]}:`, upErr.message);
          continue;
        }
      }
      updatedRows++;
    }
  }
  return updatedRows;
}

async function run() {
  console.log(DRY_RUN ? "[DRY RUN] " : "", "Starting Supabase → Bunny storage migration...");

  console.log("Listing existing objects in Supabase Storage...");
  const paths = await listAllObjects("");
  console.log(`Found ${paths.length} object(s).`);

  const migrated = new Set();
  let copied = 0,
    skipped = 0,
    failed = 0;

  for (const path of paths) {
    try {
      if (await existsOnBunny(path)) {
        skipped++;
        migrated.add(path);
        continue;
      }
      if (!DRY_RUN) await copyToBunny(path);
      migrated.add(path);
      copied++;
      console.log(`  Copied: ${path}`);
    } catch (e) {
      failed++;
      console.error(`  FAILED: ${path} — ${e.message}`);
    }
  }

  console.log(`\nObjects: ${copied} copied, ${skipped} already on Bunny, ${failed} failed.`);

  console.log("\nRewriting database URLs...");
  const updatedRows = await rewriteUrls(migrated);
  console.log(
    `Rewrote ${updatedRows} row(s) across ${URL_COLUMNS.map((t) => t.table).join(", ")}.`,
  );

  if (DRY_RUN) {
    console.log("\n(Dry run — no files copied, no DB rows updated.)");
  } else {
    if (failed > 0) {
      console.log(
        `\n${failed} object(s) failed to copy — re-run this script to retry (already-copied files are skipped).`,
      );
    }
    console.log(
      "\nNext step: verify migrated content in the live app (video/audio playback + resume, " +
        "PDF viewing, QA screenshots) across several real items, then run the separate cleanup " +
        "step to remove the Supabase-handling code paths and delete the emptied Supabase bucket.",
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
