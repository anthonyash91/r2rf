import { cn } from "@/lib/utils";
import { typeBadgeClass } from "@/lib/type-badge";

type BadgeVariant = "new" | "count" | "type";

type BadgeProps = {
  variant: BadgeVariant;
  /** Required when variant === "type". The content type string (e.g. "video"). */
  type?: string | null;
  children: React.ReactNode;
  className?: string;
};

const BASE = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0";

const VARIANT_CLASSES: Record<Exclude<BadgeVariant, "type">, string> = {
  // Emerald — used for "New" / "New Content"
  new: "border-[oklch(0.85_0.03_165)] bg-[oklch(0.95_0.02_165)] text-[oklch(0.35_0.05_165)]",
  // Gold — used for item counts
  count: "border-[oklch(0.85_0.05_85)] bg-[oklch(0.95_0.03_85)] text-[oklch(0.42_0.05_85)]",
};

export function Badge({ variant, type, children, className }: BadgeProps) {
  const variantClass =
    variant === "type" ? typeBadgeClass(type ?? null) : VARIANT_CLASSES[variant];
  return (
    <span className={cn(BASE, "justify-center", variantClass, className)}>
      {children}
    </span>
  );
}
