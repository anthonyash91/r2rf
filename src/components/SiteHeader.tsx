import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">
            R
          </span>
          <div className="leading-tight">
            <div className="font-display font-semibold text-foreground">Reentry to Recovery</div>
            <div className="text-xs text-muted-foreground">Content library</div>
          </div>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
          <Link to="/" className="hidden sm:inline hover:text-foreground transition-colors" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>
            Categories
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
              Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground flex flex-col sm:flex-row gap-3 justify-between">
        <div>© {new Date().getFullYear()} Reentry to Recovery</div>
        <div>If you are in crisis, call or text <span className="text-foreground font-medium">988</span>.</div>
      </div>
    </footer>
  );
}
