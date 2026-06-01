import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang } from "@/lib/i18n";

type TermsDoc = {
  title: string;
  title_es: string;
  content: string;
  content_es: string;
};

const DEFAULTS: TermsDoc = {
  title: "Terms of Service",
  title_es: "Términos de Servicio",
  content: "",
  content_es: "",
};

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Reentry to Recovery" },
      { name: "description", content: "Terms of Service for the Reentry to Recovery Content Library." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { lang, t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["site_settings", "terms_of_service"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<TermsDoc> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "terms_of_service")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULTS, ...((data?.value as Partial<TermsDoc>) ?? {}) };
    },
  });

  const title = pickLang(lang, data?.title || DEFAULTS.title, data?.title_es);
  const content = pickLang(lang, data?.content ?? "", data?.content_es);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-16">
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-7 w-7 text-[var(--color-accent)]" />
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
        </div>
        {isLoading ? (
          <p className="text-muted-foreground">{t("home.loading")}</p>
        ) : content.trim() ? (
          <article className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {content}
          </article>
        ) : (
          <p className="text-muted-foreground">
            {lang === "es"
              ? "Los términos de servicio aún no están disponibles."
              : "The Terms of Service are not available yet."}
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
