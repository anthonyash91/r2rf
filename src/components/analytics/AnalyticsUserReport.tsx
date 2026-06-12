import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Compass,
  Download,
  Flame,
  GraduationCap,
  Info,
  Medal,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/Badge";
import { CircleProgress } from "@/components/CircleProgress";
import { StatCard } from "@/components/StatCard";
import { ReadStatusBadge } from "@/components/ReadStatusBadge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { UserSectionHeader } from "@/components/UserSectionHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pager } from "@/components/LoadMorePager";
import { fmtDate, fmtDateShort, formatTimeSpent } from "@/lib/date-format";
import { withActionWord } from "@/lib/duration";
import { capFirst } from "@/lib/utils";
import { waitForNextPaint } from "@/lib/paint";
import { readStatusLabels } from "@/lib/read-status";
import { useI18n } from "@/lib/i18n";
import { listFacilityUsers, getUserProgressReport, getBulkFacilityProgressReport } from "@/lib/reports.functions";
import { listFacilityAdminUsers } from "@/lib/users.functions";
import { getAdminUserMonthlySummary } from "@/lib/monthly-summary.functions";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { csvEscape, downloadCsv, exportFacilityUsersCsv, exportBulkFacilityProgressCsv } from "@/lib/csv-utils";
import type { RangeKey } from "./analytics-types";
import { RANGE_OPTIONS } from "./analytics-types";
import { QK } from "@/lib/query-keys";

export function UsersReportTab({
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
    queryKey: QK.adminFacilityUsers(selected, page),
    enabled: !!selected,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchUsers({ data: { facilityValue: isAll ? "" : selected, page, pageSize: 10 } }),
  });

  const staffQuery = useQuery({
    queryKey: QK.adminFacilityStaff(selected),
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
                <Pager page={page} total={totalUsers} pageSize={10} onPage={setPage} itemLabel="user" itemLabelPlural="users" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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
    queryKey: QK.adminUserMonthlySummary(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchMonthlySummary({ data: { userId } }),
  });
  const [isExporting, setIsExporting] = useState(false);
  const { data: rawData, isLoading } = useQuery({
    queryKey: QK.adminUserProgress(userId),
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
            let totalCats = 0;
            let completedCats = 0;
            for (const g of grouped) {
              if (g.total > 0) {
                totalCats += 1;
                if (g.read >= g.total) completedCats += 1;
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
