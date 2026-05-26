import { createFileRoute } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { SectionCard } from "@/components/SectionCard";
import { PageHeader } from "@/components/PageHeader";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";

type PrivacyPolicy = {
  title: string;
  title_es: string;
  content: string;
  content_es: string;
};

const DEFAULTS: PrivacyPolicy = {
  title: "Privacy Policy",
  title_es: "Política de Privacidad",
  content: "",
  content_es: "",
};

const SETTINGS_KEY = "privacy_policy";

export const Route = createFileRoute("/admin/privacy")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminPrivacyPage,
});

function AdminPrivacyPage() {
  const qc = useQueryClient();
  const queryKey = ["admin", "site_settings", SETTINGS_KEY] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PrivacyPolicy> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data?.value as Partial<PrivacyPolicy>) ?? {}) };
    },
  });

  const [value, setValue] = useState<PrivacyPolicy>(DEFAULTS);
  useEffect(() => {
    if (data) setValue(data);
  }, [data]);

  const { run: runTranslate, busy: translating } = useTranslateToSpanish();
  const [showEs, setShowEs] = useState(false);
  useEffect(() => {
    if (data?.content_es?.trim() || data?.title_es?.trim()) setShowEs(true);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (v: PrivacyPolicy) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: SETTINGS_KEY, value: v }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["site_settings", SETTINGS_KEY] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        className="mt-6"
        icon={Shield}
        title="Privacy Policy"
        description="Edit the privacy policy page shown to all visitors. Available in English and Spanish."
      />

      <SectionCard className="mt-8">

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate(value);
            }}
          >
            <label className="block">
              <span className="text-sm font-medium">Page title (English)</span>
              <input
                type="text"
                value={value.title}
                onChange={(e) => setValue({ ...value, title: e.target.value })}
                placeholder="Privacy Policy"
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Content (English)</span>
              <textarea
                rows={20}
                value={value.content}
                onChange={(e) => setValue({ ...value, content: e.target.value })}
                placeholder="Write the privacy policy here. Line breaks are preserved."
                className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-mono leading-relaxed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Plain text with line breaks. Use blank lines to separate paragraphs.
              </p>
            </label>

            {showEs ? (
              <div className="space-y-4 rounded-lg border border-dashed border-border bg-muted/20 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Spanish translation</h3>
                    <p className="text-xs text-muted-foreground">
                      Leave blank to fall back to English when Spanish is selected.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEs(false);
                      setValue((prev) => ({ ...prev, title_es: "", content_es: "" }));
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Hide
                  </button>
                </div>
                {translating && <TranslatingIndicator />}


                <label className="block">
                  <span className="text-sm font-medium">Page title (Spanish)</span>
                  <input
                    type="text"
                    value={value.title_es}
                    onChange={(e) => setValue({ ...value, title_es: e.target.value })}
                    placeholder="Política de Privacidad"
                    className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Content (Spanish)</span>
                  <textarea
                    rows={20}
                    value={value.content_es}
                    onChange={(e) => setValue({ ...value, content_es: e.target.value })}
                    placeholder="Traducción al español (mostrada a visitantes en español)…"
                    className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-mono leading-relaxed"
                  />
                </label>
              </div>
            ) : (
              <div>
                <LoadingButton
                  variant="secondary"
                  pending={translating}
                  pendingText="Translating…"
                  disabled={!value.title.trim() && !value.content.trim()}
                  onClick={() => {
                    setShowEs(true);
                    runTranslate(
                      { title: value.title, content: value.content },
                      (tr) =>
                        setValue((prev) => ({
                          ...prev,
                          title_es: tr.title ?? prev.title_es,
                          content_es: tr.content ?? prev.content_es,
                        })),
                      "Privacy policy page",
                    );
                  }}
                >
                  + Add Spanish translation
                </LoadingButton>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <LoadingButton
                type="submit"
                pending={saveMut.isPending}
                pendingText="Saving…"
                className="w-full sm:w-auto"
              >
                Save
              </LoadingButton>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  );
}
