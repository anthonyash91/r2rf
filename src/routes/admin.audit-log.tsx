import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScrollText, UserPlus, UserMinus, KeyRound, ShieldCheck, ShieldOff, Trash2, HelpCircle, Filter } from "lucide-react";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { LoadMorePager, useLoadMore } from "@/components/LoadMorePager";
import { listAuditLog } from "@/lib/admin-audit.functions";

export const Route = createFileRoute("/admin/audit-log")({
  head: () => ({ meta: [{ title: "Audit Log — Admin" }] }),
  beforeLoad: requireAdminBeforeLoad,
  component: AdminAuditLogPage,
});

type ActionType =
  | "user.create"
  | "user.delete"
  | "user.password_reset"
  | "user.role_grant"
  | "user.role_revoke"
  | "user.security_answers_clear"
  | "user.security_answers_change";

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "user.create", label: "User created" },
  { value: "user.delete", label: "User deleted" },
  { value: "user.password_reset", label: "Password reset" },
  { value: "user.role_grant", label: "Role granted" },
  { value: "user.role_revoke", label: "Role revoked" },
  { value: "user.security_answers_clear", label: "Security answers cleared" },
  { value: "user.security_answers_change", label: "Security answers changed" },
];

const ACTION_META: Record<ActionType, { label: string; icon: typeof UserPlus; tone: string }> = {
  "user.create": { label: "User created", icon: UserPlus, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  "user.delete": { label: "User deleted", icon: Trash2, tone: "text-red-600 bg-red-50 dark:bg-red-950/40" },
  "user.password_reset": { label: "Password reset", icon: KeyRound, tone: "text-amber-700 bg-amber-50 dark:bg-amber-950/40" },
  "user.role_grant": { label: "Role granted", icon: ShieldCheck, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  "user.role_revoke": { label: "Role revoked", icon: ShieldOff, tone: "text-red-600 bg-red-50 dark:bg-red-950/40" },
  "user.security_answers_clear": { label: "Security answers cleared", icon: UserMinus, tone: "text-amber-700 bg-amber-50 dark:bg-amber-950/40" },
  "user.security_answers_change": { label: "Security answers changed", icon: HelpCircle, tone: "text-muted-foreground bg-muted" },
};

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function describeUser(username: string | null, email: string | null, id: string | null) {
  if (username) return username;
  if (email) return email;
  if (id) return id.slice(0, 8) + "…";
  return "—";
}

function describeDetails(action: ActionType, details: Record<string, string | number | boolean | null>) {
  const parts: string[] = [];
  if (action === "user.create" || action === "user.role_grant" || action === "user.role_revoke") {
    if (details.role) parts.push(`role: ${String(details.role)}`);
  }
  if (action === "user.password_reset") {
    if (details.method) parts.push(`method: ${String(details.method)}`);
    if (details.email) parts.push(String(details.email));
  }
  if (action === "user.create" && details.email) {
    parts.push(String(details.email));
  }
  if (action === "user.delete" && details.bulk) {
    parts.push("bulk");
  }
  return parts.join(" · ");
}

function AdminAuditLogPage() {
  const fetchAuditLog = useServerFn(listAuditLog);
  const [action, setAction] = useState<ActionType | "">("");
  const [search, setSearch] = useState("");
  const [since, setSince] = useState("");
  const pager = useLoadMore(25, 25);

  const sinceIso = useMemo(() => (since ? new Date(since).toISOString() : undefined), [since]);

  const query = useQuery({
    queryKey: ["admin-audit-log", action, since],
    queryFn: () =>
      fetchAuditLog({
        data: {
          action: action || undefined,
          since: sinceIso,
          limit: 200,
        },
      }),
  });

  const all = query.data?.entries ?? [];
  const s = search.trim().toLowerCase();
  const filtered = s
    ? all.filter((e) => {
        const blob = [
          e.actor_username,
          e.actor_email,
          e.target_username,
          e.target_email,
          e.ip_address,
          JSON.stringify(e.details),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(s);
      })
    : all;
  const visible = filtered.slice(0, pager.visibleCount);

  return (
    <div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          icon={ScrollText}
          title="Audit Log"
          count={!query.isLoading ? `${filtered.length}${s || action ? ` of ${all.length}` : ""}` : undefined}
          description="Sensitive admin actions, written server-side. Read-only."
        />
      </div>

      <section className="mt-8 space-y-8">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); pager.reset(); }}
                placeholder="username, email, ip, details…"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => { setAction((e.target.value as ActionType) || ""); pager.reset(); }}
                className="w-full sm:w-auto rounded-md border border-input bg-background px-4 py-2 text-sm"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Since</label>
              <input
                type="datetime-local"
                value={since}
                onChange={(e) => { setSince(e.target.value); pager.reset(); }}
                className="w-full sm:w-auto rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
            {(action || search || since) && (
              <button
                onClick={() => { setAction(""); setSearch(""); setSince(""); pager.reset(); }}
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
            <EmptyState size="sm">Failed to load audit log.</EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState size="sm">No audit entries match these filters.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((e) => {
                const meta = ACTION_META[e.action as ActionType] ?? {
                  label: e.action,
                  icon: HelpCircle,
                  tone: "text-muted-foreground bg-muted",
                };
                const Icon = meta.icon;
                const detailText = describeDetails(e.action as ActionType, e.details);
                return (
                  <li key={e.id} className="p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm">
                            <span className="font-medium">{meta.label}</span>
                            {e.target_user_id && (
                              <>
                                {" "}
                                <span className="text-muted-foreground">on</span>{" "}
                                <span className="font-medium">
                                  {describeUser(e.target_username, e.target_email, e.target_user_id)}
                                </span>
                              </>
                            )}
                            {detailText && (
                              <span className="text-muted-foreground"> — {detailText}</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>
                              by {describeUser(e.actor_username, e.actor_email, e.actor_user_id)}
                            </span>
                            {e.ip_address && <span>· {e.ip_address}</span>}
                          </div>
                        </div>
                      </div>
                      <time className="text-xs text-muted-foreground shrink-0 sm:text-right">
                        {formatDate(e.created_at)}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <LoadMorePager pager={pager} total={filtered.length} itemLabel="entry" itemLabelPlural="entries" />
      </section>
    </div>
  );
}
