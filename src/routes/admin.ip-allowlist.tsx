import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Shield, Pencil, Ban, Power } from "lucide-react";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconButton } from "@/components/IconButton";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { isMutationPendingFor } from "@/hooks/use-row-pending";
import { PageHeader } from "@/components/PageHeader";
import { Switch } from "@/components/ui/switch";

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
  return (
    <div>
      <PageHeader
        className="mt-6"
        icon={Shield}
        title="IP Allowlist"
        description="Control which IP addresses can reach the site. Changes take effect within ~30 seconds."
      />

      <IpRestrictionToggle />

      <div className="mt-8">
        <AllowlistSection />
      </div>

      <div className="mt-8">
        <BlockedSection />
      </div>
    </div>
  );
}

type BlockedRow = {
  id: string;
  ip_address: string;
  failed_count: number;
  blocked_at: string;
  last_attempt_at: string;
};

function BlockedSection() {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const queryKey = ["admin", "ip_passkey_attempts", "blocked"] as const;

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<BlockedRow[]> => {
      const { data, error } = await supabase
        .from("ip_passkey_attempts")
        .select("id, ip_address, failed_count, blocked_at, last_attempt_at")
        .not("blocked_at", "is", null)
        .order("blocked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ip_passkey_attempts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("IP unblocked");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-destructive/30 bg-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Ban className="h-5 w-5 text-destructive" /> Blocked IPs
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          IPs that failed the access passkey 5 or more times. They see a permanent block message and
          cannot retry. Remove an entry below to unblock.
        </p>
      </div>
      <div>
        {isLoading ? (
          <EmptyState>Loading…</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>No blocked IPs.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-6 md:py-5 pr-[24px] pl-[24px] flex flex-col md:flex-row md:items-center gap-5">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm">{r.ip_address}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.failed_count} failed attempt{r.failed_count === 1 ? "" : "s"} · blocked{" "}
                    {new Date(r.blocked_at).toLocaleString()}
                  </p>
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="self-end md:self-auto">
                    <IconButton
                      aria-label="Unblock"
                      tooltip="Unblock"
                      pendingTooltip="Unblocking…"
                      variant="destructive"
                      icon={Trash2}
                      pending={isMutationPendingFor(deleteMut, r.id)}
                      onClick={async () => {
                        await confirmDelete({
                          title: `Unblock ${r.ip_address}?`,
                          description:
                            "This IP will be able to attempt the access passkey again. They will not be added to the allowlist.",
                          confirmLabel: "Unblock",
                          pendingLabel: "Unblocking",
                          onConfirm: () => deleteMut.mutateAsync(r.id),
                        });
                      }}
                    />
                  </div>
                </TooltipProvider>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AllowlistSection() {
  const qc = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const queryKey = ["admin", "ip_allowlist"] as const;
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
      const { error } = await supabase.from("ip_allowlist").insert(unique);
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
        .from("ip_allowlist")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as IpRow[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (input: { ip_address: string; label: string }) => {
      const { error } = await supabase.from("ip_allowlist").insert(input);
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
      const { error } = await supabase.from("ip_allowlist").delete().eq("id", id);
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
    <SectionCard padded={false} className="overflow-hidden">
      <div className="p-6 border-b border-border">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" /> Site Allowlist
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only requests from these IPs can reach any page on the site.
        </p>
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
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Label (optional)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Office"
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </div>
          <LoadingButton
            type="submit"
            pending={addMut.isPending}
            pendingText="Adding…"
            icon={<Plus className="h-4 w-4" />}
            className="self-end"
          >
            Add
          </LoadingButton>
        </div>
      </form>

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
          className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-mono"
        />
        <div className="mt-3 flex justify-end">
          <LoadingButton
            type="submit"
            pending={bulkMut.isPending}
            pendingText="Adding…"
            disabled={bulk.trim() === ""}
            icon={<Plus className="h-4 w-4" />}
          >
            Add all
          </LoadingButton>
        </div>
      </form>

      <div>
        {isLoading ? (
          <EmptyState>Loading…</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>No IPs allowed — the site is currently inaccessible to everyone.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <AllowlistRow
                key={r.id}
                row={r}
                queryKey={queryKey}
                pendingDelete={isMutationPendingFor(deleteMut, r.id)}
                onDelete={async () => {
                  await confirmDelete({
                    title: `Remove ${r.ip_address}?`,
                    description: "This IP will be removed from the allowlist.",
                    confirmLabel: "Remove",
                    pendingLabel: "Removing",
                    onConfirm: () => deleteMut.mutateAsync(r.id),
                  });
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

function AllowlistRow({
  row,
  queryKey,
  onDelete,
  pendingDelete = false,
}: {
  row: IpRow;
  queryKey: readonly unknown[];
  onDelete: () => void;
  pendingDelete?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.label ?? "");

  const updateMut = useMutation({
    mutationFn: async (newLabel: string) => {
      const { error } = await supabase
        .from("ip_allowlist")
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
    <li className="py-6 md:py-5 pr-[24px] pl-[24px]">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm">{row.ip_address}</p>
          {row.label && !editing && (
            <p className="text-xs text-muted-foreground truncate">{row.label}</p>
          )}
        </div>
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
            <IconButton
              aria-label="Edit label"
              tooltip="Edit label"
              icon={Pencil}
              onClick={() => {
                setDraft(row.label ?? "");
                setEditing((v) => !v);
              }}
            />
            <div className="mx-1 h-6 w-px bg-border" aria-hidden />
            <IconButton
              aria-label="Remove"
              tooltip="Remove"
              pendingTooltip="Removing…"
              variant="destructive"
              icon={Trash2}
              pending={pendingDelete}
              onClick={onDelete}
            />
          </div>
        </TooltipProvider>
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
            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <LoadingButton
              variant="secondary"
              onClick={() => {
                setDraft(row.label ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </LoadingButton>
            <LoadingButton
              type="submit"
              pending={updateMut.isPending}
              pendingText="Saving…"
            >
              Update
            </LoadingButton>
          </div>
        </form>
      )}
    </li>
  );
}

function IpRestrictionToggle() {
  const qc = useQueryClient();
  const queryKey = ["admin", "site_settings", "ip_restriction_enabled"] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "ip_restriction_enabled")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value ?? null) as { enabled?: boolean } | null;
      return v && typeof v.enabled === "boolean" ? v.enabled : true;
    },
  });

  const updateMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          { key: "ip_restriction_enabled", value: { enabled } },
          { onConflict: "key" },
        );
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      toast.success(enabled ? "IP restrictions enabled" : "IP restrictions disabled — site is open to all");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const enabled = data ?? true;

  return (
    <section className={`mt-8 rounded-2xl border bg-card p-6 flex items-start gap-3 transition-all ${enabled ? "border-[var(--color-accent)] shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]" : "border-border"}`}>
      <Power className={`h-6 w-6 mt-0.5 shrink-0 ${enabled ? "text-[var(--color-accent)]" : "text-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">IP restriction</h2>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-sm font-medium ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
              {isLoading ? "Loading…" : enabled ? "On" : "Off"}
            </span>
            <Switch
              checked={enabled}
              disabled={isLoading || updateMut.isPending}
              onCheckedChange={(v) => updateMut.mutate(v)}
              aria-label="Toggle IP restriction"
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          When off, anyone can access any part of the site — the allowlist, blocklist, and per-page IP
          rules below are bypassed. When on, restrictions apply as configured. Changes take effect within ~30 seconds.
        </p>
      </div>
    </section>
  );
}
