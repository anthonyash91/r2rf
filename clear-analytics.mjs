/**
 * clear-analytics.mjs
 *
 * Wipes all analytics data: raw events + pre-aggregated daily counts.
 *
 * Usage:
 *   SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="service_role_key" \
 *   node clear-analytics.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const tables = [
    { name: "analytics_events",        col: "id",         sentinel: null,       method: "not_null" },
    { name: "analytics_daily_counts",  col: "event_type", sentinel: "__never__", method: "neq"      },
    { name: "user_content_progress",   col: "user_id",    sentinel: null,       method: "not_null" },
    { name: "user_content_seen",       col: "user_id",    sentinel: null,       method: "not_null" },
  ];

  for (const t of tables) {
    process.stdout.write(`Clearing ${t.name}... `);
    let q = db.from(t.name).delete();
    q = t.method === "neq" ? q.neq(t.col, t.sentinel) : q.not(t.col, "is", null);
    const { error } = await q;
    if (error) throw new Error(`${t.name}: ${error.message}`);
    console.log("Done.");
  }

  console.log("\nAll analytics and progress data cleared — starting fresh.");
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
