import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang } from "@/lib/i18n";

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

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Reentry to Recovery" },
      { name: "description", content: "How we collect, use, and protect your information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang, t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings", "privacy_policy"],
    queryFn: async (): Promise<PrivacyPolicy> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "privacy_policy")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data?.value as Partial<PrivacyPolicy>) ?? {}) };
    },
  });

  const title = pickLang(lang, data?.title || DEFAULTS.title, data?.title_es);
  const content = pickLang(lang, data?.content ?? "", data?.content_es);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Shield className="h-7 w-7 text-[var(--color-accent)]" />
            {title}
          </h1>
          {isLoading ? (
            <p className="mt-6 text-muted-foreground">{t("home.loading")}</p>
          ) : content.trim() ? (
            <article className="mt-6 whitespace-pre-wrap leading-relaxed text-foreground/90">
              {content}
            </article>
          ) : (
            <p className="mt-6 text-muted-foreground">
              {lang === "es"
                ? "La política de privacidad aún no está disponible."
                : "The privacy policy is not available yet."}
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
