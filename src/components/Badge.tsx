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
  Scale,
  Gavel,
  FileSignature,
  Home,
  Bus,
  Car,
  MapPin,
  Wallet,
  DollarSign,
  CreditCard,
  PiggyBank,
  Stethoscope,
  Pill,
  Activity,
  Brain,
  Dumbbell,
  Leaf,
  Sprout,
  Church,
  Sun,
  HandHeart,
  Wrench,
  Hammer,
  Lightbulb,
  Award,
  Trophy,
  Scroll,
  Baby,
  Users2,
  Gift,
  Coffee,
  Clock,
  Target,
  Flag,
  Compass,
  Bookmark,
  IdCard,
  Fingerprint,
  Utensils,
  Apple,
  Soup,
  Shirt,
  School,
  Backpack,
  Siren,
  AlertOctagon,
  Laptop,
  Smartphone,
  Wifi,
  Landmark,
  Vote,
  KeyRound,
  Unlock,
  HeartHandshake,
  Inbox,
  Blocks,
  Info,
  type LucideIcon,
} from "lucide-react";
import { paletteStyle, indexForType, type BadgeVariantKey } from "@/lib/badge-styles";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { ICON_REGISTRY } from "@/lib/category-icons";

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
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  /** "md" (default) matches the action badge height on user-facing pages.
   *  "sm" matches the compact preview badge on the admin icons-badges page. */
  size?: "sm" | "md";
};

const BASE =
  "inline-flex items-center leading-none rounded-[4px] border px-2.5 py-[5px] text-xs font-medium flex-shrink-0";

const BASE_SM =
  "inline-flex items-center leading-none rounded-[4px] border px-2 py-0.5 text-xs font-medium flex-shrink-0";

const VARIANT_ICONS: Record<BadgeVariantKey, LucideIcon> = {
  new: Sparkles,
  count: Layers,
  draft: FileEdit,
  custom: Star,
  "custom-content": Blocks,
  category: Tag,
  translation: Languages,
  admin: Shield,
  contributor: PenLine,
  tester: Wrench,
  verified: BadgeCheck,
  unverified: AlertCircle,
  user: User,
  facility: Building2,
  "facility-user": HeartHandshake,
  "exempt": Info,
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

  // Legal / justice
  [/\b(legal|law|justice|court|attorney|lawyer|rights)\b/, Scale],
  [/\b(gavel|hearing|trial|case|sentencing|parole|probation)\b/, Gavel],
  [/\b(contract|agreement|waiver|consent|signature|sign-?up|enroll)\b/, FileSignature],
  [/\b(safety|protect|protection|security|privacy|safe)\b/, Shield],

  // Housing / transport / location
  [/\b(home|housing|shelter|residence|apartment|rent)\b/, Home],
  [/\b(bus|transit|transport|transportation|commute)\b/, Bus],
  [/\b(car|drive|driving|vehicle|ride|rideshare|uber|lyft)\b/, Car],
  [/\b(pin|address|nearby|destination)\b/, MapPin],

  // Money / finance
  [/\b(wallet|finance|financial|budget)\b/, Wallet],
  [/\b(money|cash|pay|payment|cost|fee|dollar|expense|income)\b/, DollarSign],
  [/\b(credit|debit|card|banking)\b/, CreditCard],
  [/\b(savings|save|piggy|fund)\b/, PiggyBank],

  // Health / recovery
  [/\b(medical|doctor|clinic|physician|appointment-?med)\b/, Stethoscope],
  [/\b(pill|medication|prescription|rx|drug|pharmacy)\b/, Pill],
  [/\b(activity|fitness|vitals|pulse)\b/, Activity],
  [/\b(brain|mental|therapy|counseling|psychology|psych)\b/, Brain],
  [/\b(exercise|gym|workout|sport)\b/, Dumbbell],
  [/\b(sober|sobriety|nature|green|clean)\b/, Leaf],
  [/\b(growth|grow|seed|sprout|progress|new-?start)\b/, Sprout],

  // Faith / wellness
  [/\b(faith|religion|religious|church|spiritual|prayer|worship)\b/, Church],
  [/\b(meditation|mindful|wellness|sun|morning|peace)\b/, Sun],
  [/\b(volunteer|donate|donation|charity|kindness|outreach)\b/, HandHeart],

  // Skills / tools / education
  [/\b(tool|toolkit|fix|repair|maintenance)\b/, Wrench],
  [/\b(skill|trade|craft|build|construction)\b/, Hammer],
  [/\b(tip|tips|idea|advice|insight|hint)\b/, Lightbulb],
  [/\b(award|certificate|certification|credential)\b/, Award],
  [/\b(achievement|milestone|win|success|trophy)\b/, Trophy],
  [/\b(scroll|diploma|transcript|record)\b/, Scroll],

  // Family / community
  [/\b(baby|child|kid|family|parent|parenting)\b/, Baby],
  [/\b(team|peer|peers|cohort|members)\b/, Users2],
  [/\b(gift|donation-?gift|present|reward)\b/, Gift],
  [/\b(coffee|cafe|social|chat-?meet)\b/, Coffee],

  // Time / planning
  [/\b(clock|time|hour|schedule-?time|deadline)\b/, Clock],
  [/\b(target|goal|objective)\b/, Target],
  [/\b(flag|milestone-?flag|priority)\b/, Flag],
  [/\b(compass|guidance|direction|navigate|orient)\b/, Compass],
  [/\b(bookmark|saved|favorite|reference)\b/, Bookmark],

  // IDs & records
  [/\b(id|identification|license|state-?id|driver|driver'?s)\b/, IdCard],
  [/\b(fingerprint|background|biometric|live-?scan)\b/, Fingerprint],

  // Food / nutrition
  [/\b(food|meal|eat|dining|nutrition|kitchen|pantry|snap|ebt)\b/, Utensils],
  [/\b(fruit|apple|healthy|produce)\b/, Apple],
  [/\b(soup|kitchen-?meal|hot-?meal)\b/, Soup],

  // Clothing / basic needs
  [/\b(clothing|clothes|apparel|uniform|hygiene|closet)\b/, Shirt],

  // Childcare / school
  [/\b(school|class-?room|k-?12|daycare|childcare)\b/, School],
  [/\b(youth|student|backpack|enrollment)\b/, Backpack],

  // Crisis / safety
  [/\b(crisis|hotline|emergency|911|police|urgent)\b/, Siren],
  [/\b(danger|stop|warn|warning|caution)\b/, AlertOctagon],

  // Digital literacy
  [/\b(laptop|computer|pc|tech|digital-?lit|online-?class)\b/, Laptop],
  [/\b(mobile|smartphone|app|cellphone|cell-?phone|texting)\b/, Smartphone],
  [/\b(wifi|internet|broadband|connectivity)\b/, Wifi],

  // Civic / government
  [/\b(government|civic|capitol|institution|dmv|agency|federal|state)\b/, Landmark],
  [/\b(vote|voting|election|ballot|register-?to-?vote)\b/, Vote],

  // Re-entry symbols
  [/\b(release|reentry|re-entry|freedom|access|unlock|open)\b/, Unlock],
  [/\b(key|keyring)\b/, KeyRound],

  // Mentorship
  [/\b(mentor|sponsor|peer-?support|companion|buddy|mentorship)\b/, HeartHandshake],

  // Mail / inbox
  [/\b(inbox|messages-?folder|case-?manager|paperwork|caseload)\b/, Inbox],
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

export function Badge({ variant, type, hideIcon, children, className, title, onClick, size = "md" }: BadgeProps) {
  const styles = useBadgeStyles();

  const idx =
    variant === "type"
      ? indexForType(type, styles)
      : (styles.variants[variant] ?? 0);

  const ps = paletteStyle(idx);

  let Icon: LucideIcon | undefined;
  if (variant === "type") {
    const key = (type ?? "").trim().toLowerCase();
    const overrideName = styles.typeIcons?.[key];
    Icon = (overrideName && ICON_REGISTRY[overrideName]) || iconForType(type);
  } else {
    const overrideName = styles.variantIcons?.[variant];
    Icon = (overrideName && ICON_REGISTRY[overrideName]) || VARIANT_ICONS[variant];
  }


  const base = size === "sm" ? BASE_SM : BASE;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      title={title}
      onClick={onClick}
      className={cn(base, "justify-center", !hideIcon && "gap-1", className)}
      style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
    >
      {!hideIcon && Icon && <Icon className={iconSize} strokeWidth={2} />}
      {children}
    </span>
  );
}
