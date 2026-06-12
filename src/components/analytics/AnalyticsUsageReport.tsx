import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Download,
  Eye,
  Info,
  MousePointerClick,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users as UsersIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Badge } from "@/components/Badge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { UserSectionHeader } from "@/components/UserSectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { waitForNextPaint } from "@/lib/paint";
import { fmtDate, formatTimeSpent } from "@/lib/date-format";
import { csvEscape, downloadCsv } from "@/lib/csv-utils";
import { getUsageReport } from "@/lib/reports.functions";
import { QK } from "@/lib/query-keys";
import { getGrowthStats, triggerNightlyRefresh, resetFacilityAnalytics } from "@/lib/analytics-stats.functions";
import type { RangeKey, AggregatedRow, UsageScope } from "./analytics-types";
import { RANGE_OPTIONS } from "./analytics-types";
import type { Category, ContentItem } from "@/lib/categories";

export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3 w-3 text-muted-foreground/50 cursor-help flex-shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs px-3 py-2 text-center">{text}</TooltipContent>
    </Tooltip>
  );
}

export function UsageReportView({ scope }: { scope: UsageScope }) {
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
    queryKey: QK.adminReport(scope.kind, facilityValue, range),
    queryFn: () =>
      fetchReport({
        data: { range, facilityValue: facilityValue ?? null },
      }),
  });

  const { data: growthData } = useQuery({
    queryKey: QK.adminGrowth(scope.kind, facilityValue),
    queryFn: () => fetchGrowth({ data: { facilityValue } }),
    staleTime: 30 * 60 * 1000,
  });

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

  lines.push(["Overall usage"].map(csvEscape).join(","));
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(["Visits", aggregated.totalViews].map(csvEscape).join(","));
  lines.push(["Opens", aggregated.totalClicks].map(csvEscape).join(","));
  lines.push(["Completion rate", aggregated.overallCompletionRate != null ? `${aggregated.overallCompletionRate}%` : ""].map(csvEscape).join(","));
  lines.push(["Time spent", formatTimeSpent(summary.totalSeconds ?? summary.hoursSpent * 3600)].map(csvEscape).join(","));
  lines.push(["Users signed up", summary.usersSignedUp].map(csvEscape).join(","));
  lines.push("");

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
                  {(() => {
                    const hasRatings = thumbsUp > 0 || thumbsDown > 0;
                    const conditionals = [completionRate != null, openCount > completeCount, avgSessionSeconds != null && avgSessionSeconds > 0, hasRatings, bookmarkCount > 0];
                    const totalVisible = 1 + conditionals.filter(Boolean).length;
                    const lastSpan2 = totalVisible % 2 !== 0;
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
                            ? React.cloneElement(cell, { className: "col-span-2" } as any)
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
