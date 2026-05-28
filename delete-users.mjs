/**
 * delete-users.mjs
 *
 * Deletes every auth user whose role in user_roles is "user".
 * Admins and contributors are left untouched.
 *
 * Usage:
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="service_role_key" \
 *   node delete-users.mjs
 *
 * Dry-run mode (lists users without deleting):
 *   DRY_RUN=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node delete-users.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("=".repeat(60));
  console.log(DRY_RUN ? "  DRY RUN — no changes will be made" : "  Deleting all users with role = \"user\"");
  console.log("=".repeat(60));

  // Fetch all user IDs with role "user"
  const { data: roleRows, error: roleErr } = await db
    .from("user_roles")
    .select("user_id")
    .eq("role", "user");

  if (roleErr) {
    console.error("Failed to fetch user roles:", roleErr.message);
    process.exit(1);
  }

  const userIds = (roleRows ?? []).map((r) => r.user_id);
  console.log(`\nFound ${userIds.length} user(s) with role "user".`);

  if (userIds.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Show who will be deleted
  const { data: profiles } = await db
    .from("user_profiles")
    .select("user_id, username, facility")
    .in("user_id", userIds);

  console.log("\nUsers to be deleted:");
  for (const p of profiles ?? []) {
    console.log(`  ${p.username ?? p.user_id}  (facility: ${p.facility ?? "—"})`);
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN complete — run without DRY_RUN=1 to actually delete.");
    return;
  }

  console.log("\nDeleting...");
  let deleted = 0;
  let failed = 0;

  for (const userId of userIds) {
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`  FAILED ${userId}: ${error.message}`);
      failed++;
    } else {
      deleted++;
      process.stdout.write(`\r  ${deleted}/${userIds.length} deleted...`);
    }
  }

  console.log(`\n\nDone. ${deleted} deleted, ${failed} failed.`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\n[FATAL]", err.message);
  process.exit(1);
});
