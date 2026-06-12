import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSecurityLock } from "@/lib/security-lock";
import { Languages, Menu, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useActiveFacilitySlug, setActiveFacilitySlug } from "@/lib/facility-context";
import { useActiveInmatePin } from "@/lib/inmate-pin-context";
import { useAuthChecking } from "@/lib/auth-checking-context";
import { QK } from "@/lib/query-keys";

export function SiteHeader() {
  const { isChecking } = useAuthChecking();
  const authRaw = useAuth();
  const navigate = useNavigate();
  // While post-auth check is in flight, treat user as not yet authenticated
  // so nav links don't flicker to signed-in state before the check completes.
  const { user, canAccessAdmin, isUser, isAdmin, isContributor, isFacilityUser } = isChecking
    ? { ...authRaw, user: null, canAccessAdmin: false, isUser: false, isAdmin: false, isContributor: false, isFacilityUser: false }
    : authRaw;
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAdminUser = isAdmin || isContributor;
  const signOutLabel = isAdminUser ? t("nav.adminSignOut") : t("nav.signOut");
  const signInLabel = t("nav.signIn");

  const toggleLang = () => setLang(lang === "en" ? "es" : "en");

  const locked = useSecurityLock();
  const lockedLinkClass = locked ? "opacity-40 cursor-not-allowed pointer-events-none" : "";
  const handleLockedNav = (e: React.MouseEvent) => {
    if (!locked) return;
    e.preventDefault();
    e.stopPropagation();
    toast.error("Please set up your security questions before leaving this page.");
  };
  const handleLockedKey = (e: React.KeyboardEvent) => {
    if (!locked) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toast.error("Please set up your security questions before leaving this page.");
    }
  };
  // pointer-events-none blocks mouse/touch; onKeyDown blocks keyboard Enter/Space;
  // aria-disabled announces the disabled state to screen readers without removing
  // the element from the accessibility tree (better than tabIndex: -1).
  const lockProps = locked
    ? { "aria-disabled": true as const, onKeyDown: handleLockedKey }
    : {};

  // Detect facility slug from URL — supports both /facility/siteId (legacy) and /?site=siteId
  const facilityRouteMatch = location.pathname.match(/^\/facility\/([^/]+)/);
  const facilityRouteSlug = facilityRouteMatch
    ? facilityRouteMatch[1]
    : new URLSearchParams(location.search).get("site");

  // For logged-in regular users and facilityUsers, get their facility from profile
  const fetchFacilityValue = useServerFn(getMyFacilityValue);
  const { data: facilityData } = useQuery({
    queryKey: QK.myFacility(user?.id),
    enabled: !!user?.id && (isUser || isFacilityUser) && !facilityRouteSlug,
    staleTime: Infinity,
    queryFn: () => fetchFacilityValue(),
  });
  const userFacilitySlug = (isUser || isFacilityUser) ? (facilityData?.slug ?? null) : null;

  // Session-persisted facility slug (survives navigation away from the facility page)
  const persistedFacilitySlug = useActiveFacilitySlug();
  const persistedPin = useActiveInmatePin();

  // Write to session storage whenever a real facility source is discovered
  useEffect(() => {
    const source = facilityRouteSlug || userFacilitySlug;
    if (source) setActiveFacilitySlug(source);
  }, [facilityRouteSlug, userFacilitySlug]);

  // Priority: URL slug → user's facility → persisted (session) → default
  // Admins only follow URL slug (not persisted), so they aren't globally stuck to a facility
  const activeFacility = facilityRouteSlug || userFacilitySlug || (isAdminUser ? null : persistedFacilitySlug);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Client-side navigation for all cases — no full page reload, no flash.
    // The home page has no auth beforeLoad guard so there's no redirect race.
    if (activeFacility) {
      const search: Record<string, string> = { site: activeFacility };
      if (persistedPin) search.user = persistedPin;
      navigate({ to: "/", search } as any);
    } else {
      navigate({ to: "/" });
    }
  };

  const homeLinkProps = activeFacility
    ? ({ to: "/", search: { site: activeFacility } } as const)
    : ({ to: "/" } as const);

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link {...homeLinkProps} {...lockProps} className={`flex items-center gap-2 group min-w-0 ${lockedLinkClass}`}>
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
          <Link {...homeLinkProps} {...lockProps} className={`hover:text-foreground transition-colors ${lockedLinkClass}`} activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            {t("nav.categories")}
          </Link>
          {canAccessAdmin && (
            <Link to="/admin" {...lockProps} className={`hover:text-foreground transition-colors ${lockedLinkClass}`} activeProps={{ className: "text-foreground" }}>
              Admin
            </Link>
          )}
          {isUser && (
            <Link to="/dashboard" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              {t("nav.dashboard")}
            </Link>
          )}
          {user ? (
            <button
              onClick={(e) => {
                if (locked) {
                  e.preventDefault();
                  toast.error("Please set up your security questions before leaving this page.");
                  return;
                }
                handleSignOut();
              }}
              aria-disabled={locked}
              className={`hover:text-foreground transition-colors ${lockedLinkClass}`}
            >
              {signOutLabel}
            </button>
          ) : (
            <Link to="/signup" {...lockProps} className={`hover:text-foreground transition-colors ${lockedLinkClass}`}>
              {signInLabel}
            </Link>
          )}
          <button
            onClick={(e) => {
              if (locked) { handleLockedNav(e); return; }
              toggleLang();
            }}
            aria-disabled={locked}
            aria-label="Toggle language"
            className={`inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors ${lockedLinkClass}`}
          >
            <Languages className="h-3.5 w-3.5" />
            {t("nav.language")}
          </button>
        </nav>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={(e) => {
              if (locked) { handleLockedNav(e); return; }
              toggleLang();
            }}
            aria-disabled={locked}
            aria-label="Toggle language"
            className={`inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors ${lockedLinkClass}`}
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
            <Link {...homeLinkProps} {...lockProps} onClick={(e) => { if (locked) { handleLockedNav(e); return; } setOpen(false); }} className={`py-2 hover:text-foreground transition-colors ${lockedLinkClass}`} activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
              {t("nav.categories")}
            </Link>
            {canAccessAdmin && (
              <Link to="/admin" {...lockProps} onClick={(e) => { if (locked) { handleLockedNav(e); return; } setOpen(false); }} className={`py-2 hover:text-foreground transition-colors ${lockedLinkClass}`} activeProps={{ className: "text-foreground" }}>
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
                onClick={(e) => {
                  if (locked) {
                    handleLockedNav(e);
                    return;
                  }
                  setOpen(false);
                  handleSignOut();
                }}
                aria-disabled={locked}
                className={`py-2 text-left hover:text-foreground transition-colors ${lockedLinkClass}`}
              >
                {signOutLabel}
              </button>
            ) : (
              <Link to="/signup" {...lockProps} onClick={(e) => { if (locked) { handleLockedNav(e); return; } setOpen(false); }} className={`py-2 hover:text-foreground transition-colors ${lockedLinkClass}`}>
                {signInLabel}
              </Link>
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
        <div className="flex items-center gap-2 flex-wrap">
          <span>© {new Date().getFullYear()} Reentry to Recovery</span>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link>
        </div>
        <div>{t("footer.crisis")} <span className="text-foreground font-medium">988</span>.</div>
      </div>
    </footer>
  );
}
