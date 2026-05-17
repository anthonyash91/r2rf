export type ContentItem = {
  title: string;
  type: "Article" | "Video" | "Podcast" | "Worksheet" | "Meeting" | "Guide";
  source: string;
  duration: string;
  description: string;
  url?: string;
};

export type Category = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  items: ContentItem[];
};

export const categories: Category[] = [
  {
    slug: "health-and-wellness",
    name: "Health & Wellness",
    tagline: "Rebuild body and mind",
    description:
      "Practical resources for physical health, mental wellness, nutrition, and sleep — the foundation of a sustainable recovery.",
    items: [
      { title: "Building a Morning Routine That Sticks", type: "Guide", source: "Recovery.org", duration: "8 min read", description: "A step-by-step framework for anchoring your day in healthy habits." },
      { title: "Trauma-Informed Yoga for Beginners", type: "Video", source: "Yoga of 12-Step Recovery", duration: "22 min", description: "Gentle movement designed for nervous systems in healing." },
      { title: "Nutrition Basics for Early Recovery", type: "Article", source: "SAMHSA", duration: "6 min read", description: "How balanced meals stabilize mood, cravings, and energy." },
      { title: "Sleep Hygiene Checklist", type: "Worksheet", source: "NIH", duration: "PDF", description: "Printable nightly routine to restore restorative sleep." },
      { title: "Managing Anxiety Without Substances", type: "Podcast", source: "The Recovery Show", duration: "47 min", description: "Therapist-backed coping strategies you can use today." },
    ],
  },
  {
    slug: "parenting",
    name: "Parenting",
    tagline: "Show up for your family",
    description:
      "Tools to rebuild trust, communicate with your children, and parent with intention through every stage of recovery.",
    items: [
      { title: "Talking to Your Kids About Recovery", type: "Guide", source: "Partnership to End Addiction", duration: "10 min read", description: "Age-appropriate scripts for honest, healing conversations." },
      { title: "Co-Parenting After Incarceration", type: "Article", source: "Sesame Workshop", duration: "7 min read", description: "Rebuilding routines, roles, and rapport with your co-parent." },
      { title: "Rebuilding Trust With Teenagers", type: "Podcast", source: "Parenting Recovery", duration: "38 min", description: "Real parents share what worked — and what didn't." },
      { title: "Family Dinner Conversation Starters", type: "Worksheet", source: "Reentry to Recovery", duration: "PDF", description: "Printable prompts to reconnect around the table." },
      { title: "Trauma-Aware Discipline Strategies", type: "Video", source: "Conscious Discipline", duration: "31 min", description: "Replace reactive parenting with regulated, connected responses." },
    ],
  },
  {
    slug: "workforce-integration",
    name: "Workforce Integration",
    tagline: "Build a working future",
    description:
      "Resume help, fair-chance employers, interview prep, and skills training to land — and keep — meaningful work.",
    items: [
      { title: "Fair-Chance Employer Directory", type: "Guide", source: "Honest Jobs", duration: "Directory", description: "Companies actively hiring people with records." },
      { title: "Resume Templates for Reentry", type: "Worksheet", source: "Center for Employment Opportunities", duration: "PDF", description: "Three formats designed to highlight skills over gaps." },
      { title: "How to Answer 'The Question' in an Interview", type: "Video", source: "75 Hard Reentry", duration: "14 min", description: "A confident framework for disclosing your background." },
      { title: "Free Certifications That Actually Get You Hired", type: "Article", source: "Goodwill", duration: "9 min read", description: "OSHA, ServSafe, CDL, IT — where to start." },
      { title: "Negotiating Your First Paycheck", type: "Podcast", source: "Second Chance Careers", duration: "29 min", description: "Know your worth and the language to claim it." },
    ],
  },
  {
    slug: "reentry-to-recovery",
    name: "Reentry to Recovery",
    tagline: "The first 90 days",
    description:
      "Housing, ID, transportation, probation, and the practical logistics of building a stable life after release.",
    items: [
      { title: "The 90-Day Reentry Checklist", type: "Guide", source: "Reentry to Recovery", duration: "12 min read", description: "Every document, appointment, and benefit — in order." },
      { title: "How to Replace Your ID and Social Security Card", type: "Article", source: "Prison Policy Initiative", duration: "5 min read", description: "State-by-state walkthrough with required forms." },
      { title: "Finding Sober Living That Won't Exploit You", type: "Video", source: "Recovery Research Institute", duration: "18 min", description: "Red flags, green flags, and questions to ask." },
      { title: "Talking to Your Probation Officer", type: "Podcast", source: "Inside Out Reentry", duration: "42 min", description: "How transparency and preparation reduce friction." },
      { title: "Benefits You Qualify For (SNAP, Medicaid, Housing)", type: "Worksheet", source: "Benefits.gov", duration: "PDF", description: "Enrollment links and eligibility at a glance." },
    ],
  },
  {
    slug: "narcotics-anonymous",
    name: "Narcotics Anonymous",
    tagline: "Just for today",
    description:
      "NA literature, daily meditations, step work, and meeting finders for those walking the 12 Steps of Narcotics Anonymous.",
    items: [
      { title: "Find an NA Meeting Near You", type: "Guide", source: "na.org", duration: "Directory", description: "Searchable map of in-person and virtual meetings worldwide.", url: "https://www.na.org/meetingsearch/" },
      { title: "Just for Today — Daily Meditation", type: "Article", source: "NA World Services", duration: "3 min read", description: "Today's reading from the JFT meditation book." },
      { title: "Working Step One With a Sponsor", type: "Guide", source: "NA Step Working Guides", duration: "20 min read", description: "Powerlessness and unmanageability, in plain language." },
      { title: "The Basic Text — Audio Edition", type: "Podcast", source: "NA World Services", duration: "Series", description: "Listen to the full Basic Text on your commute." },
      { title: "Newcomer's Guide to Your First Meeting", type: "Video", source: "NA World Services", duration: "9 min", description: "What to expect, what to say, what not to worry about." },
    ],
  },
  {
    slug: "alcoholics-anonymous",
    name: "Alcoholics Anonymous",
    tagline: "One day at a time",
    description:
      "AA literature, the Big Book, daily reflections, sponsorship guidance, and meeting locators for the AA fellowship.",
    items: [
      { title: "Find an AA Meeting Near You", type: "Guide", source: "aa.org", duration: "Directory", description: "Locate local intergroups and online meetings.", url: "https://www.aa.org/find-aa" },
      { title: "The Big Book — Chapter 5: How It Works", type: "Article", source: "AA World Services", duration: "15 min read", description: "The chapter read aloud at meetings worldwide." },
      { title: "Daily Reflections", type: "Article", source: "AA World Services", duration: "3 min read", description: "Today's reflection from members in recovery." },
      { title: "Choosing a Sponsor", type: "Guide", source: "AA Grapevine", duration: "8 min read", description: "What to look for and how to ask." },
      { title: "Speaker Tapes: Stories of Hope", type: "Podcast", source: "AA Speaker Archive", duration: "Series", description: "Listen to members share their experience, strength, and hope." },
    ],
  },
];

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);
