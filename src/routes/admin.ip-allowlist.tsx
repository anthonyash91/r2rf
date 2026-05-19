import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Shield, ArrowLeft, LogIn, Pencil, Check, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/admin/ip-allowlist")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminIpAllowlistPage,
});

type IpRow = {
  id: string;
  ip_address: string;
  label: string;
  created_at: string;
};

const IP_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function AdminIpAllowlistPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const addBothMut = useMutation({
    mutationFn: async (input: { ip_address: string; label: string }) => {
      const [a, b] = await Promise.all([
        supabase.from("ip_allowlist").insert(input),
        supabase.from("auth_ip_allowlist").insert(input),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
    },
    onSuccess: () => {
      toast.success("IP added to both allowlists");
      setIp("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["admin", "ip_allowlist"] });
      qc.invalidateQueries({ queryKey: ["admin", "auth_ip_allowlist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleAddBoth(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ip.trim();
    if (!IP_REGEX.test(trimmed)) {
      toast.error("Enter a valid IPv4 address");
      return;
    }
    addBothMut.mutate({ ip_address: trimmed, label: label.trim() });
  }

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <Shield className="h-7 w-7" /> IP Allowlists
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control which IP addresses can reach the site and the login page. Changes take effect within ~30 seconds.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-xl font-semibold">Add to both allowlists</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adds the IP to the site allowlist and the login / sign-up allowlist in one step.
          </p>
        </div>
        <form onSubmit={handleAddBoth} className="p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="text-sm font-medium">IPv4 address</label>
              <input
                required
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.1"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Label (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Office"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={addBothMut.isPending}
              className="self-end inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add to both
            </button>
          </div>
        </form>
      </section>

      <div className="mt-8">
        <AllowlistSection
          table="ip_allowlist"
          queryKey={["admin", "ip_allowlist"]}
          icon={<Shield className="h-5 w-5" />}
          title="Site allowlist"
          description="Only requests from these IPs can reach any page on the site."
          emptyMessage="No IPs allowed — the site is currently inaccessible to everyone."
          allowBulk
        />
      </div>

      <div className="mt-8">
        <AllowlistSection
          table="auth_ip_allowlist"
          queryKey={["admin", "auth_ip_allowlist"]}
          icon={<LogIn className="h-5 w-5" />}
          title="Login / sign-up allowlist"
          description="Only requests from these IPs can load the /auth page. Applied in addition to the site allowlist."
          emptyMessage="No IPs allowed — the login page is currently inaccessible to everyone."
        />
      </div>
    </div>
  );
}

function AllowlistSection({
  table,
  queryKey,
  icon,
  title,
  description,
  emptyMessage,
  allowBulk = false,
}: {
  table: "ip_allowlist" | "auth_ip_allowlist";
  queryKey: readonly unknown[];
  icon: React.ReactNode;
  title: string;
  description: string;
  emptyMessage: string;
  allowBulk?: boolean;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");
  const [bulk, setBulk] = useState("");

  const bulkMut = useMutation({
    mutationFn: async (rawText: string) => {
      const lines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed = lines.map((line) => {
        const commaIdx = line.indexOf(",");
        const ip = (commaIdx === -1 ? line : line.slice(0, commaIdx)).trim();
        const label = commaIdx === -1 ? "" : line.slice(commaIdx + 1).trim().slice(0, 80);
        return { ip_address: ip, label };
      });
      const invalid = parsed.filter((p) => !IP_REGEX.test(p.ip_address));
      if (invalid.length > 0) {
        throw new Error(
          `Invalid IPv4 address(es): ${invalid.slice(0, 3).map((p) => p.ip_address).join(", ")}${invalid.length > 3 ? "…" : ""}`,
        );
      }
      const seen = new Set<string>();
      const unique = parsed.filter((p) => {
        if (seen.has(p.ip_address)) return false;
        seen.add(p.ip_address);
        return true;
      });
      if (unique.length === 0) throw new Error("Enter at least one IP address");
      const { error } = await supabase.from(table).insert(unique);
      if (error) throw error;
      return unique.length;
    },
    onSuccess: (count) => {
      toast.success(`Added ${count} IP${count === 1 ? "" : "s"}`);
      setBulk("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<IpRow[]> => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as IpRow[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: { ip_address: string; label: string }) => {
      const { error } = await supabase.from(table).insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IP added");
      setIp("");
      setLabel("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IP removed");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = ip.trim();
    if (!IP_REGEX.test(trimmed)) {
      toast.error("Enter a valid IPv4 address");
      return;
    }
    addMut.mutate({ ip_address: trimmed, label: label.trim() });
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={handleAdd} className="p-6 border-b border-border">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="text-sm font-medium">IPv4 address</label>
            <input
              required
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.1"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Office"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={addMut.isPending}
            className="self-end inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </form>

      {allowBulk && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bulkMut.mutate(bulk);
          }}
          className="p-6 border-b border-border"
        >
          <label className="text-sm font-medium">
            Bulk add (one per line — <span className="font-mono">IP,label</span>; label is optional)
          </label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={5}
            placeholder={"192.168.1.1,Office\n10.0.0.42,Home\n203.0.113.7"}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={bulkMut.isPending || bulk.trim() === ""}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add all
            </button>
          </div>
        </form>
      )}

      <div>
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-muted-foreground">{emptyMessage}</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <AllowlistRow
                key={r.id}
                row={r}
                table={table}
                queryKey={queryKey}
                onDelete={async () => {
                  const ok = await confirm({
                    title: `Remove ${r.ip_address}?`,
                    description: "This IP will be removed from the allowlist.",
                    confirmLabel: "Remove",
                    destructive: true,
                  });
                  if (ok) deleteMut.mutate(r.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AllowlistRow({
  row,
  table,
  queryKey,
  onDelete,
}: {
  row: IpRow;
  table: "ip_allowlist" | "auth_ip_allowlist";
  queryKey: readonly unknown[];
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.label ?? "");

  const updateMut = useMutation({
    mutationFn: async (newLabel: string) => {
      const { error } = await supabase
        .from(table)
        .update({ label: newLabel })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Label updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <li className="p-4 pl-[24px]">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm">{row.ip_address}</p>
          {row.label && !editing && (
            <p className="text-xs text-muted-foreground truncate">{row.label}</p>
          )}
        </div>
        <button
          title="Edit label"
          onClick={() => {
            setDraft(row.label ?? "");
            setEditing((v) => !v);
          }}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          title="Remove"
          onClick={onDelete}
          className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMut.mutate(draft.trim());
          }}
          className="mt-3 flex flex-col sm:flex-row gap-2"
        >
          <input
            autoFocus
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(row.label ?? "");
                setEditing(false);
              }
            }}
            placeholder="Label (e.g. Office)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(row.label ?? "");
                setEditing(false);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Update label
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
