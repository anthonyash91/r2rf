import {
  RefreshCw,
  Brain,
  Handshake,
  CircleDot,
  Wine,
  Wallet,
  Sparkles,
  Heart,
  GraduationCap,
  Users,
  BookOpen,
  Library,
  Image as ImageIcon,
  Briefcase,
  School,
  FileText,
  BookA,
  Calculator,
  Scale,
  Lightbulb,
  Anchor,
  Award,
  Backpack,
  BadgeCheck,
  Bike,
  Bird,
  Bookmark,
  Building2,
  Cake,
  Camera,
  Car,
  Church,
  Clipboard,
  Cloud,
  Code,
  Coffee,
  Compass,
  Cpu,
  CreditCard,
  Crown,
  Dog,
  Droplet,
  Dumbbell,
  Feather,
  Flag,
  Flame,
  Flower2,
  Gamepad2,
  Gift,
  Globe,
  Hammer,
  Headphones,
  Home,
  Hospital,
  Key,
  Leaf,
  LifeBuoy,
  MapPin,
  Megaphone,
  Mic,
  Moon,
  Mountain,
  Music,
  Newspaper,
  Palette,
  PenTool,
  Phone,
  PiggyBank,
  Plane,
  Puzzle,
  Rocket,
  Shield,
  ShoppingBag,
  Smile,
  Star,
  Sun,
  Target,
  Tent,
  TreePine,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  Utensils,
  Video,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  RefreshCw, Brain, Handshake, CircleDot, Wine, Wallet, Sparkles, Heart,
  GraduationCap, Users, BookOpen, Library, Image: ImageIcon, Briefcase, School,
  FileText, BookA, Calculator, Scale, Lightbulb, Anchor, Award, Backpack,
  BadgeCheck, Bike, Bird, Bookmark, Building2, Cake, Camera, Car, Church,
  Clipboard, Cloud, Code, Coffee, Compass, Cpu, CreditCard, Crown, Dog, Droplet,
  Dumbbell, Feather, Flag, Flame, Flower2, Gamepad2, Gift, Globe, Hammer,
  Headphones, Home, Hospital, Key, Leaf, LifeBuoy, MapPin, Megaphone, Mic, Moon,
  Mountain, Music, Newspaper, Palette, PenTool, Phone, PiggyBank, Plane, Puzzle,
  Rocket, Shield, ShoppingBag, Smile, Star, Sun, Target, Tent, TreePine, Trophy,
  Truck, Tv, Umbrella, Utensils, Video, Wrench, Zap,
};

// Curated palette of distinct, accessible oklch colors for category icons.
export const COLOR_POOL: string[] = [
  "oklch(0.45 0.09 165)", "oklch(0.45 0.10 280)", "oklch(0.48 0.08 210)",
  "oklch(0.45 0.04 250)", "oklch(0.45 0.10 330)", "oklch(0.52 0.10 85)",
  "oklch(0.48 0.09 145)", "oklch(0.50 0.11 15)",  "oklch(0.50 0.10 70)",
  "oklch(0.50 0.10 40)",  "oklch(0.48 0.08 110)", "oklch(0.42 0.10 20)",
  "oklch(0.48 0.10 305)", "oklch(0.42 0.07 200)", "oklch(0.40 0.08 155)",
  "oklch(0.46 0.08 195)", "oklch(0.48 0.06 140)", "oklch(0.45 0.07 240)",
  "oklch(0.45 0.04 70)",  "oklch(0.55 0.11 90)",  "oklch(0.50 0.12 5)",
  "oklch(0.46 0.11 55)",  "oklch(0.50 0.10 100)", "oklch(0.46 0.10 130)",
  "oklch(0.44 0.10 175)", "oklch(0.46 0.10 220)", "oklch(0.44 0.11 260)",
  "oklch(0.46 0.12 295)", "oklch(0.48 0.11 320)", "oklch(0.50 0.10 350)",
  "oklch(0.42 0.06 30)",  "oklch(0.42 0.06 180)", "oklch(0.55 0.09 60)",
  "oklch(0.40 0.08 270)", "oklch(0.52 0.08 170)", "oklch(0.48 0.10 25)",
  "oklch(0.46 0.09 245)", "oklch(0.50 0.10 125)", "oklch(0.44 0.09 95)",
  "oklch(0.48 0.10 285)",
];

export function resolveCategoryIcon(name: string | null | undefined): LucideIcon {
  if (name && ICON_REGISTRY[name]) return ICON_REGISTRY[name];
  return Sparkles;
}

// Keywords that hint a category title maps to a particular icon.
// Order/length doesn't matter; matches are case-insensitive substrings against the title.
const ICON_KEYWORDS: Record<string, string[]> = {
  RefreshCw: ["reentry", "re-entry", "restart", "renew", "recovery", "rehab", "reset", "transition"],
  Brain: ["mind", "mental", "brain", "cognitive", "psych", "therapy", "counseling", "neuro"],
  Handshake: ["support", "partner", "mentor", "community", "relationship", "ally", "help"],
  Wine: ["substance", "alcohol", "drug", "sobriety", "addiction", "aa", "na"],
  Wallet: ["finance", "money", "budget", "wallet", "income", "wage", "pay"],
  Sparkles: ["wellness", "spirit", "inspire", "motivation", "magic"],
  Heart: ["health", "love", "care", "family", "wellness", "compassion", "relationship"],
  GraduationCap: ["education", "graduate", "degree", "college", "university", "academic"],
  Users: ["community", "group", "team", "peer", "people", "family", "social"],
  BookOpen: ["read", "book", "study", "learn", "literacy", "guide"],
  Library: ["library", "resource", "archive", "collection"],
  Briefcase: ["job", "career", "work", "employment", "business", "professional"],
  School: ["school", "class", "education", "training"],
  FileText: ["document", "form", "record", "report", "paperwork"],
  BookA: ["language", "dictionary", "vocabulary", "spanish", "english"],
  Calculator: ["math", "calc", "tax", "accounting", "number"],
  Scale: ["legal", "law", "justice", "court", "rights", "attorney"],
  Lightbulb: ["idea", "tip", "insight", "innovation", "learn"],
  Anchor: ["stability", "anchor", "ground", "marine"],
  Award: ["award", "achievement", "honor", "recognition"],
  Backpack: ["youth", "student", "school", "kid"],
  BadgeCheck: ["verified", "certified", "credential", "approved"],
  Bike: ["bike", "cycling", "bicycle"],
  Bird: ["bird", "freedom", "wildlife"],
  Bookmark: ["bookmark", "save", "favorite"],
  Building2: ["business", "office", "company", "corporate", "building", "organization"],
  Cake: ["celebration", "birthday", "party"],
  Camera: ["photo", "camera", "media", "photography"],
  Car: ["transport", "car", "drive", "vehicle", "auto", "license"],
  Church: ["faith", "church", "religion", "spiritual", "ministry", "worship"],
  Clipboard: ["plan", "checklist", "task", "form", "intake"],
  Cloud: ["cloud", "weather", "storage"],
  Code: ["coding", "tech", "developer", "software", "programming", "computer"],
  Coffee: ["coffee", "cafe", "break"],
  Compass: ["guidance", "direction", "compass", "navigate", "explore"],
  Cpu: ["tech", "computer", "hardware", "ai"],
  CreditCard: ["credit", "card", "payment", "banking"],
  Crown: ["leadership", "premium", "royal", "elite"],
  Dog: ["pet", "dog", "animal", "service animal"],
  Droplet: ["water", "hydration", "clean"],
  Dumbbell: ["fitness", "gym", "exercise", "workout", "strength", "physical"],
  Feather: ["writing", "art", "light", "feather"],
  Flag: ["goal", "milestone", "country", "patriot", "veteran"],
  Flame: ["energy", "fire", "passion", "motivation"],
  Flower2: ["garden", "flower", "nature", "growth", "bloom"],
  Gamepad2: ["game", "gaming", "play", "recreation"],
  Gift: ["gift", "donation", "giving", "charity"],
  Globe: ["world", "global", "travel", "international", "earth"],
  Hammer: ["construction", "trade", "build", "repair", "tool", "labor"],
  Headphones: ["audio", "music", "podcast", "listen"],
  Home: ["housing", "home", "shelter", "residence", "apartment", "rent"],
  Hospital: ["hospital", "medical", "clinic", "healthcare", "health"],
  Key: ["access", "key", "unlock", "security"],
  Leaf: ["nature", "green", "eco", "growth", "plant"],
  LifeBuoy: ["help", "support", "rescue", "crisis", "emergency"],
  MapPin: ["location", "map", "place", "address", "directions"],
  Megaphone: ["advocacy", "announce", "voice", "outreach", "campaign"],
  Mic: ["podcast", "speaking", "voice", "interview", "audio"],
  Moon: ["night", "sleep", "rest", "moon"],
  Mountain: ["challenge", "mountain", "outdoor", "adventure"],
  Music: ["music", "song", "audio", "art"],
  Newspaper: ["news", "media", "press", "article", "blog"],
  Palette: ["art", "creative", "design", "paint", "color"],
  PenTool: ["writing", "design", "draw", "create"],
  Phone: ["phone", "call", "contact", "hotline"],
  PiggyBank: ["savings", "save", "budget", "money"],
  Plane: ["travel", "flight", "airplane", "transport"],
  Puzzle: ["puzzle", "problem", "solution", "fit"],
  Rocket: ["launch", "startup", "growth", "rocket", "boost"],
  Shield: ["safety", "security", "protect", "defense", "shield", "insurance"],
  ShoppingBag: ["shop", "retail", "shopping", "store", "commerce"],
  Smile: ["happy", "wellness", "smile", "joy", "positive"],
  Star: ["star", "favorite", "top", "featured"],
  Sun: ["sun", "energy", "day", "bright", "solar"],
  Target: ["goal", "target", "objective", "focus", "aim"],
  Tent: ["camp", "tent", "homeless", "outdoor", "shelter"],
  TreePine: ["tree", "nature", "forest", "outdoor"],
  Trophy: ["success", "trophy", "win", "achievement"],
  Truck: ["delivery", "truck", "transport", "logistics", "moving", "trucking", "cdl"],
  Tv: ["media", "tv", "watch", "video"],
  Umbrella: ["protection", "umbrella", "rain", "cover"],
  Utensils: ["food", "meal", "nutrition", "eat", "kitchen", "cook", "dining", "pantry"],
  Video: ["video", "film", "media", "watch"],
  Wrench: ["repair", "tool", "fix", "maintenance", "trade"],
  Zap: ["energy", "power", "fast", "electric", "spark"],
  CircleDot: ["focus", "point"],
  Image: ["image", "photo", "gallery"],
};

function scoreIconForTitle(iconName: string, title: string): number {
  const kws = ICON_KEYWORDS[iconName];
  if (!kws) return 0;
  const t = title.toLowerCase();
  // Tokenize title for whole-word boosts
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  for (const kw of kws) {
    const k = kw.toLowerCase();
    if (tokens.includes(k)) score += 10;
    else if (t.includes(k)) score += 5;
  }
  // Tiny boost when the icon name itself appears in the title
  if (t.includes(iconName.toLowerCase())) score += 3;
  return score;
}

/**
 * Pick an icon name + color that don't collide with anything already in use.
 * If a title is provided, prefer icons whose keywords match the title.
 */
export function generateUniqueCategoryIcon(opts: {
  usedNames: Iterable<string | null | undefined>;
  usedColors: Iterable<string | null | undefined>;
  title?: string | null;
}): { icon_name: string; icon_color: string } {
  const usedN = new Set(Array.from(opts.usedNames).filter(Boolean) as string[]);
  const usedC = new Set(Array.from(opts.usedColors).filter(Boolean) as string[]);

  const names = Object.keys(ICON_REGISTRY);
  const availNames = names.filter((n) => !usedN.has(n));
  const availColors = COLOR_POOL.filter((c) => !usedC.has(c));

  const namePool = availNames.length ? availNames : names;
  const colorPool = availColors.length ? availColors : COLOR_POOL;

  const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  let chosenName: string;
  const title = (opts.title ?? "").trim();
  if (title) {
    const scored = namePool
      .map((n) => ({ n, s: scoreIconForTitle(n, title) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    if (scored.length) {
      // Pick randomly among ties at the top score so repeats with the same word still vary slightly.
      const top = scored[0].s;
      const tied = scored.filter((x) => x.s === top).map((x) => x.n);
      chosenName = rand(tied);
    } else {
      chosenName = rand(namePool);
    }
  } else {
    chosenName = rand(namePool);
  }

  return {
    icon_name: chosenName,
    icon_color: rand(colorPool),
  };
}
