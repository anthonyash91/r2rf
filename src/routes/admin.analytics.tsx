import { createFileRoute } from "@tanstack/react-router";
import { requireAnalyticsAdminBeforeLoad } from "@/lib/admin-guards";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  ChevronDown,
  Download,
  Eye,
  MousePointerClick,
  Building2,
  Users as UsersIcon,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Trophy,
  Info,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Award,
  Compass,
  GraduationCap,
  Medal,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { Category, ContentItem } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { CircleProgress } from "@/components/CircleProgress";
import { UserSectionHeader } from "@/components/UserSectionHeader";
import { StatCard } from "@/components/StatCard";
import { ReadStatusBadge } from "@/components/ReadStatusBadge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { listAllFacilities } from "@/lib/facilities.functions";

import { readStatusLabels } from "@/lib/read-status";
import { withActionWord } from "@/lib/duration";
import { fmtDate, fmtDateShort, formatTimeSpent } from "@/lib/date-format";
import { csvEscape, downloadCsv } from "@/lib/csv-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { waitForNextPaint } from "@/lib/paint";
import { useI18n } from "@/lib/i18n";
import {
  getUsageReport,
  listFacilityUsers,
  getUserProgressReport,
  getBulkFacilityProgressReport,
} from "@/lib/reports.functions";
import { listFacilityAdminUsers } from "@/lib/users.functions";
import { getFacilityComparison, getGrowthStats, triggerNightlyRefresh, resetFacilityAnalytics } from "@/lib/analytics-stats.functions";
import { getAdminUserMonthlySummary } from "@/lib/monthly-summary.functions";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { capFirst } from "@/lib/utils";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Pager } from "@/components/LoadMorePager";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAnalyticsAdminBeforeLoad,
  component: AdminReportsPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all" | "month";

const RANGE_OPTIONS: { key: RangeKey; label: string; shortLabel: string }[] = [
  { key: "month", label: "Last month", shortLabel: "month" },
  { key: "7d", label: "Last 7 days", shortLabel: "7 days" },
  { key: "30d", label: "Last 30 days", shortLabel: "30 days" },
  { key: "90d", label: "Last 90 days", shortLabel: "90 days" },
  { key: "all", label: "All time", shortLabel: "All time" },
];

type FacilityRow = {
  facilityValue: string;
  facilityLabel: string;
  facilitySiteId: string | null;
  activeUsers7d: number;
  activeUsers30d: number;
  totalUsers: number;
  avgCompletionRate: number | null;
  totalSessionSeconds: number;
  itemsCompletedTotal: number;
  updatedAt: string;
  totalBookmarks: number;
  totalThumbsUp: number;
  totalThumbsDown: number;
};

type AggregatedRow = {
  category: Category;
  views: number;
  clicks: number;
  completionRate: number | null;
  totalSeconds: number;
  depth: number | null;
  items: { item: ContentItem; clicks: number; openCount: number; completeCount: number; completionRate: number | null; avgSessionSeconds: number | null; thumbsUp: number; thumbsDown: number; bookmarkCount: number }[];
};



function AdminReportsPage() {
  const { isFacilityUser, user } = useAuth();
  const fetchMyFacility = useServerFn(getMyFacilityValue);
  const { data: myFacilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });
  const myFacilityValue = isFacilityUser ? (myFacilityData?.facility ?? null) : null;

  const [tab, setTab] = useState<"overall" | "facility" | "user">("overall");
  const [facilityKey, setFacilityKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<{ value: string; label: string } | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userKey, setUserKey] = useState(0);
  const [selectedUserFacility, setSelectedUserFacility] = useState<{ value: string; label: string } | null>(null);
  const [activeUser, setActiveUser] = useState<{ userId: string; name: string; pin?: string | null } | null>(null);

  const fetchFacilities = useServerFn(listAllFacilities);
  // Defer the facilities fetch until the picker is actually opened — the list
  // is only needed for the dropdown, so there's no reason to load it up front.
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilities(),
    enabled: pickerOpen || userPickerOpen,
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];

  const openFacilityPicker = () => {
    setUserPickerOpen(false);
    setPickerOpen(true);
  };
  const openUserPicker = () => {
    setPickerOpen(false);
    setUserPickerOpen(true);
  };

  const headerTitle =
    tab === "user" && activeUser
      ? "Reports > User Report"
      : tab === "overall"
        ? "Reports > Overall"
        : tab === "facility" && selectedFacility
          ? `Reports > ${selectedFacility.label}`
          : tab === "user" && selectedUserFacility
            ? `Reports > Users > ${selectedUserFacility.label}`
            : "Reports";

  return (
    <TooltipProvider delayDuration={200}>
    <div>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "facility" || v === "user") return;
          setTab(v as any);
        }}
        className="mt-6"
      >
        <div className="flex flex-col gap-8 lg:gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PageHeader
            icon={BarChart3}
            title={headerTitle}
            description="Usage, facility, and per-user reports across the site."
          />
          <div className="flex items-center gap-2 self-stretch lg:self-center">
            <TabsList className="h-auto p-2 gap-1 flex-1 lg:flex-none bg-muted/40 self-stretch lg:self-auto">
            <TabsTrigger value="overall" className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overall
            </TabsTrigger>
            {!isFacilityUser && <Popover open={pickerOpen} onOpenChange={(o) => { if (o) setUserPickerOpen(false); setPickerOpen(o); }}>
              <PopoverAnchor asChild>
                <TabsTrigger
                  value="facility"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openFacilityPicker();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" /> By Facility
                </TabsTrigger>
              </PopoverAnchor>
              <PopoverContent
                align="center"
                className="w-80 p-3"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => {
                  const target = e.target as Node | null;
                  if (target && (e.currentTarget as HTMLElement).parentElement?.contains(target) === false) {
                    // default
                  }
                  // Ignore clicks on the anchor (TabsTrigger) that toggled it
                  const t = e.target as HTMLElement | null;
                  if (t && t.closest('[data-state][role="tab"]')) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="mb-2 text-sm font-medium">Select a facility</div>
                <FacilityCombobox
                  value={selectedFacility?.value ?? ""}
                  onChange={(v) => {
                    const f = facilities.find((x) => x.value === v);
                    if (!f) return;
                    setSelectedFacility({ value: f.value, label: f.label });
                    setFacilityKey((k) => k + 1);
                    setPickerOpen(false);
                    setTab("facility");
                  }}
                  options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                  placeholder={facilitiesQuery.isLoading || facilities.length === 0 ? "Loading…" : "Select a facility"}
                />
              </PopoverContent>
            </Popover>}
            {isFacilityUser ? (
              // facilityUser: direct tab — no picker, auto-scoped to their facility
              <TabsTrigger
                value="user"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedUserFacility({ value: myFacilityValue ?? "__all__", label: myFacilityValue ?? "My Facility" });
                  setUserKey((k) => k + 1);
                  setActiveUser(null);
                  setTab("user");
                }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
              >
                <UsersIcon className="h-3.5 w-3.5 mr-1.5" /> Users
              </TabsTrigger>
            ) : (
              <Popover open={userPickerOpen} onOpenChange={(o) => { if (o) setPickerOpen(false); setUserPickerOpen(o); }}>
                <PopoverAnchor asChild>
                  <TabsTrigger
                    value="user"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openUserPicker();
                    }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
                  >
                    <UsersIcon className="h-3.5 w-3.5 mr-1.5" /> Users
                  </TabsTrigger>
                </PopoverAnchor>
                <PopoverContent
                  align="center"
                  className="w-80 p-3"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => {
                    const t = e.target as HTMLElement | null;
                    if (t && t.closest('[data-state][role="tab"]')) e.preventDefault();
                  }}
                >
                  <div className="mb-2 text-sm font-medium">Select a facility</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserFacility({ value: "__all__", label: "All Facilities" });
                      setUserKey((k) => k + 1);
                      setUserPickerOpen(false);
                      setActiveUser(null);
                      setTab("user");
                    }}
                    className="mb-2 w-full rounded-md border border-input bg-background px-4 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">All Facilities</span>
                    <span className="ml-2 text-xs text-muted-foreground">Every registered user</span>
                  </button>
                  <FacilityCombobox
                    value={selectedUserFacility?.value && selectedUserFacility.value !== "__all__" ? selectedUserFacility.value : ""}
                    onChange={(v) => {
                      const f = facilities.find((x) => x.value === v);
                      if (!f) return;
                      setSelectedUserFacility({ value: f.value, label: f.label });
                      setUserKey((k) => k + 1);
                      setUserPickerOpen(false);
                      setActiveUser(null);
                      setTab("user");
                    }}
                    options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                    placeholder={facilitiesQuery.isLoading || facilities.length === 0 ? "Loading…" : "Select a facility"}
                  />
                </PopoverContent>
              </Popover>
            )}
          </TabsList>
          </div>
        </div>


        <TabsContent value="overall" className="mt-8">
          {isFacilityUser && myFacilityValue ? (
            <UsageReportView scope={{ kind: "facility", facilityValue: myFacilityValue, facilityLabel: myFacilityValue }} />
          ) : (
            <>
              <UsageReportView scope={{ kind: "overall" }} />
              <FacilityComparisonSection />
            </>
          )}
        </TabsContent>
        <TabsContent value="facility" className="mt-8">
          {selectedFacility ? (
            <FacilityReportTab
              key={`${facilityKey}-${selectedFacility.value}`}
              preselected={selectedFacility}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="user" className="mt-8">
          {selectedUserFacility ? (
            <UsersReportTab
              key={`${userKey}-${selectedUserFacility.value}`}
              preselected={isFacilityUser && myFacilityValue
                ? { value: myFacilityValue, label: myFacilityValue }
                : selectedUserFacility}
              activeUser={activeUser}
              setActiveUser={setActiveUser}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help flex-shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs px-3 py-2 text-center">{text}</TooltipContent>
    </Tooltip>
  );
}

/* ---------------- Usage Report (Overall + Facility) ---------------- */

type UsageScope =
  | { kind: "overall" }
  | { kind: "facility"; facilityValue: string; facilityLabel: string };

function UsageReportView({ scope }: { scope: UsageScope }) {
  const { isTester, isAdmin, isContributor } = useAuth();
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("30d");
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const doResetFacility = useServerFn(resetFacilityAnalytics);
  const confirm = useConfirm();
  const fetchReport = useServerFn(getUsageReport);
  const fetchGrowth = useServerFn(getGrowthStats);
  const doRefresh = useServerFn(triggerNightlyRefresh);

  const facilityValue = scope.kind === "facility" ? scope.facilityValue : null;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "report", scope.kind, facilityValue, range],
    queryFn: () =>
      fetchReport({
        data: { range, facilityValue: facilityValue ?? null },
      }),
  });

  const { data: growthData } = useQuery({
    queryKey: ["admin", "growth", scope.kind, facilityValue],
    queryFn: () => fetchGrowth({ data: { facilityValue } }),
    staleTime: 30 * 60 * 1000,
  });

  // Build AggregatedRow[] from pre-aggregated counts returned by the server
  const aggregated = useMemo(() => {
    if (!data) return null;
    const d = data as any;
    const catViews: Record<string, number> = d.catViews ?? {};
    const catClicks: Record<string, number> = d.catClicks ?? {};
    const itemClicks: Record<string, number> = d.itemClicks ?? {};
    const itemStats: Record<string, { openCount: number; completeCount: number; completionRate: number | null; avgSessionSeconds: number | null }> = d.itemStats ?? {};
    const itemRatings: Record<string, { thumbs_up: number; thumbs_down: number }> = d.itemRatings ?? {};
    const itemBookmarks: Record<string, number> = d.itemBookmarks ?? {};
    const catCompletionRate: Record<string, number | null> = d.catCompletionRate ?? {};
    const catTotalSeconds: Record<string, number> = d.catTotalSeconds ?? {};
    const catDepth: Record<string, number | null> = d.catDepth ?? {};
    const typeStats: Record<string, { itemCount: number; opens: number; completions: number; completionRate: number | null; totalSeconds: number }> = d.typeStats ?? {};
    const itemsByCategory = new Map<string, ContentItem[]>();
    for (const it of (d.items ?? []) as ContentItem[]) {
      const list = itemsByCategory.get(it.category_id) ?? [];
      list.push(it);
      itemsByCategory.set(it.category_id, list);
    }
    const rows: AggregatedRow[] = (d.categories ?? []).map((cat: Category) => {
      const items = (itemsByCategory.get(cat.id) ?? [])
        .map((it) => {
          const s = itemStats[it.id];
          const r = itemRatings[it.id];
          return {
            item: it,
            clicks: itemClicks[it.id] ?? 0,
            openCount: s?.openCount ?? 0,
            completeCount: s?.completeCount ?? 0,
            completionRate: s?.completionRate ?? null,
            avgSessionSeconds: s?.avgSessionSeconds ?? null,
            thumbsUp: r?.thumbs_up ?? 0,
            thumbsDown: r?.thumbs_down ?? 0,
            bookmarkCount: itemBookmarks[it.id] ?? 0,
          };
        })
        .sort((a, b) => b.clicks - a.clicks);
      return { category: cat, views: catViews[cat.id] ?? 0, clicks: catClicks[cat.id] ?? 0, completionRate: catCompletionRate[cat.id] ?? null, totalSeconds: catTotalSeconds[cat.id] ?? 0, depth: catDepth[cat.id] ?? null, items };
    });
    return { rows, totalViews: d.totalViews ?? 0, totalClicks: d.totalClicks ?? 0, overallCompletionRate: d.overallCompletionRate ?? null, typeStats };
  }, [data]);

  const exportLabel =
    scope.kind === "facility" ? `${scope.facilityLabel}-${range}` : `overall-${range}`;

  return (
    <div>
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-40">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-full !h-[38px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(isAdmin || isContributor) && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={isRefreshing}
                    onClick={async () => {
                      setIsRefreshing(true);
                      try {
                        await doRefresh();
                        toast.success("Stats refreshed successfully.");
                      } catch (e: any) {
                        toast.error(e?.message ?? "Refresh failed.");
                      } finally {
                        setIsRefreshing(false);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-md px-[11px] py-2 text-sm font-medium transition-colors bg-muted/40 text-muted-foreground hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Manually refresh all stats now
                </TooltipContent>
              </Tooltip>
              {isTester && (
                <LoadingButton
                  variant="secondary"
                  pending={isResetting}
                  pendingText="Resetting…"
                  icon={<RefreshCw className="h-4 w-4" />}
                  className="flex-1 sm:flex-none !shadow-none"
                  onClick={async () => {
                    await confirm({
                      title: "Reset CPC Sales analytics?",
                      description: "This permanently deletes all completions, engagement time, logins, achievements, and pre-computed stats for every user in the CPC Sales facility. Run this before a QA test session to start from a clean baseline. This cannot be undone.",
                      confirmLabel: "Reset analytics",
                      destructive: true,
                      pendingLabel: "Resetting",
                      onConfirm: async () => {
                        setIsResetting(true);
                        try {
                          const result = await doResetFacility({ data: { facilityValue: "s003007001" } });
                          await qc.invalidateQueries();
                          toast.success(`CPC Sales analytics reset — cleared data for ${(result as any).clearedUsers} users.`);
                        } catch (err: any) {
                          toast.error(`Reset failed: ${err?.message ?? "Unknown error"}`);
                        } finally {
                          setIsResetting(false);
                        }
                      },
                    });
                  }}
                >
                  Reset CPC Sales
                </LoadingButton>
              )}
            </>
          )}
          <LoadingButton
            variant="secondary"
            onClick={async () => {
              if (!aggregated) return;
              setIsExporting(true);
              try {
                await waitForNextPaint();
                exportUsageCsv(aggregated, exportLabel, {
                  hoursSpent: (data as any)?.hoursSpent ?? 0,
                  totalSeconds: (data as any)?.totalSeconds,
                  usersSignedUp:
                    scope.kind === "facility"
                      ? ((data as any)?.facilityUserCount ?? 0)
                      : ((data as any)?.totalUsers ?? 0),
                });
              } finally {
                setTimeout(() => setIsExporting(false), 0);
              }
            }}
            disabled={!aggregated}
            pending={isExporting}
            pendingText="Exporting…"
            icon={<Download className="h-4 w-4" />}
            className="flex-1 sm:flex-none !shadow-none"
          >
            Export CSV
          </LoadingButton>
        </div>
      </div>

      {isLoading || !aggregated ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : scope.kind === "facility" && ((data as any)?.facilityUserCount ?? 0) === 0 ? (
        <p className="mt-8 text-muted-foreground">
          No reporting to show as there are no registered users for this facility.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Completion rate"
              value={aggregated.overallCompletionRate != null ? `${aggregated.overallCompletionRate}%` : "—"}
              tooltip="Out of everyone who opened content in this period, how many actually finished it."
            />
            {(() => {
              const timeVal = formatTimeSpent((data as any)?.totalSeconds ?? ((data as any)?.hoursSpent ?? 0) * 3600);
              const timeSz = timeVal.length <= 4 ? "text-3xl" : "text-2xl";
              return (
                <SummaryCard
                  icon={<Clock className="h-5 w-5" />}
                  label="Time spent"
                  value={timeVal}
                  tooltip="Total time users actively spent engaging with content in the selected period, measured in real session time."
                  valueClassName={timeSz}
                />
              );
            })()}
            <SummaryCard
              icon={<Eye className="h-5 w-5" />}
              label={aggregated.totalViews === 1 ? "Visit" : "Visits"}
              value={aggregated.totalViews}
              tooltip="How many times a category page was viewed in the selected period."
            />
            <SummaryCard
              icon={<MousePointerClick className="h-5 w-5" />}
              label={aggregated.totalClicks === 1 ? "Open" : "Opens"}
              value={aggregated.totalClicks}
              tooltip="How many times a content item was clicked and opened in the selected period."
            />
            <SummaryCard
              icon={<UsersIcon className="h-5 w-5" />}
              label={
                scope.kind === "facility"
                  ? ((data as any)?.facilityUserCount === 1 ? "User" : "Users")
                  : ((data as any)?.totalUsers === 1 ? "User" : "Users")
              }
              value={scope.kind === "facility" ? ((data as any)?.facilityUserCount ?? 0) : ((data as any)?.totalUsers ?? 0)}
              tooltip="Total registered users. Excludes admin, staff, testers, and synthetic accounts."
            />
          </div>
          <CategoryList rows={aggregated.rows} />
          <MostLeastEngaged rows={aggregated.rows} />
          <ContentTypeBreakdown typeStats={aggregated.typeStats} />
          <ProgramCompletionSection programs={growthData?.programCompletion ?? []} />
          <RetentionSection retention={growthData?.retention ?? null} totalUsers={growthData?.totalUsers ?? 0} />
          <GrowthSection weeklyData={growthData?.weeklyData ?? []} />
        </>
      )}
    </div>
  );
}

function exportUsageCsv(
  aggregated: { rows: AggregatedRow[]; totalViews: number; totalClicks: number; overallCompletionRate?: number | null; typeStats?: Record<string, { itemCount: number; opens: number; completions: number; completionRate: number | null; totalSeconds: number }> },
  label: string,
  summary: { hoursSpent: number; usersSignedUp: number; totalSeconds?: number },
) {
  const lines: string[] = [];

  // Summary
  lines.push(["Overall usage"].map(csvEscape).join(","));
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(["Visits", aggregated.totalViews].map(csvEscape).join(","));
  lines.push(["Opens", aggregated.totalClicks].map(csvEscape).join(","));
  lines.push(["Completion rate", aggregated.overallCompletionRate != null ? `${aggregated.overallCompletionRate}%` : ""].map(csvEscape).join(","));
  lines.push(["Time spent", formatTimeSpent(summary.totalSeconds ?? summary.hoursSpent * 3600)].map(csvEscape).join(","));
  lines.push(["Users signed up", summary.usersSignedUp].map(csvEscape).join(","));
  lines.push("");

  // Content type breakdown
  const typeRows = Object.entries(aggregated.typeStats ?? {})
    .filter(([, t]) => t.opens > 0 || t.completions > 0)
    .sort((a, b) => (b[1].completionRate ?? -1) - (a[1].completionRate ?? -1));
  if (typeRows.length > 0) {
    lines.push(["Content type preference"].map(csvEscape).join(","));
    lines.push(["Type", "Items", "Opens", "Completions", "Completion rate", "Time spent"].map(csvEscape).join(","));
    for (const [type, t] of typeRows) {
      lines.push([
        csvEscape(type.charAt(0).toUpperCase() + type.slice(1)),
        t.itemCount,
        t.opens,
        t.completions,
        t.completionRate != null ? `${t.completionRate}%` : "",
        t.totalSeconds > 0 ? formatTimeSpent(t.totalSeconds) : "",
      ].join(","));
    }
    lines.push("");
  }

  // Per-category and per-item detail
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Added", "Visits", "Opens", "Completion rate", "Avg depth", "Openers", "Completions", "Drop-offs", "Avg time spent", "Helpful", "Not helpful", "Bookmarks"]
      .map(csvEscape)
      .join(","),
  );
  for (const row of aggregated.rows) {
    lines.push(
      [
        csvEscape(row.category.name),
        csvEscape(row.category.slug),
        "",
        "",
        csvEscape(fmtDate(row.category.created_at)),
        row.views,
        row.clicks,
        row.completionRate != null ? `${row.completionRate}%` : "",
        row.depth != null ? row.depth : "",
        "",
        "",
        "",
        row.totalSeconds > 0 ? formatTimeSpent(row.totalSeconds) : "",
      ].join(","),
    );
    for (const { item, clicks, openCount, completeCount, completionRate, avgSessionSeconds, thumbsUp, thumbsDown, bookmarkCount } of row.items) {
      lines.push(
        [
          csvEscape(row.category.name),
          csvEscape(row.category.slug),
          csvEscape(item.title),
          csvEscape(item.type),
          csvEscape(fmtDate(item.created_at)),
          "",
          clicks,
          completionRate != null ? `${completionRate}%` : "",
          "",
          openCount || "",
          completeCount || "",
          openCount > 0 ? openCount - completeCount : "",
          avgSessionSeconds ? formatTimeSpent(avgSessionSeconds) : "",
          thumbsUp || "",
          thumbsDown || "",
          bookmarkCount || "",
        ].join(","),
      );
    }
  }
  downloadCsv(`report-${label}-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}

/* ---------------- Facility Comparison (Overall tab) ---------------- */

function FacilityComparisonSection() {
  const fetch = useServerFn(getFacilityComparison);
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["facility-comparison"],
    queryFn: () => fetch(),
    staleTime: 10 * 60 * 1000,
  });

  const facilities = data?.facilities ?? [];
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <UserSectionHeader
          title="Facility Comparison"
          description={`All facilities ranked by average content completion rate.${updatedAt ? ` · Updated daily · Last updated ${updatedAt}` : ""}`}
        />
        {facilities.length > 0 && (
          <LoadingButton
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            onClick={() => exportFacilityComparisonCsv(facilities as FacilityRow[])}
            className="flex-shrink-0"
          >
            Export CSV
          </LoadingButton>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : facilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No facility data yet — run content and check back after the nightly refresh.</p>
      ) : (
        <SectionCard padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Facility</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Users <InfoTooltip text="Total registered users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Active (7d) <InfoTooltip text="Users who engaged with at least one piece of content in the last 7 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Active (30d) <InfoTooltip text="Users who engaged with at least one piece of content in the last 30 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Participation <InfoTooltip text="Percentage of total registered users who were active in the last 30 days." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Avg completion <InfoTooltip text="Average item completion rate across all content visible to this facility's users. Updated nightly." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Items completed <InfoTooltip text="Total number of content items completed by all users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Time spent <InfoTooltip text="Total accumulated session time across all users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Bookmarks <InfoTooltip text="Total number of content items bookmarked by users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Helpful <InfoTooltip text="Total thumbs-up ratings given by users at this facility." /></span></th>
                  <th className="text-left px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1">Not helpful <InfoTooltip text="Total thumbs-down ratings given by users at this facility." /></span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(facilities as FacilityRow[]).map((f) => (
                  <tr key={f.facilityValue} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium whitespace-nowrap">{f.facilityLabel}</div>
                      {f.facilitySiteId && (
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{f.facilitySiteId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{f.totalUsers}</td>
                    <td className="px-4 py-3 tabular-nums">{f.activeUsers7d}</td>
                    <td className="px-4 py-3 tabular-nums">{f.activeUsers30d}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.totalUsers > 0 ? `${Math.round((f.activeUsers30d / f.totalUsers) * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.avgCompletionRate != null ? (
                        <span className={f.avgCompletionRate >= 70 ? "text-[var(--color-accent)] font-medium" : f.avgCompletionRate >= 40 ? "" : "text-muted-foreground"}>
                          {f.avgCompletionRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{f.itemsCompletedTotal}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                      {f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalBookmarks || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalThumbsUp || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{f.totalThumbsDown || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

/* ---------------- Facility Tab ---------------- */

function FacilityReportTab({ preselected }: { preselected: { value: string; label: string } }) {
  const fetch = useServerFn(getFacilityComparison);
  const { data } = useQuery({
    queryKey: ["facility-comparison"],
    queryFn: () => fetch(),
    staleTime: 10 * 60 * 1000,
  });

  const facilities = data?.facilities ?? [];
  const typedFacilities = facilities as FacilityRow[];
  const rank = typedFacilities.findIndex((f) => f.facilityValue === preselected.value) + 1;
  const total = typedFacilities.length;
  const thisStats = typedFacilities.find((f) => f.facilityValue === preselected.value);
  const updatedAt = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : null;

  return (
    <div>
      {rank > 0 && total > 1 && (
        <div className="mb-8 rounded-lg border border-border bg-muted/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div>
            <p className="text-xs text-muted-foreground tracking-wide font-medium mb-1">Facility Ranking</p>
            <p className="text-2xl font-bold tabular-nums">#{rank} <span className="text-sm font-normal text-muted-foreground">of {total} facilities</span></p>
          </div>
          {thisStats?.avgCompletionRate != null && (
            <div>
              <p className="text-xs text-muted-foreground tracking-wide font-medium mb-1">Avg Completion</p>
              <p className="text-2xl font-bold tabular-nums">{thisStats.avgCompletionRate}%</p>
            </div>
          )}
          {updatedAt && (
            <p className="text-xs text-muted-foreground sm:ml-auto self-end sm:self-center italic">Updated daily · Last updated {updatedAt}</p>
          )}
        </div>
      )}
      <UsageReportView
        scope={{ kind: "facility", facilityValue: preselected.value, facilityLabel: preselected.label }}
      />
    </div>
  );
}

/* ---------------- Users Tab ---------------- */

function UsersReportTab({
  preselected,
  activeUser,
  setActiveUser,
}: {
  preselected: { value: string; label: string };
  activeUser: { userId: string; name: string; pin?: string | null } | null;
  setActiveUser: (u: { userId: string; name: string; pin?: string | null } | null) => void;
}) {
  const fetchUsers = useServerFn(listFacilityUsers);
  const fetchFacilityStaff = useServerFn(listFacilityAdminUsers);
  const fetchBulkProgress = useServerFn(getBulkFacilityProgressReport);
  const selected = preselected.value;
  const isAll = selected === "__all__";
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [selected]);

  const usersQuery = useQuery({
    queryKey: ["admin", "facility-users", selected, page],
    enabled: !!selected,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchUsers({ data: { facilityValue: isAll ? "" : selected, page, pageSize: 10 } }),
  });

  // Fetch facilityUser accounts for this facility (only on specific facility view)
  const staffQuery = useQuery({
    queryKey: ["admin", "facility-staff", selected],
    enabled: !!selected && !isAll,
    queryFn: () => fetchFacilityStaff({ data: { facilityValue: selected } }),
  });

  const selectedLabel = preselected.label;

  if (activeUser) {
    return (
      <UserProgressView
        userId={activeUser.userId}
        userName={activeUser.name}
        userPin={activeUser.pin}
        onBack={() => setActiveUser(null)}
      />
    );
  }

  const users = usersQuery.data?.users ?? [];
  const totalUsers = usersQuery.data?.total ?? 0;
  const staff = staffQuery.data?.users ?? [];
  const visibleUsers = users;
  const isLoading = usersQuery.isLoading || (!isAll && staffQuery.isLoading);

  return (
    <div>
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end">
        <LoadingButton
          variant="secondary"
          onClick={async () => {
            setIsExporting(true);
            try {
              await waitForNextPaint();
              // Fetch all pages in batches of 100 to avoid large response payloads
              const EXPORT_PAGE = 100;
              const allExportUsers: any[] = [];
              for (let p = 0; ; p++) {
                const result = await fetchUsers({
                  data: {
                    facilityValue: isAll ? "" : selected,
                    includeSynthetic: isAll ? true : false,
                    page: p,
                    pageSize: EXPORT_PAGE,
                  },
                });
                allExportUsers.push(...(result.users ?? []));
                if (allExportUsers.length >= (result.total ?? 0)) break;
              }
              exportFacilityUsersCsv(allExportUsers, selectedLabel, isAll);
            } finally {
              setTimeout(() => setIsExporting(false), 0);
            }
          }}
          disabled={isLoading || (!isAll && users.length === 0)}
          pending={isExporting}
          pendingText="Exporting…"
          icon={<Download className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Export CSV
        </LoadingButton>
        {!isAll && (
          <LoadingButton
            variant="secondary"
            onClick={async () => {
              setIsBulkExporting(true);
              try {
                await waitForNextPaint();
                const result = await fetchBulkProgress({ data: { facilityValue: selected } });
                exportBulkFacilityProgressCsv(result, selectedLabel);
              } finally {
                setTimeout(() => setIsBulkExporting(false), 0);
              }
            }}
            disabled={isLoading || users.length === 0}
            pending={isBulkExporting}
            pendingText="Exporting…"
            icon={<Download className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Export All Progress (CSV)
          </LoadingButton>
        )}
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Facility Staff section — only shown on specific facility view */}
          {!isAll && (
            <div className="mt-8">
              <UserSectionHeader className="mb-3" title="Facility Staff" count={staff.length} description="Facility admin accounts." />
              <SectionCard padded={false} className="overflow-hidden">
                {staff.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">No facility staff accounts.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {staff.map((u) => {
                      const name = [u.profile?.first_name, u.profile?.last_name].filter(Boolean).map(capFirst).join(" ") || u.email || "—";
                      return (
                        <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-6 py-4 pb-6 sm:pb-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Joined {fmtDate(u.created_at) || "—"}
                              {u.last_sign_in_at && <>{" · "}Last sign-in {fmtDate(u.last_sign_in_at)}</>}
                            </p>
                          </div>
                          <Badge variant={u.email_confirmed_at ? "verified" : "unverified"}>
                            {u.email_confirmed_at ? "Verified" : "Unverified"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>
          )}

          {/* Regular users section */}
          <div className={!isAll ? "mt-8" : "mt-0"}>
            {!isAll && (
              <UserSectionHeader className="mb-3" title="Users" count={users.length} description="Regular user accounts signed up from the public form." />
            )}
            {users.length === 0 ? (
              <p className={`text-muted-foreground ${!isAll ? "" : "mt-8"}`}>
                {isAll ? "No registered users." : "No users in this facility."}
              </p>
            ) : (
              <>
                <SectionCard padded={false} className={`overflow-hidden ${!isAll ? "" : "mt-8"}`}>
                  <ul className="divide-y divide-border">
                    {(visibleUsers as any[]).map((u) => {
                      const name = [u.first_name, u.last_name].filter(Boolean).map(capFirst).join(" ") || capFirst(u.username) || "—";
                      const meta: string[] = [];
                      if (u.username) meta.push(`@${capFirst(u.username)}`);
                      if ((u as any).inmate_pin) meta.push(`PIN: ${(u as any).inmate_pin}`);
                      if (isAll && (u as any).facility_label) meta.push((u as any).facility_label);
                      const lastLoginIso = (u as any).last_login_date || null;
                      return (
                        <li key={u.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-6 py-4 pb-6 sm:pb-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            {meta.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">{meta.join(" · ")}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              Signed up {fmtDate(u.created_at) || "—"}
                              {" · "}
                              Last login {lastLoginIso ? fmtDate(lastLoginIso) : "Never"}
                              {(u as any).engagement_tier && (
                                <> · <span className="text-[var(--color-accent)]">{(u as any).engagement_tier}</span></>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveUser({ userId: u.user_id, name, pin: (u as any).inmate_pin ?? null })}
                            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted self-start sm:self-auto"
                          >
                            View report
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </SectionCard>
                <Pager page={page} total={totalUsers} pageSize={10} onPage={setPage} itemLabel="user" itemLabelPlural="users" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}


function exportFacilityUsersCsv(
  users: { user_id: string; username: string; first_name: string; last_name: string; created_at: string; facility?: string; last_login_date?: string | null }[],
  facilityLabel: string,
  includeFacility = false,
) {
  const lines: string[] = [];
  const headers = includeFacility
    ? ["First name", "Last name", "Username", "PIN", "Facility", "Joined", "Last login", "Engagement tier", "Facility percentile"]
    : ["First name", "Last name", "Username", "PIN", "Joined", "Last login", "Engagement tier", "Facility percentile"];
  lines.push(headers.map(csvEscape).join(","));
  for (const u of users) {
    const lastLogin = u.last_login_date || "";
    const tier = (u as any).engagement_tier ?? "";
    const pct = (u as any).facility_percentile != null ? `${(u as any).facility_percentile}%` : "";
    const pin = (u as any).inmate_pin ?? "";
    const facilityName = (u as any).facility_label || u.facility || "";
    const row = includeFacility
      ? [u.first_name, u.last_name, u.username, pin, facilityName, fmtDate(u.created_at), fmtDate(lastLogin), tier, pct]
      : [u.first_name, u.last_name, u.username, pin, fmtDate(u.created_at), fmtDate(lastLogin), tier, pct];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(
    `users-${facilityLabel || "facility"}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}

function exportBulkFacilityProgressCsv(
  data: Awaited<ReturnType<typeof getBulkFacilityProgressReport>>,
  facilityLabel: string,
) {
  const { users, categories, items, progress, engagement, bookmarks, ratings, logins, userStats } = data as any;

  // Build lookup maps
  const progressSet = new Set<string>(); // "userId|itemId"
  const progressDate = new Map<string, string>(); // "userId|itemId" → date
  for (const r of progress as any[]) {
    const key = `${r.user_id}|${r.content_item_id}`;
    progressSet.add(key);
    if (r.created_at && !progressDate.has(key)) progressDate.set(key, r.created_at);
  }
  const engMap = new Map<string, any>(); // "userId|itemId"
  for (const r of engagement as any[]) engMap.set(`${r.user_id}|${r.content_item_id}`, r);
  const bookmarkSet = new Set<string>();
  for (const r of bookmarks as any[]) bookmarkSet.add(`${r.user_id}|${r.content_item_id}`);
  const ratingMap = new Map<string, number>(); // "userId|itemId" → rating
  for (const r of ratings as any[]) ratingMap.set(`${r.user_id}|${r.content_item_id}`, r.rating as number);
  const lastLoginMap = new Map<string, string>(); // userId → most recent login_date
  for (const r of logins as any[]) {
    if (!lastLoginMap.has(r.user_id) || r.login_date > (lastLoginMap.get(r.user_id) ?? "")) {
      lastLoginMap.set(r.user_id as string, r.login_date as string);
    }
  }
  const statsMap = new Map<string, any>(); // userId
  for (const r of userStats as any[]) statsMap.set(r.user_id as string, r);

  // Group items by category_id, preserving sort_order from the server response.
  const itemsByCategory = new Map<string, any[]>();
  for (const item of items as any[]) {
    const cid = item.category_id as string;
    if (!itemsByCategory.has(cid)) itemsByCategory.set(cid, []);
    itemsByCategory.get(cid)!.push(item);
  }

  const lines: string[] = [];
  lines.push([
    "First Name", "Last Name", "Username", "PIN",
    "Last Login", "Items Completed", "Time Spent (hrs)",
    "Category", "Item Title",
    "Completed", "Completed On", "Progress %", "Time on Item (min)",
    "Bookmarked", "Rating",
  ].map(csvEscape).join(","));

  // Track which user- and category-level values were shown on the previous row
  // so we can blank them out when they repeat — keeps the sheet readable.
  let prevUid = "";
  let prevCatId = "";

  for (const user of users as any[]) {
    const uid = user.user_id as string;
    const stats = statsMap.get(uid);
    const itemsCompleted = stats?.items_completed ?? 0;
    const totalSecs = stats?.total_session_seconds ?? 0;
    const lastLogin = lastLoginMap.get(uid) ? fmtDate(lastLoginMap.get(uid)!) : "";
    const hoursSpent = totalSecs > 0 ? (totalSecs / 3600).toFixed(1) : "0";

    // Iterate categories in sort_order, then items within each category in sort_order.
    for (const cat of categories as any[]) {
      const catItems = itemsByCategory.get(cat.id as string) ?? [];
      for (const item of catItems) {
        const key = `${uid}|${item.id}`;
        const eng = engMap.get(key);
        const isRead = progressSet.has(key);
        const readDate = progressDate.get(key) ? fmtDate(progressDate.get(key)!) : "";
        const bookmarked = bookmarkSet.has(key) ? "Yes" : "";
        const rating = ratingMap.get(key);
        const ratingStr = rating === 1 ? "Helpful" : rating === -1 ? "Not helpful" : "";

        // Progress %
        const isAV = item.type && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("audio") || item.type.toLowerCase().includes("podcast"));
        const isPdf = (item.file_url && /\.pdf(\?|#|$)/i.test(item.file_url)) || (item.url && /\.pdf(\?|#|$)/i.test(item.url));
        let progressPct = "";
        if (isRead) {
          progressPct = "100%";
        } else if (eng) {
          if (isAV && eng.media_progress_seconds && eng.media_duration_seconds > 0) {
            progressPct = `${Math.min(100, Math.round((eng.media_progress_seconds / eng.media_duration_seconds) * 100))}%`;
          } else if (isPdf && eng.manual_completion_pct != null) {
            progressPct = `${eng.manual_completion_pct}%`;
          }
        }

        // Time on item
        const itemSecs = eng?.session_seconds ?? 0;
        const timeOnItem = itemSecs > 0 ? (itemSecs / 60).toFixed(1) : "";

        // User-level columns: blank when this is not the first row for this user.
        const isNewUser = uid !== prevUid;
        const isNewCat = isNewUser || cat.id !== prevCatId;

        lines.push([
          isNewUser ? (user.first_name ?? "") : "",
          isNewUser ? (user.last_name ?? "") : "",
          isNewUser ? (user.username ?? "") : "",
          isNewUser ? (user.inmate_pin ?? "") : "",
          isNewUser ? lastLogin : "",
          isNewUser ? itemsCompleted : "",
          isNewUser ? hoursSpent : "",
          // Category column: blank for subsequent items within the same category.
          isNewCat ? cat.name : "",
          item.title,
          isRead ? "Yes" : "No", readDate, progressPct, timeOnItem,
          bookmarked, ratingStr,
        ].map(csvEscape).join(","));

        prevUid = uid;
        prevCatId = cat.id;
      }
    }
  }

  downloadCsv(
    `bulk-progress-${facilityLabel.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}

function exportFacilityComparisonCsv(facilities: FacilityRow[]) {
  const lines: string[] = [];
  lines.push(["Facility", "Site ID", "Total users", "Active (7d)", "Active (30d)", "Participation (30d)", "Avg completion %", "Items completed", "Time spent", "Bookmarks", "Helpful", "Not helpful"].map(csvEscape).join(","));
  for (const f of facilities) {
    const participation = f.totalUsers > 0 ? `${Math.round((f.activeUsers30d / f.totalUsers) * 100)}%` : "";
    const row = [
      f.facilityLabel,
      f.facilitySiteId ?? "",
      String(f.totalUsers),
      String(f.activeUsers7d),
      String(f.activeUsers30d),
      participation,
      f.avgCompletionRate != null ? `${f.avgCompletionRate}%` : "",
      String(f.itemsCompletedTotal),
      f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "",
      f.totalBookmarks || "",
      f.totalThumbsUp || "",
      f.totalThumbsDown || "",
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(`facility-comparison-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}

/* ---------------- User Progress View ---------------- */

function UserProgressView({
  userId,
  userName,
  userPin,
  onBack,
}: {
  userId: string;
  userName: string;
  userPin?: string | null;
  onBack: () => void;
}) {
  const fetchProgress = useServerFn(getUserProgressReport);
  const fetchMonthlySummary = useServerFn(getAdminUserMonthlySummary);
  const [range, setRange] = useState<RangeKey>("30d");

  const monthlySummaryQuery = useQuery({
    queryKey: ["admin", "user-monthly-summary", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchMonthlySummary({ data: { userId } }),
  });
  const [isExporting, setIsExporting] = useState(false);
  const { data: rawData, isLoading } = useQuery({
    queryKey: ["admin", "user-progress", userId],
    queryFn: () => fetchProgress({ data: { userId } }),
  });

  const data = useMemo(() => {
    if (!rawData) return rawData;
    const allProgress = rawData.progress ?? [];
    const days = range === "all" ? null : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = days === null ? -Infinity : Date.now() - days * 24 * 60 * 60 * 1000;
    const filteredProgress = allProgress.filter(
      (p: any) => new Date(p.created_at).getTime() >= cutoff,
    );
    const readAtMap = new Map<string, string>();
    for (const p of filteredProgress) {
      const prev = readAtMap.get(p.content_item_id);
      if (!prev || new Date(p.created_at).getTime() < new Date(prev).getTime()) {
        readAtMap.set(p.content_item_id, p.created_at);
      }
    }
    return {
      ...rawData,
      items: rawData.items.map((i: any) => ({
        ...i,
        read: readAtMap.has(i.id),
        read_at: readAtMap.get(i.id) ?? null,
      })),
      logins: (rawData.logins ?? []).filter((d: string) => {
        const t = new Date(d).getTime();
        return !isNaN(t) && t >= cutoff;
      }),
      progress: filteredProgress,
    };
  }, [rawData, range]);

  const grouped = useMemo(() => {
    if (!data) return [] as { category: any; items: any[]; total: number; read: number }[];
    const itemsByCat = new Map<string, any[]>();
    for (const it of data.items) {
      const arr = itemsByCat.get(it.category_id) ?? [];
      arr.push(it);
      itemsByCat.set(it.category_id, arr);
    }
    return data.categories.map((c: any) => {
      const items = itemsByCat.get(c.id) ?? [];
      const trackable = items.filter((i: any) => !i.exempt_from_progress);
      const read = trackable.filter((i: any) => i.read).length;
      return { category: c, items, total: trackable.length, read };
    });
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Back to users
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h2 className="font-display text-xl font-semibold truncate">{userName}</h2>
          {userPin && <span className="text-muted-foreground font-normal text-lg shrink-0">({userPin})</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-4 xl:mt-0">
          <div className="flex-1 xl:flex-none xl:w-40">
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-full !h-[38px] shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LoadingButton
            variant="secondary"
            onClick={async () => {
              if (!data) return;
              setIsExporting(true);
              try {
                await waitForNextPaint();
                exportUserProgressCsv(data, userName);
              } finally {
                setTimeout(() => setIsExporting(false), 0);
              }
            }}
            disabled={!data}
            pending={isExporting}
            pendingText="Exporting…"
            icon={<Download className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Export CSV
          </LoadingButton>
        </div>
      </div>


      {isLoading || !data ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          {(() => {
            const totalItems = data.items.filter((i: any) => !i.exempt_from_progress).length;
            const readItems = data.items.filter((i: any) => !i.exempt_from_progress && i.read).length;
            const totalSessionSeconds = (data as any).totalSeconds
              ?? data.items.reduce((acc: number, i: any) => acc + ((i.sessionSeconds as number) || 0), 0);
            // categories completed
            let totalCats = 0;
            let completedCats = 0;
            for (const g of grouped) {
              if (g.total > 0) {
                totalCats += 1;
                if (g.read >= g.total) completedCats += 1;
              }
            }
            // streak
            const loginDays = new Set<string>(data.logins ?? []);
            let streak = 0;
            if (loginDays.size > 0) {
              const fmt = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${y}-${m}-${dd}`;
              };
              const cursor = new Date();
              if (!loginDays.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
              while (loginDays.has(fmt(cursor))) {
                streak += 1;
                cursor.setDate(cursor.getDate() - 1);
              }
            }
            const fraction = (done: number, total: number) => (
              <span className="inline-flex items-center gap-1.5">
                <span>{done.toLocaleString()}</span>
                <span className="font-serif italic text-base font-normal text-[var(--color-accent)] lowercase tracking-wide">of</span>
                <span>{total.toLocaleString()}</span>
              </span>
            );
            const lastLogin = (data.logins ?? []).reduce(
              (max: string | null, d: string) => (!max || d > max ? d : max),
              null as string | null,
            );
            const stats = [
              { icon: CheckCircle2, label: "Items completed", value: fraction(readItems, totalItems) },
              { icon: Trophy, label: "Categories completed", value: fraction(completedCats, totalCats) },
              { icon: Clock, label: "Time spent", value: formatTimeSpent(totalSessionSeconds) },
              { icon: Flame, label: "Day streak", value: streak.toLocaleString() },
              { icon: Clock, label: "Last login", value: lastLogin ? fmtDateShort(lastLogin) : "Never" },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mt-8 mb-8">
                {stats.map((s) => (
                  <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} />
                ))}
              </div>
            );
          })()}

          {(() => {
            const ms = monthlySummaryQuery.data;
            if (!ms || (ms.itemsThisMonth === 0 && ms.secondsThisMonth === 0)) return null;
            const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const monthName = MONTH_NAMES[ms.monthIndex];
            const itemsDelta = ms.itemsThisMonth - ms.itemsLastMonth;
            const timeDelta = ms.secondsThisMonth - ms.secondsLastMonth;
            const deltaLabel = (n: number, formatted?: string) =>
              n > 0 ? `↑ ${formatted ?? n} more than last month`
              : n < 0 ? `↓ ${formatted ?? Math.abs(n)} fewer than last month`
              : "Same as last month";
            const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
              BookOpen, Compass, CheckCircle2, Award, Trophy, GraduationCap, Medal, Flame, Clock,
            };
            const earnedThisMonth = ACHIEVEMENTS.filter((a) =>
              (ms as any).achievementKeysThisMonth?.includes(a.key)
            );
            return (
              <details className="group mb-8 rounded-2xl border border-border bg-card overflow-hidden">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 list-none hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium">{monthName} {ms.year}</p>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {ms.itemsThisMonth} items · {formatTimeSpent(ms.secondsThisMonth)}
                      {ms.achievementsThisMonth > 0 && <> · {ms.achievementsThisMonth} achievements</>}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <div className="px-5 pb-5 pt-1 border-t border-border/40">
                  <div className={`grid gap-4 pt-4 ${earnedThisMonth.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
                    <div>
                      <p className="font-display text-2xl font-semibold tabular-nums">{ms.itemsThisMonth.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">items completed</p>
                      <p className="text-xs mt-1 text-muted-foreground/70">{deltaLabel(itemsDelta)}</p>
                    </div>
                    <div>
                      <p className="font-display text-2xl font-semibold tabular-nums">{formatTimeSpent(ms.secondsThisMonth)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">time spent</p>
                      <p className="text-xs mt-1 text-muted-foreground/70">{deltaLabel(timeDelta, formatTimeSpent(Math.abs(timeDelta)))}</p>
                    </div>
                    {earnedThisMonth.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {earnedThisMonth.map((a) => {
                            const Icon = ICON_MAP[a.icon] ?? Trophy;
                            return (
                              <Tooltip key={a.key}>
                                <TooltipTrigger asChild>
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 cursor-default">
                                    <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                                  <p className="font-semibold">{a.title}</p>
                                  <p>{a.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">achievements</p>
                        <p className="text-xs mt-1 text-muted-foreground/70">earned this month</p>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })()}

          {(() => {
            const tier = (data as any).engagementTier as string | null;
            const pct = (data as any).facilityPercentile as number | null;
            const statsUpdated = (data as any).statsUpdatedAt as string | null;
            if (!tier) return null;
            return (
              <div className="mb-8 rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-medium">
                    Engagement level:{" "}
                    <span className="text-[var(--color-accent)] font-semibold">{tier}</span>
                    {pct != null && (
                      <span className="text-muted-foreground font-normal"> · top {Math.round(100 - pct)}% of facility readers</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Based on time spent · Updates daily
                    {statsUpdated && <> · Last updated {new Date(statsUpdated).toLocaleDateString()}</>}
                  </p>
                </div>
              </div>
            );
          })()}

          {(() => {
            const earned = (data as any).achievements as Record<string, string> | undefined ?? {};
            const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
              BookOpen, Compass, CheckCircle2, Award, Trophy, GraduationCap, Medal, Flame, Clock,
            };
            return (
              <div className="mb-8 rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium mb-3">Achievements</p>
                <div className="flex flex-wrap gap-2">
                  {ACHIEVEMENTS.map((a) => {
                    const isEarned = !!earned[a.key];
                    const Icon = ICON_MAP[a.icon] ?? Trophy;
                    return (
                      <Tooltip key={a.key}>
                        <TooltipTrigger asChild>
                          <span className={`inline-flex items-center justify-center h-12 w-12 rounded-full border cursor-default transition-all ${
                            isEarned
                              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10"
                              : "border-border bg-muted opacity-40"
                          }`}>
                            <Icon className={`h-5 w-5 ${isEarned ? "text-[var(--color-accent)]" : "text-muted-foreground"}`} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                          <p className="font-semibold">{a.title}</p>
                          <p>{a.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <UserCategoryList groups={grouped} />
        </>
      )}
    </div>
  );
}


function exportUserProgressCsv(
  data: Awaited<ReturnType<typeof getUserProgressReport>>,
  userName: string,
) {
  const lines: string[] = [];
  const lastLogin = (data.logins ?? []).reduce(
    (max: string | null, d: string) => (!max || d > max ? d : max),
    null as string | null,
  );

  // Summary metrics
  const itemsArr = data.items as any[];
  const totalItems = itemsArr.filter((i) => !i.exempt_from_progress).length;
  const readItems = itemsArr.filter((i) => !i.exempt_from_progress && i.read).length;
  const totalSecondsForUser = (data as any).totalSeconds
    ?? itemsArr.reduce((acc: number, i: any) => acc + ((i.sessionSeconds as number) || 0), 0);
  const itemsByCatForSummary = new Map<string, any[]>();
  for (const it of itemsArr) {
    const arr = itemsByCatForSummary.get(it.category_id) ?? [];
    arr.push(it);
    itemsByCatForSummary.set(it.category_id, arr);
  }
  let totalCats = 0;
  let completedCats = 0;
  for (const c of data.categories as any[]) {
    const items = itemsByCatForSummary.get(c.id) ?? [];
    if (items.length > 0) {
      totalCats += 1;
      if (items.every((i) => i.read)) completedCats += 1;
    }
  }
  const loginDays = new Set<string>(data.logins ?? []);
  let streak = 0;
  if (loginDays.size > 0) {
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    const cursor = new Date();
    if (!loginDays.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (loginDays.has(fmt(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const tier = (data as any).engagementTier as string | null;
  const pct = (data as any).facilityPercentile as number | null;
  lines.push(["Overall usage"].map(csvEscape).join(","));
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(["Items completed", `${readItems} of ${totalItems}`].map(csvEscape).join(","));
  lines.push(["Categories completed", `${completedCats} of ${totalCats}`].map(csvEscape).join(","));
  lines.push(["Time spent", formatTimeSpent(totalSecondsForUser)].map(csvEscape).join(","));
  lines.push(["Day streak", streak].map(csvEscape).join(","));
  lines.push(["Last login", lastLogin ? fmtDateShort(lastLogin) : "Never"].map(csvEscape).join(","));
  if (tier) lines.push(["Engagement tier", tier + (pct != null ? ` (top ${Math.round(100 - pct)}% of facility)` : "")].map(csvEscape).join(","));
  lines.push("");

  // Achievements
  const earnedAchievements = (data as any).achievements as Record<string, string> | undefined ?? {};
  const earnedList = ACHIEVEMENTS.filter((a) => !!earnedAchievements[a.key]);
  lines.push(["Achievements"].map(csvEscape).join(","));
  lines.push(["Achievement", "Description", "Earned on"].map(csvEscape).join(","));
  if (earnedList.length === 0) {
    lines.push(["No achievements earned yet", "", ""].map(csvEscape).join(","));
  } else {
    for (const a of earnedList) {
      lines.push([a.title, a.description, fmtDateShort(earnedAchievements[a.key])].map(csvEscape).join(","));
    }
  }
  lines.push("");

  lines.push(
    ["Category", "Item title", "Read", "Read on", "Progress", "Time Spent", "Bookmarked", "Rating"]
      .map(csvEscape)
      .join(","),
  );
  const itemsByCat = new Map<string, any[]>();
  for (const it of data.items) {
    const arr = itemsByCat.get(it.category_id) ?? [];
    arr.push(it);
    itemsByCat.set(it.category_id, arr);
  }
  for (const c of data.categories as any[]) {
    const items = itemsByCat.get(c.id) ?? [];
    const trackable = items.filter((i: any) => !i.exempt_from_progress);
    const read = trackable.filter((i: any) => i.read).length;
    const catSecs = items.reduce((sum: number, i: any) => sum + ((i.sessionSeconds as number) || 0), 0);
    // Category summary row: shows name, slug, aggregate read count, and total time.
    // Item rows below it leave the category columns blank (show only once).
    lines.push(
      [csvEscape(c.name), `${read} of ${trackable.length} read`, "", "", "", catSecs > 0 ? formatTimeSpent(catSecs) : "", "", ""].join(","),
    );
    for (const it of items) {
      const isAV = it.type && (it.type.toLowerCase().includes("video") || it.type.toLowerCase().includes("audio") || it.type.toLowerCase().includes("podcast"));
      const isPdf = ((it as any).file_url && /\.pdf(\?|#|$)/i.test((it as any).file_url)) || ((it as any).url && /\.pdf(\?|#|$)/i.test((it as any).url));
      const manualPct: number | null = (it as any).manualCompletionPct ?? null;
      const pdfPct: number | null = (it as any).pdfProgressPct ?? null;
      const progressStr = isAV && (it as any).mediaProgressPct != null
        ? `${(it as any).mediaProgressPct}%`
        : it.read && isPdf && manualPct != null
          ? `Read manually at ${manualPct}%`
          : !it.read && pdfPct !== null
            ? `${pdfPct}%`
            : "";
      const sessionSecs: number = (it as any).sessionSeconds || 0;
      lines.push(
        [
          "",
          csvEscape(it.title),
          it.read ? "Yes" : "No",
          csvEscape(it.read && (it as any).read_at ? fmtDateShort((it as any).read_at) : ""),
          progressStr,
          sessionSecs > 0 ? formatTimeSpent(sessionSecs) : "",
          (it as any).bookmarked ? "Yes" : "",
          (it as any).rating === 1 ? "Helpful" : (it as any).rating === -1 ? "Not helpful" : "",
        ].join(","),
      );
    }
  }
  const safeName = userName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "user";
  downloadCsv(
    `user-progress-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}

function UserCategoryList({
  groups,
}: {
  groups: { category: any; items: any[]; total: number; read: number }[];
}) {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  if (groups.length === 0) {
    return <p className="text-muted-foreground">No categories yet.</p>;
  }
  return (
    <div className="flex flex-col [&>section]:rounded-none [&>section:first-child]:rounded-t-2xl [&>section:last-child]:rounded-b-2xl [&>section:not(:first-child)]:-mt-px">
      {groups.map((g) => (
        <UserCategorySection
          key={g.category.id}
          group={g}
          isOpen={openId === g.category.id}
          dimmed={openId !== null && openId !== g.category.id}
          onToggle={() => setOpenId((cur) => (cur === g.category.id ? null : g.category.id))}
          t={t}
        />
      ))}
    </div>
  );
}

function UserCategorySection({
  group: g,
  isOpen,
  dimmed,
  onToggle,
  t,
}: {
  group: { category: any; items: any[]; total: number; read: number };
  isOpen: boolean;
  dimmed: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const open = isOpen;
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && sectionRef.current) {
      const el = sectionRef.current;
      requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: "smooth" });
      });
    }
  }, [isOpen]);
  return (
    <SectionCard
      ref={sectionRef as any}
      padded={false}
      className={`scroll-mt-24 overflow-hidden bg-[#fffdf8] transition-all duration-200 ${dimmed ? "opacity-40" : "opacity-100"} ${open ? "!border-2 !border-[var(--color-accent)]" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex flex-row items-center justify-between gap-3 p-6 ${open ? "border-b border-border bg-[#f7f5ec]" : "bg-[#fffdf8]"} text-left hover:bg-muted/50 transition-colors`}
      >
        {(() => {
          const trackableItems = g.items.filter((item: any) => !item.exempt_from_progress);
          const weightedPct = trackableItems.length > 0 ? Math.round(
            trackableItems.reduce((sum: number, item: any) => {
              if (item.read) return sum + 1;
              if (item.manualCompletionPct != null) return sum + item.manualCompletionPct / 100;
              if (item.mediaProgressPct != null && item.mediaProgressPct >= 5) return sum + Math.min(item.mediaProgressPct / 100, 0.95);
              if (item.pdfProgressPct != null && item.pdfProgressPct >= 1) return sum + Math.min(item.pdfProgressPct / 100, 0.95);
              return sum;
            }, 0) / trackableItems.length * 100
          ) : 0;
          const catTimeSeconds = g.items.reduce((sum: number, item: any) => sum + ((item.sessionSeconds as number) || 0), 0);
          return (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
                <CircleProgress value={weightedPct} size={52} stroke={5} />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold truncate">{g.category.name}</h2>
                  <p className="text-xs text-muted-foreground truncate">/{g.category.slug}</p>
                </div>
              </div>
              <div className="flex items-center flex-shrink-0 [&>span:not(:first-child)]:-ml-px [&>span:first-child]:rounded-r-none [&>span:last-child]:rounded-l-none [&>span:only-child]:rounded-[8px]">
                <span className="inline-flex items-center gap-1 rounded-[8px] border border-input bg-background px-2.5 py-[5px] text-xs font-medium tabular-nums">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {g.read} of {g.total} completed
                </span>
                {catTimeSeconds > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-[8px] border border-input bg-background px-2.5 py-[5px] text-xs font-medium tabular-nums">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatTimeSpent(catTimeSeconds)}
                  </span>
                )}
              </div>
            </>
          );
        })()}
      </button>
      {open &&
        (g.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No content items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {g.items.map((item: any) => {
              const labels = readStatusLabels(t, item);
              return (
                <li key={item.id} className="flex flex-col gap-[10px] bg-[#fffdf8] p-6">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="type" type={item.type} className="rounded-[8px]">
                      {item.type}
                    </Badge>
                    {item.duration && (
                      <span className="text-xs text-muted-foreground truncate min-w-0">
                        {withActionWord(item.duration, item.type)}
                      </span>
                    )}
                    <div className="ml-auto flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                      {item.rating != null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center rounded-[8px] border border-input overflow-hidden cursor-default">
                              <span className={`inline-flex items-center justify-center px-2 py-1.5 ${item.rating === 1 ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "bg-background text-muted-foreground"}`}>
                                <ThumbsUp className={`h-3.5 w-3.5 ${item.rating === 1 ? "fill-[var(--color-accent)]" : ""}`} />
                              </span>
                              <span className="w-px self-stretch bg-border" />
                              <span className={`inline-flex items-center justify-center px-2 py-1.5 ${item.rating === -1 ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground"}`}>
                                <ThumbsDown className={`h-3.5 w-3.5 ${item.rating === -1 ? "fill-destructive" : ""}`} />
                              </span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                            {item.rating === 1 ? "This user rated this item as helpful" : "This user rated this item as not helpful"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {item.bookmarked && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center rounded-[8px] border border-input bg-background px-2 py-1.5 cursor-default">
                              <Bookmark className="h-3.5 w-3.5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            This user has bookmarked this item
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {(() => {
                        if ((item as any).exempt_from_progress) {
                          return (
                            <span className={`inline-flex items-center leading-none gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 ${
                              item.read
                                ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                : "border-input bg-background text-foreground"
                            }`}>
                              {item.read
                                ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                : <Circle className="h-3.5 w-3.5 flex-shrink-0" />}
                              {item.read ? t("category.acknowledged") : t("category.acknowledge")}
                            </span>
                          );
                        }

                        // Video / Audio — playback progress
                        const mediaPct: number | null = item.mediaProgressPct ?? null;
                        const isAV = item.type && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("audio") || item.type.toLowerCase().includes("podcast"));
                        if (!item.read && isAV && mediaPct !== null && mediaPct >= 5) {
                          const watchedLabel = item.type.toLowerCase().includes("video")
                            ? t("category.markedWatched").toLowerCase()
                            : t("category.markedListened").toLowerCase();
                          return (
                            <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                              <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${mediaPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                              <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                              <span className="relative">{mediaPct}% {watchedLabel}</span>
                            </span>
                          );
                        }

                        // PDF — time-based reading progress (pre-calculated by getUserProgressReport)
                        const isPdf = (item.file_url && /\.pdf(\?|#|$)/i.test(item.file_url)) || (item.url && /\.pdf(\?|#|$)/i.test(item.url));
                        const pdfPct: number | null = (item as any).pdfProgressPct ?? null;
                        if (pdfPct !== null && pdfPct >= 1) {
                          return (
                            <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                              <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pdfPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                              <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                              <span className="relative">{pdfPct}% {t("category.markedRead").toLowerCase()}</span>
                            </span>
                          );
                        }

                        return (
                          <ReadStatusBadge
                            read={item.read}
                            readLabel={
                              item.read && isPdf && (item as any).manualCompletionPct != null
                                ? `${labels.read} at ${(item as any).manualCompletionPct}%`
                                : labels.read
                            }
                            unreadLabel={labels.unread}
                            readAt={item.read_at ? fmtDateShort(item.read_at) : null}
                          />
                        );
                      })()}
                      </div>
                      {(item as any).exempt_from_progress && (
                        <p className="text-[10px] text-muted-foreground leading-tight">Doesn't count toward this user's progress</p>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="truncate text-lg font-semibold text-foreground">{item.title}</p>
                      {(item as any).exempt_from_progress && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex flex-shrink-0 cursor-help text-muted-foreground">
                              <Info className="h-4 w-4" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs px-3 py-2">
                            Exempt from tracking — doesn't count toward this user's progress or completion stats.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
    </SectionCard>
  );
}

/* ---------------- Shared subcomponents ---------------- */

function SummaryCard({ icon, label, value, note, tooltip, valueClassName }: { icon: React.ReactNode; label: string; value: React.ReactNode; note?: string; tooltip?: string; valueClassName?: string }) {
  return (
    <SectionCard as="div" padded={false} className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
        {note && <span className="ml-auto text-xs italic text-muted-foreground/70">{note}</span>}
      </div>
      <p className={`mt-2 font-display font-semibold tabular-nums whitespace-nowrap ${valueClassName ?? "text-3xl"}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
    </SectionCard>
  );
}

function CategoryList({ rows }: { rows: AggregatedRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (rows.length === 0) {
    return <p className="mt-8 text-muted-foreground">No categories yet.</p>;
  }
  return (
    <div className="mt-8 flex flex-col [&>section]:rounded-none [&>section:first-child]:rounded-t-2xl [&>section:last-child]:rounded-b-2xl [&>section:not(:first-child)]:-mt-px">
      {rows.map((row) => (
        <CategorySection
          key={row.category.id}
          row={row}
          isOpen={openId === row.category.id}
          dimmed={openId !== null && openId !== row.category.id}
          onToggle={() => setOpenId((cur) => (cur === row.category.id ? null : row.category.id))}
        />
      ))}
    </div>
  );
}

function Stat({ icon, label, value, suffix, tooltip }: { icon: React.ReactNode; label: string; value: number | string | null; suffix?: string; tooltip?: string }) {
  const display = value == null ? "—" : typeof value === "string" ? value : `${value.toLocaleString()}${suffix ?? ""}`;
  const inner = (
    <span className={`inline-flex items-center gap-1 rounded-[8px] border border-border bg-background px-2.5 py-[5px] text-xs font-medium${tooltip ? " cursor-default" : ""}`}>
      {icon}
      <span className="tabular-nums">{display}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
  if (!tooltip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent className="max-w-xs px-3 py-2">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function StatGridCell({ icon, label, value, suffix, tooltip, className }: { icon: React.ReactNode; label: string; value: number | string | null; suffix?: string; tooltip?: string; className?: string }) {
  const display = value == null ? "—" : typeof value === "string" ? value : `${value.toLocaleString()}${suffix ?? ""}`;
  const inner = (
    <div className={`flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 ${className ?? ""}`}>
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div>
        <p className="text-sm font-semibold tabular-nums leading-tight">{display}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
  if (!tooltip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent className="max-w-xs px-3 py-2">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function CategorySection({ row, isOpen, dimmed, onToggle }: { row: AggregatedRow; isOpen: boolean; dimmed?: boolean; onToggle: () => void }) {
  const open = isOpen;
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && sectionRef.current) {
      const el = sectionRef.current;
      requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: "smooth" });
      });
    }
  }, [isOpen]);
  return (
    <SectionCard ref={sectionRef as any} padded={false} className={`scroll-mt-24 overflow-hidden bg-[#fffdf8] transition-all duration-200 ${dimmed ? "opacity-40" : "opacity-100"} ${open ? "!border-2 !border-[var(--color-accent)]" : ""}`}>
      {/* @container wrapper — children use @lg: based on this div's width */}
      <div className="@container">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`w-full flex flex-col @[800px]:flex-row @[800px]:items-center @[800px]:justify-between gap-3 p-6 ${open ? "border-b border-border bg-[#f7f5ec]" : "bg-[#fffdf8]"} text-left hover:bg-muted/50 transition-colors`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
            <CategoryIcon name={row.category.icon_name} color={row.category.icon_color} size="md" />
            <div className="min-w-0 flex flex-col justify-center">
              <h2 className="font-display text-lg font-semibold truncate">{row.category.name}</h2>
              <p className="text-xs text-muted-foreground truncate">
                /{row.category.slug}
                {row.category.created_at && <> · Added {fmtDate(row.category.created_at)}</>}
              </p>
            </div>
          </div>
          {/* Compact grid: shown when container is narrower than @lg */}
          <div className="@[800px]:hidden grid grid-cols-2 gap-2 w-full mt-2">
            <StatGridCell icon={<Eye className="h-3.5 w-3.5" />} label={row.views === 1 ? "visit" : "visits"} value={row.views} tooltip="How many times this category page was viewed in the selected period." />
            <StatGridCell icon={<MousePointerClick className="h-3.5 w-3.5" />} label={row.clicks === 1 ? "open" : "opens"} value={row.clicks} tooltip="How many times content items in this category were opened in the selected period." />
            {(() => {
              const hasBoth = row.completionRate != null && row.depth != null;
              return (
                <>
                  {row.completionRate != null && (
                    <StatGridCell icon={<BarChart3 className="h-3.5 w-3.5" />} label="completion" value={row.completionRate} suffix="%" tooltip="Of everyone who opened content in this category, how many finished it." className={!hasBoth ? "col-span-2" : ""} />
                  )}
                  {row.depth != null && (
                    <StatGridCell icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="depth" value={row.depth} tooltip="Average number of items completed per user who engaged with this category in the selected period." className={!hasBoth ? "col-span-2" : ""} />
                  )}
                </>
              );
            })()}
            <StatGridCell icon={<Clock className="h-3.5 w-3.5" />} label="time spent" value={row.totalSeconds > 0 ? formatTimeSpent(row.totalSeconds) : null} tooltip="Total time all users spent on content in this category in the selected period." className="col-span-2" />
          </div>
          {/* Connected pill: shown when container is @lg+ — never wraps */}
          <div className="hidden @[800px]:inline-flex flex-nowrap flex-shrink-0 [&>span:not(:first-child)]:-ml-px [&>span:first-child]:rounded-r-none [&>span:not(:first-child):not(:last-child)]:rounded-none [&>span:last-child]:rounded-l-none [&>span:only-child]:rounded-[8px]">
            <Stat icon={<Eye className="h-3.5 w-3.5" />} label={row.views === 1 ? "visit" : "visits"} value={row.views} tooltip="How many times this category page was viewed in the selected period." />
            <Stat icon={<MousePointerClick className="h-3.5 w-3.5" />} label={row.clicks === 1 ? "open" : "opens"} value={row.clicks} tooltip="How many times content items in this category were opened in the selected period." />
            {row.completionRate != null && (
              <Stat icon={<BarChart3 className="h-3.5 w-3.5" />} label="completion" value={row.completionRate} suffix="%" tooltip="Of everyone who opened content in this category, how many finished it." />
            )}
            {row.depth != null && (
              <Stat icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="depth" value={row.depth} tooltip="Average number of items completed per user who engaged with this category in the selected period." />
            )}
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="spent" value={row.totalSeconds > 0 ? formatTimeSpent(row.totalSeconds) : null} tooltip="Total time all users spent on content in this category in the selected period." />
          </div>
        </button>
      </div>
      {open && (
        row.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No content items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {row.items.map(({ item, clicks, openCount, completeCount, completionRate, avgSessionSeconds, thumbsUp, thumbsDown, bookmarkCount }) => (
              <li key={item.id} className="@container bg-[#fffdf8]">
                <div className="flex flex-col @[700px]:flex-row @[700px]:items-center gap-3 px-6 py-[19px]">
                  {/* Badge + title — always visible */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant="type" type={item.type} className="rounded-[8px] flex-shrink-0">
                      {item.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-sm font-bold">{item.title}</p>
                        {item.exempt_from_progress && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex flex-shrink-0 cursor-help text-muted-foreground">
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs px-3 py-2">
                              Exempt from tracking — this item doesn't count toward user progress or completion rates.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {item.created_at && (
                        <p className="text-xs text-muted-foreground">Added {fmtDate(item.created_at)}</p>
                      )}
                    </div>
                  </div>
                  {/* Wide: connected pill — never wraps */}
                  <div className="hidden @[700px]:flex items-center flex-shrink-0 flex-nowrap [&>span:not(:first-child)]:-ml-px [&>span:first-child]:rounded-r-none [&>span:not(:first-child):not(:last-child)]:rounded-none [&>span:last-child]:rounded-l-none [&>span:only-child]:rounded-[8px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                          {clicks.toLocaleString()}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs px-3 py-2">Opens — how many times this item was clicked in the selected period.</TooltipContent>
                    </Tooltip>
                    {completionRate != null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                            {completionRate}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs px-3 py-2">Of everyone who opened this item, how many finished it.</TooltipContent>
                      </Tooltip>
                    )}
                    {openCount > completeCount && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                            {openCount - completeCount} drop-off{openCount - completeCount === 1 ? "" : "s"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs px-3 py-2">Drop-offs — users who opened this item but did not complete it.</TooltipContent>
                      </Tooltip>
                    )}
                    {avgSessionSeconds != null && avgSessionSeconds > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatTimeSpent(avgSessionSeconds)} avg
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs px-3 py-2">Average time spent — mean session time per user who engaged with this item in the selected period.</TooltipContent>
                      </Tooltip>
                    )}
                    {(thumbsUp > 0 || thumbsDown > 0) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                            <span className="inline-flex items-center gap-1">
                              <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />{thumbsUp}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <ThumbsDown className="h-3.5 w-3.5 text-muted-foreground" />{thumbsDown}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs px-3 py-2">Helpful / Not helpful ratings from users.</TooltipContent>
                      </Tooltip>
                    )}
                    {bookmarkCount > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-[5px] text-xs font-medium rounded-[8px] tabular-nums cursor-default">
                            <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />{bookmarkCount}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs px-3 py-2">Users who have bookmarked this item.</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {/* Narrow: 2-column stat grid */}
                  {(() => {
                    const hasRatings = thumbsUp > 0 || thumbsDown > 0;
                    const conditionals = [completionRate != null, openCount > completeCount, avgSessionSeconds != null && avgSessionSeconds > 0, hasRatings, bookmarkCount > 0];
                    const totalVisible = 1 + conditionals.filter(Boolean).length;
                    const lastSpan2 = totalVisible % 2 !== 0;
                    let idx = 0;
                    const cells = [
                      <StatGridCell key="opens" icon={<MousePointerClick className="h-3.5 w-3.5" />} label="opens" value={clicks} tooltip="How many times this item was clicked in the selected period." />,
                      completionRate != null && <StatGridCell key="comp" icon={<BarChart3 className="h-3.5 w-3.5" />} label="completion" value={completionRate} suffix="%" tooltip="Of everyone who opened this item, how many finished it." />,
                      openCount > completeCount && <StatGridCell key="drop" icon={<Circle className="h-3.5 w-3.5" />} label="drop-offs" value={openCount - completeCount} tooltip="Users who opened this item but did not complete it." />,
                      avgSessionSeconds != null && avgSessionSeconds > 0 && <StatGridCell key="time" icon={<Clock className="h-3.5 w-3.5" />} label="avg time" value={formatTimeSpent(avgSessionSeconds)} tooltip="Mean session time per user who engaged with this item." />,
                      hasRatings && <StatGridCell key="ratings" icon={<ThumbsUp className="h-3.5 w-3.5" />} label="ratings" value={`${thumbsUp} / ${thumbsDown}`} tooltip="Helpful / Not helpful ratings from users." />,
                      bookmarkCount > 0 && <StatGridCell key="bk" icon={<Bookmark className="h-3.5 w-3.5" />} label="bookmarks" value={bookmarkCount} tooltip="Users who have bookmarked this item." />,
                    ].filter(Boolean) as React.ReactElement[];
                    return (
                      <div className="@[700px]:hidden grid grid-cols-2 gap-2">
                        {cells.map((cell, i) =>
                          lastSpan2 && i === cells.length - 1
                            ? React.cloneElement(cell, { className: "col-span-2" })
                            : cell
                        )}
                      </div>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </SectionCard>
  );
}

function MostLeastEngaged({ rows }: { rows: AggregatedRow[] }) {
  const allItems = rows.flatMap((r) =>
    r.items
      .filter((i) => i.openCount >= 3)
      .map((i) => ({ ...i, categoryName: r.category.name }))
  );
  if (allItems.length < 3) return null;

  const byRate = [...allItems].sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1));
  const most = byRate.slice(0, 5);
  const least = byRate.filter((i) => i.completionRate != null).slice(-5).reverse();
  if (most.length === 0) return null;

  const ItemList = ({ items, accent }: { items: typeof most; accent: boolean }) => (
    <SectionCard padded={false} className="overflow-hidden">
      <ul className="divide-y divide-border">
        {items.map(({ item, completionRate, openCount, categoryName }) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground truncate">{categoryName}</p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
              <span className={`text-sm font-semibold tabular-nums ${accent ? "text-[var(--color-accent)]" : "text-muted-foreground"}`}>{completionRate}%</span>
              <span className="text-xs text-muted-foreground tabular-nums">{openCount} openers</span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );

  return (
    <div className="mt-12">
      <Tabs defaultValue="most">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <UserSectionHeader
            title="Content engagement"
            description="The 5 highest and lowest completion rates among items opened by at least 3 users."
          />
          <TabsList className="h-auto p-2 gap-1 self-start sm:self-auto bg-muted/40 border border-border rounded-lg">
            <TabsTrigger value="most" className="px-4 py-2 text-sm data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              Most engaged
            </TabsTrigger>
            {least.length > 0 && (
              <TabsTrigger value="least" className="px-4 py-2 text-sm data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
                Least engaged
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="most" className="mt-0">
          <ItemList items={most} accent={true} />
        </TabsContent>
        {least.length > 0 && (
          <TabsContent value="least" className="mt-0">
            <ItemList items={least} accent={false} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ContentTypeBreakdown({
  typeStats,
}: {
  typeStats: Record<string, { itemCount: number; opens: number; completions: number; completionRate: number | null; totalSeconds: number }>;
}) {
  const rows = Object.entries(typeStats)
    .filter(([, t]) => t.opens > 0 || t.completions > 0)
    .sort((a, b) => (b[1].completionRate ?? -1) - (a[1].completionRate ?? -1));

  if (rows.length === 0) return null;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="mt-12">
      <UserSectionHeader
        className="mb-4"
        title="Content Type Preference"
        description="Opens, completions, and time spent broken down by content format, sorted by completion rate."
      />
      <SectionCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Items <InfoTooltip text="Number of published content items of this type." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Opens <InfoTooltip text="How many times items of this type were opened in the selected period." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Completions <InfoTooltip text="How many times items of this type were completed in the selected period." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Completion Rate <InfoTooltip text="Percentage of opens that resulted in completion." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Time Spent <InfoTooltip text="Total accumulated session time across all users on this content type. All time." /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(([type, t]) => (
                <tr key={type} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{capitalize(type)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.itemCount}</td>
                  <td className="px-4 py-3 tabular-nums">{t.opens}</td>
                  <td className="px-4 py-3 tabular-nums">{t.completions}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {t.completionRate != null ? (
                      <span className={t.completionRate >= 70 ? "text-[var(--color-accent)] font-medium" : t.completionRate >= 40 ? "" : "text-muted-foreground"}>
                        {t.completionRate}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {t.totalSeconds > 0 ? formatTimeSpent(t.totalSeconds) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function ProgramCompletionSection({
  programs,
}: {
  programs: { categoryId: string; name: string; totalItems: number; usersEngaged: number; usersCompleted: number; rate: number | null }[];
}) {
  const visible = programs.filter((p) => p.usersEngaged > 0);
  if (visible.length === 0) return null;
  return (
    <div className="mt-12">
      <UserSectionHeader
        className="mb-4"
        title="Program Completion"
        description="Of users who started a category, what percentage completed every item in it. All time."
      />
      <SectionCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                <th className="text-left px-4 py-3">Category</th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Items <InfoTooltip text="Total published content items in this program." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Started <InfoTooltip text="Users who have completed at least one item in this program." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Completed <InfoTooltip text="Users who have completed every single item in this program." /></span></th>
                <th className="text-left px-4 py-3"><span className="inline-flex items-center gap-1">Completion Rate <InfoTooltip text="Percentage of started users who finished the entire program. A user must complete all items to count." /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((p) => (
                <tr key={p.categoryId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.totalItems}</td>
                  <td className="px-4 py-3 tabular-nums">{p.usersEngaged}</td>
                  <td className="px-4 py-3 tabular-nums">{p.usersCompleted}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.rate != null ? (
                      <span className={p.rate >= 70 ? "text-[var(--color-accent)] font-medium" : p.rate >= 40 ? "" : "text-muted-foreground"}>
                        {p.rate}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function RetentionSection({
  retention,
  totalUsers,
}: {
  retention: { day7: number | null; day30: number | null; day60: number | null } | null;
  totalUsers: number;
}) {
  if (!retention || totalUsers === 0) return null;
  const { day7, day30, day60 } = retention;
  if (day7 === null && day30 === null && day60 === null) return null;
  return (
    <div className="mt-12">
      <UserSectionHeader
        className="mb-4"
        title="User Retention"
        description="Of users who signed up at least N days ago, what percentage returned within that window."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={<UsersIcon className="h-5 w-5" />} label="7-day return rate" value={day7 != null ? `${day7}%` : "—"} tooltip="Of users who signed up more than 7 days ago, the percentage who logged back in at least once within their first 7 days." />
        <SummaryCard icon={<UsersIcon className="h-5 w-5" />} label="30-day return rate" value={day30 != null ? `${day30}%` : "—"} tooltip="Of users who signed up more than 30 days ago, the percentage who logged back in at least once within their first 30 days." />
        <SummaryCard icon={<UsersIcon className="h-5 w-5" />} label="60-day return rate" value={day60 != null ? `${day60}%` : "—"} tooltip="Of users who signed up more than 60 days ago, the percentage who logged back in at least once within their first 60 days." />
      </div>
    </div>
  );
}

function GrowthSection({
  weeklyData,
}: {
  weeklyData: { weekEnding: string; signups: number; activeUsers: number }[];
}) {
  if (weeklyData.length === 0) return null;
  const maxSignups = Math.max(...weeklyData.map((w) => w.signups), 1);
  const maxActive = Math.max(...weeklyData.map((w) => w.activeUsers), 1);
  return (
    <div className="mt-12">
      <UserSectionHeader
        className="mb-4"
        title="Growth"
        description="New signups and active users per week over the last 12 weeks."
      />
      <SectionCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                <th className="text-left px-4 py-3">Week ending</th>
                <th className="text-left px-4 py-3 w-64"><span className="inline-flex items-center gap-1">New signups <InfoTooltip text="Users who created an account during this week." /></span></th>
                <th className="text-left px-4 py-3 w-64"><span className="inline-flex items-center gap-1">Active users <InfoTooltip text="Unique users who opened at least one piece of content during this week." /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weeklyData.map((w) => (
                <tr key={w.weekEnding} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground text-xs">{w.weekEnding}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${(w.signups / maxSignups) * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-xs w-6 text-right">{w.signups}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${(w.activeUsers / maxActive) * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-xs w-6 text-right">{w.activeUsers}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
