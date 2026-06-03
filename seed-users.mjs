/**
 * seed-users.mjs
 *
 * Seeds 400 realistic test users with varied profiles, facilities, content
 * completion, session engagement, login history, and analytics events.
 *
 * Usage:
 *   node seed-users.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// ── Load .env ────────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const datesBetween = (startDaysAgo, endDaysAgo, count) => {
  const results = new Set();
  const range = startDaysAgo - endDaysAgo;
  while (results.size < count) {
    const d = new Date(Date.now() - (endDaysAgo + Math.random() * range) * 86400000);
    results.add(d.toISOString().slice(0, 10));
  }
  return [...results].sort();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Name data ────────────────────────────────────────────────────────────────
const FIRST_M = ["James","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Kenneth","Joshua","Kevin","Brian","George","Edward","Ronald","Timothy","Jason","Jeffrey","Ryan","Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Scott","Brandon","Benjamin","Samuel","Frank","Gregory","Raymond","Alexander","Patrick","Jack","Dennis","Jerry","Tyler","Aaron","Henry","Douglas","Adam","Nathan","Peter","Zachary","Walter","Harold","Kyle","Carl","Arthur","Gerald","Roger","Keith","Jeremy","Terry","Lawrence","Sean","Joe","Jordan","Billy","Albert","Dylan","Willie","Jesse","Bryan","Bruce","Noah","Ethan","Alan","Juan","Wayne","Roy","Ralph","Randy","Eugene","Vincent","Russell","Elijah","Bobby","Louis","Philip","Marcus"];
const FIRST_F = ["Mary","Patricia","Jennifer","Linda","Barbara","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna","Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia","Kathleen","Shirley","Amy","Angela","Helen","Anna","Brenda","Pamela","Emma","Nicole","Ruth","Katherine","Christina","Virginia","Catherine","Diane","Julie","Joyce","Victoria","Kelly","Christina","Lauren","Joan","Evelyn","Olivia","Judith","Megan","Cheryl","Martha","Andrea","Frances","Hannah","Jacqueline","Gloria","Teresa","Kathryn","Samantha","Grace","Maria","Amber","Debra","Sara","Denise","Carolyn","Alice","Rachel","Heather","Janet","Christine","Beverly","Tiffany","Brittany","Danielle","Diana","Natalie","Madison","Theresa","Shannon","Norma","Paula","Vanessa","Annie","Tammy","Donna","Rosa","Christine","Miranda"];
const LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Phillips","Evans","Turner","Torres","Parker","Collins","Edwards","Stewart","Flores","Morris","Nguyen","Murphy","Rivera","Cook","Rogers","Morgan","Peterson","Cooper","Reed","Bailey","Bell","Gomez","Kelly","Howard","Ward","Cox","Diaz","Richardson","Wood","Watson","Brooks","Bennett","Gray","James","Reyes","Cruz","Hughes","Price","Myers","Long","Foster","Sanders","Ross","Morales","Powell","Sullivan","Russell","Ortiz","Jenkins","Gutierrez","Perry","Butler","Barnes","Fisher"];

// ── Facility weights (heavier = more users) ───────────────────────────────────
const FACILITY_POOL = [
  { value: "kootenai_id",        label: "Kootenai, ID",        weight: 5 },
  { value: "jefferson_tx",       label: "Jefferson, TX",        weight: 5 },
  { value: "campbell_ky",        label: "Campbell, KY",         weight: 5 },
  { value: "pennington_sd",      label: "Pennington, SD",       weight: 5 },
  { value: "twin_falls_id",      label: "Twin Falls, ID",       weight: 5 },
  { value: "boone_ky",           label: "Boone, KY",            weight: 3 },
  { value: "brazos_tx",          label: "Brazos, TX",           weight: 3 },
  { value: "canyon_id",          label: "Canyon, ID",           weight: 3 },
  { value: "champaign_il",       label: "Champaign, IL",        weight: 3 },
  { value: "kenton_ky",          label: "Kenton, KY",           weight: 3 },
  { value: "walla_walla_wa",     label: "Walla Walla, WA",      weight: 3 },
  { value: "hall_ga",            label: "Hall, GA",             weight: 3 },
  { value: "elmore_id",          label: "Elmore, ID",           weight: 2 },
  { value: "adams_il",           label: "Adams, IL",            weight: 2 },
  { value: "arenac_mi",          label: "Arenac, MI",           weight: 2 },
  { value: "cherokee_ga",        label: "Cherokee, GA",         weight: 2 },
  { value: "jefferson_wa",       label: "Jefferson, WA",        weight: 2 },
  { value: "klamath_or",         label: "Klamath, OR",          weight: 2 },
  { value: "livingston_il",      label: "Livingston, IL",       weight: 1 },
  { value: "mason_wa",           label: "Mason, WA",            weight: 1 },
  { value: "nez_perce_id",       label: "Nez Perce, ID",        weight: 1 },
  { value: "payette_id",         label: "Payette, ID",          weight: 1 },
  { value: "stevens_wa",         label: "Stevens, WA",          weight: 1 },
  { value: "tillamook_or",       label: "Tillamook, OR",        weight: 1 },
  { value: "mifflin_pa",         label: "Mifflin, PA",          weight: 1 },
];

function weightedFacility() {
  const total = FACILITY_POOL.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FACILITY_POOL) {
    r -= f.weight;
    if (r <= 0) return f.value;
  }
  return FACILITY_POOL[0].value;
}

// ── User type profiles ────────────────────────────────────────────────────────
const TYPES = [
  { type: "power",   weight: 10, joinMin: 200, joinMax: 420, completionMin: 0.70, completionMax: 1.0,  loginDensity: 0.85, catsMin: 8,  catsMax: 20, sessionMin: 300,  sessionMax: 1200 },
  { type: "active",  weight: 25, joinMin: 90,  joinMax: 360, completionMin: 0.35, completionMax: 0.70, loginDensity: 0.45, catsMin: 5,  catsMax: 12, sessionMin: 120,  sessionMax: 600  },
  { type: "casual",  weight: 35, joinMin: 45,  joinMax: 300, completionMin: 0.10, completionMax: 0.35, loginDensity: 0.18, catsMin: 2,  catsMax: 7,  sessionMin: 60,   sessionMax: 300  },
  { type: "new",     weight: 20, joinMin: 3,   joinMax: 45,  completionMin: 0.01, completionMax: 0.12, loginDensity: 0.40, catsMin: 1,  catsMax: 4,  sessionMin: 30,   sessionMax: 180  },
  { type: "churned", weight: 10, joinMin: 200, joinMax: 450, completionMin: 0.01, completionMax: 0.08, loginDensity: 0.03, catsMin: 1,  catsMax: 3,  sessionMin: 30,   sessionMax: 120  },
];

function pickType() {
  const total = TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of TYPES) { r -= t.weight; if (r <= 0) return t; }
  return TYPES[0];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Fetching content...");
  const { data: items } = await db
    .from("content_items")
    .select("id, category_id, type")
    .eq("published", true);

  const { data: categories } = await db
    .from("categories")
    .select("id")
    .eq("published", true);

  // Group items by category
  const itemsByCat = {};
  for (const item of items) {
    if (!itemsByCat[item.category_id]) itemsByCat[item.category_id] = [];
    itemsByCat[item.category_id].push(item);
  }
  const catIds = categories.map((c) => c.id);

  console.log(`Found ${items.length} items across ${catIds.length} categories.\n`);

  const TOTAL = 400;
  let created = 0;

  // Accumulators for batch inserts
  const allProfiles = [];
  const allRoles = [];
  const allLogins = [];
  const allProgress = [];
  const allEngagement = [];
  const allEvents = [];

  const usedUsernames = new Set();
  const usedPins = new Set();

  function uniqueUsername(first, last) {
    const base = `${first.toLowerCase().slice(0, 1)}${last.toLowerCase().replace(/[^a-z]/g, "").slice(0, 7)}`;
    let u = base;
    let i = 1;
    while (usedUsernames.has(u)) { u = `${base}${i++}`; }
    usedUsernames.add(u);
    return u;
  }

  function uniquePin() {
    let p;
    do { p = String(randInt(100000, 999999)); } while (usedPins.has(p));
    usedPins.add(p);
    return p;
  }

  // ── Create auth users ────────────────────────────────────────────────────
  console.log(`Creating ${TOTAL} auth users...`);
  const authUsers = [];

  for (let i = 0; i < TOTAL; i++) {
    const isFemale = Math.random() < 0.35;
    const firstName = isFemale ? pick(FIRST_F) : pick(FIRST_M);
    const lastName = pick(LAST);
    const username = uniqueUsername(firstName, lastName);
    const email = `${username}@users.local`;
    const pin = uniquePin();
    const facility = weightedFacility();
    const profile = pickType();
    const joinDaysAgo = randInt(profile.joinMin, profile.joinMax);
    const joinedAt = daysAgo(joinDaysAgo);

    const { data: authUser, error } = await db.auth.admin.createUser({
      email,
      password: "Reentry2024!",
      email_confirm: true,
      user_metadata: { is_synthetic: false },
      created_at: joinedAt,
    });

    if (error) {
      console.error(`  ❌ Failed ${username}: ${error.message}`);
      continue;
    }

    authUsers.push({ id: authUser.user.id, username, firstName, lastName, facility, pin, profile, joinDaysAgo, joinedAt });
    created++;

    if (created % 20 === 0) {
      process.stdout.write(`  ${created}/${TOTAL} users created...\r`);
      await sleep(200); // gentle rate-limit pause
    }
  }
  console.log(`\n✅ Created ${created} auth users.\n`);

  // ── Build batch data ─────────────────────────────────────────────────────
  console.log("Building profile, login, progress, and event data...");

  for (const u of authUsers) {
    const { id, username, firstName, lastName, facility, pin, profile, joinDaysAgo, joinedAt } = u;

    // Profile
    allProfiles.push({
      user_id: id,
      username,
      first_name: firstName,
      last_name: lastName,
      facility,
      inmate_pin: pin,
      is_synthetic: false,
      created_at: joinedAt,
    });

    // Role
    allRoles.push({ user_id: id, role: "user", created_at: joinedAt });

    // Login history
    const loginCount = Math.max(1, Math.round(joinDaysAgo * profile.loginDensity));
    // Churned users: logins only in first 20% of their time
    const loginWindowEnd = profile.type === "churned" ? Math.floor(joinDaysAgo * 0.8) : 1;
    const loginDates = datesBetween(joinDaysAgo, loginWindowEnd, Math.min(loginCount, joinDaysAgo));
    for (const date of loginDates) {
      allLogins.push({ user_id: id, login_date: date });
    }

    // Content: pick categories to engage with
    const numCats = randInt(profile.catsMin, Math.min(profile.catsMax, catIds.length));
    const engagedCats = shuffle(catIds).slice(0, numCats);

    for (const catId of engagedCats) {
      const catItems = itemsByCat[catId] ?? [];
      if (!catItems.length) continue;

      // Category view event
      const viewDate = daysAgo(randInt(1, joinDaysAgo));
      allEvents.push({
        user_id: id,
        event_type: "category_view",
        category_id: catId,
        content_id: null,
        created_at: viewDate,
      });

      // Determine how many items in this category to complete
      const completionRate = rand(profile.completionMin, profile.completionMax);
      const numComplete = Math.floor(catItems.length * completionRate);
      const numViewed = Math.min(catItems.length, numComplete + randInt(0, Math.ceil(catItems.length * 0.15)));
      const shuffled = shuffle(catItems);
      const toComplete = shuffled.slice(0, numComplete);
      const toView = shuffled.slice(numComplete, numViewed);

      // Completed items
      for (const item of toComplete) {
        const completedAt = daysAgo(randInt(1, joinDaysAgo));
        allProgress.push({
          user_id: id,
          content_item_id: item.id,
          category_id: catId,
          created_at: completedAt,
        });

        // Content click event
        allEvents.push({
          user_id: id,
          event_type: "content_click",
          category_id: catId,
          content_id: item.id,
          created_at: completedAt,
        });

        // Engagement (session time)
        const isMedia = ["Video", "Audio", "Podcast"].includes(item.type);
        const sessionSecs = randInt(profile.sessionMin, profile.sessionMax);
        const mediaDuration = isMedia ? randInt(300, 1800) : null;
        const mediaProgress = isMedia ? Math.min(mediaDuration, Math.floor(mediaDuration * rand(0.85, 1.0))) : null;

        allEngagement.push({
          user_id: id,
          content_item_id: item.id,
          category_id: catId,
          session_seconds: sessionSecs,
          media_progress_seconds: mediaProgress,
          media_duration_seconds: mediaDuration,
          manual_completion_pct: null,
          last_updated_at: completedAt,
          created_at: completedAt,
        });
      }

      // Viewed but not completed items
      for (const item of toView) {
        const viewedAt = daysAgo(randInt(1, joinDaysAgo));
        allEvents.push({
          user_id: id,
          event_type: "content_click",
          category_id: catId,
          content_id: item.id,
          created_at: viewedAt,
        });

        // Partial engagement
        const isMedia = ["Video", "Audio", "Podcast"].includes(item.type);
        const sessionSecs = randInt(30, profile.sessionMin);
        const mediaDuration = isMedia ? randInt(300, 1800) : null;
        const mediaProgress = isMedia ? Math.floor(mediaDuration * rand(0.05, 0.80)) : null;

        allEngagement.push({
          user_id: id,
          content_item_id: item.id,
          category_id: catId,
          session_seconds: sessionSecs,
          media_progress_seconds: mediaProgress,
          media_duration_seconds: mediaDuration,
          manual_completion_pct: null,
          last_updated_at: viewedAt,
          created_at: viewedAt,
        });
      }
    }
  }

  // ── Batch insert ─────────────────────────────────────────────────────────
  const CHUNK = 500;
  async function batchInsert(table, rows, label) {
    if (!rows.length) { console.log(`  ⏭️  ${label}: 0 rows`); return; }
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await db.from(table).insert(chunk);
      if (error) console.error(`  ❌ ${label} chunk error: ${error.message}`);
      else inserted += chunk.length;
    }
    console.log(`  ✅ ${label}: ${inserted} rows`);
  }

  console.log("\nInserting data in batches...");
  await batchInsert("user_profiles", allProfiles, "user_profiles");
  await batchInsert("user_roles", allRoles, "user_roles");
  await batchInsert("user_logins", allLogins, "user_logins");
  await batchInsert("user_content_progress", allProgress, "user_content_progress");
  await batchInsert("user_content_engagement", allEngagement, "user_content_engagement");
  await batchInsert("analytics_events", allEvents, "analytics_events");

  console.log(`
✅ Seed complete.
   Users:       ${authUsers.length}
   Logins:      ${allLogins.length}
   Completions: ${allProgress.length}
   Engagements: ${allEngagement.length}
   Events:      ${allEvents.length}
`);
}

main().catch((err) => { console.error(err); process.exit(1); });
