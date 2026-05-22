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
  // Rose — Custom category chips (muted)
  category: "border-[oklch(0.85_0.04_15)] bg-[oklch(0.95_0.02_15)] text-[oklch(0.42_0.07_15)]",
  // Gold (themed) — translation status (Needs ES / Partially translated)
  translation:
    "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
  // Admin role (muted primary)
  admin: "border-primary/25 bg-primary/8 text-primary/90",
  // Contributor role — sky (muted)
  contributor: "border-[oklch(0.85_0.04_230)] bg-[oklch(0.95_0.02_230)] text-[oklch(0.42_0.07_230)]",
  // Verified email — emerald (muted)
  verified: "border-[oklch(0.85_0.04_160)] bg-[oklch(0.95_0.02_160)] text-[oklch(0.4_0.07_160)]",
  // Unverified email — amber (muted)
  unverified: "border-[oklch(0.85_0.05_75)] bg-[oklch(0.95_0.03_75)] text-[oklch(0.45_0.07_75)]",
  // Regular user role — indigo (muted)
  user: "border-[oklch(0.85_0.04_265)] bg-[oklch(0.95_0.02_265)] text-[oklch(0.42_0.07_265)]",
  // Facility name — violet (muted)
  facility: "border-[oklch(0.85_0.04_290)] bg-[oklch(0.95_0.02_290)] text-[oklch(0.42_0.07_290)]",
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
