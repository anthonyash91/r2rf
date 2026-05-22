import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, MessageSquare, Home, User as UserIcon, Megaphone, RefreshCw } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";

export const Route = createFileRoute("/admin/messages")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminMessagesPage,
});

type SiteMessage = { enabled: boolean; message: string; message_es: string };
const DEFAULTS: SiteMessage = { enabled: false, message: "", message_es: "" };

function AdminMessagesPage() {
  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <PageHeader
        className="mt-6"
        icon={MessageSquare}
        title="Messages"
        description="Show a banner under the navigation on the home page or user dashboard."
      />

      <div className="mt-8 space-y-6">
        <MessageEditor
          settingsKey="home_message"
          title="Home Page Message"
          description="Shown as a banner on the main index page under the navigation."
          icon={<Home className="h-6 w-6 text-[var(--color-accent)]" />}
          context="Home page banner message"
        />
        <MessageEditor
          settingsKey="user_message"
          title="User Message"
          description="Shown as a banner on the user dashboard page under the navigation."
          icon={<UserIcon className="h-6 w-6 text-[var(--color-accent)]" />}
          context="User dashboard banner message"
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
  context,
}: {
  settingsKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  context: string;
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

  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();
  const [showEs, setShowEs] = useState(false);
  useEffect(() => {
    if (data?.message_es?.trim()) setShowEs(true);
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
      const cleared: SiteMessage = { enabled: false, message: "", message_es: "" };
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: settingsKey, value: cleared }, { onConflict: "key" });
      if (error) throw error;
      return cleared;
    },
    onSuccess: (cleared) => {
      setValue(cleared);
      setShowEs(false);
      toast.success("Message cleared");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", settingsKey] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <SectionCard>
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
          <label className="block">
            <span className="text-sm font-medium">Message (English)</span>
            <textarea
              rows={4}
              value={value.message}
              onChange={(e) =>
                setValue({ ...value, message: e.target.value, enabled: e.target.value.trim().length > 0 })
              }
              placeholder="Enter the message to display in the banner…"
              className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The banner will appear as long as there is a saved message. Clear the message to hide it.
            </p>
          </label>

          {showEs ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <span className="text-sm font-medium">Message (Spanish)</span>
                  <p className="text-xs text-muted-foreground">Leave blank to fall back to English when Spanish is selected.</p>
                </div>
                <div className="flex items-center gap-3">
                  <LoadingButton
                    variant="secondary"
                    pending={addEsBusy}
                    pendingText="Translating…"
                    disabled={!value.message.trim()}
                    icon={<RefreshCw className="h-3 w-3" />}
                    className="gap-1.5"
                    onClick={() =>
                      runAddEs(
                        { message: value.message },
                        (t) => setValue((prev) => ({ ...prev, message_es: t.message ?? prev.message_es })),
                        context,
                      )
                    }
                  >
                    Regenerate
                  </LoadingButton>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEs(false);
                      setValue((prev) => ({ ...prev, message_es: "" }));
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Hide
                  </button>
                </div>
              </div>
              {addEsBusy && <TranslatingIndicator />}
              <textarea
                rows={4}
                value={value.message_es}
                onChange={(e) => setValue({ ...value, message_es: e.target.value })}
                placeholder="Spanish translation (shown to Spanish-language visitors)…"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <LoadingButton
                variant="secondary"
                pending={addEsBusy}
                pendingText="Translating…"
                disabled={!value.message.trim()}
                onClick={() => {
                  setShowEs(true);
                  runAddEs(
                    { message: value.message },
                    (t) => setValue((prev) => ({ ...prev, message_es: t.message ?? prev.message_es })),
                    context,
                  );
                }}
              >
                + Add Spanish translation
              </LoadingButton>
            </div>
          )}

          {value.message.trim() && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
              <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 flex items-start gap-3 text-sm">
                <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">English</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{value.message}</p>
                </div>
              </div>
              {value.message_es.trim() && (
                <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3 flex items-start gap-3 text-sm">
                  <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Spanish</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{value.message_es}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <LoadingButton
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => clearMut.mutate()}
              pending={clearMut.isPending}
              pendingText="Clearing…"
              disabled={saveMut.isPending}
            >
              Clear message
            </LoadingButton>
            <LoadingButton
              type="submit"
              variant="primary"
              className="w-full sm:w-auto"
              pending={saveMut.isPending}
              icon={<Save className="h-4 w-4" />}
            >
              Save
            </LoadingButton>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
