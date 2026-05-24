import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, ChevronDown, Download, Eye, MousePointerClick } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { Category, ContentItem } from "@/lib/categories";
import { Badge } from "@/components/Badge";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminAnalyticsPage,
});

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

type EventRow = {
  event_type: "category_view" | "content_click";
  category_id: string | null;
  content_id: string | null;
  created_at: string;
};

function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");

  const sinceIso = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.key === range)!;
    if (opt.days === null) return null;
    return new Date(Date.now() - opt.days * 24 * 60 * 60 * 1000).toISOString();
  }, [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", range],
    queryFn: async () => {
      const [categoriesRes, itemsRes, eventsRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("content_items").select("*").order("sort_order", { ascending: true }),
        (() => {
          let q = supabase
            .from("analytics_events")
            .select("event_type, category_id, content_id, created_at")
            .order("created_at", { ascending: false })
            .limit(50000);
          if (sinceIso) q = q.gte("created_at", sinceIso);
          return q;
        })(),
      ]);
      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (eventsRes.error) throw eventsRes.error;
      return {
        categories: (categoriesRes.data ?? []) as Category[],
        items: (itemsRes.data ?? []) as ContentItem[],
        events: (eventsRes.data ?? []) as EventRow[],
      };
    },
  });

  const aggregated = useMemo(() => {
    if (!data) return null;
    const catViews = new Map<string, number>();
    const catClicks = new Map<string, number>();
    const itemClicks = new Map<string, number>();

    for (const e of data.events) {
      if (e.event_type === "category_view" && e.category_id) {
        catViews.set(e.category_id, (catViews.get(e.category_id) ?? 0) + 1);
      } else if (e.event_type === "content_click") {
        if (e.content_id) itemClicks.set(e.content_id, (itemClicks.get(e.content_id) ?? 0) + 1);
        if (e.category_id) catClicks.set(e.category_id, (catClicks.get(e.category_id) ?? 0) + 1);
      }
    }

    const itemsByCategory = new Map<string, ContentItem[]>();
    for (const it of data.items) {
      const list = itemsByCategory.get(it.category_id) ?? [];
      list.push(it);
      itemsByCategory.set(it.category_id, list);
    }

    const rows = data.categories.map((cat) => {
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

    const totalViews = data.events.filter((e) => e.event_type === "category_view").length;
    const totalClicks = data.events.filter((e) => e.event_type === "content_click").length;

    return { rows, totalViews, totalClicks };
  }, [data]);

  return (
    <div>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <PageHeader
          icon={BarChart3}
          title="Usage Analytics"
          description="Category views and content clicks across the site."
        />
        <div className="flex flex-col gap-2 w-full lg:w-auto sm:flex-row sm:flex-wrap lg:flex-nowrap">
          <div className="flex gap-2 flex-1 min-w-0 basis-full sm:basis-auto">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`flex-1 lg:flex-initial rounded-md border px-4 py-2 text-sm text-center transition-colors ${
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
            onClick={() => aggregated && exportCsv(aggregated, range)}
            disabled={!aggregated}
            icon={<Download className="h-4 w-4" />}
            className="w-full sm:w-auto"
          >
            Export CSV
          </LoadingButton>
        </div>
      </div>

      {isLoading || !aggregated ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <SummaryCard icon={<Eye className="h-5 w-5" />} label={aggregated.totalViews === 1 ? "Category view" : "Category views"} value={aggregated.totalViews} />
            <SummaryCard icon={<MousePointerClick className="h-5 w-5" />} label={aggregated.totalClicks === 1 ? "Content click" : "Content clicks"} value={aggregated.totalClicks} />
          </div>

          <CategoryList rows={aggregated.rows} />

        </>
      )}
    </div>
  );
}

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

function exportCsv(
  aggregated: { rows: AggregatedRow[]; totalViews: number; totalClicks: number },
  range: RangeKey,
) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(["Category", "Category slug", "Item title", "Item type", "Added", "Views", "Clicks"].join(","));
  for (const row of aggregated.rows) {
    lines.push([esc(row.category.name), esc(row.category.slug), "", "", esc(fmtDate(row.category.created_at)), row.views, row.clicks].join(","));
    for (const { item, clicks } of row.items) {
      lines.push([esc(row.category.name), esc(row.category.slug), esc(item.title), esc(item.type), esc(fmtDate(item.created_at)), "", clicks].join(","));
    }
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
