import { cn } from "@/lib/utils";
import { typeBadgeClass } from "@/lib/type-badge";

type BadgeVariant =
  | "new"
  | "count"
  | "type"
  | "draft"
  | "custom"
  | "category"
  | "translation"
  | "admin"
  | "contributor"
  | "verified"
  | "unverified"
  | "user"
  | "facility";

type BadgeProps = {
  variant: BadgeVariant;
  /** Required when variant === "type". The content type string (e.g. "video"). */
  type?: string | null;
  children: React.ReactNode;
  className?: string;
  title?: string;
};

const BASE = "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium flex-shrink-0";

// All variants follow the same pattern as CategoryIcon: a single base color
// rendered as a 15%-tinted background, 30%-tinted border, and the full color
// for text. This keeps badges quiet and visually consistent with the
// category icon palette.
const VARIANT_CLASSES: Record<Exclude<BadgeVariant, "type">, string> = {
  // Emerald — "New" / "New Content"
  new: "border-[oklch(0.48_0.09_165)]/30 bg-[oklch(0.48_0.09_165)]/15 text-[oklch(0.48_0.09_165)]",
  // Gold — item counts
  count: "border-[oklch(0.52_0.10_85)]/30 bg-[oklch(0.52_0.10_85)]/15 text-[oklch(0.52_0.10_85)]",
  // Muted — Draft
  draft: "border-border bg-muted text-muted-foreground",
  // Accent green — Custom / custom home page name
  custom:
    "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  // Rose — Custom category chips
  category: "border-[oklch(0.50_0.11_15)]/30 bg-[oklch(0.50_0.11_15)]/15 text-[oklch(0.50_0.11_15)]",
  // Gold (themed) — translation status
  translation:
    "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
  // Admin role — primary
  admin: "border-primary/25 bg-primary/10 text-primary/90",
  // Contributor — sky
  contributor: "border-[oklch(0.46_0.10_220)]/30 bg-[oklch(0.46_0.10_220)]/15 text-[oklch(0.46_0.10_220)]",
  // Verified email — emerald
  verified: "border-[oklch(0.48_0.09_145)]/30 bg-[oklch(0.48_0.09_145)]/15 text-[oklch(0.48_0.09_145)]",
  // Unverified email — amber
  unverified: "border-[oklch(0.50_0.10_70)]/30 bg-[oklch(0.50_0.10_70)]/15 text-[oklch(0.50_0.10_70)]",
  // Regular user — indigo
  user: "border-[oklch(0.44_0.11_260)]/30 bg-[oklch(0.44_0.11_260)]/15 text-[oklch(0.44_0.11_260)]",
  // Facility — violet
  facility: "border-[oklch(0.46_0.12_295)]/30 bg-[oklch(0.46_0.12_295)]/15 text-[oklch(0.46_0.12_295)]",
};


export function Badge({ variant, type, children, className, title }: BadgeProps) {
  const variantClass =
    variant === "type" ? typeBadgeClass(type ?? null) : VARIANT_CLASSES[variant];
  return (
    <span title={title} className={cn(BASE, "justify-center", variantClass, className)}>
      {children}
    </span>
  );
}
