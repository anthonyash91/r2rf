import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertOctagon, Filter, Server, Monitor, Trash2 } from "lucide-react";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadMorePager, useLoadMore } from "@/components/LoadMorePager";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  listErrorLogs,
  clearOldErrorLogs,
  deleteAllErrorLogs,
} from "@/lib/error-logs.functions";

export const Route = createFileRoute("/admin/errors")({
  head: () => ({ meta: [{ title: "Errors — Admin" }] }),
  beforeLoad: requireAdminBeforeLoad,
  component: AdminErrorsPage,
});

type SourceFilter = "" | "server" | "client";

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function ErrorRow({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);
  const Icon = entry.source === "server" ? Server : Monitor;
  const tone =
    entry.source === "server"
      ? "text-red-600 bg-red-50 dark:bg-red-950/40"
      : "text-amber-700 bg-amber-50 dark:bg-amber-950/40";
  return (
    <li className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-1 flex-1">
            <div className="text-sm break-words">
              <span className="font-medium">{entry.message}</span>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="uppercase tracking-wide">{entry.source}</span>
              {entry.route && <span>· {entry.route}</span>}
              {entry.username && <span>· {entry.username}</span>}
              {entry.ip_address && <span>· {entry.ip_address}</span>}
            </div>
            {(entry.stack || (entry.context && Object.keys(entry.context).length > 0)) && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {open ? "Hide details" : "Show details"}
              </button>
            )}
            {open && (
              <div className="mt-2 space-y-2">
                {entry.stack && (
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                    {entry.stack}
                  </pre>
                )}
                {entry.context && Object.keys(entry.context).length > 0 && (
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.context, null, 2)}
                  </pre>
                )}
                {entry.user_agent && (
                  <div className="text-[11px] text-muted-foreground break-all">
                    UA: {entry.user_agent}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <time className="text-xs text-muted-foreground shrink-0 sm:text-right">
          {formatDate(entry.created_at)}
        </time>
      </div>
    </li>
  );
}

function AdminErrorsPage() {
  const fetchErrors = useServerFn(listErrorLogs);
  const clearOld = useServerFn(clearOldErrorLogs);
  const deleteAll = useServerFn(deleteAllErrorLogs);
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();

  const [source, setSource] = useState<SourceFilter>("");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState("");
  const pager = useLoadMore(25, 25);

  const sinceIso = useMemo(() => (since ? new Date(since).toISOString() : undefined), [since]);

  const query = useQuery({
    queryKey: ["admin-error-logs", source, since],
    queryFn: () =>
      fetchErrors({
        data: {
          source: source || undefined,
          since: sinceIso,
          limit: 200,
        },
      }),
  });

  const all = query.data?.entries ?? [];
  const s = search.trim().toLowerCase();
  const filtered = s
    ? all.filter((e: any) => {
        const blob = [e.message, e.stack, e.route, e.username, e.ip_address, JSON.stringify(e.context)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(s);
      })
    : all;
  const visible = filtered.slice(0, pager.visibleCount);

  const handleClearOld = async () => {
    const ok = await confirmDelete({
      title: "Clear errors older than 30 days?",
      description: "This removes old error log entries permanently.",
      confirmLabel: "Clear old",
    });
    if (!ok) return;
    try {
      await clearOld({ data: { olderThanDays: 30 } });
      toast.success("Old error logs cleared");
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to clear");
    }
  };

  const handleDeleteAll = async () => {
    const ok = await confirmDelete({
      title: "Delete ALL error logs?",
      description: "This removes every error log entry permanently. Cannot be undone.",
      confirmLabel: "Delete all",
    });
    if (!ok) return;
    try {
      await deleteAll({});
      toast.success("All error logs deleted");
      qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  return (
    <div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={AlertOctagon}
          title="Errors"
          count={
            !query.isLoading
              ? `${filtered.length}${s || source ? ` of ${all.length}` : ""}`
              : undefined
          }
          description="Application errors captured from both server and browser. Read-only."
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            onClick={handleClearOld}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear 30+ days
          </button>
          <button
            onClick={handleDeleteAll}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete all
          </button>
        </div>
      </div>

      <section className="mt-8 space-y-8">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pager.reset();
                }}
                placeholder="message, stack, route, ip…"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Source
              </label>
              <select
                value={source}
                onChange={(e) => {
                  setSource((e.target.value as SourceFilter) || "");
                  pager.reset();
                }}
                className="w-full sm:w-auto rounded-md border border-input bg-background px-4 py-2 text-sm"
              >
                <option value="">All sources</option>
                <option value="server">Server</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Since
              </label>
              <input
                type="datetime-local"
                value={since}
                onChange={(e) => {
                  setSince(e.target.value);
                  pager.reset();
                }}
                className="w-full sm:w-auto rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
            {(source || search || since) && (
              <button
                onClick={() => {
                  setSource("");
                  setSearch("");
                  setSince("");
                  pager.reset();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                <Filter className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {query.isLoading ? (
            <EmptyState size="sm">Loading…</EmptyState>
          ) : query.isError ? (
            <EmptyState size="sm">Failed to load errors.</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState size="sm">No errors match these filters.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((e: any) => (
                <ErrorRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </div>
        <LoadMorePager
          pager={pager}
          total={filtered.length}
          itemLabel="error"
          itemLabelPlural="errors"
        />
      </section>
    </div>
  );
}
