/**
 * seed-content.mjs
 *
 * Seeds fake content items into all published categories for testing.
 *
 * Usage:
 *   node seed-content.mjs
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment.
 * You can dot-source your .env first:
 *   export $(grep -v '^#' .env | xargs) && node seed-content.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env manually
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

const VIDEO_URL = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780164093600-Managing_Anxiety_While_Doing_Time.mp4";
const PDF_URL   = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780117653861-Alabama_State_Resources.pdf";
const AUDIO_URL = "https://civhmjsatmloowfvxsoy.supabase.co/storage/v1/object/public/content-files/uploads/1780223307034-04_Preface.m4a";

function url(type) {
  if (type === "Video") return VIDEO_URL;
  if (type === "Audio" || type === "Podcast") return AUDIO_URL;
  return PDF_URL;
}

// category_id → array of { title, type, duration, description, source }
const CONTENT = {

  // ── Reentry to Recovery (18) ─────────────────────────────────────────
  "30f11c4d-5c79-4291-b247-cc0781a0bdd9": [
    { title: "What to Expect Your First Week Out", type: "Video", duration: "14 min", description: "A practical walkthrough of the first seven days after release — what to prioritize, what to avoid, and how to start strong." },
    { title: "Building Your Support Network", type: "Video", duration: "18 min", description: "How to identify trustworthy people in your life and build a network that supports your reentry goals." },
    { title: "Housing Resources After Release", type: "Guide", duration: "20 min", description: "An overview of transitional housing, halfway houses, and Section 8 options available to returning citizens." },
    { title: "Your Rights as a Returning Citizen", type: "PDF", duration: "25 min", description: "Know your legal rights during reentry — from employment protections to housing discrimination laws." },
    { title: "Creating a 90-Day Reentry Plan", type: "Worksheet", duration: "30 min", description: "A step-by-step worksheet for mapping your first 90 days: housing, employment, benefits, and support." },
    { title: "Navigating Government Benefits After Release", type: "Guide", duration: "22 min", description: "Which benefits you qualify for immediately after release and how to apply for SNAP, Medicaid, and SSI." },
    { title: "How to Replace Your ID and Social Security Card", type: "Video", duration: "10 min", description: "Step-by-step guide to replacing key identification documents you'll need to access services and employment." },
    { title: "Transportation Options in Your Community", type: "Article", duration: "8 min", description: "How to get around using public transit, bus passes, and community transportation programs." },
    { title: "Building a Positive Daily Routine", type: "Video", duration: "16 min", description: "Why structure matters in early reentry and how to build a daily routine that supports your recovery and goals." },
    { title: "Understanding Your Supervision Requirements", type: "Guide", duration: "12 min", description: "A clear explanation of parole and probation conditions, check-ins, and how to avoid violations." },
    { title: "Community Resource Directory Overview", type: "PDF", duration: "15 min", description: "How to use local 211 services and resource directories to find food, shelter, healthcare, and more." },
    { title: "Overcoming Barriers to Employment", type: "Video", duration: "20 min", description: "Strategies for addressing criminal history on applications and in interviews, and finding fair-chance employers." },
    { title: "Reentry Success Stories", type: "Video", duration: "24 min", description: "Real stories from people who navigated reentry successfully — their challenges, strategies, and turning points." },
    { title: "First 24 Hours After Release Checklist", type: "Worksheet", duration: "10 min", description: "A practical checklist for your first day: who to call, where to go, and what to do right away." },
    { title: "Staying Motivated Through Setbacks", type: "Article", duration: "10 min", description: "Reentry rarely goes perfectly. This article explores how to stay motivated when things don't go as planned." },
    { title: "Connecting with Peer Mentors", type: "Guide", duration: "12 min", description: "How to find and connect with peer mentors who have been through reentry and can offer guidance." },
    { title: "Trauma and Reentry: What You Need to Know", type: "Video", duration: "19 min", description: "How unresolved trauma affects reentry outcomes and the resources available to address it." },
    { title: "Family Reunification After Incarceration", type: "PDF", duration: "18 min", description: "Guidance on rebuilding family relationships, addressing trust issues, and navigating custody and visitation." },
  ],

  // ── MindRehab (22) ───────────────────────────────────────────────────
  "004e17ab-362f-4ab5-8501-ef039c0602f9": [
    { title: "Understanding PTSD and Trauma", type: "Video", duration: "22 min", description: "An accessible introduction to post-traumatic stress disorder, its causes, and how it shows up in daily life." },
    { title: "Cognitive Behavioral Therapy Basics", type: "Video", duration: "28 min", description: "Learn the foundational techniques of CBT and how to use them to change negative thought patterns." },
    { title: "Mindfulness Meditation for Beginners", type: "Audio", duration: "15 min", description: "A guided mindfulness session designed for people new to meditation — no experience required." },
    { title: "Managing Anxiety in High-Stress Situations", type: "Video", duration: "17 min", description: "Practical tools for managing anxiety in everyday situations like job interviews, supervision meetings, and family stress." },
    { title: "Depression: What It Is and How to Cope", type: "Article", duration: "12 min", description: "A plain-language explanation of depression and evidence-based strategies for managing it without medication." },
    { title: "Box Breathing for Stress Relief", type: "Audio", duration: "8 min", description: "A guided breathing exercise used by first responders and therapists to quickly reduce stress and anxiety." },
    { title: "DBT Skills: Distress Tolerance", type: "Video", duration: "25 min", description: "Core Dialectical Behavior Therapy distress tolerance skills — TIPP, ACCEPTS, and self-soothe techniques." },
    { title: "Journaling for Mental Health", type: "Worksheet", duration: "20 min", description: "Guided prompts and frameworks for using journaling as a tool for emotional processing and self-awareness." },
    { title: "Understanding Trauma Responses", type: "Video", duration: "20 min", description: "Why people react differently to trauma, and how the fight-flight-freeze response affects your behavior." },
    { title: "Building Emotional Resilience", type: "Guide", duration: "22 min", description: "What resilience is, what it isn't, and practical ways to build it through small daily practices." },
    { title: "Sleep Hygiene for Better Mental Health", type: "Article", duration: "10 min", description: "How sleep affects mental health and 10 practical strategies for improving your sleep quality." },
    { title: "Anger Management Techniques", type: "Video", duration: "19 min", description: "Healthy ways to recognize, process, and express anger without damaging your relationships or your progress." },
    { title: "Developing a Positive Self-Image", type: "Video", duration: "16 min", description: "How to challenge negative beliefs about yourself and begin to see yourself differently." },
    { title: "Grounding Techniques for Anxiety", type: "Worksheet", duration: "15 min", description: "The 5-4-3-2-1 grounding method and other sensory techniques to bring yourself back when anxiety spikes." },
    { title: "Understanding Bipolar Disorder", type: "Article", duration: "14 min", description: "A clear overview of bipolar disorder, its types, and how people manage it effectively with support." },
    { title: "Medication and Mental Health: What to Know", type: "Video", duration: "18 min", description: "How psychiatric medications work, what to expect, and how to communicate with your prescriber." },
    { title: "Finding Mental Health Services After Release", type: "Guide", duration: "15 min", description: "How to access low-cost or free mental health services using Medicaid, community health centers, and telehealth." },
    { title: "Peer Support for Mental Health", type: "Video", duration: "21 min", description: "How peer support programs work and why connecting with people with lived experience can be as powerful as therapy." },
    { title: "Mindfulness Body Scan", type: "Audio", duration: "20 min", description: "A guided body scan meditation to release tension, increase body awareness, and promote relaxation." },
    { title: "Setting Healthy Boundaries", type: "Video", duration: "23 min", description: "What boundaries are, why they matter in recovery, and how to set and communicate them effectively." },
    { title: "The Mind-Body Connection", type: "Article", duration: "11 min", description: "How emotional health and physical health are linked, and why caring for one always affects the other." },
    { title: "Crisis Resources and When to Call for Help", type: "Guide", duration: "10 min", description: "A guide to recognizing a mental health crisis and the resources available — including 988, crisis lines, and ERs." },
  ],

  // ── Resources & Partners (15) ─────────────────────────────────────────
  "b4092308-6ad6-4ce9-990d-62989d9792a8": [
    { title: "How to Use 211 to Find Local Resources", type: "Video", duration: "8 min", description: "A walkthrough of the 211 helpline and website — the fastest way to find local food, housing, and services." },
    { title: "State Resource Guide Overview", type: "PDF", duration: "20 min", description: "A comprehensive guide to state-level reentry resources including housing, benefits, legal aid, and healthcare." },
    { title: "Food Pantries and Food Banks Near You", type: "Guide", duration: "12 min", description: "How to locate and access local food pantries, food banks, and free meal programs in your area." },
    { title: "Healthcare for Returning Citizens", type: "Article", duration: "10 min", description: "How to access primary care, dental, vision, and mental health services after release using Medicaid." },
    { title: "Clothing and Household Item Assistance", type: "Guide", duration: "8 min", description: "Where to find free or low-cost clothing, furniture, and household items through thrift programs and nonprofits." },
    { title: "Emergency Financial Assistance Programs", type: "PDF", duration: "15 min", description: "Programs that provide emergency cash, utility assistance, and rent support for people in financial crisis." },
    { title: "Legal Aid Organizations in Your State", type: "Guide", duration: "14 min", description: "How to find free or low-cost legal help for reentry-related issues including housing, employment, and expungement." },
    { title: "Faith-Based Reentry Programs", type: "Article", duration: "10 min", description: "How faith-based organizations provide reentry support, and how to connect with them regardless of your beliefs." },
    { title: "Community Centers and Drop-In Programs", type: "Guide", duration: "12 min", description: "Local community centers that offer drop-in services including showers, phone charging, mail, and case management." },
    { title: "Veteran-Specific Reentry Resources", type: "PDF", duration: "18 min", description: "VA benefits, veteran treatment courts, and veteran-specific reentry programs available to those who served." },
    { title: "Peer Navigation Programs Explained", type: "Video", duration: "14 min", description: "What peer navigation programs are and how a peer navigator can help you access services after release." },
    { title: "Applying for Medicaid After Release", type: "Video", duration: "11 min", description: "Step-by-step guide to applying for Medicaid immediately after release to access healthcare coverage." },
    { title: "How to Find a Recovery Coach", type: "Guide", duration: "10 min", description: "What recovery coaches do, how they differ from counselors, and how to find one in your community." },
    { title: "Social Services Application Checklist", type: "Worksheet", duration: "15 min", description: "A checklist of documents and information you'll need when applying for SNAP, Medicaid, housing assistance, and more." },
    { title: "Reentry Organization Directory", type: "PDF", duration: "10 min", description: "A directory of national and regional reentry organizations offering services to returning citizens and their families." },
  ],

  // ── Narcotics Anonymous (12) ──────────────────────────────────────────
  "a29f6fa7-eb79-4a66-8263-6654dba0d6ca": [
    { title: "Introduction to Narcotics Anonymous", type: "Video", duration: "18 min", description: "An overview of what NA is, how meetings work, and what you can expect when you attend your first meeting.", source: "Narcotics Anonymous World Services" },
    { title: "The 12 Steps of Narcotics Anonymous", type: "PDF", duration: "25 min", description: "The complete 12 Steps of NA with explanations of what each step means and how to work them.", source: "Narcotics Anonymous World Services" },
    { title: "Finding an NA Meeting", type: "Guide", duration: "8 min", description: "How to find NA meetings in your area, including in-person and online options.", source: "Narcotics Anonymous World Services" },
    { title: "NA Step One: Admitting Powerlessness", type: "Audio", duration: "22 min", description: "A deep exploration of Step One — admitting powerlessness over addiction and that life had become unmanageable.", source: "Narcotics Anonymous World Services" },
    { title: "NA Step Four: A Searching Moral Inventory", type: "Worksheet", duration: "30 min", description: "Guided questions and prompts to help you complete your Fourth Step moral inventory.", source: "Narcotics Anonymous World Services" },
    { title: "Choosing a Sponsor in NA", type: "Video", duration: "14 min", description: "What a sponsor is, what to look for, and how the sponsor-sponsee relationship works in Narcotics Anonymous.", source: "Narcotics Anonymous World Services" },
    { title: "Using the NA White Book", type: "Guide", duration: "12 min", description: "An introduction to NA's primary text, the White Book, and how to use it in your recovery.", source: "Narcotics Anonymous World Services" },
    { title: "Recovery from Addiction: Personal Stories", type: "Podcast", duration: "35 min", description: "Voices from the NA fellowship sharing their experience, strength, and hope in recovery.", source: "Narcotics Anonymous World Services" },
    { title: "The NA Serenity Prayer", type: "Article", duration: "8 min", description: "The history and meaning behind the Serenity Prayer and its role in NA recovery.", source: "Narcotics Anonymous World Services" },
    { title: "Service in NA: Why It Matters", type: "Video", duration: "16 min", description: "How service to others is central to the NA program and how to get involved in your group.", source: "Narcotics Anonymous World Services" },
    { title: "Relapse and Recovery in NA", type: "Video", duration: "20 min", description: "An honest conversation about relapse — what it means in NA, how to come back, and how the fellowship supports you.", source: "Narcotics Anonymous World Services" },
    { title: "NA for Incarcerated People", type: "PDF", duration: "15 min", description: "Information about NA meetings in correctional facilities and how to continue your NA journey after release.", source: "Narcotics Anonymous World Services" },
  ],

  // ── Alcoholics Anonymous (14) ─────────────────────────────────────────
  "9eb59417-58aa-4572-be55-d323d73edef8": [
    { title: "Introduction to Alcoholics Anonymous", type: "Video", duration: "16 min", description: "What AA is, how it works, and what you can expect at your first meeting.", source: "Alcoholics Anonymous World Services" },
    { title: "The 12 Steps of Alcoholics Anonymous", type: "PDF", duration: "25 min", description: "The complete 12 Steps with explanations and reflections for people new to AA.", source: "Alcoholics Anonymous World Services" },
    { title: "The Big Book: An Introduction", type: "Guide", duration: "20 min", description: "An overview of Alcoholics Anonymous (The Big Book) — its history, purpose, and how to use it.", source: "Alcoholics Anonymous World Services" },
    { title: "Finding an AA Meeting", type: "Guide", duration: "8 min", description: "How to find AA meetings in person or online, including open and closed meetings explained.", source: "Alcoholics Anonymous World Services" },
    { title: "AA Step One: Admitting Powerlessness", type: "Audio", duration: "20 min", description: "An exploration of Step One and what it truly means to admit powerlessness over alcohol.", source: "Alcoholics Anonymous World Services" },
    { title: "Working the Steps with a Sponsor", type: "Video", duration: "18 min", description: "How the sponsor relationship works in AA and how to get the most from working the steps together.", source: "Alcoholics Anonymous World Services" },
    { title: "AA Step Eight and Nine: Making Amends", type: "Worksheet", duration: "30 min", description: "Guided reflection on Steps Eight and Nine — making a list of people harmed and making direct amends.", source: "Alcoholics Anonymous World Services" },
    { title: "Sobriety and Relationships", type: "Article", duration: "12 min", description: "How sobriety affects relationships and practical advice for navigating family and romantic relationships in recovery.", source: "Alcoholics Anonymous World Services" },
    { title: "AA in Correctional Facilities", type: "PDF", duration: "14 min", description: "Information about AA programs inside correctional facilities and how to continue your recovery after release.", source: "Alcoholics Anonymous World Services" },
    { title: "Gratitude in Recovery", type: "Podcast", duration: "28 min", description: "AA members share how practicing gratitude has transformed their recovery and daily lives.", source: "Alcoholics Anonymous World Services" },
    { title: "The AA Twelve Traditions", type: "Article", duration: "15 min", description: "An overview of AA's Twelve Traditions — the principles that guide how the fellowship operates as a whole.", source: "Alcoholics Anonymous World Services" },
    { title: "Cravings and How to Handle Them", type: "Video", duration: "17 min", description: "What cravings are, why they happen, and AA-based and evidence-based strategies for managing them.", source: "Alcoholics Anonymous World Services" },
    { title: "One Day at a Time: Living Sober", type: "Guide", duration: "18 min", description: "The philosophy of one-day-at-a-time sobriety and practical tools for applying it in daily life.", source: "Alcoholics Anonymous World Services" },
    { title: "Recovery Stories from the Fellowship", type: "Podcast", duration: "40 min", description: "Inspiring first-hand recovery stories shared by AA members from around the country.", source: "Alcoholics Anonymous World Services" },
  ],

  // ── Personal Finance (20) ─────────────────────────────────────────────
  "67f462b3-be73-4864-8a74-f87392dc8f0c": [
    { title: "Building a Budget from Scratch", type: "Video", duration: "18 min", description: "How to create a simple budget using the 50/30/20 rule and track your spending with free tools." },
    { title: "Opening a Bank Account After Incarceration", type: "Video", duration: "12 min", description: "Why you need a bank account, what banks look for, and how to open a second-chance checking account." },
    { title: "Understanding Credit Scores", type: "Article", duration: "14 min", description: "What credit scores are, how they're calculated, and why your credit score matters for housing and employment." },
    { title: "Building Credit from Zero", type: "Guide", duration: "20 min", description: "Step-by-step strategies for building credit when you have no credit history — secured cards, credit-builder loans, and more." },
    { title: "Managing Debt After Release", type: "PDF", duration: "22 min", description: "How to assess your debts, understand what's collectible, and create a plan to pay down what you owe." },
    { title: "Saving Money on a Low Income", type: "Article", duration: "10 min", description: "Practical strategies for saving even small amounts when income is limited — including microsavings apps and tips." },
    { title: "Understanding Payday Loans and Predatory Lending", type: "Video", duration: "15 min", description: "Why payday loans are dangerous and what better alternatives exist when you need emergency cash." },
    { title: "Filing Your Taxes for the First Time", type: "Guide", duration: "25 min", description: "A plain-language guide to filing your first or returning tax return, including free filing options." },
    { title: "SNAP: How to Apply and What to Expect", type: "Video", duration: "14 min", description: "Everything you need to know about applying for SNAP (food stamps), eligibility, and how benefits work." },
    { title: "Social Security and Disability Benefits", type: "PDF", duration: "20 min", description: "An overview of SSI and SSDI — who qualifies, how to apply, and what to expect during the process." },
    { title: "Budgeting Worksheet", type: "Worksheet", duration: "20 min", description: "A fill-in worksheet to map your monthly income and expenses and identify areas to cut or save." },
    { title: "Avoiding Financial Scams Targeting Returning Citizens", type: "Article", duration: "10 min", description: "Common financial scams that target people coming out of incarceration and how to protect yourself." },
    { title: "Child Support and Back Payments", type: "Guide", duration: "18 min", description: "Understanding child support obligations, how to modify orders, and resources to help manage arrears." },
    { title: "Earning Money While on Supervision", type: "Article", duration: "12 min", description: "Rules about income reporting while on parole or probation, and tips for managing finances under supervision." },
    { title: "Emergency Fund: Why You Need One and How to Start", type: "Video", duration: "11 min", description: "Why an emergency fund is the foundation of financial stability and how to start building one even on a tight budget." },
    { title: "Financial Goal Setting Worksheet", type: "Worksheet", duration: "15 min", description: "A worksheet for setting 30-day, 6-month, and 1-year financial goals and tracking your progress." },
    { title: "Introduction to Banking and Financial Services", type: "Guide", duration: "20 min", description: "The basics of checking accounts, savings accounts, direct deposit, and how to use banking services safely." },
    { title: "EITC and Tax Credits for Low-Income Earners", type: "Article", duration: "12 min", description: "How the Earned Income Tax Credit and other tax credits can put money back in your pocket at tax time." },
    { title: "Understanding Your Pay Stub", type: "Video", duration: "10 min", description: "How to read a pay stub — gross pay, net pay, deductions, and what all those numbers mean." },
    { title: "Creating a Debt Payoff Plan", type: "Worksheet", duration: "20 min", description: "The snowball and avalanche methods for paying off debt, with a worksheet to build your personal payoff plan." },
  ],

  // ── Recovery (25) ─────────────────────────────────────────────────────
  "bdaed82a-ae6e-4411-be6b-223c9ea0d532": [
    { title: "What Is Recovery?", type: "Video", duration: "14 min", description: "A broad introduction to recovery — what it means across different contexts and why it's a lifelong process, not an event." },
    { title: "The Stages of Change", type: "Video", duration: "20 min", description: "The five stages of change (pre-contemplation through maintenance) and where you might be in your journey." },
    { title: "Understanding Addiction as a Disease", type: "Article", duration: "12 min", description: "The neuroscience behind addiction and why it's classified as a chronic brain disorder rather than a moral failing." },
    { title: "Medication-Assisted Treatment (MAT) Explained", type: "Video", duration: "22 min", description: "What MAT is, what medications are used, and how it supports recovery from opioid and alcohol use disorder." },
    { title: "Identifying Your Triggers", type: "Worksheet", duration: "25 min", description: "A structured exercise for identifying your personal relapse triggers and developing a plan to manage them." },
    { title: "Building a Relapse Prevention Plan", type: "Guide", duration: "30 min", description: "How to create a personalized relapse prevention plan that includes your warning signs, strategies, and emergency contacts." },
    { title: "The Role of Community in Recovery", type: "Video", duration: "16 min", description: "Why connection and community are essential to lasting recovery and how to find your recovery community." },
    { title: "Coping Skills for Everyday Life", type: "Worksheet", duration: "20 min", description: "A toolkit of healthy coping skills for stress, boredom, loneliness, and other common recovery challenges." },
    { title: "Sober Living Homes: What to Expect", type: "Guide", duration: "15 min", description: "What sober living homes are, rules and expectations, and how to find a reputable one in your area." },
    { title: "SMART Recovery: An Alternative to 12-Step", type: "Video", duration: "18 min", description: "An introduction to SMART Recovery — a science-based alternative to 12-step programs using CBT and motivational tools." },
    { title: "Harm Reduction: What It Is and Why It Matters", type: "Article", duration: "12 min", description: "The principles of harm reduction, how they're applied in real life, and why they save lives." },
    { title: "Naloxone (Narcan): How to Use It", type: "Video", duration: "10 min", description: "A demonstration of how to administer naloxone and what to do during an opioid overdose emergency." },
    { title: "Recovery and Spirituality", type: "Podcast", duration: "30 min", description: "A conversation about the role of spirituality (not necessarily religion) in supporting recovery." },
    { title: "Nutrition and Recovery", type: "Article", duration: "14 min", description: "How nutrition affects brain chemistry and recovery, and simple dietary changes that support healing." },
    { title: "Exercise as a Recovery Tool", type: "Video", duration: "16 min", description: "The science behind exercise and recovery, and how to build a simple movement routine even without a gym." },
    { title: "Recovery and Relationships", type: "Guide", duration: "22 min", description: "How to navigate relationships in early recovery — setting boundaries, rebuilding trust, and avoiding toxic dynamics." },
    { title: "Managing Cravings in Real Time", type: "Audio", duration: "12 min", description: "A guided audio session for managing intense cravings using urge surfing and other mindfulness techniques." },
    { title: "Grief and Loss in Recovery", type: "Video", duration: "20 min", description: "How grief and loss are connected to substance use and how to process them without relapsing." },
    { title: "Recovery and Employment: Making It Work", type: "Article", duration: "12 min", description: "How to manage work responsibilities in early recovery and communicate your needs without oversharing." },
    { title: "Long-Term Recovery: Life After the First Year", type: "Video", duration: "18 min", description: "What recovery looks like after the first year and how to continue growing, healing, and building a meaningful life." },
    { title: "Recovery Support Services Directory", type: "PDF", duration: "15 min", description: "A directory of recovery support services including recovery coaches, peer support, and recovery community organizations." },
    { title: "The HALT Method: Hunger, Anger, Loneliness, Tired", type: "Article", duration: "8 min", description: "Using the HALT acronym to check in with yourself and address basic needs before they become triggers." },
    { title: "Recovery Journaling Prompts", type: "Worksheet", duration: "20 min", description: "Thirty journaling prompts designed to support reflection, gratitude, and growth in recovery." },
    { title: "Finding Purpose in Recovery", type: "Video", duration: "22 min", description: "How discovering a sense of purpose accelerates recovery and practical ways to find what drives you." },
    { title: "Recovery Self-Assessment", type: "Worksheet", duration: "15 min", description: "A self-assessment tool to evaluate your current recovery health across multiple life domains." },
  ],

  // ── Health & Wellness (17) ────────────────────────────────────────────
  "beab5df1-e61e-4310-b253-8ba498c8e7e8": [
    { title: "Annual Physical Exams: Why They Matter", type: "Video", duration: "12 min", description: "What to expect at a physical exam, how often to get one, and why preventive care is critical after incarceration." },
    { title: "Understanding Blood Pressure", type: "Article", duration: "10 min", description: "What blood pressure numbers mean, what's healthy, and how to manage high blood pressure with lifestyle changes." },
    { title: "HIV/AIDS: Prevention, Testing, and Treatment", type: "Video", duration: "20 min", description: "Essential information about HIV transmission, testing, treatment options, and living well with HIV." },
    { title: "Hepatitis C: What You Need to Know", type: "Article", duration: "14 min", description: "How Hepatitis C spreads, how to get tested, and the highly effective treatments now available." },
    { title: "Sexually Transmitted Infections: Testing and Treatment", type: "Guide", duration: "18 min", description: "A guide to common STIs, how to get tested for free or low cost, and what treatment looks like." },
    { title: "Dental Health After Incarceration", type: "Article", duration: "10 min", description: "How to access affordable or free dental care and why dental health matters for your overall health and employment." },
    { title: "Diabetes Basics", type: "Video", duration: "16 min", description: "What diabetes is, the difference between Type 1 and Type 2, and how to manage blood sugar through diet and exercise." },
    { title: "Quitting Tobacco: Resources and Strategies", type: "Guide", duration: "15 min", description: "Evidence-based strategies for quitting tobacco including nicotine replacement, medication, and support programs." },
    { title: "Eating Healthy on a Budget", type: "Article", duration: "12 min", description: "How to eat nutritious food on a very limited budget using SNAP benefits, food banks, and smart shopping." },
    { title: "Basic Fitness Routine for Beginners", type: "Video", duration: "22 min", description: "A no-equipment workout routine designed for people starting from scratch — with modifications for all fitness levels." },
    { title: "Managing Chronic Pain Without Opioids", type: "Video", duration: "18 min", description: "Non-opioid approaches to managing chronic pain including physical therapy, mindfulness, heat therapy, and more." },
    { title: "Mental Health vs. Substance Use: Understanding the Connection", type: "Article", duration: "14 min", description: "How mental health disorders and substance use are linked, and why treating both together leads to better outcomes." },
    { title: "Getting Health Insurance After Release", type: "Guide", duration: "16 min", description: "How to enroll in Medicaid, marketplace plans, or other coverage options immediately after release." },
    { title: "Telehealth: Accessing Care Remotely", type: "Video", duration: "11 min", description: "What telehealth is, how to access it with or without a smartphone, and what services are available online." },
    { title: "Self-Care Routine Planner", type: "Worksheet", duration: "15 min", description: "A weekly planner for building a self-care routine that includes physical, mental, and emotional wellness." },
    { title: "Vaccines You May Need After Release", type: "PDF", duration: "10 min", description: "Which vaccines are recommended for adults and where to get them for free or low cost." },
    { title: "Women's Health After Incarceration", type: "Guide", duration: "18 min", description: "Specific healthcare needs and resources for women returning from incarceration, including reproductive health and prenatal care." },
  ],

  // ── GED (28) ──────────────────────────────────────────────────────────
  "dd237674-cefa-4785-8f22-00f8bada3802": [
    { title: "About the GED: What It Is and Why It Matters", type: "Video", duration: "12 min", description: "An overview of the GED credential, what doors it opens, and what's on the four-subject test." },
    { title: "How to Register for the GED", type: "Guide", duration: "10 min", description: "Step-by-step instructions for registering for the GED exam, including in-prison testing programs." },
    { title: "GED Mathematical Reasoning Overview", type: "Video", duration: "25 min", description: "A review of the math content on the GED — what topics are covered and how to approach each section." },
    { title: "GED Math Practice Worksheet 1: Basic Operations", type: "Worksheet", duration: "30 min", description: "Practice problems covering addition, subtraction, multiplication, and division as tested on the GED Math section." },
    { title: "GED Math Practice Worksheet 2: Algebra", type: "Worksheet", duration: "30 min", description: "Practice problems covering algebraic expressions, equations, and inequalities for the GED Mathematical Reasoning test." },
    { title: "GED Math Practice Worksheet 3: Geometry", type: "Worksheet", duration: "30 min", description: "Practice problems covering area, perimeter, volume, and coordinate geometry as tested on the GED." },
    { title: "GED Reasoning Through Language Arts Overview", type: "Video", duration: "20 min", description: "What's on the GED RLA test — extended response, reading comprehension, and language skills." },
    { title: "GED Reading Comprehension Strategies", type: "Guide", duration: "22 min", description: "How to read passages strategically, identify main ideas, and answer inference and evidence questions." },
    { title: "GED Extended Response Writing Guide", type: "Guide", duration: "25 min", description: "How to plan, draft, and write a strong extended response essay in the 45 minutes allotted." },
    { title: "GED Writing Practice: Essay Prompts", type: "Worksheet", duration: "45 min", description: "Practice essay prompts with grading rubric — designed to prepare you for the GED RLA Extended Response." },
    { title: "GED Science Overview", type: "Video", duration: "18 min", description: "What's covered in the GED Science test — life science, earth science, and physical science." },
    { title: "GED Science Practice: Life Science", type: "Worksheet", duration: "30 min", description: "Practice questions covering cells, genetics, evolution, and ecosystems as tested on the GED Science exam." },
    { title: "GED Science Practice: Physical Science", type: "Worksheet", duration: "30 min", description: "Practice questions covering chemistry, physics, and energy concepts for the GED Science section." },
    { title: "GED Social Studies Overview", type: "Video", duration: "16 min", description: "An overview of the GED Social Studies test covering civics, U.S. history, economics, and geography." },
    { title: "GED Social Studies: Civics and Government", type: "Worksheet", duration: "25 min", description: "Practice questions on U.S. government structure, the Constitution, and civic participation." },
    { title: "GED Social Studies: U.S. History", type: "Worksheet", duration: "25 min", description: "Practice questions covering major periods of U.S. history as tested on the GED Social Studies exam." },
    { title: "Test-Taking Strategies for the GED", type: "Guide", duration: "20 min", description: "Time management strategies, how to eliminate wrong answers, and mental preparation for test day." },
    { title: "Using a Calculator on the GED", type: "Video", duration: "14 min", description: "How to use the TI-30XS calculator provided during the GED Math test — including key functions and shortcuts." },
    { title: "GED Online Study Resources", type: "Guide", duration: "12 min", description: "Free online resources for GED preparation including GED.com, Khan Academy, and other practice tools." },
    { title: "Overcoming Math Anxiety", type: "Article", duration: "10 min", description: "Strategies for managing anxiety around math and building confidence as you prepare for the GED." },
    { title: "Reading Nonfiction Texts: Practice Passage", type: "Worksheet", duration: "20 min", description: "A nonfiction reading passage with comprehension questions to practice for the GED RLA test." },
    { title: "Data Interpretation: Charts and Graphs", type: "Worksheet", duration: "20 min", description: "Practice reading and interpreting bar charts, line graphs, pie charts, and tables as tested on GED Science and Social Studies." },
    { title: "GED Study Schedule Template", type: "Worksheet", duration: "15 min", description: "A fillable weekly study schedule template to help you structure your GED preparation over 8-12 weeks." },
    { title: "GED Vocabulary List for RLA", type: "PDF", duration: "20 min", description: "A curated list of vocabulary words commonly tested on the GED Reasoning Through Language Arts section." },
    { title: "Common GED Math Formulas", type: "PDF", duration: "15 min", description: "The math formulas provided on the GED test — and how to use each one with worked examples." },
    { title: "GED vs. HiSET vs. TASC: What's the Difference?", type: "Article", duration: "8 min", description: "A comparison of the three high school equivalency exams and how to know which one is offered in your state." },
    { title: "GED Success Story: From Cell to Credential", type: "Video", duration: "16 min", description: "A first-person account of earning a GED while incarcerated and the difference it made." },
    { title: "Next Steps After the GED: College and Workforce", type: "Guide", duration: "18 min", description: "What to do after earning your GED — community college options, trade school, financial aid, and workforce programs." },
  ],

  // ── Parenting (16) ────────────────────────────────────────────────────
  "776a2a40-1b12-47fd-a411-60bf62f3de80": [
    { title: "Parenting After Incarceration: Where to Start", type: "Video", duration: "18 min", description: "A compassionate introduction to reconnecting with your children after incarceration — what to expect and how to begin." },
    { title: "Talking to Your Kids About Incarceration", type: "Guide", duration: "20 min", description: "Age-appropriate language and strategies for having honest conversations with children about a parent's incarceration." },
    { title: "Understanding Child Custody and Visitation", type: "PDF", duration: "22 min", description: "An overview of custody types, visitation rights, and how incarceration affects parental rights." },
    { title: "Rebuilding Trust with Your Children", type: "Video", duration: "16 min", description: "How trust is broken during incarceration and evidence-based strategies for rebuilding it slowly and consistently." },
    { title: "Child Support: What You Need to Know", type: "Guide", duration: "18 min", description: "How child support works, how to modify an existing order, and programs that help with arrears after release." },
    { title: "Co-Parenting After Incarceration", type: "Article", duration: "14 min", description: "How to communicate and cooperate with a co-parent after release, even when the relationship is difficult." },
    { title: "Child Development Basics", type: "Video", duration: "20 min", description: "Understanding developmental stages from infancy through adolescence and what children need at each stage." },
    { title: "Discipline Without Violence", type: "Guide", duration: "18 min", description: "Positive discipline techniques that work for children of all ages — building boundaries without physical punishment." },
    { title: "Parenting a Teenager After Long Absence", type: "Video", duration: "22 min", description: "The unique challenges of reconnecting with teenagers, who are navigating their own identity while managing complex feelings." },
    { title: "Trauma-Informed Parenting", type: "Article", duration: "14 min", description: "How your children may have been affected by your incarceration and how to parent with that trauma in mind." },
    { title: "Building New Family Routines", type: "Worksheet", duration: "20 min", description: "A worksheet for creating consistent, predictable family routines that children can rely on." },
    { title: "Reading Together: Activities for Parents and Kids", type: "Guide", duration: "12 min", description: "Easy reading and literacy activities you can do with your children to build connection and support their learning." },
    { title: "Domestic Violence Resources for Parents", type: "PDF", duration: "15 min", description: "Safety planning resources for parents experiencing domestic violence, including hotlines, shelters, and legal protections." },
    { title: "WIC and SNAP for Parents and Children", type: "Guide", duration: "14 min", description: "How to apply for WIC (Women, Infants, Children) and SNAP benefits to support your family's nutrition." },
    { title: "Parenting Support Groups", type: "Article", duration: "10 min", description: "How parenting support groups work and how to find one in your community designed for returning parents." },
    { title: "Mindful Parenting: Being Present for Your Kids", type: "Audio", duration: "18 min", description: "A guided audio session on mindful parenting — being present, managing your reactions, and connecting with your children." },
  ],

  // ── Devotional Books (13) ─────────────────────────────────────────────
  "71960a5e-f118-45cd-ab6b-2d6d50603b39": [
    { title: "Daily Devotional: Finding Strength", type: "Audio", duration: "10 min", description: "A daily devotional reading focused on finding inner strength during difficult times and transitions." },
    { title: "The Serenity Prayer: History and Reflection", type: "Article", duration: "12 min", description: "The history behind the Serenity Prayer and how its wisdom applies to recovery and reentry." },
    { title: "Psalms of Comfort", type: "PDF", duration: "20 min", description: "A curated collection of Psalms focused on comfort, hope, and restoration, with reflective questions." },
    { title: "Proverbs on Wisdom and Self-Control", type: "PDF", duration: "18 min", description: "Selected Proverbs focused on wisdom, discipline, and self-control with modern application notes." },
    { title: "Forgiveness: A Devotional Study", type: "Guide", duration: "25 min", description: "A five-session devotional exploring forgiveness — of others, of yourself, and the healing that follows." },
    { title: "Morning Devotion for a New Day", type: "Audio", duration: "8 min", description: "A gentle morning devotional to start each day with intention, gratitude, and hope." },
    { title: "Evening Reflection: Gratitude and Grace", type: "Audio", duration: "10 min", description: "An evening devotional for reflecting on the day's gifts, releasing burdens, and preparing for rest." },
    { title: "Hope for the Future: A Study on Jeremiah 29:11", type: "Article", duration: "14 min", description: "A devotional study of one of the Bible's most beloved promises and what it means for people in recovery and reentry." },
    { title: "Walking Through the Valley: Faith in Hard Times", type: "Video", duration: "22 min", description: "A message of hope and faith for people walking through their most difficult seasons of life." },
    { title: "Devotional: Identity and Worth", type: "PDF", duration: "20 min", description: "A devotional on finding your identity and worth in something greater than your mistakes or your past." },
    { title: "Prayer Journal Prompts", type: "Worksheet", duration: "20 min", description: "Guided prayer and journaling prompts to deepen your devotional practice and spiritual reflection." },
    { title: "The Lord's Prayer: A Deep Dive", type: "Article", duration: "12 min", description: "A verse-by-verse study of the Lord's Prayer and its relevance to recovery, forgiveness, and daily life." },
    { title: "Faith and Recovery: Stories of Transformation", type: "Podcast", duration: "35 min", description: "Personal stories of faith-based transformation in recovery — how spiritual practice supported lasting change." },
  ],

  // ── Books (11) ────────────────────────────────────────────────────────
  "f83644d2-f143-4835-9ffa-b4e7879870a5": [
    { title: "Viktor Frankl's Man's Search for Meaning: Summary", type: "PDF", duration: "20 min", description: "A guided summary and reflection guide for Viktor Frankl's landmark book on finding meaning through suffering.", source: "Viktor Frankl" },
    { title: "The Alchemist: Key Themes and Reflections", type: "Guide", duration: "18 min", description: "An exploration of the key themes in Paulo Coelho's The Alchemist — personal legend, perseverance, and transformation.", source: "Paulo Coelho" },
    { title: "Think and Grow Rich: Core Principles", type: "PDF", duration: "22 min", description: "A summary of Napoleon Hill's principles of success, desire, faith, and persistence applied to reentry.", source: "Napoleon Hill" },
    { title: "The Four Agreements: A Reflection Guide", type: "Guide", duration: "16 min", description: "The four agreements of Don Miguel Ruiz applied to recovery and reentry — impeccable word, no assumptions, and more.", source: "Don Miguel Ruiz" },
    { title: "7 Habits of Highly Effective People: Habit 1-3", type: "Video", duration: "25 min", description: "Stephen Covey's first three habits — being proactive, beginning with the end in mind, and putting first things first.", source: "Stephen R. Covey" },
    { title: "Atomic Habits: Small Changes, Big Results", type: "Article", duration: "15 min", description: "James Clear's core framework for building good habits and breaking bad ones — applied to recovery and reentry.", source: "James Clear" },
    { title: "Between the World and Me: Discussion Guide", type: "PDF", duration: "20 min", description: "A discussion guide for Ta-Nehisi Coates' powerful letter on race, identity, and America.", source: "Ta-Nehisi Coates" },
    { title: "Emotional Intelligence: What It Is and Why It Matters", type: "Article", duration: "14 min", description: "Daniel Goleman's key concepts on emotional intelligence — self-awareness, empathy, and social skills.", source: "Daniel Goleman" },
    { title: "The Autobiography of Malcolm X: Key Passages", type: "PDF", duration: "25 min", description: "Selected passages and discussion questions from Malcolm X's autobiography — transformation, identity, and perseverance.", source: "Malcolm X & Alex Haley" },
    { title: "Mindset: Fixed vs. Growth Mindset", type: "Video", duration: "18 min", description: "Carol Dweck's research on mindset — why believing you can grow changes everything about how you approach challenges.", source: "Carol S. Dweck" },
    { title: "A Long Way Gone: Memoirs of a Boy Soldier — Discussion Guide", type: "Guide", duration: "20 min", description: "Discussion guide and reflection questions for Ishmael Beah's memoir on surviving trauma, war, and rebuilding.", source: "Ishmael Beah" },
  ],

  // ── Galleries & Devotion (10) ─────────────────────────────────────────
  "af0523c8-3143-4083-8fc7-23805631f15d": [
    { title: "Art as Healing: Introduction", type: "Video", duration: "14 min", description: "How visual art has been used throughout history as a tool for healing, expression, and recovery." },
    { title: "Nature Photography: Finding Peace in the Outdoors", type: "PDF", duration: "10 min", description: "A gallery of nature photography with devotional reflections on each image." },
    { title: "Devotional Art: Strength and Renewal", type: "PDF", duration: "12 min", description: "A visual devotional using art and scripture to reflect on strength, renewal, and hope." },
    { title: "Creating a Vision Board", type: "Worksheet", duration: "20 min", description: "A guide to creating a personal vision board as a tool for motivation, goal-setting, and recovery." },
    { title: "Coloring for Mindfulness", type: "PDF", duration: "15 min", description: "Printable coloring pages with mindfulness prompts designed for stress relief and creative expression." },
    { title: "Photography and Storytelling", type: "Video", duration: "16 min", description: "How photography can be used to tell your story, express your journey, and reclaim your narrative." },
    { title: "Mandalas and Meditation", type: "PDF", duration: "12 min", description: "The history and meaning of mandalas, with guided coloring pages for meditation and reflection." },
    { title: "Gratitude Photo Journal", type: "Worksheet", duration: "15 min", description: "A 30-day photo journal challenge — capturing one thing you're grateful for each day." },
    { title: "Scripture Art: Hope and Peace", type: "PDF", duration: "10 min", description: "A collection of scripture-based artwork focused on themes of hope, peace, and perseverance." },
    { title: "Drawing Your Recovery Journey", type: "Worksheet", duration: "20 min", description: "A guided art exercise for mapping your recovery journey visually — past, present, and future." },
  ],

  // ── Workforce Integration (21) ────────────────────────────────────────
  "e132945b-342e-4ca9-9918-5057122acf63": [
    { title: "Fair Chance Hiring: Know Your Rights", type: "Video", duration: "16 min", description: "How Ban the Box laws work, your rights as a job applicant with a record, and how to navigate the hiring process." },
    { title: "Job Search Strategies for Returning Citizens", type: "Guide", duration: "20 min", description: "Where to find fair-chance employers, how to use workforce agencies, and job search strategies that work." },
    { title: "Acing the Job Interview", type: "Video", duration: "22 min", description: "How to prepare for job interviews, answer common questions, and handle the criminal history question confidently." },
    { title: "Addressing Your Criminal History With Employers", type: "Guide", duration: "18 min", description: "Scripts and strategies for disclosing your background to employers honestly and strategically." },
    { title: "Trade Skills and Certifications Overview", type: "Article", duration: "14 min", description: "High-demand trades that are accessible to returning citizens — plumbing, electrical, HVAC, welding, and more." },
    { title: "CDL Certification: How to Get Started", type: "Guide", duration: "20 min", description: "What a Commercial Driver's License is, eligibility with a criminal record, and how to pursue CDL training." },
    { title: "Workforce Development Programs in Your State", type: "PDF", duration: "16 min", description: "A guide to state-funded workforce development, apprenticeship, and job training programs." },
    { title: "Networking When You Have a Record", type: "Video", duration: "15 min", description: "How to build professional relationships and use your network effectively when you're starting over." },
    { title: "Online Job Platforms and How to Use Them", type: "Guide", duration: "14 min", description: "How to use Indeed, LinkedIn, and other platforms to find fair-chance employment opportunities." },
    { title: "Self-Employment and Entrepreneurship", type: "Video", duration: "20 min", description: "Why self-employment may be a strong option for returning citizens and how to start a small business." },
    { title: "Work Opportunity Tax Credit (WOTC) Explained", type: "Article", duration: "10 min", description: "How the WOTC incentivizes employers to hire returning citizens and how to use this as a selling point." },
    { title: "Understanding Your Background Check", type: "Guide", duration: "18 min", description: "What employers see on a background check, how to dispute errors, and how to prepare for what's there." },
    { title: "Clothing and Interview Preparation Resources", type: "Guide", duration: "10 min", description: "Where to find free professional clothing, grooming assistance, and interview preparation programs." },
    { title: "Workplace Rights and Labor Laws", type: "PDF", duration: "20 min", description: "Your rights as an employee — minimum wage, workplace safety, discrimination protections, and how to file a complaint." },
    { title: "Transitional Employment Programs", type: "Article", duration: "12 min", description: "What transitional employment is, how it works, and how to find programs in your area." },
    { title: "Building a Professional Online Presence", type: "Video", duration: "16 min", description: "How to set up a LinkedIn profile, manage your online reputation, and present yourself professionally online." },
    { title: "Soft Skills Employers Want", type: "Video", duration: "18 min", description: "The non-technical skills employers consistently rank highest — communication, punctuality, reliability, and teamwork." },
    { title: "Mock Interview Practice Scenarios", type: "Worksheet", duration: "30 min", description: "Practice interview questions with coaching notes and space to write and refine your answers." },
    { title: "Day One at a New Job: What to Expect", type: "Article", duration: "10 min", description: "How to show up on your first day — what to bring, how to act, and how to make a strong first impression." },
    { title: "Managing Work and Supervision Simultaneously", type: "Guide", duration: "14 min", description: "How to navigate work schedule requirements while maintaining supervision check-ins and court obligations." },
    { title: "Career Planning Worksheet", type: "Worksheet", duration: "25 min", description: "A structured worksheet for identifying your skills, interests, and a realistic 1-3 year career plan." },
  ],

  // ── Education (24) ────────────────────────────────────────────────────
  "e4e9a569-ac1b-4d8b-b248-f31b73fa5052": [
    { title: "Why Education Changes Everything", type: "Video", duration: "14 min", description: "The documented impact of education on reentry outcomes — employment, recidivism, and long-term earnings." },
    { title: "Adult Education Programs: What's Available", type: "Guide", duration: "18 min", description: "An overview of adult education options including GED, ABE, ESL, vocational training, and college." },
    { title: "Community College After Incarceration", type: "Video", duration: "20 min", description: "How to apply to community college, what financial aid is available, and what to expect as a returning student." },
    { title: "Pell Grants: Are You Eligible?", type: "Guide", duration: "14 min", description: "How the Second Chance Pell program works and how to apply for federal financial aid as a returning citizen." },
    { title: "Study Skills for Adult Learners", type: "Video", duration: "16 min", description: "Practical study techniques — active recall, spaced repetition, and note-taking — for adults returning to education." },
    { title: "Time Management for Students", type: "Worksheet", duration: "20 min", description: "A planning worksheet for balancing school, work, supervision, and family responsibilities." },
    { title: "Reading Comprehension Strategies", type: "Guide", duration: "18 min", description: "How to read academic texts effectively, take notes, and retain information for exams and papers." },
    { title: "Writing a College Essay", type: "Guide", duration: "22 min", description: "How to write a compelling personal statement for college applications, including how to address your background." },
    { title: "Vocational Certifications Overview", type: "Article", duration: "14 min", description: "High-value vocational certifications available in trades, healthcare, tech, and business that open employment doors." },
    { title: "Online Learning: How to Succeed", type: "Video", duration: "16 min", description: "How to stay motivated, organized, and connected in online learning environments." },
    { title: "Library Resources for Education", type: "Guide", duration: "12 min", description: "How to use public library resources for free — databases, online courses, tutoring, and internet access." },
    { title: "Khan Academy: A Free Learning Tool", type: "Article", duration: "10 min", description: "How to use Khan Academy for GED prep, math review, reading practice, and vocational skill building." },
    { title: "Finding a Tutor or Study Partner", type: "Guide", duration: "12 min", description: "How to find free tutoring services and study partners through libraries, nonprofits, and community colleges." },
    { title: "ESL: English as a Second Language Programs", type: "PDF", duration: "16 min", description: "Resources and programs for people whose first language is not English looking to improve language skills." },
    { title: "Introduction to Computer Basics", type: "Video", duration: "20 min", description: "Foundational computer skills: using a keyboard and mouse, navigating the internet, and creating documents." },
    { title: "Email and Digital Communication", type: "Video", duration: "14 min", description: "How to set up and use email professionally — writing, sending, and organizing messages." },
    { title: "Applying for Scholarships with a Criminal Record", type: "Guide", duration: "16 min", description: "How to find scholarships available to returning citizens and how to write a compelling scholarship application." },
    { title: "Math Review: Fractions, Decimals, and Percentages", type: "Worksheet", duration: "30 min", description: "Practice problems for fractions, decimals, and percentages with step-by-step examples." },
    { title: "Reading Practice: Nonfiction Articles", type: "Worksheet", duration: "20 min", description: "Reading comprehension exercises using real nonfiction articles on topics relevant to daily life." },
    { title: "Goal Setting for Education", type: "Worksheet", duration: "15 min", description: "A structured goal-setting worksheet for mapping your educational goals from where you are to where you want to be." },
    { title: "Science Literacy: Understanding Research and News", type: "Article", duration: "12 min", description: "How to evaluate scientific claims in the news and understand how research studies work." },
    { title: "History of Civil Rights in America", type: "PDF", duration: "25 min", description: "A condensed overview of the Civil Rights Movement — key figures, events, and their lasting impact." },
    { title: "Critical Thinking and Logical Reasoning", type: "Video", duration: "18 min", description: "How to evaluate arguments, spot logical fallacies, and think critically about information you encounter." },
    { title: "Education and Income: The Numbers", type: "Article", duration: "10 min", description: "Data on the relationship between education level and lifetime earnings — why every credential counts." },
  ],

  // ── Cover Letter & Resume (19) ────────────────────────────────────────
  "e27068e8-b51a-482a-a590-d0fcdcbe0c9e": [
    { title: "Resume Writing Basics", type: "Video", duration: "20 min", description: "The fundamentals of an effective resume — what to include, what to leave out, and how to format it." },
    { title: "Resume Template: No Work Experience", type: "Worksheet", duration: "25 min", description: "A fillable resume template for people with limited formal work history — focused on skills and accomplishments." },
    { title: "Resume Template: Returning Citizen", type: "Worksheet", duration: "25 min", description: "A resume template designed for returning citizens that highlights skills, education, and certifications." },
    { title: "How to List Skills on a Resume", type: "Guide", duration: "14 min", description: "How to identify your transferable skills from work, programs, and life experience and present them on a resume." },
    { title: "What to Put in Your Resume Summary", type: "Article", duration: "10 min", description: "How to write a powerful 2-3 sentence resume summary that makes employers want to keep reading." },
    { title: "Cover Letter Writing Basics", type: "Video", duration: "16 min", description: "What a cover letter is, why it matters, and how to write one that complements your resume." },
    { title: "Cover Letter Template", type: "Worksheet", duration: "20 min", description: "A fill-in cover letter template with instructions for customizing it for each job application." },
    { title: "Addressing a Criminal Record on a Cover Letter", type: "Guide", duration: "18 min", description: "When and how to proactively address your background in a cover letter — sample language included." },
    { title: "Action Verbs for Resumes", type: "PDF", duration: "10 min", description: "A list of 100+ powerful action verbs to strengthen the language on your resume and cover letter." },
    { title: "Tailoring Your Resume for a Job Description", type: "Video", duration: "14 min", description: "How to read job descriptions and adjust your resume to match what the employer is looking for." },
    { title: "Applicant Tracking Systems: How to Beat Them", type: "Article", duration: "12 min", description: "What ATS software is, how it filters resumes, and how to make sure yours makes it to a human." },
    { title: "Online Resume Builders: Free Tools", type: "Guide", duration: "12 min", description: "Free tools for building a professional-looking resume online, including Canva, Zety, and Resume.com." },
    { title: "References: Who to Ask and How", type: "Guide", duration: "10 min", description: "How to choose references, how to ask them, and how to prepare them to speak on your behalf." },
    { title: "LinkedIn Profile Setup", type: "Video", duration: "18 min", description: "Step-by-step instructions for setting up a professional LinkedIn profile to support your job search." },
    { title: "Job Application Tracker", type: "Worksheet", duration: "10 min", description: "A spreadsheet-style tracker for keeping organized records of jobs applied to, dates, and follow-up status." },
    { title: "Thank You Notes After Interviews", type: "Guide", duration: "8 min", description: "Why thank you notes matter and how to write a brief, professional follow-up after a job interview." },
    { title: "Sample Resume: Warehouse and Logistics", type: "PDF", duration: "10 min", description: "A sample resume for warehouse, forklift, and logistics positions — with annotations explaining each section." },
    { title: "Sample Resume: Food Service and Culinary", type: "PDF", duration: "10 min", description: "A sample resume for kitchen, restaurant, and food service roles with tips for highlighting culinary skills." },
    { title: "Sample Cover Letter: General Application", type: "PDF", duration: "10 min", description: "A full sample cover letter for a general job application with notes on what each paragraph accomplishes." },
  ],

  // ── English Study Sheets (23) ─────────────────────────────────────────
  "207456f3-103a-4d10-8812-eac18f3f91d9": [
    { title: "Alphabet and Letter Sounds Review", type: "Worksheet", duration: "15 min", description: "A foundational review of the alphabet, letter sounds, and phonics rules for beginning readers." },
    { title: "Sight Words: Level 1", type: "Worksheet", duration: "15 min", description: "The 50 most common sight words in English — flashcard-style practice for reading fluency." },
    { title: "Sight Words: Level 2", type: "Worksheet", duration: "15 min", description: "The next 50 sight words for building reading speed and confidence." },
    { title: "Short Vowel Sounds", type: "Worksheet", duration: "20 min", description: "Practice with short a, e, i, o, u sounds — identifying them in words and spelling with them." },
    { title: "Long Vowel Sounds and Silent E", type: "Worksheet", duration: "20 min", description: "How the silent E changes vowel sounds, with practice words and sentences." },
    { title: "Consonant Blends and Digraphs", type: "Worksheet", duration: "20 min", description: "Practice with bl, st, ch, sh, th, and other common consonant combinations." },
    { title: "Reading Fluency Practice Passage 1", type: "Worksheet", duration: "15 min", description: "A short reading passage at the 3rd-4th grade level with comprehension questions." },
    { title: "Reading Fluency Practice Passage 2", type: "Worksheet", duration: "15 min", description: "A short reading passage on everyday topics with vocabulary and comprehension questions." },
    { title: "Sentence Structure: Subject and Predicate", type: "Worksheet", duration: "18 min", description: "Understanding basic sentence structure — identifying subjects and predicates and writing complete sentences." },
    { title: "Punctuation Rules", type: "Worksheet", duration: "18 min", description: "Rules for periods, commas, question marks, exclamation points, apostrophes, and quotation marks." },
    { title: "Capitalization Rules", type: "Worksheet", duration: "15 min", description: "When to capitalize — proper nouns, first words, titles, and other capitalization rules with practice exercises." },
    { title: "Paragraph Writing", type: "Worksheet", duration: "20 min", description: "How to write a complete paragraph — topic sentence, supporting details, and concluding sentence." },
    { title: "Spelling Rules: Common Patterns", type: "Worksheet", duration: "20 min", description: "Common English spelling patterns and rules — i before e, doubling consonants, dropping silent e, and more." },
    { title: "Vocabulary Building: Word Roots", type: "Worksheet", duration: "18 min", description: "Common Latin and Greek word roots that help you decode unfamiliar words — pre, re, un, tion, and more." },
    { title: "Synonyms and Antonyms", type: "Worksheet", duration: "15 min", description: "Practice matching words with their synonyms and antonyms to build vocabulary and precision." },
    { title: "Context Clues: Figuring Out Word Meaning", type: "Worksheet", duration: "18 min", description: "How to use surrounding words and sentences to figure out the meaning of unfamiliar vocabulary." },
    { title: "Types of Writing: Narrative, Persuasive, Informative", type: "Guide", duration: "16 min", description: "An overview of the three main types of writing with examples and when each type is used." },
    { title: "Writing a Formal Letter", type: "Worksheet", duration: "20 min", description: "How to format and write a formal business letter, with practice writing a complaint, request, and thank-you letter." },
    { title: "Reading Comprehension: Main Idea and Details", type: "Worksheet", duration: "20 min", description: "Practice identifying the main idea and supporting details in nonfiction paragraphs." },
    { title: "Compound Words", type: "Worksheet", duration: "12 min", description: "Practice with common compound words — identifying them, forming them, and using them in sentences." },
    { title: "Contractions", type: "Worksheet", duration: "12 min", description: "How contractions work, common contractions in English, and practice forming and using them correctly." },
    { title: "Parts of Speech Overview", type: "Worksheet", duration: "20 min", description: "Nouns, verbs, adjectives, adverbs, pronouns, prepositions — what they are and how they work together." },
    { title: "Editing Practice: Finding and Fixing Errors", type: "Worksheet", duration: "25 min", description: "Paragraphs with embedded errors for proofreading practice — spelling, grammar, punctuation, and capitalization." },
  ],

  // ── Math Study Sheets (26) ────────────────────────────────────────────
  "05a290a1-dd5d-4042-9b62-70ee77b253f0": [
    { title: "Whole Number Review: Place Value", type: "Worksheet", duration: "15 min", description: "Understanding place value from ones to millions — reading, writing, and comparing whole numbers." },
    { title: "Adding and Subtracting Whole Numbers", type: "Worksheet", duration: "20 min", description: "Multi-digit addition and subtraction with and without regrouping." },
    { title: "Multiplying Whole Numbers", type: "Worksheet", duration: "20 min", description: "Single and multi-digit multiplication with practice problems and step-by-step examples." },
    { title: "Dividing Whole Numbers", type: "Worksheet", duration: "20 min", description: "Long division with and without remainders — with worked examples and practice problems." },
    { title: "Introduction to Fractions", type: "Worksheet", duration: "18 min", description: "What fractions are, how to read them, and how to identify equivalent fractions." },
    { title: "Adding and Subtracting Fractions", type: "Worksheet", duration: "20 min", description: "How to add and subtract fractions with like and unlike denominators." },
    { title: "Multiplying and Dividing Fractions", type: "Worksheet", duration: "20 min", description: "Step-by-step guide to multiplying and dividing fractions and mixed numbers." },
    { title: "Understanding Decimals", type: "Worksheet", duration: "18 min", description: "Reading, writing, and comparing decimals — tenths, hundredths, and thousandths." },
    { title: "Adding and Subtracting Decimals", type: "Worksheet", duration: "18 min", description: "How to align decimals and add or subtract accurately with worked examples." },
    { title: "Multiplying and Dividing Decimals", type: "Worksheet", duration: "20 min", description: "Decimal multiplication and division with step-by-step examples and practice problems." },
    { title: "Understanding Percentages", type: "Worksheet", duration: "18 min", description: "What percentages are, how to convert between fractions, decimals, and percentages." },
    { title: "Percent Applications: Tip, Tax, and Discount", type: "Worksheet", duration: "20 min", description: "Real-world percent problems — calculating tips, sales tax, discounts, and percent increase/decrease." },
    { title: "Introduction to Ratios and Proportions", type: "Worksheet", duration: "18 min", description: "What ratios and proportions are and how to use them to solve real-world problems." },
    { title: "Introduction to Algebra: Variables and Expressions", type: "Worksheet", duration: "22 min", description: "What variables are, how to write algebraic expressions, and how to evaluate them." },
    { title: "Solving One-Step Equations", type: "Worksheet", duration: "20 min", description: "How to solve equations with one operation using inverse operations — addition, subtraction, multiplication, division." },
    { title: "Solving Two-Step Equations", type: "Worksheet", duration: "22 min", description: "Solving equations requiring two steps with worked examples and practice problems." },
    { title: "Inequalities", type: "Worksheet", duration: "18 min", description: "What inequalities are, how to solve them, and how to graph them on a number line." },
    { title: "Introduction to Geometry: Shapes and Properties", type: "Worksheet", duration: "18 min", description: "Basic geometric shapes — triangles, rectangles, circles — and their key properties." },
    { title: "Area and Perimeter", type: "Worksheet", duration: "20 min", description: "How to calculate area and perimeter for rectangles, triangles, circles, and composite shapes." },
    { title: "Volume and Surface Area", type: "Worksheet", duration: "22 min", description: "How to calculate volume and surface area for cubes, rectangular prisms, and cylinders." },
    { title: "The Pythagorean Theorem", type: "Worksheet", duration: "18 min", description: "What the Pythagorean theorem is and how to use it to find missing sides of right triangles." },
    { title: "Reading Graphs and Tables", type: "Worksheet", duration: "18 min", description: "How to read and interpret bar graphs, line graphs, pie charts, and data tables." },
    { title: "Mean, Median, Mode, and Range", type: "Worksheet", duration: "18 min", description: "How to calculate the four measures of central tendency with practice datasets." },
    { title: "Real-World Math: Budgeting Problems", type: "Worksheet", duration: "25 min", description: "Math problems set in real-world budgeting scenarios — rent, groceries, bills, and savings." },
    { title: "Real-World Math: Measurement and Conversion", type: "Worksheet", duration: "20 min", description: "Unit conversion problems for length, weight, volume, and temperature with real-world applications." },
    { title: "Mixed Review: All Operations Practice", type: "Worksheet", duration: "30 min", description: "A comprehensive mixed review covering all four operations, fractions, decimals, and percentages." },
  ],

  // ── Legal Information (14) ────────────────────────────────────────────
  "09140116-7e35-4e84-9218-39a27346840c": [
    { title: "Your Rights After Incarceration", type: "Video", duration: "20 min", description: "A plain-language overview of your civil rights as a returning citizen — employment, housing, voting, and more." },
    { title: "Expungement and Record Sealing Explained", type: "Video", duration: "22 min", description: "What expungement and record sealing are, who qualifies, and how to start the process in your state." },
    { title: "Voting Rights for Returning Citizens", type: "Guide", duration: "16 min", description: "State-by-state overview of voting rights restoration for people with felony convictions." },
    { title: "Understanding Parole Conditions", type: "PDF", duration: "18 min", description: "What parole conditions typically include, your rights under supervision, and how violations are handled." },
    { title: "Understanding Probation Conditions", type: "PDF", duration: "16 min", description: "How probation works, standard conditions, special conditions, and your rights as a person on probation." },
    { title: "Finding Free Legal Help", type: "Guide", duration: "14 min", description: "How to access legal aid, law school clinics, public defenders, and pro bono lawyers for reentry-related issues." },
    { title: "Housing Discrimination and the Fair Housing Act", type: "Article", duration: "12 min", description: "How the Fair Housing Act protects renters with criminal records and when a landlord can and cannot deny you housing." },
    { title: "Employment Discrimination and the EEOC", type: "Article", duration: "14 min", description: "What employment discrimination looks like, your rights under EEOC guidelines, and how to file a complaint." },
    { title: "Drug Convictions and Federal Benefits", type: "PDF", duration: "16 min", description: "How drug convictions affect eligibility for federal benefits like SNAP, Pell Grants, and public housing." },
    { title: "Divorce and Family Court After Incarceration", type: "Guide", duration: "18 min", description: "How incarceration affects divorce proceedings, child custody, and family court obligations." },
    { title: "Immigration and Criminal Records", type: "Article", duration: "14 min", description: "How a criminal record can affect immigration status, deportation risk, and options for non-citizens." },
    { title: "Debt Collectors and Your Rights Under the FDCPA", type: "Article", duration: "12 min", description: "How the Fair Debt Collection Practices Act protects you from abusive debt collectors and what you can do." },
    { title: "Identity Theft Recovery", type: "Guide", duration: "16 min", description: "What to do if your identity was stolen during or after incarceration — how to dispute, report, and recover." },
    { title: "Navigating the Legal System: Glossary of Terms", type: "PDF", duration: "15 min", description: "Plain-language definitions of common legal terms you'll encounter in court documents, supervision, and legal proceedings." },
  ],

  // ── Learning Center (30) ──────────────────────────────────────────────
  "79439733-2285-437e-bdae-9ef5d077fbf6": [
    { title: "Introduction to the Learning Center", type: "Video", duration: "8 min", description: "How to use the Learning Center — what resources are available and how to get the most out of each one." },
    { title: "Setting Learning Goals", type: "Worksheet", duration: "15 min", description: "A structured guide for setting academic and personal learning goals with short and long-term timelines." },
    { title: "How Adults Learn: Learning Styles", type: "Article", duration: "12 min", description: "Understanding visual, auditory, and kinesthetic learning styles and how to leverage yours." },
    { title: "Memory and Retention Techniques", type: "Video", duration: "16 min", description: "Evidence-based techniques for remembering more of what you learn — spaced repetition, active recall, and chunking." },
    { title: "Focus and Concentration Tips", type: "Article", duration: "10 min", description: "How to improve concentration and reduce distraction during study sessions using environment and habit changes." },
    { title: "Note-Taking Methods: Cornell, Outline, and Mind Map", type: "Guide", duration: "18 min", description: "Three effective note-taking methods with examples and guidance on when to use each." },
    { title: "Digital Literacy: Using a Smartphone for Learning", type: "Video", duration: "14 min", description: "How to use your phone for learning — apps, podcasts, YouTube, and free educational platforms." },
    { title: "Free Online Courses: Where to Start", type: "Guide", duration: "12 min", description: "Free online learning platforms — Coursera, edX, Khan Academy, and Duolingo — and how to access them." },
    { title: "Reading for Pleasure: Why It Matters", type: "Article", duration: "10 min", description: "The cognitive and emotional benefits of reading for enjoyment and how to build a reading habit." },
    { title: "Public Libraries: Your Free Learning Center", type: "Guide", duration: "12 min", description: "Everything available at a public library beyond books — courses, databases, internet, tutoring, and community programs." },
    { title: "Learning a Trade Online", type: "Article", duration: "14 min", description: "Online resources for learning trade skills — plumbing, electrical, HVAC, welding, and automotive basics." },
    { title: "Introduction to Coding: Why It Opens Doors", type: "Video", duration: "16 min", description: "Why coding is one of the most accessible and high-paying skills to learn, and free resources to get started." },
    { title: "Spanish for Beginners: Workplace Basics", type: "Audio", duration: "20 min", description: "Basic Spanish phrases for common workplace settings — greetings, directions, and safety vocabulary." },
    { title: "Financial Literacy 101", type: "Video", duration: "18 min", description: "The core concepts of financial literacy — budgeting, saving, credit, and investing — in one accessible overview." },
    { title: "Typing and Keyboard Skills", type: "Guide", duration: "15 min", description: "How to improve your typing speed and accuracy using free tools like TypingClub and Keybr." },
    { title: "Microsoft Word Basics", type: "Video", duration: "20 min", description: "How to create, format, save, and print documents in Microsoft Word — foundational skills for any office job." },
    { title: "Microsoft Excel Basics", type: "Video", duration: "22 min", description: "Introduction to spreadsheets — entering data, basic formulas, and creating simple charts in Excel." },
    { title: "Email Etiquette and Professional Communication", type: "Guide", duration: "14 min", description: "How to write professional emails — subject lines, tone, structure, and common mistakes to avoid." },
    { title: "Introduction to Healthcare Careers", type: "Article", duration: "14 min", description: "Entry-level healthcare careers accessible to returning citizens — CNA, medical assistant, phlebotomy, and more." },
    { title: "CNA Training: What to Expect", type: "Video", duration: "18 min", description: "What Certified Nursing Assistant training involves, how long it takes, and how to find programs in your area." },
    { title: "Introduction to Welding", type: "Video", duration: "20 min", description: "An overview of the welding trade — types of welding, what the job is like, earning potential, and training paths." },
    { title: "Introduction to HVAC", type: "Video", duration: "18 min", description: "The HVAC trade explained — what HVAC technicians do, how to get certified, and job outlook." },
    { title: "ServSafe Food Handler Certification Overview", type: "Guide", duration: "16 min", description: "What ServSafe certification is, why it's required in food service jobs, and how to prepare for the exam." },
    { title: "Understanding Contracts and Legal Documents", type: "Article", duration: "12 min", description: "How to read basic contracts — leases, employment agreements, and service contracts — before signing." },
    { title: "Conflict Resolution Skills", type: "Video", duration: "16 min", description: "How to handle workplace and personal conflicts constructively using communication and de-escalation skills." },
    { title: "Public Speaking and Presentations", type: "Guide", duration: "18 min", description: "How to prepare and deliver a presentation — structure, body language, managing nerves, and engaging an audience." },
    { title: "Critical Thinking in Everyday Life", type: "Article", duration: "12 min", description: "Applying critical thinking to decisions, media consumption, and problem-solving in daily life." },
    { title: "Introduction to Photography with a Smartphone", type: "Video", duration: "16 min", description: "Basic photography skills using a phone camera — composition, lighting, and editing for free." },
    { title: "Starting a Small Business: First Steps", type: "Guide", duration: "20 min", description: "The very first steps to starting a small business — choosing a structure, registering, and understanding licenses." },
    { title: "Learning Center Progress Tracker", type: "Worksheet", duration: "15 min", description: "A personal tracker to log courses completed, skills learned, and goals achieved in the Learning Center." },
  ],
};

async function main() {
  console.log("Starting content seed...\n");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const [categoryId, items] of Object.entries(CONTENT)) {
    // Get category name for logging
    const { data: cat } = await db
      .from("categories")
      .select("name")
      .eq("id", categoryId)
      .maybeSingle();

    const catName = cat?.name ?? categoryId;
    console.log(`📁 ${catName} (${items.length} items)`);

    // Get current max sort_order for this category
    const { data: existing } = await db
      .from("content_items")
      .select("sort_order")
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const startOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const rows = items.map((item, i) => ({
      category_id: categoryId,
      title: item.title,
      type: item.type,
      url: url(item.type),
      duration: item.duration ?? null,
      description: item.description ?? null,
      source: item.source ?? "",
      published: true,
      sort_order: startOrder + i,
    }));

    const { error } = await db.from("content_items").insert(rows);

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      totalSkipped += items.length;
    } else {
      console.log(`  ✅ Inserted ${items.length} items`);
      totalInserted += items.length;
    }
  }

  console.log(`\n✅ Done. Inserted ${totalInserted} items. Skipped ${totalSkipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
