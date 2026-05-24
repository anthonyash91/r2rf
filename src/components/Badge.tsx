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
  Image as ImageIcon,
  Music,
  Map,
  Calendar,
  Mail,
  Phone,
  MessageCircle,
  HelpCircle,
  Newspaper,
  GraduationCap,
  Briefcase,
  Heart,
  Globe,
  Download,
  ListChecks,
  Quote,
  Camera,
  PlayCircle,
  Radio,
  Presentation,
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

// Keyword heuristics for user-defined types. First match wins (ordered).
const TYPE_KEYWORD_ICONS: Array<[RegExp, LucideIcon]> = [
  [/\b(video|film|movie|watch|stream|youtube)\b/, Video],
  [/\b(podcast|episode)\b/, Mic],
  [/\b(audio|sound|listen|music|song)\b/, Headphones],
  [/\b(radio|broadcast)\b/, Radio],
  [/\b(image|photo|picture|gallery)\b/, ImageIcon],
  [/\b(camera|snapshot)\b/, Camera],
  [/\b(worksheet|checklist|task|todo|to-do)\b/, ListChecks],
  [/\b(form|survey|questionnaire|assessment)\b/, ClipboardList],
  [/\b(book|ebook|read|chapter|story)\b/, BookOpen],
  [/\b(course|class|lesson|training|tutorial|education|school)\b/, GraduationCap],
  [/\b(presentation|slide|deck|webinar)\b/, Presentation],
  [/\b(meeting|group|community|forum|panel)\b/, Users],
  [/\b(contact|person|profile|bio)\b/, User],
  [/\b(news|announcement|press|bulletin)\b/, Newspaper],
  [/\b(article|blog|post|essay|write-?up)\b/, FileText],
  [/\b(quote|testimonial)\b/, Quote],
  [/\b(faq|question|q&a|q-?and-?a|help)\b/, HelpCircle],
  [/\b(message|chat|comment|discussion)\b/, MessageCircle],
  [/\b(email|mail|newsletter)\b/, Mail],
  [/\b(phone|call|hotline)\b/, Phone],
  [/\b(event|calendar|schedule|appointment)\b/, Calendar],
  [/\b(map|location|directions|address|place)\b/, Map],
  [/\b(facility|building|office|center|centre|location)\b/, Building2],
  [/\b(job|career|employment|work|resume)\b/, Briefcase],
  [/\b(health|wellness|care|support|recovery)\b/, Heart],
  [/\b(website|site|web|online|portal|resource)\b/, Globe],
  [/\b(download|file|attachment|document|doc)\b/, Download],
  [/\b(pdf)\b/, FileText],
  [/\b(link|url)\b/, LinkIcon],
  [/\b(play|media|recording)\b/, PlayCircle],
  [/\b(guide|manual|handbook|playbook)\b/, BookOpen],
  [/\b(verify|verified|approved)\b/, BadgeCheck],
  [/\b(translate|language|spanish|english)\b/, Languages],
];

export function iconForType(type: string | null | undefined): LucideIcon {
  const raw = (type ?? "").trim();
  if (!raw) return File;
  const key = raw.toLowerCase();
  if (TYPE_ICONS[key]) return TYPE_ICONS[key];
  for (const [re, Icon] of TYPE_KEYWORD_ICONS) {
    if (re.test(key)) return Icon;
  }
  return File;
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
