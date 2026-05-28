import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertOctagon, Filter, Server, Monitor, Trash2 } from "lucide-react";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Pager } from "@/components/LoadMorePager";
import { LoadingButton } from "@/components/LoadingButton";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [page, setPage] = useState(0);

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
  const visible = filtered.slice(page * 25, (page + 1) * 25);

  const handleClearOld = async () => {
    await confirmDelete({
      title: "Clear errors older than 30 days?",
      description: "This removes old error log entries permanently.",
      confirmLabel: "Clear old",
      onConfirm: async () => {
        await clearOld({ data: { olderThanDays: 30 } });
        toast.success("Old error logs cleared");
        qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      },
    });
  };

  const handleDeleteAll = async () => {
    await confirmDelete({
      title: "Delete ALL error logs?",
      description: "This removes every error log entry permanently. Cannot be undone.",
      confirmLabel: "Delete all",
      onConfirm: async () => {
        await deleteAll({ data: undefined as never });
        toast.success("All error logs deleted");
        qc.invalidateQueries({ queryKey: ["admin-error-logs"] });
      },
    });
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
          <LoadingButton
            variant="secondary"
            onClick={handleClearOld}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            className="w-full sm:w-auto"
          >
            Clear 30+ Days
          </LoadingButton>
          <LoadingButton
            variant="destructive"
            onClick={handleDeleteAll}
            icon={<Trash2 className="h-3.5 w-3.5" />}
            className="w-full sm:w-auto"
          >
            Delete All
          </LoadingButton>
        </div>
      </div>

      <section className="mt-8 space-y-8">
        <div className="rounded-2xl border border-border bg-card p-6 pt-[22px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="message, stack, route, ip…"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Source
              </label>
              <Select
                value={source || "all"}
                onValueChange={(v) => {
                  setSource(v === "all" ? "" : (v as SourceFilter));
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full px-4 py-2 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="server">Server</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
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
                  setPage(0);
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
                  setPage(0);
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
        <Pager page={page} total={filtered.length} pageSize={25} onPage={setPage} itemLabel="error" itemLabelPlural="errors" />
      </section>
    </div>
  );
}
