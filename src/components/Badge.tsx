import { cn } from "@/lib/utils";
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
import { paletteStyle, indexForType, type BadgeVariantKey } from "@/lib/badge-styles";
import { useBadgeStyles } from "@/hooks/use-badge-styles";

type BadgeVariant = BadgeVariantKey | "type";

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

const BASE =
  "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium flex-shrink-0";

const VARIANT_ICONS: Record<BadgeVariantKey, LucideIcon> = {
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

export function iconForType(type: string | null | undefined): LucideIcon {
  const key = (type ?? "").trim().toLowerCase();
  return TYPE_ICONS[key] ?? File;
}

export function Badge({ variant, type, hideIcon, children, className, title }: BadgeProps) {
  const styles = useBadgeStyles();

  const idx =
    variant === "type"
      ? indexForType(type, styles)
      : (styles.variants[variant] ?? 0);

  const ps = paletteStyle(idx);
  const Icon = variant === "type" ? iconForType(type) : VARIANT_ICONS[variant];

  return (
    <span
      title={title}
      className={cn(BASE, "justify-center", !hideIcon && "gap-1", className)}
      style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
    >
      {!hideIcon && Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
