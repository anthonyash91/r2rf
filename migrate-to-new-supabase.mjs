/**
 * migrate-to-new-supabase.mjs
 *
 * Migrates all data from the old (Lovable-managed) Supabase project to a new
 * Supabase project you control.
 *
 * Usage:
 *   OLD_URL="https://old.supabase.co" \
 *   OLD_KEY="service_role_key_old" \
 *   NEW_URL="https://new.supabase.co" \
 *   NEW_KEY="service_role_key_new" \
 *   node migrate-to-new-supabase.mjs
 *
 * Prerequisites:
 *   - New Supabase project created
 *   - All migrations already applied to the new project (npx supabase db push --linked)
 *   - @supabase/supabase-js installed (already in package.json)
 *
 * After running:
 *   - Update your .env with the new project URL and keys
 *   - All users are created with the temporary password below — reset yours
 *     immediately and optionally send reset emails to other admin users.
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ─────────────────────────────────────────────────────────────────

const OLD_URL = process.env.OLD_URL;
const OLD_KEY = process.env.OLD_KEY;
const NEW_URL = process.env.NEW_URL;
const NEW_KEY = process.env.NEW_KEY;

// Every migrated user gets this temporary password. Change yours immediately
// after migration via the app's password-reset flow.
const TEMP_PASSWORD = "Migration2026!Temp";

// ─── Clients ─────────────────────────────────────────────────────────────────

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error(
    "Missing env vars. Set OLD_URL, OLD_KEY, NEW_URL, NEW_KEY before running."
  );
  process.exit(1);
}

const oldDb = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const newDb = createClient(NEW_URL, NEW_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[migrate] ${msg}`);
}

function warn(msg) {
  console.warn(`[warn]    ${msg}`);
}

/** Fetch every row from a table, paging through in chunks of 1000. */
async function fetchAll(client, table, select = "*") {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
      .order("id", { ascending: true });
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Fetch every row from a table that has no 'id' column to order by.
 * Uses a generic select without ordering.
 */
async function fetchAllUnordered(client, table, select = "*") {
  const rows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/**
 * Delete all rows from a table in the destination DB before inserting.
 * Uses a filter that matches every row (neq on a column that is never null).
 */
async function clearTable(client, table, { column = "id", type = "uuid" } = {}) {
  let q = client.from(table).delete();
  if (type === "uuid") {
    q = q.neq(column, "00000000-0000-0000-0000-000000000000");
  } else {
    // text PK — neq against a value that will never appear
    q = q.neq(column, "\x00");
  }
  const { error } = await q;
  if (error) warn(`  clear ${table}: ${error.message}`);
}

/** Insert rows in batches to stay under PostgREST's size limit. */
async function insertBatch(client, table, rows, batchSize = 500) {
  if (rows.length === 0) {
    log(`  ${table}: nothing to insert`);
    return;
  }
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await client.from(table).insert(batch);
    if (error) {
      throw new Error(
        `insertBatch ${table} (rows ${i}–${i + batch.length - 1}): ${error.message}`
      );
    }
  }
  log(`  ${table}: inserted ${rows.length} rows`);
}

/** Fetch all auth users from a project, paging through 1000 at a time. */
async function fetchAllAuthUsers(client) {
  const users = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    if (!data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  return users;
}

// ─── Migration steps ──────────────────────────────────────────────────────────

async function migrateSimpleTable(table, { orderById = true, clearColumn = "id", clearType = "uuid" } = {}) {
  log(`Migrating ${table}…`);
  const rows = orderById
    ? await fetchAll(oldDb, table)
    : await fetchAllUnordered(oldDb, table);
  await clearTable(newDb, table, { column: clearColumn, type: clearType });
  await insertBatch(newDb, table, rows);
}

async function migrateUsers() {
  log("Migrating auth users…");
  const users = await fetchAllAuthUsers(oldDb);
  log(`  found ${users.length} user(s)`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const { error } = await newDb.auth.admin.createUser({
      id: user.id, // preserve UUID so all FK references stay intact
      email: user.email,
      phone: user.phone ?? undefined,
      email_confirm: true,
      phone_confirm: true,
      password: TEMP_PASSWORD,
      user_metadata: user.user_metadata ?? {},
      app_metadata: user.app_metadata ?? {},
    });

    if (error) {
      if (error.message?.includes("already exists") || error.status === 422) {
        skipped++;
      } else {
        warn(`  user ${user.id} (${user.email}): ${error.message}`);
        skipped++;
      }
    } else {
      created++;
    }
  }

  log(`  auth users: ${created} created, ${skipped} skipped/already-exist`);
}

async function migrateSiteSettings() {
  log("Migrating site_settings…");
  const { data, error } = await oldDb.from("site_settings").select("*");
  if (error) {
    warn(`  site_settings: ${error.message} — skipping`);
    return;
  }
  if (!data?.length) {
    log("  site_settings: empty");
    return;
  }
  // site_settings uses a text 'key' PK, not a UUID
  await clearTable(newDb, "site_settings", { column: "key", type: "text" });
  await insertBatch(newDb, "site_settings", data);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Supabase Migration");
  console.log(`  FROM: ${OLD_URL}`);
  console.log(`  TO:   ${NEW_URL}`);
  console.log("=".repeat(60));
  console.log();

  // ── Tables with no FK dependencies ──────────────────────────────────────
  await migrateSimpleTable("facilities");
  await migrateSimpleTable("categories");
  await migrateSiteSettings();
  await migrateSimpleTable("ip_allowlist");

  // ── Tables that depend on categories/facilities ──────────────────────────
  await migrateSimpleTable("content_items");
  await migrateSimpleTable("custom_home_pages");
  await migrateSimpleTable("custom_home_page_categories");

  // ── content_item_facilities (new table — may be empty on old DB) ─────────
  log("Migrating content_item_facilities…");
  try {
    const rows = await fetchAllUnordered(oldDb, "content_item_facilities");
    await clearTable(newDb, "content_item_facilities", { column: "content_item_id", type: "uuid" });
    await insertBatch(newDb, "content_item_facilities", rows);
  } catch (e) {
    warn(`  content_item_facilities: ${e.message} — table may not exist on old DB yet, skipping`);
  }

  // ── Auth users (must come before any table with user_id FK) ─────────────
  await migrateUsers();

  // ── User-dependent tables ────────────────────────────────────────────────
  await migrateSimpleTable("user_profiles", { orderById: false, clearColumn: "user_id" });
  await migrateSimpleTable("user_roles", { orderById: false, clearColumn: "user_id" });
  await migrateSimpleTable("user_security_answers", { orderById: false, clearColumn: "user_id" });
  await migrateSimpleTable("user_logins", { orderById: false, clearColumn: "user_id" });
  await migrateSimpleTable("user_dismissed_messages", { orderById: false, clearColumn: "user_id" });

  // ── User activity tables ─────────────────────────────────────────────────
  log("Migrating user_content_progress…");
  try {
    const rows = await fetchAllUnordered(oldDb, "user_content_progress");
    await clearTable(newDb, "user_content_progress", { column: "user_id", type: "uuid" });
    await insertBatch(newDb, "user_content_progress", rows);
  } catch (e) {
    warn(`  user_content_progress: ${e.message}`);
  }

  log("Migrating user_content_seen…");
  try {
    const rows = await fetchAllUnordered(oldDb, "user_content_seen");
    await clearTable(newDb, "user_content_seen", { column: "user_id", type: "uuid" });
    await insertBatch(newDb, "user_content_seen", rows);
  } catch (e) {
    warn(`  user_content_seen: ${e.message}`);
  }

  // ── Attempt / rate-limit tables (optional, ok to skip) ──────────────────
  for (const t of ["signup_attempts", "ip_passkey_attempts", "password_reset_attempts"]) {
    try {
      await migrateSimpleTable(t);
    } catch (e) {
      warn(`  ${t}: ${e.message} — skipping`);
    }
  }

  // ── Log tables (large, skip if not needed) ───────────────────────────────
  for (const t of ["admin_audit_log", "analytics_events", "error_logs"]) {
    try {
      await migrateSimpleTable(t, false);
    } catch (e) {
      warn(`  ${t}: ${e.message} — skipping`);
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("  Migration complete!");
  console.log();
  console.log("  Next steps:");
  console.log("  1. Update your .env with the new project URL and keys");
  console.log(`  2. All users were created with password: ${TEMP_PASSWORD}`);
  console.log("  3. Log in as yourself and immediately change your password");
  console.log("  4. Reset any other admin/contributor passwords via the admin panel");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\n[FATAL]", err.message);
  process.exit(1);
});
