import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
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
import { waitForNextPaint } from "@/lib/paint";
import { useI18n } from "@/lib/i18n";
import {
  getUsageReport,
  listFacilityUsers,
  getUserProgressReport,
} from "@/lib/reports.functions";
import { listFacilityAdminUsers } from "@/lib/users.functions";
import { getFacilityComparison } from "@/lib/analytics-stats.functions";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Pager } from "@/components/LoadMorePager";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminReportsPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; shortLabel: string }[] = [
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
};

type AggregatedRow = {
  category: Category;
  views: number;
  clicks: number;
  completionRate: number | null;
  totalSeconds: number;
  items: { item: ContentItem; clicks: number; openCount: number; completeCount: number; completionRate: number | null; avgSessionSeconds: number | null }[];
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
  const [activeUser, setActiveUser] = useState<{ userId: string; name: string } | null>(null);

  const fetchFacilities = useServerFn(listAllFacilities);
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
          <TabsList className="h-auto p-2 gap-1 w-full lg:w-auto bg-muted/40 self-stretch lg:self-center">
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
  );
}

/* ---------------- Usage Report (Overall + Facility) ---------------- */

type UsageScope =
  | { kind: "overall" }
  | { kind: "facility"; facilityValue: string; facilityLabel: string };

function UsageReportView({ scope }: { scope: UsageScope }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [isExporting, setIsExporting] = useState(false);
  const fetchReport = useServerFn(getUsageReport);

  const facilityValue = scope.kind === "facility" ? scope.facilityValue : null;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "report", scope.kind, facilityValue, range],
    queryFn: () =>
      fetchReport({
        data: { range, facilityValue: facilityValue ?? null },
      }),
  });

  // Build AggregatedRow[] from pre-aggregated counts returned by the server
  const aggregated = useMemo(() => {
    if (!data) return null;
    const d = data as any;
    const catViews: Record<string, number> = d.catViews ?? {};
    const catClicks: Record<string, number> = d.catClicks ?? {};
    const itemClicks: Record<string, number> = d.itemClicks ?? {};
    const itemStats: Record<string, { openCount: number; completeCount: number; completionRate: number | null; avgSessionSeconds: number | null }> = d.itemStats ?? {};
    const catCompletionRate: Record<string, number | null> = d.catCompletionRate ?? {};
    const catTotalSeconds: Record<string, number> = d.catTotalSeconds ?? {};
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
          return {
            item: it,
            clicks: itemClicks[it.id] ?? 0,
            openCount: s?.openCount ?? 0,
            completeCount: s?.completeCount ?? 0,
            completionRate: s?.completionRate ?? null,
            avgSessionSeconds: s?.avgSessionSeconds ?? null,
          };
        })
        .sort((a, b) => b.clicks - a.clicks);
      return { category: cat, views: catViews[cat.id] ?? 0, clicks: catClicks[cat.id] ?? 0, completionRate: catCompletionRate[cat.id] ?? null, totalSeconds: catTotalSeconds[cat.id] ?? 0, items };
    });
    return { rows, totalViews: d.totalViews ?? 0, totalClicks: d.totalClicks ?? 0, overallCompletionRate: d.overallCompletionRate ?? null };
  }, [data]);

  const exportLabel =
    scope.kind === "facility" ? `${scope.facilityLabel}-${range}` : `overall-${range}`;

  return (
    <div>
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`inline-flex flex-1 sm:flex-none items-center justify-center rounded-md border px-4 py-2 text-sm text-center whitespace-normal sm:whitespace-nowrap transition-colors ${
                range === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {opt.key === "all" ? (
                "All time"
              ) : (
                <>
                  <span className="hidden sm:inline">Last&nbsp;</span>
                  {opt.shortLabel}
                </>
              )}
            </button>
          ))}
        </div>
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
          className="w-full sm:w-auto"
        >
          Export CSV
        </LoadingButton>
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
              icon={<Eye className="h-5 w-5" />}
              label={aggregated.totalViews === 1 ? "Visit" : "Visits"}
              value={aggregated.totalViews}
            />
            <SummaryCard
              icon={<MousePointerClick className="h-5 w-5" />}
              label={aggregated.totalClicks === 1 ? "Open" : "Opens"}
              value={aggregated.totalClicks}
            />
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5" />}
              label="Completion rate"
              value={aggregated.overallCompletionRate != null ? `${aggregated.overallCompletionRate}%` : "—"}
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5" />}
              label="Time spent"
              value={formatTimeSpent((data as any)?.totalSeconds ?? ((data as any)?.hoursSpent ?? 0) * 3600)}
            />
            <SummaryCard
              icon={<UsersIcon className="h-5 w-5" />}
              label={
                scope.kind === "facility"
                  ? ((data as any)?.facilityUserCount === 1 ? "User" : "Users")
                  : ((data as any)?.totalUsers === 1 ? "User" : "Users")
              }
              value={scope.kind === "facility" ? ((data as any)?.facilityUserCount ?? 0) : ((data as any)?.totalUsers ?? 0)}
            />
          </div>
          <CategoryList rows={aggregated.rows} />
          <MostLeastEngaged rows={aggregated.rows} />
        </>
      )}
    </div>
  );
}

function exportUsageCsv(
  aggregated: { rows: AggregatedRow[]; totalViews: number; totalClicks: number; overallCompletionRate?: number | null },
  label: string,
  summary: { hoursSpent: number; usersSignedUp: number; totalSeconds?: number },
) {
  const lines: string[] = [];
  lines.push(["Overall usage"].map(csvEscape).join(","));
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(["Visits", aggregated.totalViews].map(csvEscape).join(","));
  lines.push(["Opens", aggregated.totalClicks].map(csvEscape).join(","));
  lines.push(["Completion rate", aggregated.overallCompletionRate != null ? `${aggregated.overallCompletionRate}%` : ""].map(csvEscape).join(","));
  lines.push(["Time spent", formatTimeSpent(summary.totalSeconds ?? summary.hoursSpent * 3600)].map(csvEscape).join(","));
  lines.push(["Users signed up", summary.usersSignedUp].map(csvEscape).join(","));
  lines.push("");
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Added", "Visits", "Opens", "Completion rate", "Openers", "Completions", "Avg time spent"]
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
        "",
        "",
        row.totalSeconds > 0 ? formatTimeSpent(row.totalSeconds) : "",
      ].join(","),
    );
    for (const { item, clicks, openCount, completeCount, completionRate, avgSessionSeconds } of row.items) {
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
          openCount || "",
          completeCount || "",
          avgSessionSeconds ? formatTimeSpent(avgSessionSeconds) : "",
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
        <div>
          <h2 className="font-display text-xl font-semibold">Facility Comparison</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All facilities ranked by average content completion rate.
            {updatedAt && (
              <span className="ml-1 italic">· Updated daily · Last updated {updatedAt}</span>
            )}
          </p>
        </div>
        {facilities.length > 0 && (
          <button
            type="button"
            onClick={() => exportFacilityComparisonCsv(facilities as FacilityRow[])}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            Export CSV
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : facilities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No facility data yet — run content and check back after the nightly refresh.</p>
      ) : (
        <SectionCard padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                  <th className="text-left px-4 py-3">Facility</th>
                  <th className="text-right px-4 py-3">Users</th>
                  <th className="text-right px-4 py-3">Active (7d)</th>
                  <th className="text-right px-4 py-3">Active (30d)</th>
                  <th className="text-right px-4 py-3">Avg Completion</th>
                  <th className="text-right px-4 py-3">Items Completed</th>
                  <th className="text-right px-4 py-3">Time Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(facilities as FacilityRow[]).map((f) => (
                  <tr key={f.facilityValue} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {f.facilityLabel}
                      {f.facilitySiteId && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{f.facilitySiteId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.totalUsers}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.activeUsers7d}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.activeUsers30d}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {f.avgCompletionRate != null ? (
                        <span className={f.avgCompletionRate >= 70 ? "text-[var(--color-accent)] font-medium" : f.avgCompletionRate >= 40 ? "" : "text-muted-foreground"}>
                          {f.avgCompletionRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{f.itemsCompletedTotal}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "—"}
                    </td>
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
        <div className="mb-6 rounded-lg border border-border bg-muted/30 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Facility Ranking</p>
            <p className="text-2xl font-bold tabular-nums">#{rank} <span className="text-sm font-normal text-muted-foreground">of {total} facilities</span></p>
          </div>
          {thisStats?.avgCompletionRate != null && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Avg Completion</p>
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
  activeUser: { userId: string; name: string } | null;
  setActiveUser: (u: { userId: string; name: string } | null) => void;
}) {
  const fetchUsers = useServerFn(listFacilityUsers);
  const fetchFacilityStaff = useServerFn(listFacilityAdminUsers);
  const selected = preselected.value;
  const isAll = selected === "__all__";
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);

  const usersQuery = useQuery({
    queryKey: ["admin", "facility-users", selected],
    enabled: !!selected,
    queryFn: () => fetchUsers({ data: { facilityValue: isAll ? "" : selected } }),
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
        onBack={() => setActiveUser(null)}
      />
    );
  }

  const users = usersQuery.data?.users ?? [];
  const staff = staffQuery.data?.users ?? [];
  const visibleUsers = isAll ? users.slice(page * 10, (page + 1) * 10) : users;
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
              const exportUsers = isAll
                ? (await fetchUsers({ data: { facilityValue: "", includeSynthetic: true } })).users ?? []
                : users;
              exportFacilityUsersCsv(exportUsers, selectedLabel, isAll);
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
                      const name = [u.profile?.first_name, u.profile?.last_name].filter(Boolean).join(" ") || u.email || "—";
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
                    {visibleUsers.map((u) => {
                      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "—";
                      const meta: string[] = [];
                      if (u.username) meta.push(`@${u.username}`);
                      if (isAll && (u as any).facility) meta.push((u as any).facility);
                      const lastLoginIso = (u as any).last_sign_in_at || (u as any).last_login_date || null;
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
                            onClick={() => setActiveUser({ userId: u.user_id, name })}
                            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted self-start sm:self-auto"
                          >
                            View report
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </SectionCard>
                {isAll && (
                  <Pager page={page} total={users.length} pageSize={10} onPage={setPage} itemLabel="user" />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}


function exportFacilityUsersCsv(
  users: { user_id: string; username: string; first_name: string; last_name: string; email: string; created_at: string; facility?: string; last_sign_in_at?: string | null; last_login_date?: string | null }[],
  facilityLabel: string,
  includeFacility = false,
) {
  const lines: string[] = [];
  const headers = includeFacility
    ? ["First name", "Last name", "Username", "Facility", "Joined", "Last login", "Engagement tier", "Facility percentile"]
    : ["First name", "Last name", "Username", "Joined", "Last login", "Engagement tier", "Facility percentile"];
  lines.push(headers.map(csvEscape).join(","));
  for (const u of users) {
    const lastLogin = u.last_sign_in_at || u.last_login_date || "";
    const tier = (u as any).engagement_tier ?? "";
    const pct = (u as any).facility_percentile != null ? `${(u as any).facility_percentile}%` : "";
    const row = includeFacility
      ? [u.first_name, u.last_name, u.username, u.facility ?? "", fmtDate(u.created_at), fmtDate(lastLogin), tier, pct]
      : [u.first_name, u.last_name, u.username, fmtDate(u.created_at), fmtDate(lastLogin), tier, pct];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(
    `users-${facilityLabel || "facility"}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
}

function exportFacilityComparisonCsv(facilities: FacilityRow[]) {
  const lines: string[] = [];
  lines.push(["Facility", "Site ID", "Total users", "Active (7d)", "Active (30d)", "Avg completion %", "Items completed", "Time spent"].map(csvEscape).join(","));
  for (const f of facilities) {
    const row = [
      f.facilityLabel,
      f.facilitySiteId ?? "",
      String(f.totalUsers),
      String(f.activeUsers7d),
      String(f.activeUsers30d),
      f.avgCompletionRate != null ? `${f.avgCompletionRate}%` : "",
      String(f.itemsCompletedTotal),
      f.totalSessionSeconds > 0 ? formatTimeSpent(f.totalSessionSeconds) : "",
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(`facility-comparison-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}

/* ---------------- User Progress View ---------------- */

function UserProgressView({
  userId,
  userName,
  onBack,
}: {
  userId: string;
  userName: string;
  onBack: () => void;
}) {
  const fetchProgress = useServerFn(getUserProgressReport);
  const [range, setRange] = useState<RangeKey>("all");
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
      const read = items.filter((i) => i.read).length;
      return { category: c, items, total: items.length, read };
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
        <h2 className="font-display text-xl font-semibold flex-1 min-w-0 truncate">{userName}</h2>
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto mt-4 xl:mt-0">
          <div className="flex flex-wrap gap-2 flex-1 xl:flex-initial">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`inline-flex flex-1 sm:flex-none items-center justify-center rounded-md border px-4 py-2 text-sm text-center whitespace-normal sm:whitespace-nowrap transition-colors ${
                  range === opt.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-input bg-background hover:bg-muted"
                }`}
              >
                {opt.key === "all" ? (
                  "All time"
                ) : (
                  <>
                    <span className="hidden sm:inline">Last&nbsp;</span>
                    {opt.shortLabel}
                  </>
                )}
              </button>
            ))}
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
            const totalItems = data.items.length;
            const readItems = data.items.filter((i: any) => i.read).length;
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
            const tier = (data as any).engagementTier as string | null;
            const pct = (data as any).facilityPercentile as number | null;
            const statsUpdated = (data as any).statsUpdatedAt as string | null;
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mt-8 mb-8">
                  {stats.map((s) => (
                    <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} />
                  ))}
                </div>
                {tier && (
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
                )}
              </>
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
  const totalItems = itemsArr.length;
  const readItems = itemsArr.filter((i) => i.read).length;
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
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Duration", "Read", "Read on", "Progress", "Time Spent"]
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
    const read = items.filter((i) => i.read).length;
    const catSecs = items.reduce((sum: number, i: any) => sum + ((i.sessionSeconds as number) || 0), 0);
    lines.push(
      [csvEscape(c.name), csvEscape(c.slug), `${read} of ${items.length} read`, "", "", "", "", "", catSecs > 0 ? formatTimeSpent(catSecs) : ""].join(","),
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
          csvEscape(c.name),
          csvEscape(c.slug),
          csvEscape(it.title),
          csvEscape(it.type),
          csvEscape(it.duration ?? ""),
          it.read ? "Yes" : "No",
          csvEscape(it.read && (it as any).read_at ? fmtDateShort((it as any).read_at) : ""),
          progressStr,
          sessionSecs > 0 ? formatTimeSpent(sessionSecs) : "",
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
        className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 ${open ? "border-b border-border bg-[#f7f5ec]" : "bg-[#fffdf8]"} text-left hover:bg-muted/50 transition-colors`}
      >
        {(() => {
          const weightedPct = g.total > 0 ? Math.round(
            g.items.reduce((sum: number, item: any) => {
              if (item.read) return sum + 1;
              if (item.manualCompletionPct != null) return sum + item.manualCompletionPct / 100;
              if (item.mediaProgressPct != null && item.mediaProgressPct >= 5) return sum + Math.min(item.mediaProgressPct / 100, 0.95);
              if (item.pdfProgressPct != null && item.pdfProgressPct >= 1) return sum + Math.min(item.pdfProgressPct / 100, 0.95);
              return sum;
            }, 0) / g.total * 100
          ) : 0;
          const catTimeSeconds = g.items.reduce((sum: number, item: any) => sum + ((item.sessionSeconds as number) || 0), 0);
          return (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
                <CircleProgress value={weightedPct} size={52} stroke={5} />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold truncate">{g.category.name}</h2>
                  <p className="text-xs text-muted-foreground truncate">/{g.category.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <span className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium rounded-[4px] tabular-nums">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {g.read} of {g.total} read
                </span>
                {catTimeSeconds > 0 && (
                  <span className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium rounded-[4px] tabular-nums">
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
                    <Badge variant="type" type={item.type}>
                      {item.type}
                    </Badge>
                    {item.duration && (
                      <span className="text-xs text-muted-foreground truncate min-w-0">
                        {withActionWord(item.duration, item.type)}
                      </span>
                    )}
                    {(() => {
                      // Video / Audio — playback progress
                      const mediaPct: number | null = item.mediaProgressPct ?? null;
                      const isAV = item.type && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("audio") || item.type.toLowerCase().includes("podcast"));
                      if (!item.read && isAV && mediaPct !== null && mediaPct >= 5) {
                        const watchedLabel = item.type.toLowerCase().includes("video")
                          ? t("category.markedWatched").toLowerCase()
                          : t("category.markedListened").toLowerCase();
                        return (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium ml-auto flex-shrink-0 overflow-hidden">
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
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium ml-auto flex-shrink-0 overflow-hidden">
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
                          className="ml-auto"
                        />
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">{item.title}</p>
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

function SummaryCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note?: string }) {
  return (
    <SectionCard as="div" padded={false} className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
        {note && <span className="ml-auto text-xs italic text-muted-foreground/70">{note}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
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

function Stat({ icon, label, value, suffix, position }: { icon: React.ReactNode; label: string; value: number | string | null; suffix?: string; position?: "first" | "last" | "middle" }) {
  const radius =
    position === "first"
      ? "rounded-l-[4px]"
      : position === "last"
        ? "rounded-r-[4px] -ml-px"
        : "-ml-px";
  const display = value == null ? "—" : typeof value === "string" ? value : `${value.toLocaleString()}${suffix ?? ""}`;
  return (
    <span className={`inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium ${radius}`}>
      {icon}
      <span className="tabular-nums">{display}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 ${open ? "border-b border-border bg-[#f7f5ec]" : "bg-[#fffdf8]"} text-left hover:bg-muted/50 transition-colors`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
          <CategoryIcon name={row.category.icon_name} color={row.category.icon_color} size="sm" />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">{row.category.name}</h2>
            <p className="text-xs text-muted-foreground truncate">
              /{row.category.slug}
              {row.category.created_at && <> · Added {fmtDate(row.category.created_at)}</>}
            </p>
          </div>
        </div>
        <div className="inline-flex flex-shrink-0">
          <Stat position="first" icon={<Eye className="h-3.5 w-3.5" />} label={row.views === 1 ? "visit" : "visits"} value={row.views} />
          <Stat position="middle" icon={<MousePointerClick className="h-3.5 w-3.5" />} label={row.clicks === 1 ? "open" : "opens"} value={row.clicks} />
          <Stat position="last" icon={<Clock className="h-3.5 w-3.5" />} label="time spent" value={row.totalSeconds > 0 ? formatTimeSpent(row.totalSeconds) : null} />
        </div>
      </button>
      {open && (
        row.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No content items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {row.items.map(({ item, clicks, completionRate, avgSessionSeconds }) => (
              <li key={item.id} className="flex items-center gap-3 bg-[#fffdf8] px-6 py-[19px]">
                <Badge variant="type" type={item.type}>
                  {item.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  {item.created_at && (
                    <p className="text-xs text-muted-foreground">Added {fmtDate(item.created_at)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                    <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                    {clicks.toLocaleString()}
                  </span>
                  {completionRate != null && (
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      {completionRate}%
                    </span>
                  )}
                  {avgSessionSeconds != null && avgSessionSeconds > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeSpent(avgSessionSeconds)} avg
                    </span>
                  )}
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

  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-[var(--color-accent)]" /> Most engaged content
        </h3>
        <SectionCard padded={false} className="overflow-hidden">
          <ul className="divide-y divide-border">
            {most.map(({ item, completionRate, openCount, categoryName }) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{categoryName}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                  <span className="text-sm font-semibold tabular-nums text-[var(--color-accent)]">{completionRate}%</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{openCount} openers</span>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      {least.length > 0 && (
        <div>
          <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" /> Least engaged content
          </h3>
          <SectionCard padded={false} className="overflow-hidden">
            <ul className="divide-y divide-border">
              {least.map(({ item, completionRate, openCount, categoryName }) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{categoryName}</p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">{completionRate}%</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{openCount} openers</span>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
