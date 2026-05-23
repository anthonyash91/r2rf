import { cn } from "@/lib/utils";
import { typeBadgeClass } from "@/lib/type-badge";
import {
  Sparkles,
  Layers,
  FileEdit,
  Star,
  Tag,
  Languages,
  Shield,
  PenLine,
  BadgeCheck,
  AlertCircle,
  User,
  Building2,
  FileText,
  Mic,
  ClipboardList,
  Video,
  BookOpen,
  Users,
  Headphones,
  Link as LinkIcon,
  File,
  type LucideIcon,
} from "lucide-react";

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
  /** Set to true to suppress the auto-rendered leading icon. */
  hideIcon?: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
};

const BASE = "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium flex-shrink-0";

const VARIANT_CLASSES: Record<Exclude<BadgeVariant, "type">, string> = {
  new: "border-[oklch(0.48_0.09_165)]/30 bg-[oklch(0.48_0.09_165)]/15 text-[oklch(0.48_0.09_165)]",
  count: "border-[oklch(0.52_0.10_85)]/30 bg-[oklch(0.52_0.10_85)]/15 text-[oklch(0.52_0.10_85)]",
  draft: "border-border bg-muted text-muted-foreground",
  custom:
    "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  category: "border-[oklch(0.50_0.11_15)]/30 bg-[oklch(0.50_0.11_15)]/15 text-[oklch(0.50_0.11_15)]",
  translation:
    "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
  admin: "border-primary/25 bg-primary/10 text-primary/90",
  contributor: "border-[oklch(0.46_0.10_220)]/30 bg-[oklch(0.46_0.10_220)]/15 text-[oklch(0.46_0.10_220)]",
  verified: "border-[oklch(0.48_0.09_145)]/30 bg-[oklch(0.48_0.09_145)]/15 text-[oklch(0.48_0.09_145)]",
  unverified: "border-[oklch(0.50_0.10_70)]/30 bg-[oklch(0.50_0.10_70)]/15 text-[oklch(0.50_0.10_70)]",
  user: "border-[oklch(0.44_0.11_260)]/30 bg-[oklch(0.44_0.11_260)]/15 text-[oklch(0.44_0.11_260)]",
  facility: "border-[oklch(0.46_0.12_295)]/30 bg-[oklch(0.46_0.12_295)]/15 text-[oklch(0.46_0.12_295)]",
};

const VARIANT_ICONS: Record<Exclude<BadgeVariant, "type">, LucideIcon> = {
  new: Sparkles,
  count: Layers,
  draft: FileEdit,
  custom: Star,
  category: Tag,
  translation: Languages,
  admin: Shield,
  contributor: PenLine,
  verified: BadgeCheck,
  unverified: AlertCircle,
  user: User,
  facility: Building2,
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  article: FileText,
  podcast: Mic,
  worksheet: ClipboardList,
  video: Video,
  guide: BookOpen,
  meeting: Users,
  audio: Headphones,
  pdf: FileText,
  link: LinkIcon,
};

function iconForType(type: string | null | undefined): LucideIcon {
  const key = (type ?? "").trim().toLowerCase();
  return TYPE_ICONS[key] ?? File;
}

export function Badge({ variant, type, hideIcon, children, className, title }: BadgeProps) {
  const variantClass =
    variant === "type" ? typeBadgeClass(type ?? null) : VARIANT_CLASSES[variant];
  const Icon = variant === "type" ? iconForType(type) : VARIANT_ICONS[variant];
  return (
    <span title={title} className={cn(BASE, "justify-center", !hideIcon && "gap-1", variantClass, className)}>
      {!hideIcon && Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
