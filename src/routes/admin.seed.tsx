import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sprout, Upload, CheckCircle2, AlertCircle } from "lucide-react";

import { requireStrictAdminBeforeLoad } from "@/lib/admin-guards";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { LoadingButton } from "@/components/LoadingButton";
import { Badge } from "@/components/Badge";
import { defaultDurationForType } from "@/lib/duration";

export const Route = createFileRoute("/admin/seed")({
  beforeLoad: requireStrictAdminBeforeLoad,
  component: AdminSeedPage,
});

type SeedRow = {
  category_slug: string;
  title: string;
  type?: string;
  url?: string;
  source?: string;
  sort_order?: number;
};

type ParsedRow = {
  raw: Record<string, unknown>;
  row: SeedRow | null;
  errors: string[];
  categoryId?: string;
};

const ALLOWED_TYPES = ["Article", "Video", "Audio", "PDF", "Link", "Resource"];

const JSON_EXAMPLE = `[
  {
    "category_slug": "housing",
    "title": "Local shelter directory",
    "type": "Article",
    "url": "https://example.org/shelters",
    "source": "City of Example",
    "sort_order": 1
  }
]`;

const CSV_EXAMPLE = `category_slug,title,type,url,source,sort_order
housing,Local shelter directory,Article,https://example.org/shelters,City of Example,1
employment,Resume tips,Article,https://example.org/resume,Workforce Center,1`;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeRow(
  raw: Record<string, unknown>,
  slugMap: Map<string, string>,
): ParsedRow {
  const errors: string[] = [];
  const slugVal = String(raw.category_slug ?? "").trim().toLowerCase();
  const title = String(raw.title ?? "").trim();
  const type = (String(raw.type ?? "").trim() || "Article");
  const url = String(raw.url ?? "").trim();
  const source = String(raw.source ?? "").trim();
  const sortRaw = raw.sort_order;
  let sort_order: number | undefined;
  if (sortRaw !== undefined && sortRaw !== "" && sortRaw !== null) {
    const n = Number(sortRaw);
    if (!Number.isFinite(n)) errors.push("sort_order must be a number");
    else sort_order = Math.trunc(n);
  }

  if (!slugVal) errors.push("category_slug is required");
  if (!title) errors.push("title is required");
  if (type && !ALLOWED_TYPES.includes(type)) {
    errors.push(`type must be one of ${ALLOWED_TYPES.join(", ")}`);
  }
  if (url && !/^https?:\/\//i.test(url)) {
    errors.push("url must start with http(s)://");
  }

  const categoryId = slugVal ? slugMap.get(slugVal) : undefined;
  if (slugVal && !categoryId) {
    errors.push(`no category found with slug "${slugVal}"`);
  }

  const row: SeedRow | null = errors.length
    ? null
    : { category_slug: slugVal, title, type, url, source, sort_order };

  return { raw, row, errors, categoryId };
}

function AdminSeedPage() {
  const qc = useQueryClient();
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["admin", "seed", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const slugMap = useMemo(() => {
    const m = new Map<string, string>();
    (categoriesQuery.data ?? []).forEach((c: any) => {
      if (c.slug) m.set(String(c.slug).toLowerCase(), c.id);
    });
    return m;
  }, [categoriesQuery.data]);

  const parsed = useMemo<ParsedRow[]>(() => {
    if (!text.trim()) return [];
    try {
      let rawRows: Record<string, unknown>[] = [];
      if (format === "json") {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          return [
            {
              raw: {},
              row: null,
              errors: ["JSON must be an array of objects"],
            },
          ];
        }
        rawRows = data;
      } else {
        rawRows = parseCSV(text);
      }
      return rawRows.map((r) => normalizeRow(r, slugMap));
    } catch (e: any) {
      return [{ raw: {}, row: null, errors: [`Parse error: ${e.message}`] }];
    }
  }, [text, format, slugMap]);

  const validCount = parsed.filter((p) => p.row && p.categoryId).length;
  const errorCount = parsed.length - validCount;

  const handleInsert = async () => {
    const valid = parsed.filter((p) => p.row && p.categoryId);
    if (valid.length === 0) {
      toast.error("No valid rows to insert");
      return;
    }
    setSubmitting(true);
    try {
      // Compute next sort_order per category to fill in missing values.
      const cats = Array.from(new Set(valid.map((v) => v.categoryId!)));
      const nextSort = new Map<string, number>();
      await Promise.all(
        cats.map(async (cid) => {
          const { data } = await supabase
            .from("content_items")
            .select("sort_order")
            .eq("category_id", cid)
            .order("sort_order", { ascending: false })
            .limit(1);
          nextSort.set(cid, (data?.[0]?.sort_order ?? 0) + 1);
        }),
      );

      const payload = valid.map((v) => {
        const cid = v.categoryId!;
        const r = v.row!;
        const so =
          r.sort_order !== undefined
            ? r.sort_order
            : (() => {
                const n = nextSort.get(cid)!;
                nextSort.set(cid, n + 1);
                return n;
              })();
        return {
          category_id: cid,
          title: r.title,
          type: r.type ?? "Article",
          source: r.source ?? "",
          duration: defaultDurationForType(r.type ?? "Article"),
          description: "",
          url: r.url || null,
          published: true,
          sort_order: so,
        };
      });

      const { error } = await supabase.from("content_items").insert(payload);
      if (error) throw error;
      toast.success(`Seeded ${payload.length} item${payload.length === 1 ? "" : "s"}`);
      setText("");
      qc.invalidateQueries({ queryKey: ["admin", "category"] });
      qc.invalidateQueries({ queryKey: ["category"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to insert");
    } finally {
      setSubmitting(false);
    }
  };

  const loadExample = () => {
    setText(format === "json" ? JSON_EXAMPLE : CSV_EXAMPLE);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sprout}
        title="Seed Content"
        description="Bulk-add content items to categories. Paste JSON or CSV, preview matches, then insert."
      />

      <SectionCard className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Format:</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "json" | "csv")}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="button"
              onClick={loadExample}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Load example
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            {categoriesQuery.data?.length ?? 0} categories available
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Paste {format.toUpperCase()}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            spellCheck={false}
            placeholder={format === "json" ? JSON_EXAMPLE : CSV_EXAMPLE}
            className="w-full rounded-md border border-input bg-background px-4 py-2 font-mono text-xs"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Required per row: <code className="font-mono">category_slug</code>,{" "}
            <code className="font-mono">title</code>. Optional:{" "}
            <code className="font-mono">type</code>,{" "}
            <code className="font-mono">url</code>,{" "}
            <code className="font-mono">source</code>,{" "}
            <code className="font-mono">sort_order</code>. Items default to
            published; <code className="font-mono">type</code> defaults to{" "}
            <code className="font-mono">Article</code>.
          </p>
        </div>
      </SectionCard>

      {parsed.length > 0 && (
        <SectionCard className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Preview</h2>
              <Badge variant="count">
                {validCount} valid
              </Badge>
              {errorCount > 0 && (
                <Badge variant="draft">{errorCount} with errors</Badge>
              )}
            </div>
            <LoadingButton
              onClick={handleInsert}
              pending={submitting}
              pendingText="Inserting…"
              disabled={validCount === 0}
              icon={<Upload className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Insert {validCount} {validCount === 1 ? "item" : "items"}
            </LoadingButton>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2">Category slug</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">URL</th>
                  <th className="px-2 py-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p, i) => {
                  const ok = p.row && p.categoryId;
                  return (
                    <tr key={i} className="border-b last:border-b-0 align-top">
                      <td className="px-2 py-2">
                        {ok ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {String(p.raw.category_slug ?? "")}
                      </td>
                      <td className="px-2 py-2">
                        {String(p.raw.title ?? "")}
                      </td>
                      <td className="px-2 py-2">
                        {String(p.raw.type ?? "Article")}
                      </td>
                      <td className="px-2 py-2 max-w-[240px] truncate font-mono text-xs">
                        {String(p.raw.url ?? "")}
                      </td>
                      <td className="px-2 py-2 text-xs text-destructive">
                        {p.errors.join("; ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
