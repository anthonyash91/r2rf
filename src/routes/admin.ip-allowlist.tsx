import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/ip-allowlist")({
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
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "ip_allowlist"],
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
      toast.success("IP added to allowlist");
      setIp("");
      setLabel("");
      qc.invalidateQueries({ queryKey: ["admin", "ip_allowlist"] });
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
      qc.invalidateQueries({ queryKey: ["admin", "ip_allowlist"] });
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
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Shield className="h-7 w-7" /> IP Allowlist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only requests from these IP addresses can reach the site. Changes take effect within ~30 seconds.
          </p>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to admin
        </Link>
      </div>

      <form onSubmit={handleAdd} className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-semibold">Add IP address</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
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

      <div className="mt-8 rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-muted-foreground">
            No IPs allowed — the site is currently inaccessible to everyone.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm">{r.ip_address}</p>
                  {r.label && (
                    <p className="text-xs text-muted-foreground truncate">{r.label}</p>
                  )}
                </div>
                <button
                  title="Remove"
                  onClick={() => {
                    if (confirm(`Remove ${r.ip_address} from the allowlist?`)) {
                      deleteMut.mutate(r.id);
                    }
                  }}
                  className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
