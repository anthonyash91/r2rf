import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LayoutGrid, Users, Shield, BarChart3, Home, Globe, Award } from "lucide-react";

type NavLink = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  adminOnly?: boolean;
};

const links: NavLink[] = [
  { to: "/admin", label: "Categories", icon: LayoutGrid, exact: true },
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/admin/ip-allowlist", label: "IP allowlist", icon: Shield, adminOnly: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, adminOnly: true },
  { to: "/admin/home", label: "Home header", icon: Home, adminOnly: true },
  { to: "/admin/custom-home-pages", label: "Custom home pages", icon: Globe, adminOnly: true },
  { to: "/admin/certificate", label: "Certificate", icon: Award, adminOnly: true },
];

export function AdminNav() {
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = links.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav
      aria-label="Admin"
      className="mb-8 -mx-2 overflow-x-auto"
    >
      <ul className="flex items-center gap-1 px-2 min-w-max">
        {visible.map((l) => {
          const active = l.exact ? pathname === l.to : pathname === l.to || pathname.startsWith(l.to + "/");
          const Icon = l.icon;
          return (
            <li key={l.to}>
              <Link
                to={l.to}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground,white)] shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-[var(--color-accent)]/40 hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
