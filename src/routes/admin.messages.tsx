import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, MessageSquare, Home, User as UserIcon, Megaphone } from "lucide-react";

export const Route = createFileRoute("/admin/messages")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminMessagesPage,
});

type SiteMessage = { enabled: boolean; message: string };
const DEFAULTS: SiteMessage = { enabled: false, message: "" };

function AdminMessagesPage() {
  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <MessageSquare className="h-7 w-7 text-[var(--color-accent)]" /> Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Show a banner under the navigation on the home page or user dashboard.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <MessageEditor
          settingsKey="home_message"
          title="Home Page Message"
          description="Shown as a banner on the main index page under the navigation."
          icon={<Home className="h-6 w-6 text-[var(--color-accent)]" />}
        />
        <MessageEditor
          settingsKey="user_message"
          title="User Message"
          description="Shown as a banner on the user dashboard page under the navigation."
          icon={<UserIcon className="h-6 w-6 text-[var(--color-accent)]" />}
        />
      </div>
    </div>
  );
}

function MessageEditor({
  settingsKey,
  title,
  description,
  icon,
}: {
  settingsKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const qc = useQueryClient();
  const queryKey = ["admin", "site_settings", settingsKey] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<SiteMessage> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", settingsKey)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data?.value as Partial<SiteMessage>) ?? {}) };
    },
  });

  const [value, setValue] = useState<SiteMessage>(DEFAULTS);
  useEffect(() => {
    if (data) setValue(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (v: SiteMessage) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: settingsKey, value: v }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", settingsKey] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      const cleared: SiteMessage = { enabled: false, message: "" };
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: settingsKey, value: cleared }, { onConflict: "key" });
      if (error) throw error;
      return cleared;
    },
    onSuccess: (cleared) => {
      setValue(cleared);
      toast.success("Message cleared");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", settingsKey] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {isLoading ? (
        <p className="mt-6 text-muted-foreground">Loading…</p>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMut.mutate(value);
          }}
        >
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Show this banner
          </label>

          <label className="block">
            <span className="text-sm font-medium">Message</span>
            <textarea
              rows={4}
              value={value.message}
              onChange={(e) => setValue({ ...value, message: e.target.value })}
              placeholder="Enter the message to display in the banner…"
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
          </label>

          {value.message.trim() && value.enabled && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
              <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 flex items-start gap-3 text-sm">
                <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <p className="whitespace-pre-wrap leading-relaxed">{value.message}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending || saveMut.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
            >
              {clearMut.isPending ? "Clearing…" : "Clear message"}
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
