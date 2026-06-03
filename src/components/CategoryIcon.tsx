import { resolveCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { PALETTES } from "@/lib/badge-styles";
import { useBadgeStyles } from "@/hooks/use-badge-styles";

type Props = {
  name: string | null | undefined;
  color: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  iconClassName?: string;
};

const SIZES = {
  sm: { box: "h-10 w-10", icon: "h-4 w-4", radius: "rounded-md" },
  md: { box: "h-12 w-12", icon: "h-5 w-5", radius: "rounded-lg" },
  lg: { box: "h-16 w-16", icon: "h-7 w-7", radius: "rounded-lg" },
};

export function CategoryIcon({ name, color, size = "md", className, iconClassName }: Props) {
  const Icon = resolveCategoryIcon(name);
  const styles = useBadgeStyles();

  // If no color is passed, fall back to the saved category default palette color.
  // The modular arithmetic handles negative indices safely.
  const fallback =
    PALETTES[((styles.categoryDefault % PALETTES.length) + PALETTES.length) % PALETTES.length]
      ?.oklch ?? "var(--color-accent)";
  const c = color || fallback;
  const s = SIZES[size];

  return (
    <div
      className={cn("flex items-center justify-center border shrink-0", s.box, s.radius, className)}
      style={{
        // 12% tint for the background, 25% for the border — keeps the icon readable
        // against both light and dark surfaces.
        backgroundColor: `color-mix(in oklab, ${c} 12%, transparent)`,
        borderColor: `color-mix(in oklab, ${c} 25%, transparent)`,
      }}
    >
      <Icon className={cn(s.icon, iconClassName)} style={{ color: c }} strokeWidth={1.75} />
    </div>
  );
}
