import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BarChart3, ChevronDown, Download, Eye, MousePointerClick } from "lucide-react";
import type { Category, ContentItem } from "@/lib/categories";

export const Route = createFileRoute("/admin/analytics")({
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
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-[var(--color-accent)]" /> Usage analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Category views and content clicks across the site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                range === opt.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => aggregated && exportCsv(aggregated, range)}
            disabled={!aggregated}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {isLoading || !aggregated ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <SummaryCard icon={<Eye className="h-5 w-5" />} label={aggregated.totalViews === 1 ? "Category view" : "Category views"} value={aggregated.totalViews} />
            <SummaryCard icon={<MousePointerClick className="h-5 w-5" />} label={aggregated.totalClicks === 1 ? "Content click" : "Content clicks"} value={aggregated.totalClicks} />
          </div>

          <div className="mt-8 space-y-6">
            {aggregated.rows.length === 0 ? (
              <p className="text-muted-foreground">No categories yet.</p>
            ) : (
              aggregated.rows.map((row) => (
                <CategorySection key={row.category.id} row={row} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
      {icon}
      <span className="tabular-nums">{value.toLocaleString()}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function CategorySection({ row }: { row: AggregatedRow }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-border bg-muted/30 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
          {row.category.icon_url ? (
            <img src={row.category.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border bg-muted flex-shrink-0" />
          ) : (
            <div className="h-10 w-10 rounded-lg border border-dashed border-border bg-muted/40 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">{row.category.name}</h2>
            <p className="text-xs text-muted-foreground truncate">
              /{row.category.slug}
              {row.category.created_at && <> · Added {fmtDate(row.category.created_at)}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Stat icon={<Eye className="h-3.5 w-3.5" />} label={row.views === 1 ? "view" : "views"} value={row.views} />
          <Stat icon={<MousePointerClick className="h-3.5 w-3.5" />} label={row.clicks === 1 ? "click" : "clicks"} value={row.clicks} />
        </div>
      </button>
      {open && (
        row.items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No content items.</p>
        ) : (
          <ul className="divide-y divide-border">
            {row.items.map(({ item, clicks }) => (
              <li key={item.id} className="flex items-center gap-3 p-4">
                <span className="text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground flex-shrink-0">
                  {item.type}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">{item.title}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium tabular-nums">
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                  {clicks.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
