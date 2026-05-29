import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue, saveFacilityMessage } from "@/lib/user-signup.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, MessageSquare, Megaphone, RefreshCw, Building2 } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";
import { FacilityCombobox } from "@/components/FacilityCombobox";
import { listFacilities } from "@/lib/facilities.functions";

export const Route = createFileRoute("/admin/messages")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminMessagesPage,
});

type SiteMessage = { enabled: boolean; message: string; message_es: string };

function FacilityMessageSection({ preselectedFacility }: { preselectedFacility?: string | null }) {
  const qc = useQueryClient();
  const saveFacilityMsgFn = useServerFn(saveFacilityMessage);
  const fetchFacilities = useServerFn(listFacilities);

  // Always call hooks unconditionally — Rules of Hooks
  const { data: facilitiesData } = useQuery({
    queryKey: ["facilities"],
    enabled: !preselectedFacility, // only needed for admin picker view
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesData?.facilities ?? [];

  const { data: existingMessages } = useQuery({
    queryKey: ["site_settings", "facility-messages-list"],
    enabled: !preselectedFacility,
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .like("key", "facility_message_%");
      const result: { value: string; message: string }[] = [];
      for (const row of data ?? []) {
        const text = ((row.value as any)?.message as string | undefined)?.trim();
        if (text) result.push({ value: (row.key as string).replace("facility_message_", ""), message: text });
      }
      return result;
    },
  });

  const [selected, setSelected] = useState<{ value: string; label: string } | null>(null);

  function selectFacility(facilityValue: string) {
    const f = facilities.find((x) => x.value === facilityValue);
    setSelected(f ? { value: f.value, label: f.label } : null);
  }

  const configuredFacilities = (existingMessages ?? [])
    .map((m) => {
      const f = facilities.find((x) => x.value === m.value);
      return f ? { ...f, message: m.message } : null;
    })
    .filter(Boolean) as { value: string; label: string; message: string }[];

  // facilityUser view: editor directly, no dropdown
  if (preselectedFacility) {
    return (
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Facility Message</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown as a banner under the navigation for users whose account is attached to a specific facility.
        </p>
        <SectionCard className="mt-3 pt-4">
          <MessageEditor
            key={preselectedFacility}
            settingsKey={`facility_message_${preselectedFacility}`}
            title="Facility Message"
            description="Shown to users at your facility and anyone visiting your facility's page."
            icon={<Building2 className="h-5 w-5 text-[var(--color-accent)]" />}
            context="Facility banner message"
            embedded
            onSaved={() => qc.invalidateQueries({ queryKey: ["site_settings", "facility-messages-list"] })}
            overrideSave={async (v) => {
              await saveFacilityMsgFn({ data: { facilityValue: preselectedFacility, value: v } });
            }}
          />
        </SectionCard>
      </section>
    );
  }

  // Admin/contributor view: full facility picker + configured messages list
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">Facility Message</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown as a banner under the navigation for users whose account is attached to a specific facility.
      </p>
      <SectionCard className="mt-3 pt-4 space-y-4">
        {configuredFacilities.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Configured messages:</span>{" "}
            {configuredFacilities.map((f, i) => (
              <span key={f.value}>
                {i > 0 && "; "}
                <button type="button" onClick={() => selectFacility(f.value)} className="text-[var(--color-accent)] hover:underline">
                  {f.label}
                </button>
              </span>
            ))}
          </p>
        )}

        <label className="block">
          <span className="text-sm font-medium">Select facility</span>
          <div className="mt-1 max-w-sm">
            <FacilityCombobox
              value={selected?.value ?? ""}
              onChange={(v) => {
                const f = facilities.find((x) => x.value === v);
                setSelected(f ? { value: f.value, label: f.label } : null);
              }}
              options={facilities.map((f) => ({ value: f.value, label: f.label }))}
              placeholder="Choose a facility…"
              searchPlaceholder="Search facilities…"
              emptyMessage={facilities.length === 0 ? "No facilities found." : "No match."}
            />
          </div>
        </label>

        {selected && (
          <MessageEditor
            key={selected.value}
            settingsKey={`facility_message_${selected.value}`}
            title={`Message for ${selected.label}`}
            description={`Shown to users at ${selected.label} and anyone visiting /facility/${selected.value}.`}
            icon={<Building2 className="h-5 w-5 text-[var(--color-accent)]" />}
            context={`Facility banner message for ${selected.label}`}
            embedded
            onSaved={() => qc.invalidateQueries({ queryKey: ["site_settings", "facility-messages-list"] })}
            overrideSave={async (v) => {
              await saveFacilityMsgFn({ data: { facilityValue: selected.value, value: v } });
            }}
          />
        )}
      </SectionCard>
    </section>
  );
}
const DEFAULTS: SiteMessage = { enabled: false, message: "", message_es: "" };

function AdminMessagesPage() {
  const { isFacilityUser, user } = useAuth();
  const fetchMyFacility = useServerFn(getMyFacilityValue);
  const { data: myFacilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });
  const myFacilityValue = isFacilityUser ? (myFacilityData?.facility ?? null) : null;

  return (
    <div>
      <PageHeader
        className="mt-6"
        icon={MessageSquare}
        title="Messages"
        description={isFacilityUser
          ? "Manage the message banner shown to users at your facility."
          : "Show a banner under the navigation on the home page or user dashboard."}
      />
      {!isFacilityUser && (
        <MessageEditor
          settingsKey="home_message"
          title="Admin Message"
          description="Shown as a banner under the navigation on all pages — home, facility pages, and the user dashboard."
          icon={<MessageSquare className="h-5 w-5 text-[var(--color-accent)]" />}
          context="Site-wide banner message"
        />
      )}
      <FacilityMessageSection preselectedFacility={myFacilityValue} />
    </div>
  );
}

function MessageEditor({
  settingsKey,
  title,
  description,
  icon,
  context,
  embedded = false,
  onSaved,
  overrideSave,
}: {
  settingsKey: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  context: string;
  embedded?: boolean;
  onSaved?: () => void;
  /** When provided, used instead of direct supabase upsert (e.g. for facilityUser RLS bypass). */
  overrideSave?: (v: SiteMessage) => Promise<void>;
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
      if (overrideSave) {
        await overrideSave(v);
      } else {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key: settingsKey, value: v }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", settingsKey] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: async () => {
      const cleared: SiteMessage = { enabled: false, message: "", message_es: "" };
      if (overrideSave) {
        await overrideSave(cleared);
      } else {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key: settingsKey, value: cleared }, { onConflict: "key" });
        if (error) throw error;
      }
      return cleared;
    },
    onSuccess: (cleared) => {
      setValue(cleared);
      setShowEs(false);
      toast.success("Message cleared");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", settingsKey] });
      onSaved?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formContent = isLoading ? (
    <p className="text-muted-foreground">Loading…</p>
  ) : (
    <form
      className="space-y-4"
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

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
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
  );

  if (embedded) return formContent;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <SectionCard className="mt-3 pt-4">
        {formContent}
      </SectionCard>
    </section>
  );
}
