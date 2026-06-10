/**
 * migrate-pin-hashes.mjs
 *
 * Back-fills inmate_pin_hmac for any user_profiles row that has a plaintext
 * inmate_pin but no HMAC yet. Run this once after deploying the
 * 20260610000001_inmate_pin_hmac.sql migration.
 *
 * After this script completes and you verify all records have an HMAC, you can
 * clear the plaintext column with:
 *   UPDATE public.user_profiles SET inmate_pin = NULL WHERE inmate_pin_hmac IS NOT NULL;
 *
 * Usage:
 *   node migrate-pin-hashes.mjs
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SIGNUP_CHALLENGE_SECRET
 * in the environment (or a .env file in the project root).
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { readFileSync } from "fs";

// Load .env if present
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SIGNUP_CHALLENGE_SECRET } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!SIGNUP_CHALLENGE_SECRET || SIGNUP_CHALLENGE_SECRET.length < 32) {
  console.error("SIGNUP_CHALLENGE_SECRET must be set (min 32 chars).");
  process.exit(1);
}

function hashPin(pin) {
  return createHmac("sha256", SIGNUP_CHALLENGE_SECRET).update(pin.trim()).digest("hex");
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH = 500;

async function run() {
  let offset = 0;
  let total = 0;
  let updated = 0;

  console.log(DRY_RUN ? "[DRY RUN] " : "", "Starting PIN HMAC back-fill...");

  while (true) {
    const { data: rows, error } = await db
      .from("user_profiles")
      .select("user_id, inmate_pin")
      .not("inmate_pin", "is", null)
      .is("inmate_pin_hmac", null)
      .range(offset, offset + BATCH - 1);

    if (error) { console.error("Fetch error:", error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;

    total += rows.length;
    console.log(`  Processing batch of ${rows.length} (offset ${offset})...`);

    for (const row of rows) {
      if (!row.inmate_pin) continue;
      const hmac = hashPin(row.inmate_pin);
      if (!DRY_RUN) {
        const { error: upErr } = await db
          .from("user_profiles")
          .update({ inmate_pin_hmac: hmac })
          .eq("user_id", row.user_id);
        if (upErr) { console.error(`  Update failed for ${row.user_id}:`, upErr.message); continue; }
      }
      updated++;
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  console.log(`\nDone. Processed ${total} rows, updated ${updated}.`);
  if (DRY_RUN) console.log("(Dry run — no changes written.)");
  else console.log("\nNext step: verify all PINs have HMACs, then clear plaintext column:");
  console.log("  UPDATE public.user_profiles SET inmate_pin = NULL WHERE inmate_pin_hmac IS NOT NULL;");
}

run().catch((e) => { console.error(e); process.exit(1); });
