/**
 * update-sources.mjs
 *
 * 1. Adds realistic random sources to content items that have an empty source.
 * 2. Replaces the old PDF test URL with the new R2R Certificate Program PDF.
 *
 * Usage:
 *   node update-sources.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OLD_PDF = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780117653861-Alabama_State_Resources.pdf";
const NEW_PDF = "https://upcdn.io/223k24F/raw/uploads/R2R%20Certificate%20Program.pdf?v=1779121222006";

// Sources by category slug
const SOURCES_BY_CATEGORY = {
  "reentry-to-recovery": [
    "National Reentry Resource Center",
    "Vera Institute of Justice",
    "Justice Center — Council of State Governments",
    "Urban Institute — Justice Policy Center",
    "Bureau of Justice Assistance",
    "Annie E. Casey Foundation",
    "Reentry Council of the Midlands",
    "Second Chance Act",
    "U.S. Department of Justice",
  ],
  "mind-rehab": [
    "National Alliance on Mental Illness (NAMI)",
    "SAMHSA",
    "National Institute of Mental Health (NIMH)",
    "Mental Health America",
    "Crisis Text Line",
    "Substance Abuse and Mental Health Services Administration",
    "American Psychological Association",
    "Hazelden Betty Ford Foundation",
    "DBT-Linehan Board of Certification",
  ],
  "resources-partners": [
    "United Way Worldwide",
    "211 Helpline",
    "National Alliance to End Homelessness",
    "Food Research & Action Center",
    "Benefits.gov",
    "U.S. Department of Health & Human Services",
    "Community Action Partnership",
    "Catholic Charities USA",
    "Salvation Army",
  ],
  "narcotics-anonymous": [
    "Narcotics Anonymous World Services",
  ],
  "alcoholics-anonymous": [
    "Alcoholics Anonymous World Services",
  ],
  "personal-finance": [
    "Consumer Financial Protection Bureau (CFPB)",
    "National Foundation for Credit Counseling",
    "Jump$tart Coalition",
    "America Saves",
    "IRS Free File",
    "Federal Deposit Insurance Corporation (FDIC)",
    "MyMoney.gov",
    "National Endowment for Financial Education",
  ],
  "recovery": [
    "SAMHSA",
    "National Institute on Drug Abuse (NIDA)",
    "Faces & Voices of Recovery",
    "SMART Recovery",
    "Hazelden Betty Ford Foundation",
    "Partnership to End Addiction",
    "American Society of Addiction Medicine",
    "Recovery Research Institute — MGH",
    "Substance Abuse and Mental Health Services Administration",
  ],
  "health-and-wellness": [
    "Centers for Disease Control and Prevention (CDC)",
    "National Institutes of Health (NIH)",
    "National Institute on Drug Abuse (NIDA)",
    "Planned Parenthood",
    "Health Resources & Services Administration (HRSA)",
    "American Public Health Association",
    "National Sexual Violence Resource Center",
    "HealthFinder.gov",
  ],
  "ged": [
    "GED Testing Service",
    "Khan Academy",
    "ProLiteracy",
    "National Center for Education Statistics",
    "Literacy Council",
    "Adult Education and Literacy — U.S. Department of Education",
    "GED.com",
  ],
  "parenting": [
    "Child Welfare Information Gateway",
    "Parents as Teachers",
    "National Responsible Fatherhood Clearinghouse",
    "Zero to Three",
    "National Parent Helpline",
    "Children's Defense Fund",
    "Prevent Child Abuse America",
  ],
  "devotional-books": [
    "American Bible Society",
    "Chaplaincy Innovation Lab",
    "Prison Fellowship",
    "Good News Jail & Prison Ministry",
    "InnerChange Freedom Initiative",
  ],
  "books": [
    "Penguin Random House",
    "HarperCollins",
    "Simon & Schuster",
    "Macmillan Publishers",
    "Farrar, Straus and Giroux",
  ],
  "galleries-devotion": [
    "Prison Fellowship",
    "American Bible Society",
    "Arts in Corrections",
    "William James Association",
    "Chaplaincy Innovation Lab",
  ],
  "workforce-integration": [
    "U.S. Department of Labor",
    "CareerOneStop",
    "National Skills Coalition",
    "Jobs for the Future",
    "Center for Employment Opportunities (CEO)",
    "National Reentry Resource Center",
    "Bureau of Labor Statistics",
    "American Job Centers",
  ],
  "education": [
    "U.S. Department of Education",
    "Khan Academy",
    "National Center for Education Statistics",
    "ProLiteracy",
    "Community College Research Center",
    "Jobs for the Future",
    "Lumina Foundation",
    "American Association of Community Colleges",
  ],
  "cover-letter-resume": [
    "U.S. Department of Labor",
    "CareerOneStop",
    "Society for Human Resource Management (SHRM)",
    "LinkedIn",
    "Indeed",
    "Resume.com",
    "National Resume Writers' Association",
  ],
  "english-study-sheets": [
    "ProLiteracy",
    "Literacy Council",
    "Adult Education and Literacy — U.S. Department of Education",
    "Khan Academy",
    "National Institute for Literacy",
    "Reading Is Fundamental",
  ],
  "math-study-sheets": [
    "Khan Academy",
    "GED Testing Service",
    "National Council of Teachers of Mathematics",
    "Adult Education and Literacy — U.S. Department of Education",
    "Math.com",
    "Everyday Mathematics",
  ],
  "legal-information": [
    "The Legal Aid Society",
    "ACLU",
    "National Reentry Resource Center",
    "Vera Institute of Justice",
    "The Sentencing Project",
    "Justice Center — Council of State Governments",
    "LawHelp.org",
    "Equal Justice Initiative",
  ],
  "learning-center": [
    "Khan Academy",
    "Coursera",
    "edX",
    "U.S. Department of Labor",
    "National Skills Coalition",
    "Literacy Council",
    "CareerOneStop",
    "Jobs for the Future",
    "American Library Association",
  ],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // ── Step 1: Update PDF URLs ─────────────────────────────────────────
  console.log("🔄 Replacing old PDF URL with new R2R PDF...");

  const { data: pdfItems, error: pdfFetchErr } = await db
    .from("content_items")
    .select("id")
    .eq("url", OLD_PDF);

  if (pdfFetchErr) {
    console.error("  ❌ Error fetching PDF items:", pdfFetchErr.message);
  } else if (!pdfItems?.length) {
    console.log("  ℹ️  No items found with the old PDF URL.");
  } else {
    const ids = pdfItems.map((r) => r.id);
    const { error: pdfUpdateErr } = await db
      .from("content_items")
      .update({ url: NEW_PDF })
      .in("id", ids);

    if (pdfUpdateErr) {
      console.error("  ❌ Error updating PDF URLs:", pdfUpdateErr.message);
    } else {
      console.log(`  ✅ Updated ${ids.length} items to new PDF URL.`);
    }
  }

  // ── Step 2: Add sources ─────────────────────────────────────────────
  console.log("\n🏷️  Adding sources to items with empty source...");

  // Fetch all items with empty source along with their category slug
  const { data: items, error: fetchErr } = await db
    .from("content_items")
    .select("id, category_id, categories!inner(slug)")
    .eq("source", "");

  if (fetchErr) {
    console.error("  ❌ Error fetching items:", fetchErr.message);
    process.exit(1);
  }

  if (!items?.length) {
    console.log("  ℹ️  No items with empty source found.");
    return;
  }

  console.log(`  Found ${items.length} items to update.`);

  // Batch updates by category to minimize round-trips
  const byCategory = {};
  for (const item of items) {
    const slug = item.categories?.slug ?? "learning-center";
    if (!byCategory[slug]) byCategory[slug] = [];
    byCategory[slug].push(item.id);
  }

  let updated = 0;
  for (const [slug, ids] of Object.entries(byCategory)) {
    const pool = SOURCES_BY_CATEGORY[slug] ?? SOURCES_BY_CATEGORY["learning-center"];

    // Update each item individually to assign different random sources
    for (const id of ids) {
      const source = pick(pool);
      const { error } = await db
        .from("content_items")
        .update({ source })
        .eq("id", id);

      if (error) {
        console.error(`  ❌ Error updating item ${id}:`, error.message);
      } else {
        updated++;
      }
    }

    console.log(`  ✅ ${slug}: updated ${ids.length} items`);
  }

  console.log(`\n✅ Done. ${updated} items updated with sources.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
