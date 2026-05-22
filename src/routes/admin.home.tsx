import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAdminBeforeLoad } from "@/lib/admin-guards";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, RefreshCw, Home } from "lucide-react";
import { useTranslateToSpanish, TranslatingIndicator } from "@/components/TranslateButton";
import { LabeledField } from "@/components/FormField";
import { LoadingButton } from "@/components/LoadingButton";

export const Route = createFileRoute("/admin/home")({
  beforeLoad: requireAdminBeforeLoad,
  component: AdminHomePage,
});

type HomeHero = {
  eyebrow: string;
  heading_prefix: string;
  heading_emphasis: string;
  heading_suffix: string;
  subheading: string;
  eyebrow_es: string;
  heading_prefix_es: string;
  heading_emphasis_es: string;
  heading_suffix_es: string;
  subheading_es: string;
};

const DEFAULTS: HomeHero = {
  eyebrow: "",
  heading_prefix: "",
  heading_emphasis: "",
  heading_suffix: "",
  subheading: "",
  eyebrow_es: "",
  heading_prefix_es: "",
  heading_emphasis_es: "",
  heading_suffix_es: "",
  subheading_es: "",
};

function AdminHomePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "site_settings", "home_hero"],
    queryFn: async (): Promise<HomeHero> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "home_hero")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data?.value as Partial<HomeHero>) ?? {}) };
    },
  });

  const [hero, setHero] = useState<HomeHero>(DEFAULTS);
  const [showEs, setShowEs] = useState(false);
  useEffect(() => {
    if (data) {
      setHero(data);
      if (data.eyebrow_es || data.heading_prefix_es || data.heading_emphasis_es || data.heading_suffix_es || data.subheading_es) {
        setShowEs(true);
      }
    }
  }, [data]);

  const { run: runAddEs, busy: addEsBusy } = useTranslateToSpanish();

  const saveMut = useMutation({
    mutationFn: async (value: HomeHero) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert({ key: "home_hero", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "site_settings", "home_hero"] });
      qc.invalidateQueries({ queryKey: ["site_settings", "home_hero"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Home className="h-6 w-6 text-[var(--color-accent)]" /> Home page header</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the eyebrow, headline, and subheading shown at the top of the home page. The headline is split into three parts; the middle part is shown in accent italic.
        </p>

        {isLoading ? (
          <p className="mt-6 text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => { e.preventDefault(); saveMut.mutate(hero); }}
          >
            <LabeledField label="Eyebrow (small pill above headline)">
              <input
                value={hero.eyebrow}
                onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </LabeledField>
            <div className="grid sm:grid-cols-3 gap-4">
              <LabeledField label="Headline — prefix">
                <input
                  value={hero.heading_prefix}
                  onChange={(e) => setHero({ ...hero, heading_prefix: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </LabeledField>
              <LabeledField label="Headline — emphasis (italic accent)">
                <input
                  value={hero.heading_emphasis}
                  onChange={(e) => setHero({ ...hero, heading_emphasis: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </LabeledField>
              <LabeledField label="Headline — suffix">
                <input
                  value={hero.heading_suffix}
                  onChange={(e) => setHero({ ...hero, heading_suffix: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </LabeledField>
            </div>
            <LabeledField label="Subheading">
              <textarea
                rows={3}
                value={hero.subheading}
                onChange={(e) => setHero({ ...hero, subheading: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            </LabeledField>

            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 mb-[30px]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">EN</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
                {hero.eyebrow || "—"}
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                {hero.heading_prefix}{" "}
                <span className="italic text-[var(--color-accent)]">{hero.heading_emphasis}</span>{" "}
                {hero.heading_suffix}
              </h2>
              <p className="mt-3 text-muted-foreground">{hero.subheading}</p>
            </div>

            {showEs ? (
              <div className="border-t border-border pt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Spanish translation</h2>
                    <p className="text-xs text-muted-foreground">Leave blank to fall back to English when Spanish is selected.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={addEsBusy}
                      onClick={() => {
                        runAddEs(
                          {
                            eyebrow: hero.eyebrow,
                            heading_prefix: hero.heading_prefix,
                            heading_emphasis: hero.heading_emphasis,
                            heading_suffix: hero.heading_suffix,
                            subheading: hero.subheading,
                          },
                          (t) =>
                            setHero((prev) => ({
                              ...prev,
                              eyebrow_es: t.eyebrow ?? prev.eyebrow_es,
                              heading_prefix_es: t.heading_prefix ?? prev.heading_prefix_es,
                              heading_emphasis_es: t.heading_emphasis ?? prev.heading_emphasis_es,
                              heading_suffix_es: t.heading_suffix ?? prev.heading_suffix_es,
                              subheading_es: t.subheading ?? prev.subheading_es,
                            })),
                          "Home page hero copy",
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3 w-3 ${addEsBusy ? "animate-spin" : ""}`} />
                      {addEsBusy ? "Translating…" : "Regenerate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEs(false)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Hide
                    </button>
                  </div>
                </div>
                {addEsBusy && <TranslatingIndicator />}
                <LabeledField label="Eyebrow (ES)">
                  <input
                    value={hero.eyebrow_es}
                    onChange={(e) => setHero({ ...hero, eyebrow_es: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                  />
                </LabeledField>
                <div className="grid sm:grid-cols-3 gap-4">
                  <LabeledField label="Headline — prefix (ES)">
                    <input
                      value={hero.heading_prefix_es}
                      onChange={(e) => setHero({ ...hero, heading_prefix_es: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                    />
                  </LabeledField>
                  <LabeledField label="Headline — emphasis (ES)">
                    <input
                      value={hero.heading_emphasis_es}
                      onChange={(e) => setHero({ ...hero, heading_emphasis_es: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                    />
                  </LabeledField>
                  <LabeledField label="Headline — suffix (ES)">
                    <input
                      value={hero.heading_suffix_es}
                      onChange={(e) => setHero({ ...hero, heading_suffix_es: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                    />
                  </LabeledField>
                </div>
                <LabeledField label="Subheading (ES)">
                  <textarea
                    rows={3}
                    value={hero.subheading_es}
                    onChange={(e) => setHero({ ...hero, subheading_es: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                  />
                </LabeledField>

                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 mb-[30px]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">ES</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
                    {hero.eyebrow_es || hero.eyebrow || "—"}
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">
                    {hero.heading_prefix_es || hero.heading_prefix}{" "}
                    <span className="italic text-[var(--color-accent)]">{hero.heading_emphasis_es || hero.heading_emphasis}</span>{" "}
                    {hero.heading_suffix_es || hero.heading_suffix}
                  </h2>
                  <p className="mt-3 text-muted-foreground">{hero.subheading_es || hero.subheading}</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-border pt-6">
                <button
                  type="button"
                  disabled={addEsBusy}
                  onClick={() => {
                    setShowEs(true);
                    runAddEs(
                      {
                        eyebrow: hero.eyebrow,
                        heading_prefix: hero.heading_prefix,
                        heading_emphasis: hero.heading_emphasis,
                        heading_suffix: hero.heading_suffix,
                        subheading: hero.subheading,
                      },
                      (t) =>
                        setHero((prev) => ({
                          ...prev,
                          eyebrow_es: t.eyebrow ?? prev.eyebrow_es,
                          heading_prefix_es: t.heading_prefix ?? prev.heading_prefix_es,
                          heading_emphasis_es: t.heading_emphasis ?? prev.heading_emphasis_es,
                          heading_suffix_es: t.heading_suffix ?? prev.heading_suffix_es,
                          subheading_es: t.subheading ?? prev.subheading_es,
                        })),
                      "Home page hero copy",
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-60"
                >
                  {addEsBusy ? "Translating…" : "+ Add Spanish translation"}
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saveMut.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

