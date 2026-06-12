/**
 * Centralised query key definitions. Import QK and use these instead of
 * inline arrays so typos are caught at compile time and invalidations stay
 * in sync with queries.
 *
 * Convention:
 *   - Static keys (no params) are plain arrays.
 *   - Dynamic keys are factory functions.
 *   - Keys that appear in both a base form (for invalidation) and a
 *     parameterised form (for useQuery) are defined as two entries:
 *     `foo` (static prefix) + `fooFor(...)` (specific key).
 */

export const QK = {
  // ── categories ────────────────────────────────────────────────────────────
  categories: ["categories"] as const,
  categoriesPublic: (facilityValue: string) =>
    ["categories", "public", facilityValue] as const,
  category: (slug: string) => ["category", slug] as const,
  categoryItemStats: (categoryIds: string, facilityKey: number) =>
    ["category-item-stats", categoryIds, facilityKey] as const,

  // ── content ───────────────────────────────────────────────────────────────
  contentTypes: ["content-types"] as const,
  contentProgress: (userId: string | undefined, categoryId: string | undefined) =>
    ["content-progress", userId, categoryId] as const,
  contentSeen: (userId: string | undefined) =>
    ["content-seen", userId] as const,
  engagement: (userId: string | undefined, categoryId: string | undefined) =>
    ["engagement", userId, categoryId] as const,
  ratingTotals: ["rating-totals"] as const,
  ratingTotalsFor: (itemIds: string) => ["rating-totals", itemIds] as const,

  // ── facilities ────────────────────────────────────────────────────────────
  facilities: ["facilities"] as const,
  facilitiesWithStats: ["facilities", "with-stats"] as const,
  facilitiesList: ["facilities-list"] as const,
  facilityBySiteParam: (site: string | null) =>
    ["facility-by-site-param", site] as const,
  // facilityCategories base — used as invalidation prefix for all facility-category queries
  facilityCategoriesBase: ["facility-categories"] as const,
  facilityCategories: (facilityValue: string) =>
    ["facility-categories", facilityValue] as const,
  facilityComparison: ["facility-comparison"] as const,
  facilityUserIdsForAudit: (facilityValue: string | null) =>
    ["facility-user-ids-for-audit", facilityValue] as const,

  // ── user / dashboard ──────────────────────────────────────────────────────
  myProfile: ["my-profile"] as const,
  mySecurityQuestions: ["my-security-questions"] as const,
  myFacility: (userId: string | undefined) => ["my-facility", userId] as const,
  myAchievements: (userId: string | undefined) =>
    ["my-achievements", userId] as const,
  myBookmarkIds: (userId: string | undefined) =>
    ["my-bookmark-ids", userId] as const,
  myBookmarkedItems: (userId: string | undefined) =>
    ["my-bookmarked-items", userId] as const,
  myRatings: (userId: string | undefined) => ["my-ratings", userId] as const,
  myEngagementTier: (userId: string | undefined) =>
    ["my-engagement-tier", userId] as const,
  myMonthlySummary: (userId: string | undefined) =>
    ["my-monthly-summary", userId] as const,
  myLoginDays: (userId: string | null | undefined) =>
    ["my-login-days", userId] as const,
  myTestRuns: ["my-test-runs"] as const,
  myTestRunResults: (runId: string | null) =>
    ["my-test-run-results", runId] as const,
  resumeItem: (userId: string | undefined) => ["resume-item", userId] as const,
  testerProfile: (userId: string | undefined) =>
    ["tester-profile", userId] as const,

  // dashboard-categories: static prefix for invalidation, factory for queries
  dashboardCategories: ["dashboard-categories"] as const,
  dashboardCategoriesFor: (facilityValue: string | null | undefined) =>
    ["dashboard-categories", facilityValue] as const,

  // dashboard-progress: static prefix for invalidation, two factory forms
  dashboardProgress: ["dashboard-progress"] as const,
  dashboardProgressFor: (userId: string | null | undefined, categoryIds?: string) =>
    (categoryIds !== undefined
      ? ["dashboard-progress", userId, categoryIds]
      : ["dashboard-progress", userId]) as readonly unknown[],

  // home-user-progress: same pattern
  homeUserProgress: (userId: string | undefined) =>
    ["home-user-progress", userId] as const,
  homeUserProgressFor: (userId: string | undefined, categoryIds: string) =>
    ["home-user-progress", userId, categoryIds] as const,

  homeSearch: (query: string, categoryIds: string, facilityKey: number) =>
    ["home-search", query, categoryIds, facilityKey] as const,

  inmatePinCheck: (
    facilityValue: string | undefined,
    pin: string | null,
  ) => ["inmate-pin-check", facilityValue, pin] as const,
  signupChallenge: ["signup-challenge"] as const,

  // ── site settings ─────────────────────────────────────────────────────────
  siteSettings: (key: string) => ["site_settings", key] as const,

  // ── admin ─────────────────────────────────────────────────────────────────
  // category (singular) base — used as invalidation prefix for all ["category", slug] queries
  categoryBase: ["category"] as const,

  adminCategories: ["admin", "categories"] as const,
  // adminCategory base — used as invalidation prefix for all ["admin", "category", id] queries
  adminCategoryBase: ["admin", "category"] as const,
  adminCategory: (id: string) => ["admin", "category", id] as const,
  adminCategoryItems: ["admin", "category-items"] as const,
  adminCategoryFacilityMap: ["admin", "category-facility-map"] as const,
  adminItemFacilityMap: ["admin", "item-facility-map"] as const,
  adminContentSources: ["admin", "content-sources"] as const,
  adminFacilityLabels: ["admin", "facility-labels"] as const,
  adminIconsBadgesCategories: ["admin", "icons-badges", "categories"] as const,
  adminIconsBadgesContentTypes: [
    "admin",
    "icons-badges",
    "content-types",
  ] as const,
  adminSeedCategories: ["admin", "seed", "categories"] as const,
  adminUsersAdmins: ["admin", "users", "admins"] as const,
  adminUsersTesters: ["admin", "users", "testers"] as const,
  adminUsersFacilityAdmins: (facilityValue: string | null) =>
    ["admin", "users", "facilityAdmins", facilityValue] as const,
  adminTestRuns: ["admin", "test-runs"] as const,
  adminTestRunDetail: (runId: string | null) =>
    ["admin", "test-run-detail", runId] as const,
  adminNewUsersCount: (lastSeen: string | null) =>
    ["admin", "new-users-count", lastSeen] as const,
  adminSiteSettings: (key: string) =>
    ["admin", "site_settings", key] as const,
  adminReport: (
    kind: string,
    facilityValue: string | null,
    range: string,
  ) => ["admin", "report", kind, facilityValue, range] as const,
  adminGrowth: (kind: string, facilityValue: string | null) =>
    ["admin", "growth", kind, facilityValue] as const,
  adminFacilityUsers: (facilityValue: string, page: number) =>
    ["admin", "facility-users", facilityValue, page] as const,
  adminFacilityStaff: (facilityValue: string) =>
    ["admin", "facility-staff", facilityValue] as const,
  adminUserProgress: (userId: string) =>
    ["admin", "user-progress", userId] as const,
  adminUserMonthlySummary: (userId: string) =>
    ["admin", "user-monthly-summary", userId] as const,

  // admin-audit-log: static prefix for invalidation, factory for queries
  adminAuditLog: ["admin-audit-log"] as const,
  adminAuditLogFor: (action: string | null, since: string | null) =>
    ["admin-audit-log", action, since] as const,

  // admin-error-logs: same pattern
  adminErrorLogs: ["admin-error-logs"] as const,
  adminErrorLogsFor: (source: string | null, since: string | null) =>
    ["admin-error-logs", source, since] as const,
} as const;
