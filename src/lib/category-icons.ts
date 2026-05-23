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

/**
 * Pick an icon name + color that don't collide with anything already in use.
 * Falls back to a random pick if the pools are exhausted.
 */
export function generateUniqueCategoryIcon(opts: {
  usedNames: Iterable<string | null | undefined>;
  usedColors: Iterable<string | null | undefined>;
}): { icon_name: string; icon_color: string } {
  const usedN = new Set(Array.from(opts.usedNames).filter(Boolean) as string[]);
  const usedC = new Set(Array.from(opts.usedColors).filter(Boolean) as string[]);

  const names = Object.keys(ICON_REGISTRY);
  const availNames = names.filter((n) => !usedN.has(n));
  const availColors = COLOR_POOL.filter((c) => !usedC.has(c));

  const pick = <T,>(arr: T[], fallback: T[]) =>
    (arr.length ? arr : fallback)[Math.floor(Math.random() * (arr.length ? arr.length : fallback.length))];

  return {
    icon_name: pick(availNames, names),
    icon_color: pick(availColors, COLOR_POOL),
  };
}
