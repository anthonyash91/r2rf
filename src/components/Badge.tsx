import { cn } from "@/lib/utils";
import { typeBadgeClass } from "@/lib/type-badge";

type BadgeVariant =
  | "new"
  | "count"
  | "type"
  | "draft"
  | "custom"
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

const BASE = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0";

const VARIANT_CLASSES: Record<Exclude<BadgeVariant, "type">, string> = {
  // Emerald — used for "New" / "New Content"
  new: "border-[oklch(0.85_0.03_165)] bg-[oklch(0.95_0.02_165)] text-[oklch(0.35_0.05_165)]",
  // Gold — used for item counts
  count: "border-[oklch(0.85_0.05_85)] bg-[oklch(0.95_0.03_85)] text-[oklch(0.42_0.05_85)]",
  // Muted — Draft
  draft: "border-border bg-muted text-muted-foreground",
  // Accent green — Custom / custom home page name
  custom:
    "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  // Gold (themed) — translation status (Needs ES / Partially translated)
  translation:
    "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
  // Admin role
  admin: "border-primary/30 bg-primary/10 text-primary",
  // Contributor role
  contributor: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  // Verified email
  verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  // Unverified email
  unverified: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  // Regular user role
  user: "border-border bg-secondary text-secondary-foreground",
  // Facility name
  facility: "border-border bg-muted text-foreground",
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
