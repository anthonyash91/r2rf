export type AchievementCategory = "first_steps" | "completion" | "streaks" | "time";

export type Achievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
};

export const ACHIEVEMENTS: Achievement[] = [
  // First steps
  { key: "first_item",    title: "First Resource",      description: "Complete your first content item",          icon: "BookOpen",      category: "first_steps" },
  { key: "first_program", title: "Explorer",             description: "Start your first category",                 icon: "Compass",       category: "first_steps" },

  // Completion milestones
  { key: "items_10",   title: "10 Resources",        description: "Complete 10 content items",                 icon: "CheckCircle2",  category: "completion" },
  { key: "items_25",   title: "25 Resources",        description: "Complete 25 content items",                 icon: "CheckCircle2",  category: "completion" },
  { key: "items_50",   title: "50 Resources",        description: "Complete 50 content items",                 icon: "Award",         category: "completion" },
  { key: "items_100",  title: "100 Resources",       description: "Complete 100 content items",                icon: "Trophy",        category: "completion" },
  { key: "program_1",  title: "Category graduate",    description: "Complete all items in a category",          icon: "GraduationCap", category: "completion" },
  { key: "program_5",  title: "5 categories finished", description: "Complete all items in 5 categories",       icon: "Medal",         category: "completion" },

  // Streaks
  { key: "streak_7",  title: "7-Day Streak",  description: "Log in 7 days in a row",  icon: "Flame", category: "streaks" },
  { key: "streak_30", title: "30-Day Streak", description: "Log in 30 days in a row", icon: "Flame", category: "streaks" },

  // Time
  { key: "time_5h",  title: "5 Hours In",  description: "Spend 5 hours actively learning",  icon: "Clock", category: "time" },
  { key: "time_10h", title: "10 Hours In", description: "Spend 10 hours actively learning", icon: "Clock", category: "time" },
  { key: "time_50h", title: "50 Hours In", description: "Spend 50 hours actively learning", icon: "Clock", category: "time" },
];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  first_steps: "First Steps",
  completion:  "Completion",
  streaks:     "Streaks",
  time:        "Time Spent",
};

// CHECKS mirrors ACHIEVEMENTS but as a predicate map so checkAndGrantAchievements
// can evaluate all conditions in one pass without duplicating the thresholds.
export const CHECKS: Record<string, (s: { itemsCompleted: number; categoriesStarted: number; programsCompleted: number; totalSeconds: number; streak: number }) => boolean> = {
  first_item:    (s) => s.itemsCompleted >= 1,
  first_program: (s) => s.categoriesStarted >= 1,
  items_10:      (s) => s.itemsCompleted >= 10,
  items_25:      (s) => s.itemsCompleted >= 25,
  items_50:      (s) => s.itemsCompleted >= 50,
  items_100:     (s) => s.itemsCompleted >= 100,
  program_1:     (s) => s.programsCompleted >= 1,
  program_5:     (s) => s.programsCompleted >= 5,
  streak_7:      (s) => s.streak >= 7,
  streak_30:     (s) => s.streak >= 30,
  // 5 hr = 18,000 s | 10 hr = 36,000 s | 50 hr = 180,000 s
  time_5h:       (s) => s.totalSeconds >= 18_000,
  time_10h:      (s) => s.totalSeconds >= 36_000,
  time_50h:      (s) => s.totalSeconds >= 180_000,
};
