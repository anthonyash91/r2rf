import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LayoutGrid, Users, Shield, BarChart3, Home, Globe, Award, Building2 } from "lucide-react";

type NavLink = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  exact?: boolean;
  matchPrefixes?: string[];
  adminOnly?: boolean;
};

const links: NavLink[] = [
  { to: "/admin", label: "Categories", icon: LayoutGrid, exact: true, matchPrefixes: ["/admin/category"] },
  { to: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { to: "/admin/facilities", label: "Facilities", icon: Building2, adminOnly: true },
  { to: "/admin/ip-allowlist", label: "IP Allowlist", icon: Shield, adminOnly: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, adminOnly: true },
  { to: "/admin/custom-home-pages", label: "Home Pages", icon: Globe, adminOnly: true },
  { to: "/admin/home", label: "Home Header", icon: Home, adminOnly: true },
  { to: "/admin/certificate", label: "Certificate Footer", icon: Award, adminOnly: true },
];

export function AdminNav() {
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = links.filter((l) => !l.adminOnly || isAdmin);

  return (
    <nav aria-label="Admin" className="mb-8 overflow-x-auto">
      <ul className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {visible.map((l) => {
          const active =
            (l.exact ? pathname === l.to : pathname === l.to || pathname.startsWith(l.to + "/")) ||
            (l.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
          const Icon = l.icon;
          return (
            <li key={l.to}>
              <Link
                to={l.to as any}
                className={[
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow"
                    : "hover:text-foreground",
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

