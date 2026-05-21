import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

const LINK_CLASS_BASE =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors";

export function AdminNav() {
  const { isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const visible = links.filter((l) => !l.adminOnly || isAdmin);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLUListElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(visible.length);

  const GAP = 4; // gap-1 = 0.25rem = 4px
  const PADDING = 16; // p-2 on both sides = 16px total horizontal padding

  const recompute = () => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const itemEls = Array.from(measure.querySelectorAll<HTMLElement>("[data-measure-item]"));
    const moreEl = measure.querySelector<HTMLElement>("[data-measure-more]");
    if (itemEls.length === 0 || !moreEl) return;

    const itemWidths = itemEls.map((el) => el.getBoundingClientRect().width);
    const moreWidth = moreEl.getBoundingClientRect().width;
    const available = container.clientWidth - PADDING;

    // Try to fit all
    const totalAll = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? GAP : 0), 0);
    if (totalAll <= available) {
      setVisibleCount(itemWidths.length);
      return;
    }

    // Need More button; fit as many as possible with More reserved
    let used = moreWidth;
    let count = 0;
    for (let i = 0; i < itemWidths.length; i++) {
      const next = used + itemWidths[i] + GAP; // GAP between this item and More (or prev)
      if (next > available) break;
      used = next;
      count++;
    }
    setVisibleCount(Math.max(0, count));
  };

  useLayoutEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, isAdmin]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split, ensuring active overflow item is promoted into the visible row
  let primary = visible.slice(0, visibleCount);
  let overflow = visible.slice(visibleCount);
  const activeInOverflow = overflow.find((l) => isLinkActive(l, pathname));
  if (activeInOverflow && primary.length > 0) {
    const displaced = primary[primary.length - 1];
    primary = [...primary.slice(0, -1), activeInOverflow];
    overflow = overflow.map((l) => (l === activeInOverflow ? displaced : l));
  }
  const overflowActive = overflow.some((l) => isLinkActive(l, pathname));

  return (
    <nav aria-label="Admin" className="mb-8">
      <div ref={containerRef} className="relative w-full">
        {/* Hidden measurement row */}
        <ul
          ref={measureRef}
          aria-hidden="true"
          className="invisible pointer-events-none absolute inset-0 flex items-center gap-1 p-2"
        >
          {visible.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.to} data-measure-item className="shrink-0">
                <span className={LINK_CLASS_BASE}>
                  <Icon className="h-3.5 w-3.5" />
                  {l.label}
                </span>
              </li>
            );
          })}
          <li data-measure-more className="shrink-0">
            <span className={LINK_CLASS_BASE}>
              <MoreHorizontal className="h-3.5 w-3.5" />
              More
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </span>
          </li>
        </ul>

        {/* Visible row */}
        <ul className="flex w-full items-center justify-center gap-1 rounded-lg bg-muted p-2 text-muted-foreground">
          {primary.map((l) => {
            const active = isLinkActive(l, pathname);
            const Icon = l.icon;
            return (
              <li key={l.to} className="shrink-0">
                <Link
                  to={l.to as any}
                  className={[
                    LINK_CLASS_BASE,
                    active ? "bg-background text-foreground" : "hover:bg-background hover:text-foreground",
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
                    LINK_CLASS_BASE,
                    overflowActive ? "bg-background text-foreground" : "hover:bg-background hover:text-foreground",
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
