import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Check,
  
  X,
  Clock,
  Flame,
  Trophy,
} from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { Category, ContentItem } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { listAllFacilities } from "@/lib/facilities.functions";

import { readStatusLabels } from "@/lib/read-status";
import { withActionWord } from "@/lib/duration";
import { useI18n } from "@/lib/i18n";
import {
  getUsageReport,
  listFacilityUsers,
  getUserProgressReport,
} from "@/lib/reports.functions";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { LoadMorePager, useLoadMore } from "@/components/LoadMorePager";

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

type EventRow = {
  event_type: "category_view" | "content_click";
  category_id: string | null;
  content_id: string | null;
  created_at: string;
};

type AggregatedRow = {
  category: Category;
  views: number;
  clicks: number;
  items: { item: ContentItem; clicks: number }[];
};

function CircleProgress({
  value,
  size = 52,
  stroke = 5,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const offset = c - (pct / 100) * c;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {pct}%
      </div>
    </div>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "2-digit", day: "2-digit" });
}

function aggregate(report: { categories: Category[]; items: ContentItem[]; events: EventRow[] }) {
  const catViews = new Map<string, number>();
  const catClicks = new Map<string, number>();
  const itemClicks = new Map<string, number>();
  for (const e of report.events) {
    if (e.event_type === "category_view" && e.category_id) {
      catViews.set(e.category_id, (catViews.get(e.category_id) ?? 0) + 1);
    } else if (e.event_type === "content_click") {
      if (e.content_id) itemClicks.set(e.content_id, (itemClicks.get(e.content_id) ?? 0) + 1);
      if (e.category_id) catClicks.set(e.category_id, (catClicks.get(e.category_id) ?? 0) + 1);
    }
  }
  const itemsByCategory = new Map<string, ContentItem[]>();
  for (const it of report.items) {
    const list = itemsByCategory.get(it.category_id) ?? [];
    list.push(it);
    itemsByCategory.set(it.category_id, list);
  }
  const rows: AggregatedRow[] = report.categories.map((cat) => {
    const items = (itemsByCategory.get(cat.id) ?? [])
      .map((it) => ({ item: it, clicks: itemClicks.get(it.id) ?? 0 }))
      .sort((a, b) => b.clicks - a.clicks);
    return {
      category: cat,
      views: catViews.get(cat.id) ?? 0,
      clicks: catClicks.get(cat.id) ?? 0,
      items,
    };
  });
  const totalViews = report.events.filter((e) => e.event_type === "category_view").length;
  const totalClicks = report.events.filter((e) => e.event_type === "content_click").length;
  return { rows, totalViews, totalClicks };
}

function csvEscape(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AdminReportsPage() {
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
            <Popover open={pickerOpen} onOpenChange={(o) => { if (o) setUserPickerOpen(false); setPickerOpen(o); }}>
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
            </Popover>
            <Popover open={userPickerOpen} onOpenChange={(o) => { if (o) setPickerOpen(false); setUserPickerOpen(o); }}>
              <PopoverAnchor asChild>
                <TabsTrigger
                  value="user"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openUserPicker();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
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
                  if (t && t.closest('[data-state][role="tab"]')) {
                    e.preventDefault();
                  }
                }}
              >
                <div className="mb-2 text-sm font-medium">Select a facility</div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserFacility({ value: "__all__", label: "All Facilities" });
                    setUserKey((k) => k + 1);
                    setUserPickerOpen(false);
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
                    setTab("user");
                  }}
                  options={facilities.map((f) => ({ value: f.value, label: f.label }))}
                  placeholder={facilitiesQuery.isLoading || facilities.length === 0 ? "Loading…" : "Select a facility"}
                />
              </PopoverContent>
            </Popover>
          </TabsList>
        </div>


        <TabsContent value="overall" className="mt-8">
          <UsageReportView scope={{ kind: "overall" }} />
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
                preselected={selectedUserFacility}
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
  const fetchReport = useServerFn(getUsageReport);

  const facilityValue = scope.kind === "facility" ? scope.facilityValue : null;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "report", scope.kind, facilityValue, range],
    queryFn: () =>
      fetchReport({
        data: { range, facilityValue: facilityValue ?? null },
      }),
  });

  const aggregated = useMemo(() => (data ? aggregate(data as any) : null), [data]);

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
          onClick={() =>
            aggregated &&
            exportUsageCsv(aggregated, exportLabel, {
              hoursSpent: (data as any)?.hoursSpent ?? 0,
              usersSignedUp:
                scope.kind === "facility"
                  ? ((data as any)?.facilityUserCount ?? 0)
                  : ((data as any)?.totalUsers ?? 0),
            })
          }
          disabled={!aggregated}
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
          <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={<Eye className="h-5 w-5" />}
              label={aggregated.totalViews === 1 ? "Category view" : "Category views"}
              value={aggregated.totalViews}
            />
            <SummaryCard
              icon={<MousePointerClick className="h-5 w-5" />}
              label={aggregated.totalClicks === 1 ? "Content click" : "Content clicks"}
              value={aggregated.totalClicks}
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5" />}
              label="Hours spent"
              value={(data as any)?.hoursSpent ?? 0}
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
        </>
      )}
    </div>
  );
}

function exportUsageCsv(
  aggregated: { rows: AggregatedRow[]; totalViews: number; totalClicks: number },
  label: string,
  summary: { hoursSpent: number; usersSignedUp: number },
) {
  const lines: string[] = [];
  lines.push(["Overall usage"].map(csvEscape).join(","));
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(["Category views", aggregated.totalViews].map(csvEscape).join(","));
  lines.push(["Content clicks", aggregated.totalClicks].map(csvEscape).join(","));
  lines.push(["Hours spent", summary.hoursSpent].map(csvEscape).join(","));
  lines.push(["Users signed up", summary.usersSignedUp].map(csvEscape).join(","));
  lines.push("");
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Added", "Views", "Clicks"]
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
      ].join(","),
    );
    for (const { item, clicks } of row.items) {
      lines.push(
        [
          csvEscape(row.category.name),
          csvEscape(row.category.slug),
          csvEscape(item.title),
          csvEscape(item.type),
          csvEscape(fmtDate(item.created_at)),
          "",
          clicks,
        ].join(","),
      );
    }
  }
  downloadCsv(`report-${label}-${new Date().toISOString().slice(0, 10)}.csv`, lines);
}

/* ---------------- Facility Tab ---------------- */

function FacilityReportTab({ preselected }: { preselected: { value: string; label: string } }) {
  return (
    <UsageReportView
      scope={{ kind: "facility", facilityValue: preselected.value, facilityLabel: preselected.label }}
    />
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
  const selected = preselected.value;
  const isAll = selected === "__all__";
  const pager = useLoadMore(10, 10);

  const usersQuery = useQuery({
    queryKey: ["admin", "facility-users", selected],
    enabled: !!selected,
    queryFn: () => fetchUsers({ data: { facilityValue: isAll ? "" : selected } }),
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
  const visibleUsers = isAll ? users.slice(0, pager.visibleCount) : users;

  return (
    <div>
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end">
        <LoadingButton
          variant="secondary"
          onClick={() => exportFacilityUsersCsv(users, selectedLabel, isAll)}
          disabled={users.length === 0}
          icon={<Download className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Export CSV
        </LoadingButton>
      </div>

      {usersQuery.isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {isAll ? "No registered users." : "No users in this facility."}
        </p>
      ) : (
        <>
          <SectionCard padded={false} className="mt-8 overflow-hidden">
            <ul className="divide-y divide-border">
              {visibleUsers.map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "—";
                const meta: string[] = [];
                if (u.username) meta.push(`@${u.username}`);
                if (isAll && (u as any).facility) meta.push((u as any).facility);
                const lastLoginIso = (u as any).last_sign_in_at || (u as any).last_login_date || null;
                return (
                  <li key={u.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-6 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      {meta.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate">{meta.join(" · ")}</p>
                      )}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        Signed up {fmtDate(u.created_at) || "—"}
                        {" · "}
                        Last login {lastLoginIso ? fmtDate(lastLoginIso) : "Never"}
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
            <LoadMorePager pager={pager} total={users.length} itemLabel="user" />
          )}
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
    ? ["First name", "Last name", "Username", "Facility", "Joined", "Last login"]
    : ["First name", "Last name", "Username", "Joined", "Last login"];
  lines.push(headers.map(csvEscape).join(","));
  for (const u of users) {
    const lastLogin = u.last_sign_in_at || u.last_login_date || "";
    const row = includeFacility
      ? [u.first_name, u.last_name, u.username, u.facility ?? "", fmtDate(u.created_at), fmtDate(lastLogin)]
      : [u.first_name, u.last_name, u.username, fmtDate(u.created_at), fmtDate(lastLogin)];
    lines.push(row.map(csvEscape).join(","));
  }
  downloadCsv(
    `users-${facilityLabel || "facility"}-${new Date().toISOString().slice(0, 10)}.csv`,
    lines,
  );
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
            onClick={() => data && exportUserProgressCsv(data, userName)}
            disabled={!data}
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
            const minutesSpent = data.items
              .filter((i: any) => i.read)
              .reduce((acc: number, i: any) => acc + parseMinutes(i.duration), 0);
            const hours = Math.floor(minutesSpent / 60);
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
              { icon: Clock, label: "Hours spent", value: hours.toLocaleString() },
              { icon: Flame, label: "Day streak", value: streak.toLocaleString() },
              { icon: Clock, label: "Last login", value: lastLogin ? fmtDateShort(lastLogin) : "Never" },
            ];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-8 mb-8">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-[var(--color-accent)] flex-shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex flex-col items-start">
                        <p className="font-display text-2xl font-semibold leading-none tabular-nums">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{s.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <UserCategoryList groups={grouped} />
        </>
      )}
    </div>
  );
}

function parseMinutes(d?: string | null): number {
  if (!d) return 0;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const n = parseFloat(m[1]);
    const u = (m[2] ?? "min").toLowerCase();
    total += u.startsWith("h") ? n * 60 : n;
  }
  return total;
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
  lines.push(`Last login,${csvEscape(lastLogin ? fmtDateShort(lastLogin) : "Never")}`);
  lines.push("");
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Duration", "Read", "Read on"]
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
    lines.push(
      [csvEscape(c.name), csvEscape(c.slug), `${read} of ${items.length} read`, "", "", "", ""].join(","),
    );
    for (const it of items) {
      lines.push(
        [
          csvEscape(c.name),
          csvEscape(c.slug),
          csvEscape(it.title),
          csvEscape(it.type),
          csvEscape(it.duration ?? ""),
          it.read ? "Yes" : "No",
          csvEscape(it.read && (it as any).read_at ? fmtDateShort((it as any).read_at) : ""),
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
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
          <CircleProgress value={g.total > 0 ? (g.read / g.total) * 100 : 0} size={52} stroke={5} />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">{g.category.name}</h2>
            <p className="text-xs text-muted-foreground truncate">/{g.category.slug}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium rounded-[4px] tabular-nums self-start sm:self-auto">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          {g.read} of {g.total} read
        </span>
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
                    <span className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 ml-auto ${
                      item.read
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-background"
                        : "border-input bg-background text-foreground"
                    }`}>
                      {item.read ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          {labels.read}
                          {item.read_at && <> on {fmtDateShort(item.read_at)}</>}
                        </>
                      ) : (
                        <>
                          <X className="h-3.5 w-3.5" />
                          {labels.unread}
                        </>
                      )}
                    </span>
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

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <SectionCard as="div" padded={false} className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
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

function Stat({ icon, label, value, position }: { icon: React.ReactNode; label: string; value: number; position?: "first" | "last" | "middle" }) {
  const radius =
    position === "first"
      ? "rounded-l-[4px]"
      : position === "last"
        ? "rounded-r-[4px] -ml-px"
        : "-ml-px";
  return (
    <span className={`inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium ${radius}`}>
      {icon}
      <span className="tabular-nums">{value.toLocaleString()}</span>
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
          <Stat position="first" icon={<Eye className="h-3.5 w-3.5" />} label={row.views === 1 ? "view" : "views"} value={row.views} />
          <Stat position="last" icon={<MousePointerClick className="h-3.5 w-3.5" />} label={row.clicks === 1 ? "click" : "clicks"} value={row.clicks} />
        </div>
      </button>
      {open && (
        row.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No content items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {row.items.map(({ item, clicks }) => (
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
                <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                  {clicks.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </SectionCard>
  );
}
