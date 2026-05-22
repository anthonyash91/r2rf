import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { isAuthIpAllowed } from "@/lib/auth-ip.functions";
import { useActiveCustomHome } from "@/lib/custom-home-context";
import { useSecurityLock } from "@/lib/security-lock";
import { Languages, Menu, X } from "lucide-react";

export function SiteHeader() {
  const { user, canAccessAdmin, isUser, isAdmin, isContributor } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const activeCustomHome = useActiveCustomHome();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };
  const checkAuthIp = useServerFn(isAuthIpAllowed);
  const { data: authIp } = useQuery({
    queryKey: ["auth-ip-allowed"],
    queryFn: () => checkAuthIp(),
    staleTime: 60_000,
  });
  // Show admin auth link to visitors whose IP is allowed (admin sign-in is IP-gated).
  const showAuthLink = authIp?.allowed === true;
  const isAdminUser = isAdmin || isContributor;
  const signOutLabel = isAdminUser ? t("nav.adminSignOut") : t("nav.signOut");
  const signInLabel = t("nav.adminSignIn");

  const toggleLang = () => setLang(lang === "en" ? "es" : "en");

  const locked = useSecurityLock();
  const lockedLinkClass = locked ? "opacity-40 pointer-events-none cursor-not-allowed" : "";
  const handleLockedNav = (e: React.MouseEvent) => {
    if (!locked) return;
    e.preventDefault();
    e.stopPropagation();
    toast.error("Please set up your security questions before leaving this page.");
  };
  // Wrap all nav Links so they intercept clicks while locked. We render the Link
  // with pointer-events disabled via class, plus a sibling overlay-free onClick
  // capture via parent span so the toast still fires when users try to click.
  const lockProps = locked
    ? { onClickCapture: handleLockedNav, "aria-disabled": true as const, tabIndex: -1 }
    : {};

  const homeLinkProps = activeCustomHome
    ? ({ to: "/$customHome", params: { customHome: activeCustomHome } } as const)
    : ({ to: "/" } as const);

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link {...homeLinkProps} className="flex items-center gap-2 group min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
            R
          </span>
          <div className="leading-tight min-w-0">
            <div className="font-display font-semibold text-foreground truncate">Reentry to Recovery</div>
            <div className="hidden sm:block text-xs text-muted-foreground truncate">{t("site.tagline")}</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground">
          <Link {...homeLinkProps} className="hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            {t("nav.categories")}
          </Link>
          {canAccessAdmin && (
            <Link to="/admin" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              Admin
            </Link>
          )}
          {isUser && (
            <Link to="/dashboard" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              {t("nav.dashboard")}
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="hover:text-foreground transition-colors">
              {signOutLabel}
            </button>
          ) : (
            <>
              <Link to="/signup" className="hover:text-foreground transition-colors">
                {t("nav.signUp")}
              </Link>
              {showAuthLink && (
                <Link to="/auth" className="hover:text-foreground transition-colors">
                  {signInLabel}
                </Link>
              )}
            </>
          )}
          <button
            onClick={toggleLang}
            aria-label="Toggle language"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            {t("nav.language")}
          </button>
        </nav>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleLang}
            aria-label="Toggle language"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Languages className="h-3.5 w-3.5" />
            <span className="uppercase">{lang}</span>
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:border-[var(--color-accent)] transition-colors"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-border/60 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1 text-sm font-medium text-muted-foreground">
            <Link {...homeLinkProps} onClick={() => setOpen(false)} className="py-2 hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
              {t("nav.categories")}
            </Link>
            {canAccessAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="py-2 hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
                Admin
              </Link>
            )}
            {isUser && (
              <Link to="/dashboard" onClick={() => setOpen(false)} className="py-2 hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
                {t("nav.dashboard")}
              </Link>
            )}
            {user ? (
              <button
                onClick={() => { setOpen(false); handleSignOut(); }}
                className="py-2 text-left hover:text-foreground transition-colors"
              >
                {signOutLabel}
              </button>
            ) : (
              <>
                <Link to="/signup" onClick={() => setOpen(false)} className="py-2 hover:text-foreground transition-colors">
                  {t("nav.signUp")}
                </Link>
                {showAuthLink && (
                  <Link to="/auth" onClick={() => setOpen(false)} className="py-2 hover:text-foreground transition-colors">
                    {signInLabel}
                  </Link>
                )}
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 mt-0">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row gap-3 justify-between">
        <div>© {new Date().getFullYear()} Reentry to Recovery</div>
        <div>{t("footer.crisis")} <span className="text-foreground font-medium">988</span>.</div>
      </div>
    </footer>
  );
}
