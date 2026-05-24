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
  Circle,
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
import { listFacilities } from "@/lib/facilities.functions";
import { withActionWord } from "@/lib/duration";
import { readStatusLabels } from "@/lib/read-status";
import { useI18n } from "@/lib/i18n";
import {
  getUsageReport,
  listFacilityUsers,
  getUserProgressReport,
} from "@/lib/reports.functions";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminReportsPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
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

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PageHeader
            icon={BarChart3}
            title="Reports"
            description="Usage, facility, and per-user reports across the site."
          />
          <TabsList className="h-auto p-2 gap-1 w-full lg:w-auto bg-muted/40 self-stretch lg:self-center">
            <TabsTrigger value="overall" className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Overall
            </TabsTrigger>
            <TabsTrigger value="facility" className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> By Facility
            </TabsTrigger>
            <TabsTrigger value="user" className="flex-1 lg:flex-none px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground">
              <UsersIcon className="h-3.5 w-3.5 mr-1.5" /> Users
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overall" className="mt-6">
          <UsageReportView scope={{ kind: "overall" }} />
        </TabsContent>
        <TabsContent value="facility" className="mt-6">
          <FacilityReportTab />
        </TabsContent>
        <TabsContent value="user" className="mt-6">
          <UsersReportTab />
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
        <div className="flex gap-2 flex-1 min-w-0">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`flex-1 sm:flex-initial rounded-md border px-4 py-2 text-sm text-center transition-colors ${
                range === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <LoadingButton
          variant="secondary"
          onClick={() => aggregated && exportUsageCsv(aggregated, exportLabel)}
          disabled={!aggregated}
          icon={<Download className="h-4 w-4" />}
          className="w-full sm:w-auto"
        >
          Export CSV
        </LoadingButton>
      </div>

      {isLoading || !aggregated ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
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
) {
  const lines: string[] = [];
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

function FacilityReportTab() {
  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!selected && facilities.length > 0) setSelected(facilities[0].value);
  }, [facilities, selected]);

  const selectedLabel = facilities.find((f) => f.value === selected)?.label ?? "";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <label className="text-sm font-medium">Facility</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm w-full sm:w-auto sm:min-w-[260px]"
        >
          {facilities.length === 0 && <option value="">Loading…</option>}
          {facilities.map((f) => (
            <option key={f.id} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <UsageReportView
          scope={{ kind: "facility", facilityValue: selected, facilityLabel: selectedLabel }}
        />
      )}
    </div>
  );
}

/* ---------------- Users Tab ---------------- */

function UsersReportTab() {
  const fetchFacilities = useServerFn(listFacilities);
  const fetchUsers = useServerFn(listFacilityUsers);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const [selected, setSelected] = useState<string>("");
  const [activeUser, setActiveUser] = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    if (!selected && facilities.length > 0) setSelected(facilities[0].value);
  }, [facilities, selected]);

  const usersQuery = useQuery({
    queryKey: ["admin", "facility-users", selected],
    enabled: !!selected,
    queryFn: () => fetchUsers({ data: { facilityValue: selected } }),
  });

  const selectedLabel = facilities.find((f) => f.value === selected)?.label ?? "";

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <label className="text-sm font-medium">Facility</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm w-full sm:w-auto sm:min-w-[260px]"
        >
          {facilities.length === 0 && <option value="">Loading…</option>}
          {facilities.map((f) => (
            <option key={f.id} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <LoadingButton
          variant="secondary"
          onClick={() => exportFacilityUsersCsv(users, selectedLabel)}
          disabled={users.length === 0}
          icon={<Download className="h-4 w-4" />}
          className="sm:ml-auto w-full sm:w-auto"
        >
          Export CSV
        </LoadingButton>
      </div>

      {usersQuery.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">No users in this facility.</p>
      ) : (
        <SectionCard padded={false} className="overflow-hidden">
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email;
              return (
                <li key={u.user_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.username ? `@${u.username}` : ""}
                      {u.email ? ` · ${u.email}` : ""}
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
      )}
    </div>
  );
}

function exportFacilityUsersCsv(
  users: { user_id: string; username: string; first_name: string; last_name: string; email: string; created_at: string }[],
  facilityLabel: string,
) {
  const lines: string[] = [];
  lines.push(["First name", "Last name", "Username", "Email", "Joined"].map(csvEscape).join(","));
  for (const u of users) {
    lines.push(
      [
        csvEscape(u.first_name),
        csvEscape(u.last_name),
        csvEscape(u.username),
        csvEscape(u.email),
        csvEscape(fmtDate(u.created_at)),
      ].join(","),
    );
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
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-progress", userId],
    queryFn: () => fetchProgress({ data: { userId } }),
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted self-start"
        >
          <ArrowLeft className="h-4 w-4" /> Back to users
        </button>
        <h2 className="font-display text-xl font-semibold flex-1 min-w-0 truncate">{userName}</h2>
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

      {isLoading || !data ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Items read"
              value={data.items.filter((i: any) => i.read).length}
            />
            <SummaryCard
              icon={<Eye className="h-5 w-5" />}
              label="Category views"
              value={data.eventCounts.categoryViews}
            />
            <SummaryCard
              icon={<MousePointerClick className="h-5 w-5" />}
              label="Content clicks"
              value={data.eventCounts.contentClicks}
            />
            <SummaryCard
              icon={<UsersIcon className="h-5 w-5" />}
              label="Login days"
              value={data.logins.length}
            />
          </div>

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
  lines.push(
    ["Category", "Category slug", "Item title", "Item type", "Duration", "Read"]
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
      [csvEscape(c.name), csvEscape(c.slug), `${read} of ${items.length} read`, "", "", ""].join(","),
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
  const [openId, setOpenId] = useState<string | null>(null);
  if (groups.length === 0) {
    return <p className="text-muted-foreground">No categories yet.</p>;
  }
  return (
    <div className="flex flex-col [&>section]:rounded-none [&>section:first-child]:rounded-t-2xl [&>section:last-child]:rounded-b-2xl [&>section:not(:first-child)]:-mt-px">
      {groups.map((g) => {
        const open = openId === g.category.id;
        const dimmed = openId !== null && openId !== g.category.id;
        return (
          <SectionCard
            key={g.category.id}
            padded={false}
            className={`overflow-hidden bg-[#fffdf8] transition-all duration-200 ${dimmed ? "opacity-40" : "opacity-100"} ${open ? "!border-2 !border-[var(--color-accent)]" : ""}`}
          >
            <button
              type="button"
              onClick={() => setOpenId((cur) => (cur === g.category.id ? null : g.category.id))}
              aria-expanded={open}
              className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 ${open ? "border-b border-border bg-[#f7f5ec]" : "bg-[#fffdf8]"} text-left hover:bg-muted/50 transition-colors`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
                <CategoryIcon name={g.category.icon_name} color={g.category.icon_color} size="sm" />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold truncate">{g.category.name}</h2>
                  <p className="text-xs text-muted-foreground truncate">/{g.category.slug}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1 text-xs font-medium rounded-[4px] tabular-nums">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                {g.read} of {g.total} read
              </span>
            </button>
            {open &&
              (g.items.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No content items.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {g.items.map((item: any) => (
                    <li key={item.id} className="flex items-center gap-3 bg-[#fffdf8] px-6 py-[19px]">
                      <Badge variant="type" type={item.type}>
                        {item.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-bold">{item.title}</p>
                        {item.duration && (
                          <p className="text-xs text-muted-foreground">{item.duration}</p>
                        )}
                      </div>
                      {item.read ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
                          <CheckCircle2 className="h-4 w-4" /> Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          <Circle className="h-4 w-4" /> Not read
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ))}
          </SectionCard>
        );
      })}
    </div>
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
