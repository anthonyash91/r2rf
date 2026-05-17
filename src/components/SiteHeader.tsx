import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const { lang, setLang, t } = useI18n();
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
            R
          </span>
          <div className="leading-tight">
            <div className="font-display font-semibold text-foreground">Reentry to Recovery</div>
            <div className="text-xs text-muted-foreground">{t("site.tagline")}</div>
          </div>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hidden sm:inline hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            {t("nav.categories")}
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              {t("nav.admin")}
            </Link>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="hover:text-foreground transition-colors"
            >
              {t("nav.signOut")}
            </button>
          ) : (
            <Link to="/auth" className="hover:text-foreground transition-colors">
              {t("nav.signIn")}
            </Link>
          )}
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            aria-label="Toggle language"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            {t("nav.language")}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 mt-6">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row gap-3 justify-between">
        <div>© {new Date().getFullYear()} Reentry to Recovery</div>
        <div>{t("footer.crisis")} <span className="text-foreground font-medium">988</span>.</div>
      </div>
    </footer>
  );
}
