import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LayoutGrid, Users, Shield, BarChart3, Home, LayoutTemplate, Award, Building2, MessageSquare, ChevronDown, MoreHorizontal } from "lucide-react";


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  { to: "/admin/custom-home-pages", label: "Home Pages", icon: LayoutTemplate, adminOnly: true },
  { to: "/admin/home", label: "Home Header", icon: Home, adminOnly: true },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare, adminOnly: true },
  { to: "/admin/certificate", label: "Certificate Footer", icon: Award, adminOnly: true },
];

function isLinkActive(l: NavLink, pathname: string) {
  return (
    (l.exact ? pathname === l.to : pathname === l.to || pathname.startsWith(l.to + "/")) ||
    (l.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false)
  );
}

export function AdminNav() {
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const visible = links.filter((l) => !l.adminOnly || isAdmin);
  const current = visible.find((l) => isLinkActive(l, pathname)) ?? visible[0];
  const CurrentIcon = current?.icon ?? LayoutGrid;

  const MAX_VISIBLE = 7;
  const needsOverflow = visible.length > MAX_VISIBLE;
  // If an overflow item is active, swap it into the visible set so it stays highlighted
  let primary = visible.slice(0, MAX_VISIBLE);
  let overflow = needsOverflow ? visible.slice(MAX_VISIBLE) : [];
  const activeInOverflow = overflow.find((l) => isLinkActive(l, pathname));
  if (activeInOverflow) {
    const displaced = primary[MAX_VISIBLE - 1];
    primary = [...primary.slice(0, MAX_VISIBLE - 1), activeInOverflow];
    overflow = overflow.map((l) => (l === activeInOverflow ? displaced : l));
  }
  const overflowActive = overflow.some((l) => isLinkActive(l, pathname));

  return (
    <nav aria-label="Admin" className="mb-8">
      {/* Mobile: dropdown */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
            <span className="inline-flex items-center gap-2">
              <CurrentIcon className="h-4 w-4" />
              {current?.label ?? "Admin"}
            </span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {visible.map((l) => {
              const Icon = l.icon;
              const active = isLinkActive(l, pathname);
              return (
                <DropdownMenuItem
                  key={l.to}
                  onSelect={() => navigate({ to: l.to as any })}
                  className={active ? "bg-muted" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {l.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* sm+: fixed tabs with More dropdown for overflow */}
      <div className="hidden sm:block">
        <ul className="flex w-full items-center justify-center gap-1 rounded-lg bg-muted p-2 text-muted-foreground">
          {primary.map((l) => {
            const active = isLinkActive(l, pathname);
            const Icon = l.icon;
            return (
              <li key={l.to} className="shrink-0">
                <Link
                  to={l.to as any}
                  className={[
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-background text-foreground"
                      : "hover:bg-background hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {l.label}
                </Link>
              </li>
            );
          })}
          {overflow.length > 0 && (
            <li className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={[
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    overflowActive
                      ? "bg-background text-foreground"
                      : "hover:bg-background hover:text-foreground",
                  ].join(" ")}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  More
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflow.map((l) => {
                    const Icon = l.icon;
                    const active = isLinkActive(l, pathname);
                    return (
                      <DropdownMenuItem
                        key={l.to}
                        onSelect={() => navigate({ to: l.to as any })}
                        className={active ? "bg-muted" : ""}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {l.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )}
        </ul>
      </div>

    </nav>
  );
}
