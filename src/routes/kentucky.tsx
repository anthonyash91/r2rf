import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Search, Phone, Mail, Globe, MapPin, X, ExternalLink,
  Landmark, Home, Briefcase, Stethoscope, Leaf, Scale, Utensils,
  IdCard, Wallet, Bus, Baby, HeartHandshake, GraduationCap, Shield,
  Shirt, Gavel, Unlock, BookOpen, CheckCircle2, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { SpotlightTutorial, type TutorialStep } from "@/components/SpotlightTutorial";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeGroup } from "@/components/BadgeGroup";

export const Route = createFileRoute("/kentucky")({
  head: () => ({
    meta: [
      { title: "Kentucky Re-Entry Resource Directory" },
      {
        name: "description",
        content:
          "A comprehensive directory of housing, employment, legal aid, healthcare, food, and other resources for people leaving jail or prison in Kentucky.",
      },
    ],
  }),
  component: KentuckyPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | "State Agency"
  | "Housing"
  | "Employment"
  | "Healthcare"
  | "Substance Use Treatment"
  | "Legal Aid"
  | "Food & Nutrition"
  | "ID & Documentation"
  | "Financial Assistance"
  | "Transportation"
  | "Family & Children"
  | "Peer Support"
  | "Education"
  | "Veterans"
  | "Basic Needs"
  | "Probation & Parole"
  | "Reentry Organizations";

type Region =
  | "Statewide"
  | "Louisville / Jefferson County"
  | "Lexington / Fayette County"
  | "Northern Kentucky"
  | "Bowling Green / Warren County"
  | "Richmond / Madison County"
  | "Owensboro / Daviess County"
  | "Eastern Kentucky"
  | "Paducah / Western Kentucky"
  | "Ashland / Boyd County"
  | "Frankfort / Franklin County"
  | "Elizabethtown / Hardin County";

type Resource = {
  id: number;
  name: string;
  category: Category;
  description: string;
  description_es?: string;
  address?: string;
  city?: string;
  region: Region;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  notes_es?: string;
};

// ─── Translation maps ─────────────────────────────────────────────────────────

const CATEGORY_KEY: Record<Category, TranslationKey> = {
  "State Agency":            "ky.cat.stateAgency",
  "Housing":                 "ky.cat.housing",
  "Employment":              "ky.cat.employment",
  "Healthcare":              "ky.cat.healthcare",
  "Substance Use Treatment": "ky.cat.substanceUse",
  "Legal Aid":               "ky.cat.legalAid",
  "Food & Nutrition":        "ky.cat.food",
  "ID & Documentation":      "ky.cat.idDocs",
  "Financial Assistance":    "ky.cat.financial",
  "Transportation":          "ky.cat.transportation",
  "Family & Children":       "ky.cat.family",
  "Peer Support":            "ky.cat.peerSupport",
  "Education":               "ky.cat.education",
  "Veterans":                "ky.cat.veterans",
  "Basic Needs":             "ky.cat.basicNeeds",
  "Probation & Parole":      "ky.cat.probationParole",
  "Reentry Organizations":   "ky.cat.reentryOrgs",
};

const REGION_KEY: Record<Region, TranslationKey> = {
  "Statewide":                    "ky.region.statewide",
  "Louisville / Jefferson County": "ky.region.louisville",
  "Lexington / Fayette County":   "ky.region.lexington",
  "Northern Kentucky":            "ky.region.northernKy",
  "Bowling Green / Warren County": "ky.region.bowlingGreen",
  "Richmond / Madison County":    "ky.region.richmond",
  "Owensboro / Daviess County":   "ky.region.owensboro",
  "Eastern Kentucky":             "ky.region.easternKy",
  "Paducah / Western Kentucky":   "ky.region.paducah",
  "Ashland / Boyd County":        "ky.region.ashland",
  "Frankfort / Franklin County":  "ky.region.frankfort",
  "Elizabethtown / Hardin County": "ky.region.elizabethtown",
};

// ─── Category styling ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<Category, string> = {
  "State Agency":            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/40",
  "Housing":                 "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/40",
  "Employment":              "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800/40",
  "Healthcare":              "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-800/40",
  "Substance Use Treatment": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/40",
  "Legal Aid":               "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/40",
  "Food & Nutrition":        "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/40",
  "ID & Documentation":      "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-800/40",
  "Financial Assistance":    "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/40 dark:text-lime-300 dark:border-lime-800/40",
  "Transportation":          "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800/40",
  "Family & Children":       "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:border-pink-800/40",
  "Peer Support":            "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800/40",
  "Education":               "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800/40",
  "Veterans":                "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800/40",
  "Basic Needs":             "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800/40",
  "Probation & Parole":      "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800/40",
  "Reentry Organizations":   "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/40",
};

const CATEGORY_COLOR: Record<Category, string> = {
  "State Agency":            "#bfdbfe",
  "Housing":                 "#bbf7d0",
  "Employment":              "#fed7aa",
  "Healthcare":              "#99f6e4",
  "Substance Use Treatment": "#e9d5ff",
  "Legal Aid":               "#fecaca",
  "Food & Nutrition":        "#fde68a",
  "ID & Documentation":      "#a5f3fc",
  "Financial Assistance":    "#d9f99d",
  "Transportation":          "#bae6fd",
  "Family & Children":       "#fbcfe8",
  "Peer Support":            "#ddd6fe",
  "Education":               "#c7d2fe",
  "Veterans":                "#fef08a",
  "Basic Needs":             "#fecdd3",
  "Probation & Parole":      "#e2e8f0",
  "Reentry Organizations":   "#a7f3d0",
};

const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  "State Agency":            Landmark,
  "Housing":                 Home,
  "Employment":              Briefcase,
  "Healthcare":              Stethoscope,
  "Substance Use Treatment": Leaf,
  "Legal Aid":               Scale,
  "Food & Nutrition":        Utensils,
  "ID & Documentation":      IdCard,
  "Financial Assistance":    Wallet,
  "Transportation":          Bus,
  "Family & Children":       Baby,
  "Peer Support":            HeartHandshake,
  "Education":               GraduationCap,
  "Veterans":                Shield,
  "Basic Needs":             Shirt,
  "Probation & Parole":      Gavel,
  "Reentry Organizations":   Unlock,
};

const CATEGORIES: Category[] = [
  "State Agency", "Housing", "Employment", "Healthcare",
  "Substance Use Treatment", "Legal Aid", "Food & Nutrition",
  "ID & Documentation", "Financial Assistance", "Transportation",
  "Family & Children", "Peer Support", "Education",
  "Veterans", "Basic Needs", "Probation & Parole", "Reentry Organizations",
];

const REGIONS: Region[] = [
  "Statewide",
  "Louisville / Jefferson County",
  "Lexington / Fayette County",
  "Northern Kentucky",
  "Bowling Green / Warren County",
  "Richmond / Madison County",
  "Owensboro / Daviess County",
  "Eastern Kentucky",
  "Paducah / Western Kentucky",
  "Ashland / Boyd County",
  "Frankfort / Franklin County",
  "Elizabethtown / Hardin County",
];

// ─── Resource data ────────────────────────────────────────────────────────────

const RESOURCES: Resource[] = [
  // ── STATE AGENCIES ──────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Kentucky Department of Corrections — Division of Reentry Services",
    category: "State Agency",
    description: "Oversees reentry planning for all state prisoners. Operates 13 Reentry Service Centers (RSCs) statewide. Provides reentry coordinators by region to help connect individuals with housing, employment, and community supports before and after release.",
    description_es: "Supervisa la planificación de reinserción para todos los presos estatales. Opera 13 Centros de Servicios de Reinserción en todo el estado. Proporciona coordinadores de reinserción por región para ayudar a conectar a las personas con vivienda, empleo y apoyo comunitario antes y después de la liberación.",
    address: "275 East Main Street",
    city: "Frankfort",
    region: "Statewide",
    phone: "(502) 782-2347",
    website: "https://corrections.ky.gov/Reentry",
  },
  {
    id: 2,
    name: "Kentucky DOC — Second Chance Portal",
    category: "State Agency",
    description: "State-run online resource portal for individuals preparing for or navigating reentry. Covers housing, employment, education, benefits, and community resources all in one place.",
    description_es: "Portal de recursos en línea del estado para personas que se preparan para la reinserción o la están navegando. Cubre vivienda, empleo, educación, beneficios y recursos comunitarios en un solo lugar.",
    region: "Statewide",
    website: "https://secondchance.ky.gov",
  },
  {
    id: 3,
    name: "KY HELP Statewide Substance Use Hotline",
    category: "State Agency",
    description: "Statewide call center operated by Operation UNITE. Connects callers with treatment, housing, peer support, and recovery resources. Available 7 days a week.",
    description_es: "Centro de llamadas estatal operado por Operation UNITE. Conecta a los llamantes con tratamiento, vivienda, apoyo entre pares y recursos de recuperación. Disponible los 7 días de la semana.",
    region: "Statewide",
    phone: "1-833-859-4357",
    website: "https://findhelpnow.org/ky",
    notes: "1-833-KY-HELP7",
  },
  {
    id: 4,
    name: "Southern Kentucky Reentry Council",
    category: "State Agency",
    description: "Regional reentry council serving Logan, Simpson, Butler, Warren, Edmonson, Hart, Barren, Allen, Metcalfe, and Monroe counties. Connects justice-involved individuals with community resources.",
    description_es: "Consejo regional de reinserción que atiende los condados de Logan, Simpson, Butler, Warren, Edmonson, Hart, Barren, Allen, Metcalfe y Monroe. Conecta a personas involucradas con el sistema de justicia con recursos comunitarios.",
    address: "PMB #394, 1945 Scottsville Road, B2",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 784-9509",
    website: "https://southernkyreentry.org",
  },
  {
    id: 5,
    name: "FIVCO Reentry Council",
    category: "State Agency",
    description: "Regional reentry council for Boyd, Carter, Elliott, Greenup, and Lawrence counties in northeastern Kentucky.",
    description_es: "Consejo regional de reinserción para los condados de Boyd, Carter, Elliott, Greenup y Lawrence en el noreste de Kentucky.",
    region: "Ashland / Boyd County",
    phone: "(606) 920-2024",
    email: "fivco@kentuckyreentry.org",
  },

  // ── HOUSING — LOUISVILLE ─────────────────────────────────────────────────────
  {
    id: 10,
    name: "CTS-Russell (Community Transitional Services)",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center. Provides transitional housing, programming, and supervision support for individuals released to community custody.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky. Proporciona vivienda transitoria, programación y apoyo de supervisión para personas liberadas bajo custodia comunitaria.",
    address: "1407 West Jefferson Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 855-6500",
    website: "https://c-t-susa.com",
  },
  {
    id: 11,
    name: "The Burns M. Brady Center",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center in downtown Louisville offering transitional housing and comprehensive reentry programming for men and women.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky en el centro de Louisville que ofrece vivienda transitoria y programación integral de reinserción para hombres y mujeres.",
    address: "1000 West Market Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 259-0080",
  },
  {
    id: 12,
    name: "Dismas Charities — Diersen (Louisville)",
    category: "Housing",
    description: "Residential reentry program for men and women released from federal and state prison. Provides housing, employment assistance, and community reintegration support.",
    description_es: "Programa residencial de reinserción para hombres y mujeres liberados de prisiones federales y estatales. Proporciona vivienda, asistencia para el empleo y apoyo para la reintegración comunitaria.",
    address: "1218 West Oak Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 636-1572",
    website: "https://dismas.com",
  },
  {
    id: 13,
    name: "Dismas Charities — Portland (Louisville)",
    category: "Housing",
    description: "Residential reentry halfway house for people released from incarceration. Provides structured housing and programming.",
    description_es: "Casa de transición residencial para personas liberadas del encarcelamiento. Proporciona vivienda estructurada y programación.",
    address: "1501 Lytle Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-3733",
    website: "https://dismas.com",
  },
  {
    id: 14,
    name: "Volunteers of America — Halfway Back Program",
    category: "Housing",
    description: "Long-term residential program for paroled adult men with substance use issues. Provides housing, substance abuse treatment, employment assistance, and life skills programming.",
    description_es: "Programa residencial a largo plazo para hombres adultos en libertad condicional con problemas de uso de sustancias. Proporciona vivienda, tratamiento de abuso de sustancias, asistencia para el empleo y programación de habilidades para la vida.",
    address: "1436 South Shelby Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 636-0742",
    website: "https://voamid.org",
  },
  {
    id: 15,
    name: "Volunteers of America — Freedom House",
    category: "Housing",
    description: "Long-term residential treatment and transitional housing for women with children, including those with substance use issues. Comprehensive recovery and family stabilization services.",
    description_es: "Tratamiento residencial a largo plazo y vivienda transitoria para mujeres con hijos, incluidas aquellas con problemas de uso de sustancias. Servicios integrales de recuperación y estabilización familiar.",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 634-0082",
    website: "https://voamid.org",
  },
  {
    id: 16,
    name: "Re:Center Ministries",
    category: "Housing",
    description: "Long-term recovery and transitional housing program for adult men. Provides shelter, recovery services, and reintegration support in partnership with local churches.",
    description_es: "Programa de recuperación y vivienda transitoria a largo plazo para hombres adultos. Proporciona refugio, servicios de recuperación y apoyo para la reintegración en asociación con iglesias locales.",
    address: "733 East Jefferson Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-6543",
    website: "https://recenterministries.org",
  },
  {
    id: 17,
    name: "Exodus Scholar Homes",
    category: "Housing",
    description: "Transitional and recovery housing for individuals leaving incarceration in the Louisville area.",
    description_es: "Vivienda transitoria y de recuperación para personas que salen del encarcelamiento en el área de Louisville.",
    address: "2617 West Broadway Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 356-5912",
  },
  {
    id: 18,
    name: "Coalition for the Homeless — Single Point of Entry",
    category: "Housing",
    description: "Single point of entry for homeless services in Louisville Metro. Provides emergency shelter placement and housing navigation for adults, including those recently released from incarceration.",
    description_es: "Punto único de entrada para servicios para personas sin hogar en Louisville Metro. Proporciona colocación en refugios de emergencia y orientación en vivienda para adultos, incluidos los recién liberados del encarcelamiento.",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 637-2337",
  },

  // ── HOUSING — LEXINGTON ──────────────────────────────────────────────────────
  {
    id: 20,
    name: "Chrysalis House",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center. Oldest and largest substance abuse treatment program for women in Kentucky. Accepts women with young children. Provides residential treatment, GED assistance, job placement, and domestic violence counseling.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky. El programa de tratamiento de abuso de sustancias más antiguo y grande para mujeres en Kentucky. Acepta mujeres con hijos pequeños. Proporciona tratamiento residencial, asistencia para el GED, colocación laboral y asesoramiento en violencia doméstica.",
    address: "1589 Hill Rise Drive",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 977-2504",
    website: "https://chrysalishouse.org",
  },
  {
    id: 21,
    name: "Hope Center — George Privett (Men)",
    category: "Housing",
    description: "Kentucky DOC-contracted men's residential reentry program. Provides housing, substance use recovery services, and life skills programming.",
    description_es: "Programa residencial de reinserción para hombres contratado por el DOC de Kentucky. Proporciona vivienda, servicios de recuperación por uso de sustancias y programación de habilidades para la vida.",
    address: "250 West Loudon Avenue",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 225-4673",
  },
  {
    id: 22,
    name: "Hope Center — Ball-Quantrell Jones (Women)",
    category: "Housing",
    description: "Kentucky DOC-contracted women's residential reentry program. Provides housing, recovery services, and community reintegration programming.",
    description_es: "Programa residencial de reinserción para mujeres contratado por el DOC de Kentucky. Proporciona vivienda, servicios de recuperación y programación de reintegración comunitaria.",
    address: "1524 Versailles Road",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 252-2002",
  },
  {
    id: 23,
    name: "Dismas Charities — Lexington",
    category: "Housing",
    description: "Residential reentry halfway house for men and women released from incarceration in Central Kentucky.",
    description_es: "Casa de transición residencial para hombres y mujeres liberados del encarcelamiento en el centro de Kentucky.",
    address: "909 Georgetown Street",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 231-8448",
    website: "https://dismas.com",
  },
  {
    id: 24,
    name: "Shepherds House",
    category: "Housing",
    description: "Recovery-focused transitional housing for men. Emphasizes accountability, peer support, and long-term sobriety. Suitable for individuals on probation, parole, or court compliance.",
    description_es: "Vivienda transitoria enfocada en la recuperación para hombres. Hace hincapié en la responsabilidad, el apoyo entre pares y la sobriedad a largo plazo. Adecuado para personas en libertad condicional, vigilada o bajo supervisión judicial.",
    address: "365 Waller Avenue, Suite 230",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 252-1939",
    website: "https://shepherdshouseinc.com",
    notes: "Admissions: (859) 447-4020",
  },
  {
    id: 25,
    name: "Lexington Rescue Mission — Re-Entry Program",
    category: "Housing",
    description: "Offers reentry training and support for incarcerated men and women inside the Fayette County Detention Center, Woodford County Detention Center, and Madison County Detention Center.",
    description_es: "Ofrece capacitación y apoyo de reinserción para hombres y mujeres encarcelados dentro del Centro de Detención del Condado de Fayette, el Centro de Detención del Condado de Woodford y el Centro de Detención del Condado de Madison.",
    city: "Lexington",
    region: "Lexington / Fayette County",
    website: "https://lexingtonrescue.org",
  },

  // ── HOUSING — NORTHERN KY ────────────────────────────────────────────────────
  {
    id: 30,
    name: "Welcome House of Northern Kentucky",
    category: "Housing",
    description: "Comprehensive housing and homelessness provider in Northern Kentucky. Serves women, children, families, and adults. Offers emergency shelter, housing navigation, case management, and pathways to long-term housing for those leaving incarceration.",
    description_es: "Proveedor integral de vivienda y servicios para personas sin hogar en el norte de Kentucky. Atiende a mujeres, niños, familias y adultos. Ofrece refugio de emergencia, orientación en vivienda, gestión de casos y vías hacia vivienda a largo plazo para quienes salen del encarcelamiento.",
    address: "205 West Pike Street",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 431-8717",
    website: "https://welcomehouseky.org",
  },
  {
    id: 31,
    name: "Transitions, Inc. — Covington",
    category: "Housing",
    description: "Northern Kentucky substance use treatment and recovery organization founded in 1969. Residential and outpatient programs, detox, and transitional housing. Multiple Covington locations.",
    description_es: "Organización de tratamiento de recuperación y uso de sustancias del norte de Kentucky fundada en 1969. Programas residenciales y ambulatorios, desintoxicación y vivienda transitoria. Múltiples ubicaciones en Covington.",
    address: "535 West Pike Street",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 491-4435",
    website: "https://transitionsky.org",
  },
  {
    id: 32,
    name: "Transitions, Inc. — Grateful Life Center",
    category: "Housing",
    description: "Long-term residential recovery program for men. Recovery Kentucky affiliate. 110-bed therapeutic community emphasizing peer support and accountability. Kentucky DOC-affiliated reentry resource.",
    description_es: "Programa de recuperación residencial a largo plazo para hombres. Afiliado a Recovery Kentucky. Comunidad terapéutica de 110 camas que hace hincapié en el apoyo entre pares y la responsabilidad. Recurso de reinserción afiliado al DOC de Kentucky.",
    address: "305 Pleasure Isle Drive",
    city: "Erlanger",
    region: "Northern Kentucky",
    phone: "(859) 359-4500",
    website: "https://transitionsky.org/facilities/grateful-life-center",
  },

  // ── HOUSING — BOWLING GREEN ──────────────────────────────────────────────────
  {
    id: 40,
    name: "Men's Addiction Recovery Center (MARC)",
    category: "Housing",
    description: "Free inpatient substance abuse recovery program for adult men. Recovery Kentucky affiliate. No cost to clients.",
    description_es: "Programa gratuito de recuperación de adicciones para pacientes internados adultos masculinos. Afiliado a Recovery Kentucky. Sin costo para los clientes.",
    address: "1791 River Street",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 715-0810",
    website: "https://marcrecovery.com",
  },
  {
    id: 41,
    name: "Haven4Change",
    category: "Housing",
    description: "Transitional housing and support services for individuals in recovery or reentry in Warren County and the greater Bowling Green area.",
    description_es: "Vivienda transitoria y servicios de apoyo para personas en recuperación o reinserción en el Condado de Warren y el área metropolitana de Bowling Green.",
    address: "1500 Parkside Drive",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 796-1764",
  },

  // ── HOUSING — RICHMOND ───────────────────────────────────────────────────────
  {
    id: 50,
    name: "Bluegrass Career Development Center",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center providing housing, career development training, and comprehensive programming for individuals leaving incarceration in Central Kentucky.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky que proporciona vivienda, capacitación para el desarrollo profesional y programación integral para personas que salen del encarcelamiento en el centro de Kentucky.",
    address: "549 Recycle Drive",
    city: "Richmond",
    region: "Richmond / Madison County",
    phone: "(859) 626-9120",
  },
  {
    id: 51,
    name: "Liberty Place Recovery Center for Women",
    category: "Housing",
    description: "Free 108-bed residential recovery center for women. Recovery Kentucky affiliate. Long-term substance abuse recovery programming at no cost, serving Central and Eastern Kentucky.",
    description_es: "Centro de recuperación residencial gratuito de 108 camas para mujeres. Afiliado a Recovery Kentucky. Programación de recuperación de abuso de sustancias a largo plazo sin costo, que atiende al centro y al este de Kentucky.",
    address: "218 Lake Street",
    city: "Richmond",
    region: "Richmond / Madison County",
    phone: "(859) 625-0104",
    website: "https://foothillscap.org/programs/liberty-place",
  },

  // ── HOUSING — OWENSBORO ──────────────────────────────────────────────────────
  {
    id: 60,
    name: "Dismas Charities — Owensboro",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center. Residential reentry housing, structured programming, and supervision support for men and women in Western Kentucky.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky. Vivienda residencial de reinserción, programación estructurada y apoyo de supervisión para hombres y mujeres en el oeste de Kentucky.",
    address: "615 Carlton Drive",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 685-6054",
    website: "https://dismas.com",
  },

  // ── HOUSING — EASTERN KY ─────────────────────────────────────────────────────
  {
    id: 70,
    name: "WestCare — Lookout (Elkhorn City)",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center providing substance use treatment and residential housing in Eastern Kentucky.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky que proporciona tratamiento de uso de sustancias y vivienda residencial en el este de Kentucky.",
    address: "5971 Poor Bottom Road",
    city: "Elkhorn City",
    region: "Eastern Kentucky",
    phone: "(606) 772-3012",
  },
  {
    id: 71,
    name: "Keeton Corrections — Paducah",
    category: "Housing",
    description: "Kentucky DOC-contracted Reentry Service Center providing residential transitional housing and programming in Western Kentucky.",
    description_es: "Centro de Servicios de Reinserción contratado por el DOC de Kentucky que proporciona vivienda transitoria residencial y programación en el oeste de Kentucky.",
    address: "621 South Clarence Gains Street",
    city: "Paducah",
    region: "Paducah / Western Kentucky",
    phone: "(270) 442-6251",
  },

  // ── HOUSING — STATEWIDE ──────────────────────────────────────────────────────
  {
    id: 80,
    name: "Oxford House Kentucky — Recovery Housing",
    category: "Housing",
    description: "Statewide network of self-supported Oxford Houses providing sober living for people in recovery, including those leaving incarceration. Reentry coordinator assists with placement in available houses.",
    description_es: "Red estatal de Oxford Houses autofinanciadas que ofrecen vida sobria para personas en recuperación, incluidas las que salen del encarcelamiento. El coordinador de reinserción ayuda con la colocación en casas disponibles.",
    region: "Statewide",
    phone: "(502) 830-8082",
    email: "reentryky@oxfordhouse.us",
    website: "https://oxfordhouseky.org",
  },

  // ── EMPLOYMENT ───────────────────────────────────────────────────────────────
  {
    id: 100,
    name: "Goodwill Industries of Kentucky — RISE Program",
    category: "Employment",
    description: "Major second-chance employer running the RISE (Reintegrating Individuals Successfully Every Day) job-readiness training program. Covers soft skills, financial literacy, digital literacy, resume development, and mock interviewing. Also runs Aspire for individuals post-incarceration. Serves 103 of 120 Kentucky counties.",
    description_es: "Importante empleador de segunda oportunidad que dirige el programa de capacitación RISE (Reintegrando Individuos Exitosamente Cada Día). Cubre habilidades blandas, educación financiera, alfabetización digital, desarrollo de currículum y entrevistas simuladas. También ofrece Aspire para personas post-encarcelamiento. Atiende 103 de los 120 condados de Kentucky.",
    address: "2820 West Broadway",
    city: "Louisville",
    region: "Statewide",
    phone: "(502) 585-5221",
    website: "https://goodwillky.org",
    notes: "RISE program locations in Louisville, Lexington, Bowling Green, and Pikeville",
  },
  {
    id: 101,
    name: "Goodwill Kentucky — Free Expungement Services",
    category: "Employment",
    description: "Free expungement clinics held across Kentucky throughout the year. Attorney review of criminal record, determination of eligibility, and filing fees paid by Goodwill. Over 8,500 records expunged to date.",
    description_es: "Clínicas gratuitas de eliminación de antecedentes penales realizadas en todo Kentucky durante el año. Revisión del historial criminal por un abogado, determinación de elegibilidad y honorarios de presentación pagados por Goodwill. Más de 8,500 registros eliminados hasta la fecha.",
    region: "Statewide",
    phone: "(502) 585-5221",
    email: "Cody.Avery@goodwillky.org",
    website: "https://goodwillky.org/expungements",
  },
  {
    id: 102,
    name: "Kentucky Career Center — Louisville",
    category: "Employment",
    description: "American Job Center providing free job search assistance, resume help, career counseling, and training referrals. Part of the KentuckianaWorks workforce development network.",
    description_es: "Centro de Trabajo Americano que proporciona asistencia gratuita para búsqueda de empleo, ayuda con currículum, orientación profesional y referencias para capacitación. Parte de la red de desarrollo de la fuerza laboral de KentuckianaWorks.",
    address: "600 West Cedar Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 595-4003",
    website: "https://kentuckianaworks.org/kcclou",
  },
  {
    id: 103,
    name: "Kentucky Career Center — Lexington (Bluegrass)",
    category: "Employment",
    description: "American Job Center serving Fayette and surrounding counties. Free services include job search, resume workshops, career assessment, veterans services, and referrals to training programs.",
    description_es: "Centro de Trabajo Americano que atiende a Fayette y los condados circundantes. Los servicios gratuitos incluyen búsqueda de empleo, talleres de currículum, evaluación profesional, servicios para veteranos y referencias a programas de capacitación.",
    address: "2473 Fortune Drive, Suite 180",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 267-2223",
    website: "https://ckycareers.com",
  },
  {
    id: 104,
    name: "Kentucky Career Center — Northern Kentucky",
    category: "Employment",
    description: "American Job Center for Northern Kentucky. Career coaching, job readiness workshops, resume services, and training funding. Partners with Gateway Community College, Goodwill, and TANK transit.",
    description_es: "Centro de Trabajo Americano para el norte de Kentucky. Orientación profesional, talleres de preparación laboral, servicios de currículum y financiamiento para capacitación. Asociado con Gateway Community College, Goodwill y el transporte TANK.",
    address: "1324 Madison Avenue",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 292-6666",
    website: "https://nkcareercenter.org",
  },
  {
    id: 105,
    name: "Kentucky Career Center — Bowling Green",
    category: "Employment",
    description: "American Job Center in Warren County providing free job search, resume assistance, employment workshops, and referrals to training programs.",
    description_es: "Centro de Trabajo Americano en el Condado de Warren que proporciona búsqueda de empleo gratuita, asistencia con currículum, talleres de empleo y referencias a programas de capacitación.",
    address: "803 Chestnut Street",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 746-7425",
  },
  {
    id: 106,
    name: "Kentucky Career Center — TENCO (Ashland)",
    category: "Employment",
    description: "American Job Center serving northeastern Kentucky including Boyd, Greenup, Carter, and surrounding counties. Free job seeker services.",
    description_es: "Centro de Trabajo Americano que atiende al noreste de Kentucky, incluidos los condados de Boyd, Greenup, Carter y los circundantes. Servicios gratuitos para buscadores de empleo.",
    address: "1844 Carter Avenue",
    city: "Ashland",
    region: "Ashland / Boyd County",
    phone: "(606) 920-2024",
    website: "https://tencocareercenter.com",
  },
  {
    id: 107,
    name: "Eastern Kentucky CEP (EKCEP) — SITE Program",
    category: "Employment",
    description: "Workforce development organization for 23 Appalachian Kentucky counties. The SITE (Strategic Initiative for Transformational Employment) program bridges addiction recovery and workforce participation. Recovery-informed job services, barrier relief, and career advising.",
    description_es: "Organización de desarrollo de la fuerza laboral para 23 condados del Kentucky Apalache. El programa SITE conecta la recuperación de adicciones con la participación laboral. Servicios de empleo informados en recuperación, alivio de barreras y asesoramiento profesional.",
    address: "100 Airport Gardens Road, Suite 300",
    city: "Hazard",
    region: "Eastern Kentucky",
    phone: "(606) 436-5751",
    email: "ekcep@ekcep.org",
    website: "https://ekcep.org",
  },
  {
    id: 108,
    name: "Kentucky Dept of Professional Licensing — Occupational Licensing",
    category: "Employment",
    description: "Kentucky's HB 185 (2022) allows anyone with a conviction to petition a licensing board before investing in training to find out if their record would be disqualifying. Boards can only deny based on convictions 'directly related' to the licensed occupation. Contact DPL to be routed to the correct board.",
    description_es: "El proyecto de ley HB 185 de Kentucky (2022) permite que cualquier persona con una condena solicite a una junta de licencias antes de invertir en capacitación para saber si su historial sería descalificante. Las juntas solo pueden negar en base a condenas directamente relacionadas con la ocupación con licencia. Comuníquese con el DPL para que lo dirijan a la junta correcta.",
    address: "500 Mero Street",
    city: "Frankfort",
    region: "Statewide",
    phone: "(502) 564-3296",
    website: "https://dpl.ky.gov",
  },
  {
    id: 109,
    name: "Institute for Justice — Kentucky Licensing",
    category: "Employment",
    description: "National nonprofit law firm that led advocacy for Kentucky's occupational licensing reforms. Can provide guidance or referrals if you are denied a professional license due to a prior conviction.",
    description_es: "Firma de abogados sin fines de lucro que lideró la defensa de las reformas de licencias ocupacionales de Kentucky. Puede proporcionar orientación o referencias si se le niega una licencia profesional debido a una condena anterior.",
    region: "Statewide",
    website: "https://ij.org/issues/economic-liberty/occupational-licensing/kentucky/",
  },

  // ── HEALTHCARE ───────────────────────────────────────────────────────────────
  {
    id: 120,
    name: "kynect — Medicaid & Benefits Enrollment",
    category: "Healthcare",
    description: "State online portal to apply for Medicaid (Kentucky Health Plan), SNAP, KTAP, childcare assistance, and other benefits. People leaving incarceration can enroll for Medicaid immediately upon release. Apply online, by phone, or at any DCBS office.",
    description_es: "Portal estatal en línea para solicitar Medicaid, SNAP, KTAP, asistencia para el cuidado de niños y otros beneficios. Las personas que salen del encarcelamiento pueden inscribirse en Medicaid inmediatamente al salir. Solicite en línea, por teléfono o en cualquier oficina del DCBS.",
    region: "Statewide",
    phone: "1-855-306-8959",
    website: "https://kynect.ky.gov",
  },
  {
    id: 121,
    name: "Seven Counties Services — Louisville",
    category: "Healthcare",
    description: "Community Mental Health Center serving Jefferson and surrounding counties. Full continuum of care: mental health, substance abuse, developmental disabilities, and detox to recovery housing. 24/7 crisis line.",
    description_es: "Centro Comunitario de Salud Mental que atiende a Jefferson y los condados circundantes. Continuo completo de atención: salud mental, abuso de sustancias, discapacidades del desarrollo y desintoxicación hasta vivienda de recuperación. Línea de crisis disponible las 24 horas.",
    address: "101 West Muhammad Ali Blvd.",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 589-8915",
    website: "https://sevencounties.org",
    notes: "24/7 Crisis Line: (502) 589-4313",
  },
  {
    id: 122,
    name: "Centerstone — Louisville",
    category: "Healthcare",
    description: "Behavioral health organization offering mental health care, substance use treatment, and family support. Multiple Louisville locations. 24/7 crisis line available.",
    description_es: "Organización de salud conductual que ofrece atención de salud mental, tratamiento de uso de sustancias y apoyo familiar. Múltiples ubicaciones en Louisville. Línea de crisis disponible las 24 horas.",
    address: "708 Magazine Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 287-0642",
    website: "https://centerstoneky.org",
    notes: "24/7 line: (855) 802-1592",
  },
  {
    id: 123,
    name: "New Vista Behavioral Health — Lexington",
    category: "Healthcare",
    description: "Community Mental Health Center serving 17 Central Kentucky counties. Mental health, substance use, IDD, and primary care services. Same-day Behavioral Health Urgent Care available. 24/7 crisis line.",
    description_es: "Centro Comunitario de Salud Mental que atiende a 17 condados del centro de Kentucky. Servicios de salud mental, uso de sustancias, discapacidades del desarrollo y atención primaria. Atención Urgente de Salud Conductual disponible el mismo día. Línea de crisis las 24 horas.",
    address: "1351 Newtown Pike, Building 1",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 253-1686",
    website: "https://newvista.org",
    notes: "24/7 Crisis Line: 1-800-928-8000",
  },
  {
    id: 124,
    name: "North Key Community Care — Covington",
    category: "Healthcare",
    description: "Community Mental Health Center serving Northern Kentucky. Mental health, substance use, and developmental disability services. 24/7 crisis line.",
    description_es: "Centro Comunitario de Salud Mental que atiende al norte de Kentucky. Servicios de salud mental, uso de sustancias y discapacidades del desarrollo. Línea de crisis disponible las 24 horas.",
    address: "503 Farrell Drive",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 781-5586",
    notes: "24/7 Crisis Line: (859) 331-3292",
  },
  {
    id: 125,
    name: "988 Suicide & Crisis Lifeline",
    category: "Healthcare",
    description: "Call or text 988 to reach the National Suicide & Crisis Lifeline. Free, confidential mental health crisis support available 24/7. Spanish-speaking counselors available.",
    description_es: "Llame o envíe un mensaje de texto al 988 para comunicarse con la Línea Nacional de Prevención del Suicidio y Crisis. Apoyo gratuito y confidencial para crisis de salud mental disponible las 24 horas. Consejeros de habla hispana disponibles.",
    region: "Statewide",
    phone: "988",
    website: "https://988lifeline.org",
  },
  {
    id: 126,
    name: "University of Louisville 550 HIV Clinic / Ryan White Program",
    category: "Healthcare",
    description: "Federally funded outpatient HIV medical clinic. Ryan White case managers help with care coordination, housing support, and wraparound services for low-income uninsured/underinsured clients. Covers a 7-county Greater Louisville region. Telehealth services connect to jails via Kentucky TeleHealth Network.",
    description_es: "Clínica médica ambulatoria de VIH con fondos federales. Los gestores de casos de Ryan White ayudan con la coordinación de atención, apoyo en vivienda y servicios integrales para clientes de bajos ingresos sin seguro. Cubre una región de 7 condados del Gran Louisville. Los servicios de telesalud conectan con cárceles.",
    address: "550 South Jackson Street, 2nd Floor",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 561-8844",
    website: "https://louisville.edu/ryanwhite550",
  },
  {
    id: 127,
    name: "Volunteers of America — HIV Services (Louisville)",
    category: "Healthcare",
    description: "Free, confidential HIV testing and education; syringe exchange; HOPWA (Housing Opportunities for Persons with AIDS) rental and housing assistance; S.T.O.P. outreach and prevention program.",
    description_es: "Pruebas de VIH gratuitas y confidenciales y educación; intercambio de jeringas; asistencia de alquiler y vivienda HOPWA (Oportunidades de Vivienda para Personas con SIDA); programa de extensión y prevención S.T.O.P.",
    address: "570 South Fourth Street, Suite 100",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 636-0771",
    website: "https://voamid.org",
    notes: "HIV Testing: (502) 635-4506 | HOPWA Housing: (502) 635-4511",
  },
  {
    id: 128,
    name: "AVOL Kentucky — Lexington",
    category: "Healthcare",
    description: "Statewide HIV/AIDS organization. Free, private HIV and STI testing; care coordination; housing assistance for people living with HIV; prevention education and outreach; on-site PrEP medical services.",
    description_es: "Organización estatal de VIH/SIDA. Pruebas privadas y gratuitas de VIH e ITS; coordinación de atención; asistencia de vivienda para personas que viven con VIH; educación de prevención y extensión; servicios médicos de PrEP en el sitio.",
    address: "225 Walton Avenue, Suite 110",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 225-3000",
    website: "https://avolky.org",
    notes: "Toll-free: 877-225-9245",
  },
  {
    id: 129,
    name: "Louisville Metro Public Health — Free HIV Testing",
    category: "Healthcare",
    description: "Free HIV testing Monday–Friday at Louisville Metro's Specialty Clinic. STI testing also available.",
    description_es: "Pruebas gratuitas de VIH de lunes a viernes en la Clínica Especializada de Louisville Metro. Pruebas de ITS también disponibles.",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 574-5600",
    website: "https://louisvilleky.gov/government/health-wellness/services/hiv-testing",
  },

  // ── SUBSTANCE USE TREATMENT ──────────────────────────────────────────────────
  {
    id: 140,
    name: "The Healing Place — Men's Campus",
    category: "Substance Use Treatment",
    description: "Free residential addiction recovery program for men. One of Louisville's largest recovery programs. No charge for services. Provides detox, residential treatment, and aftercare programming.",
    description_es: "Programa gratuito de recuperación de adicciones residencial para hombres. Uno de los programas de recuperación más grandes de Louisville. Sin cargo por los servicios. Proporciona desintoxicación, tratamiento residencial y programación posterior al tratamiento.",
    address: "1020 West Market Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 585-4848",
    website: "https://thehealingplace.org",
  },
  {
    id: 141,
    name: "The Healing Place — Women's Campus",
    category: "Substance Use Treatment",
    description: "Free residential addiction recovery program for women. Kentucky DOC-contracted Reentry Service Center. No charge for services. Detox, residential treatment, and aftercare.",
    description_es: "Programa gratuito de recuperación de adicciones residencial para mujeres. Centro de Servicios de Reinserción contratado por el DOC de Kentucky. Sin cargo por los servicios. Desintoxicación, tratamiento residencial y seguimiento posterior.",
    address: "1503 South 15th Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 568-1268",
    website: "https://thehealingplace.org",
  },
  {
    id: 142,
    name: "Stepworks Recovery Centers",
    category: "Substance Use Treatment",
    description: "Multi-location substance use treatment network across Kentucky including Louisville and Elizabethtown. Offers detox, residential, and outpatient services. Accepts most insurance including Medicaid.",
    description_es: "Red de centros de tratamiento de uso de sustancias en múltiples ubicaciones en todo Kentucky, incluidos Louisville y Elizabethtown. Ofrece servicios de desintoxicación, residencial y ambulatorio. Acepta la mayoría de los seguros, incluido Medicaid.",
    region: "Statewide",
    website: "https://stepworks.com",
  },
  {
    id: 143,
    name: "SAMHSA Treatment Locator",
    category: "Substance Use Treatment",
    description: "Federal tool to find substance use treatment facilities anywhere in Kentucky by zip code. Filters by type of care, payment accepted (Medicaid, sliding scale, free), and more. SAMHSA National Helpline is free, confidential, and available 24/7.",
    description_es: "Herramienta federal para encontrar instalaciones de tratamiento de uso de sustancias en cualquier lugar de Kentucky por código postal. Filtros por tipo de atención, pago aceptado (Medicaid, escala móvil, gratuito) y más. La Línea de Ayuda Nacional de SAMHSA es gratuita, confidencial y disponible las 24 horas.",
    region: "Statewide",
    phone: "1-800-662-4357",
    website: "https://findtreatment.gov",
  },

  // ── LEGAL AID ────────────────────────────────────────────────────────────────
  {
    id: 160,
    name: "Legal Aid Society — Louisville",
    category: "Legal Aid",
    description: "Free civil legal help for low-income individuals in 15 Kentucky counties. Handles housing, family, benefits, safety, and health matters. Hosts expungement clinics in partnership with Goodwill Kentucky.",
    description_es: "Ayuda legal civil gratuita para personas de bajos ingresos en 15 condados de Kentucky. Maneja asuntos de vivienda, familia, beneficios, seguridad y salud. Organiza clínicas de eliminación de antecedentes penales en asociación con Goodwill Kentucky.",
    address: "416 West Muhammad Ali Blvd., Suite 300",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-1254",
    website: "https://yourlegalaid.org",
    notes: "Toll-free: (800) 292-1862 | Expungement: (502) 614-3101",
  },
  {
    id: 161,
    name: "Legal Aid of the Bluegrass — Lexington",
    category: "Legal Aid",
    description: "Free civil legal services for low-income individuals in 32 Central and Northern Kentucky counties. Expungement representation when a record is a barrier to employment or housing. Partners with Goodwill Kentucky expungement clinics.",
    description_es: "Servicios legales civiles gratuitos para personas de bajos ingresos en 32 condados del centro y norte de Kentucky. Representación para la eliminación de antecedentes penales cuando el historial es una barrera para el empleo o la vivienda. Asociado con las clínicas de eliminación de antecedentes penales de Goodwill Kentucky.",
    address: "300 East Main Street, Suite 210",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 431-8200",
    email: "legalaid@lablaw.org",
    website: "https://lablaw.org",
    notes: "Also offices in Covington, Ashland, and Morehead",
  },
  {
    id: 162,
    name: "Kentucky Legal Aid — Bowling Green",
    category: "Legal Aid",
    description: "Free civil legal services for low-income individuals in western and south-central Kentucky. Housing, benefits, family, and civil matters. Expungement assistance available.",
    description_es: "Servicios legales civiles gratuitos para personas de bajos ingresos en el oeste y centro-sur de Kentucky. Asuntos de vivienda, beneficios, familia y civiles. Asistencia para la eliminación de antecedentes penales disponible.",
    address: "1700 Destiny Lane",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 782-1924",
    website: "https://klaid.org",
    notes: "Intake: (877) 782-4219",
  },
  {
    id: 163,
    name: "Kentucky Legal Aid — Owensboro",
    category: "Legal Aid",
    description: "Free civil legal services for low-income individuals in Western Kentucky.",
    description_es: "Servicios legales civiles gratuitos para personas de bajos ingresos en el oeste de Kentucky.",
    address: "117 West Second Street",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 683-4585",
    website: "https://klaid.org",
    notes: "Toll-free: (800) 467-2260",
  },
  {
    id: 164,
    name: "Kentucky Legal Aid — Paducah",
    category: "Legal Aid",
    description: "Free civil legal services for low-income individuals in Western Kentucky.",
    description_es: "Servicios legales civiles gratuitos para personas de bajos ingresos en el oeste de Kentucky.",
    address: "216 Berger Road",
    city: "Paducah",
    region: "Paducah / Western Kentucky",
    phone: "(270) 442-5518",
    website: "https://klaid.org",
    notes: "Toll-free: (800) 467-2218",
  },
  {
    id: 165,
    name: "AppalReD Legal Aid — Eastern Kentucky",
    category: "Legal Aid",
    description: "Free civil legal services for low-income people in 37 Appalachian counties in Eastern and South-Central Kentucky. Handles expungement, housing, benefits, and more.",
    description_es: "Servicios legales civiles gratuitos para personas de bajos ingresos en 37 condados del Apalache en el este y centro-sur de Kentucky. Maneja la eliminación de antecedentes penales, vivienda, beneficios y más.",
    region: "Eastern Kentucky",
    phone: "1-866-277-5733",
    website: "https://ardfky.org",
    notes: "Covers Bell, Clay, Floyd, Harlan, Knox, Laurel, Letcher, Pike, Perry, and 28 other counties",
  },
  {
    id: 166,
    name: "ACLU of Kentucky — Voting Rights Restoration (ROVR)",
    category: "Legal Aid",
    description: "Actively campaigns to register Kentuckians with past felony convictions and provides ROVR (Restoration of Voting Rights) resources. Governor Beshear's 2019 executive order automatically restored voting rights for non-violent felonies upon completion of full sentence including probation and parole.",
    description_es: "Hace campaña activamente para registrar a ciudadanos de Kentucky con condenas previas y proporciona recursos de ROVR (Restauración de Derechos de Voto). La orden ejecutiva de 2019 del Gobernador Beshear restauró automáticamente los derechos de voto para delitos graves no violentos al completar la sentencia completa, incluyendo la libertad condicional y la vigilada.",
    address: "325 Main Street, Suite 2210",
    city: "Louisville",
    region: "Statewide",
    phone: "(502) 581-9746",
    email: "info@aclu-ky.org",
    website: "https://aclu-ky.org/en/rovr",
  },
  {
    id: 167,
    name: "Kentucky Civil Rights Restoration Program",
    category: "Legal Aid",
    description: "Restores voting rights to Kentuckians convicted of non-violent felonies who have completed their full sentence (including probation and parole). Those with violent felony convictions must petition the Governor separately. Free application, takes up to 12 weeks to process.",
    description_es: "Restaura los derechos de voto a los ciudadanos de Kentucky condenados por delitos graves no violentos que han completado su sentencia completa (incluyendo libertad condicional y vigilada). Los que tienen condenas por delitos graves violentos deben solicitar al Gobernador por separado. Solicitud gratuita, tarda hasta 12 semanas en procesarse.",
    region: "Statewide",
    phone: "(502) 782-9731",
    email: "CivilRights.Restoration@ky.gov",
    website: "https://civilrightsrestoration.ky.gov",
  },
  {
    id: 168,
    name: "Kentucky Equal Justice Center",
    category: "Legal Aid",
    description: "Poverty law advocacy organization involved in voter registration drives for returning citizens. Provides legal help for low-income Kentuckians facing systemic barriers, including licensing and housing issues.",
    description_es: "Organización de defensa de la ley de pobreza involucrada en campañas de registro de votantes para ciudadanos que regresan. Proporciona ayuda legal para ciudadanos de Kentucky de bajos ingresos que enfrentan barreras sistémicas, incluidos problemas de licencias y vivienda.",
    address: "201 West Short Street, Suite 310",
    city: "Lexington",
    region: "Statewide",
    website: "https://kyequaljustice.org",
  },
  {
    id: 169,
    name: "Jefferson County Drug Court — Louisville",
    category: "Legal Aid",
    description: "Alternative sentencing program for non-violent offenders with substance use disorder. Felony track minimum 18 months. Entry through diversion, probation, or probation revocation referral. Access through a judge, prosecutor, defense attorney, or probation officer.",
    description_es: "Programa de sentencias alternativas para infractores no violentos con trastorno por uso de sustancias. La pista de delitos graves tiene un mínimo de 18 meses. Acceso a través de un juez, fiscal, defensor o agente de libertad condicional.",
    address: "700 West Jefferson Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    notes: "Referral required through court system",
  },
  {
    id: 170,
    name: "Louisville Veterans Treatment Court",
    category: "Legal Aid",
    description: "Kentucky's first Veterans Treatment Court, launched 2012. Voluntary program for veterans with substance use or serious mental illness charges. Requires regular court appearances and treatment compliance. Contact the Robley Rex VA VJO team or your attorney for referral.",
    description_es: "El primer Tribunal de Tratamiento para Veteranos de Kentucky, lanzado en 2012. Programa voluntario para veteranos con cargos por uso de sustancias o enfermedades mentales graves. Requiere comparecencias regulares ante el tribunal y cumplimiento del tratamiento. Comuníquese con el equipo VJO del VA Robley Rex o su abogado para una referencia.",
    address: "700 West Jefferson Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    notes: "VA referral: (502) 287-4000, ask for VJO/Mental Health",
  },
  {
    id: 171,
    name: "Fayette County Drug Courts — Lexington",
    category: "Legal Aid",
    description: "Four certified Drug Court programs in Fayette County serving residents with substance use disorder as an alternative to incarceration. Access through the court system.",
    description_es: "Cuatro programas certificados de Tribunal de Drogas en el Condado de Fayette que atienden a residentes con trastorno por uso de sustancias como alternativa al encarcelamiento. El acceso es a través del sistema judicial.",
    address: "163 West Short Street",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 254-4941",
    website: "https://fayettecountyattorney.com/services/specialty-courts",
  },
  {
    id: 172,
    name: "Kentucky Court of Justice — Specialty Courts Directory",
    category: "Legal Aid",
    description: "Statewide directory of all Drug Courts, Veterans Treatment Courts, Mental Health Courts, and Family Recovery Courts across all 120 Kentucky counties. Find your county's specialty court options here.",
    description_es: "Directorio estatal de todos los Tribunales de Drogas, Tribunales de Tratamiento para Veteranos, Tribunales de Salud Mental y Tribunales de Recuperación Familiar en los 120 condados de Kentucky. Encuentre aquí las opciones del tribunal especial de su condado.",
    region: "Statewide",
    website: "https://kycourts.gov/Court-Programs/Specialty-Courts",
  },

  // ── FOOD & NUTRITION ─────────────────────────────────────────────────────────
  {
    id: 180,
    name: "Kentucky SNAP Enrollment — kynect",
    category: "Food & Nutrition",
    description: "Apply for SNAP (food assistance) through the kynect portal online, by phone, or at any DCBS office. Kentucky does not automatically disqualify people with drug felony convictions from SNAP. Applications accepted in all 120 counties.",
    description_es: "Solicite SNAP (asistencia alimentaria) a través del portal kynect en línea, por teléfono o en cualquier oficina del DCBS. Kentucky no descalifica automáticamente a personas con condenas por delitos de drogas del SNAP. Solicitudes aceptadas en los 120 condados.",
    region: "Statewide",
    phone: "1-855-306-8959",
    website: "https://kynect.ky.gov",
  },
  {
    id: 181,
    name: "Dare to Care Food Bank — Louisville",
    category: "Food & Nutrition",
    description: "Louisville area's only community-wide emergency food provider. Partners with 320+ food pantries in 13 counties in Kentucky and Southern Indiana. Find a pantry near you at their website.",
    description_es: "El único proveedor comunitario de alimentos de emergencia en el área de Louisville. Asociado con más de 320 despensas de alimentos en 13 condados de Kentucky y el sur de Indiana. Encuentre una despensa cerca de usted en su sitio web.",
    address: "5803 Fern Valley Road",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 966-3821",
    website: "https://daretocare.org",
  },
  {
    id: 182,
    name: "God's Pantry Food Bank — Lexington",
    category: "Food & Nutrition",
    description: "Regional food bank serving 50 counties in Central and Eastern Kentucky. Find food assistance locations and programs through their website.",
    description_es: "Banco de alimentos regional que atiende a 50 condados del centro y el este de Kentucky. Encuentre ubicaciones y programas de asistencia alimentaria a través de su sitio web.",
    address: "1685 Jaggie Fox Way",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 259-2308",
    website: "https://godspantry.org",
  },
  {
    id: 183,
    name: "Feeding America Kentucky's Heartland — Elizabethtown",
    category: "Food & Nutrition",
    description: "Regional food bank serving 42 counties in central, southern, and western Kentucky. Use their site to find food resources in your county.",
    description_es: "Banco de alimentos regional que atiende a 42 condados en el centro, sur y oeste de Kentucky. Use su sitio para encontrar recursos alimentarios en su condado.",
    address: "313 Peterson Drive",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 769-6997",
    website: "https://feedingamericaky.org",
  },
  {
    id: 184,
    name: "Feeding America — Find a Food Bank",
    category: "Food & Nutrition",
    description: "National locator to find food banks and pantries by zip code across all of Kentucky.",
    description_es: "Localizador nacional para encontrar bancos de alimentos y despensas por código postal en todo Kentucky.",
    region: "Statewide",
    website: "https://feedingamerica.org/find-your-local-foodbank",
  },

  // ── ID & DOCUMENTATION ───────────────────────────────────────────────────────
  {
    id: 200,
    name: "Kentucky Office of Vital Statistics — Birth Certificates",
    category: "ID & Documentation",
    description: "Order certified Kentucky birth certificates in person, by mail, or online through VitalChek. Required for obtaining a state ID or driver's license. Fee: $10 per certificate. In-person hours: 8am–3:30pm Monday–Friday.",
    description_es: "Solicite certificados de nacimiento certificados de Kentucky en persona, por correo o en línea a través de VitalChek. Requerido para obtener una identificación estatal o licencia de conducir. Tarifa: $10 por certificado. Horario en persona: 8am–3:30pm de lunes a viernes.",
    address: "275 East Main Street, 1E-A",
    city: "Frankfort",
    region: "Statewide",
    phone: "(502) 564-4212",
    website: "https://vitalchek.com",
    notes: "VitalChek phone: 1-877-817-7362",
  },
  {
    id: 201,
    name: "Kentucky Driver Licensing (DRIVE) — State ID",
    category: "ID & Documentation",
    description: "State agency that issues Kentucky driver's licenses and state IDs. People leaving incarceration can use a Felon Release Letter from KDOC as a primary identity document when obtaining an ID. Visit any regional driver licensing office.",
    description_es: "Agencia estatal que emite licencias de conducir e identificaciones estatales de Kentucky. Las personas que salen del encarcelamiento pueden usar una Carta de Liberación del KDOC como documento de identidad principal al obtener una identificación. Visite cualquier oficina regional de licencias de conducir.",
    region: "Statewide",
    phone: "(502) 564-1257",
    website: "https://drive.ky.gov",
  },
  {
    id: 202,
    name: "Kentucky Driver Licensing — License Reinstatement",
    category: "ID & Documentation",
    description: "Standard reinstatement fee is $40 (certified check/money order payable to 'Kentucky State Treasurer' or pay by phone with debit/credit card). Paying the fee alone does not restore privileges — all suspension conditions (court orders, DUI classes, ignition interlock) must also be satisfied.",
    description_es: "La tarifa estándar de restablecimiento es de $40 (cheque certificado/giro postal pagadero al 'Kentucky State Treasurer' o pague por teléfono con débito/crédito). Pagar la tarifa sola no restaura los privilegios; también deben cumplirse todas las condiciones de suspensión (órdenes judiciales, clases de DUI, dispositivo interbloqueo).",
    region: "Statewide",
    phone: "(502) 564-1257",
    website: "https://drive.ky.gov/Drivers/Pages/License%20Reinstatement.aspx",
    notes: "Pay by phone with debit/credit: (502) 564-1257",
  },
  {
    id: 203,
    name: "Social Security Administration — Louisville",
    category: "ID & Documentation",
    description: "Apply for or replace a Social Security card. Required for employment and most benefits. Hours: Monday–Friday 9am–4pm.",
    description_es: "Solicite o reemplace una tarjeta del Seguro Social. Requerida para el empleo y la mayoría de los beneficios. Horario: lunes a viernes, 9am–4pm.",
    address: "601 West Broadway, Room 101",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(866) 716-9671",
    website: "https://ssa.gov",
  },
  {
    id: 204,
    name: "Social Security Administration — Lexington",
    category: "ID & Documentation",
    description: "SSA field office serving Fayette County and Central Kentucky. Replace Social Security card and apply for benefits. Hours: Monday–Friday 9am–4pm.",
    description_es: "Oficina de campo de la SSA que atiende al Condado de Fayette y el centro de Kentucky. Reemplace la tarjeta del Seguro Social y solicite beneficios. Horario: lunes a viernes, 9am–4pm.",
    address: "2241 Buena Vista Road, Suite 110",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(866) 530-7754",
    website: "https://ssa.gov",
  },
  {
    id: 205,
    name: "Social Security Administration — Locate an Office",
    category: "ID & Documentation",
    description: "Find the nearest SSA office anywhere in Kentucky. A Social Security card is needed to obtain a driver's license or state ID and for employment.",
    description_es: "Encuentre la oficina de la SSA más cercana en cualquier parte de Kentucky. Se necesita una tarjeta del Seguro Social para obtener una licencia de conducir o identificación estatal y para el empleo.",
    region: "Statewide",
    phone: "1-800-772-1213",
    website: "https://ssa.gov/locator",
  },

  // ── FINANCIAL ASSISTANCE ─────────────────────────────────────────────────────
  {
    id: 220,
    name: "LIHEAP — Utility Assistance (Community Action Kentucky)",
    category: "Financial Assistance",
    description: "Low Income Home Energy Assistance Program administered through local Community Action Agencies in all 120 Kentucky counties. Helps with heating, cooling, and crisis utility bills for low-income households.",
    description_es: "Programa de Asistencia de Energía para Hogares de Bajos Ingresos administrado a través de Agencias de Acción Comunitaria local en los 120 condados de Kentucky. Ayuda con facturas de servicios públicos de calefacción, refrigeración y crisis para hogares de bajos ingresos.",
    region: "Statewide",
    phone: "1-800-456-3452",
    website: "https://capky.org",
    notes: "Call to find your local Community Action office",
  },
  {
    id: 221,
    name: "Northern Kentucky Community Action Commission (NKCAC)",
    category: "Financial Assistance",
    description: "Administers LIHEAP and other financial assistance programs in Northern Kentucky. Also provides early childhood education, job training, adult education, and crisis assistance.",
    description_es: "Administra LIHEAP y otros programas de asistencia financiera en el norte de Kentucky. También proporciona educación temprana de la infancia, capacitación laboral, educación para adultos y asistencia en crisis.",
    address: "717 Madison Avenue",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 581-6607",
    website: "https://nkcac.org",
    notes: "LIHEAP line: (859) 655-2959",
  },
  {
    id: 222,
    name: "kynect — KTAP & Financial Assistance",
    category: "Financial Assistance",
    description: "Apply for Kentucky Transitional Assistance Program (KTAP cash assistance), Child Care Assistance Program, and other financial benefits through the state kynect portal.",
    description_es: "Solicite el Programa de Asistencia Transitoria de Kentucky (asistencia en efectivo KTAP), el Programa de Asistencia para el Cuidado de Niños y otros beneficios financieros a través del portal estatal kynect.",
    region: "Statewide",
    phone: "1-855-306-8959",
    website: "https://kynect.ky.gov",
  },
  {
    id: 223,
    name: "211 Kentucky — Crisis Resource Navigation",
    category: "Financial Assistance",
    description: "Dial 2-1-1 or text your zip code to 898-211 to connect with a local specialist who can find emergency financial assistance, food, housing, and other community resources in your area of Kentucky. Available 24/7.",
    description_es: "Marque 2-1-1 o envíe un mensaje de texto con su código postal al 898-211 para conectarse con un especialista local que pueda encontrar asistencia financiera de emergencia, alimentos, vivienda y otros recursos comunitarios en su área de Kentucky. Disponible las 24 horas.",
    region: "Statewide",
    phone: "211",
    website: "https://211.org",
  },
  {
    id: 224,
    name: "Bank On Louisville — Second-Chance Banking",
    category: "Financial Assistance",
    description: "City program connecting residents — including those with ChexSystems history from past banking problems — to certified low-cost, low-fee checking accounts at mainstream financial institutions. Participating banks include Bank of America, Chase, Fifth Third, PNC, US Bank, and others. No overdraft fees, $5 or less per month.",
    description_es: "Programa de la ciudad que conecta a los residentes, incluidos aquellos con historial en ChexSystems por problemas bancarios pasados, con cuentas corrientes certificadas de bajo costo en instituciones financieras convencionales. Los bancos participantes incluyen Bank of America, Chase, Fifth Third, PNC, US Bank y otros. Sin cargos por sobregiro, $5 o menos por mes.",
    region: "Louisville / Jefferson County",
    phone: "(502) 574-1969",
    email: "bankonlouisville@louisvilleky.gov",
    website: "https://bankonlouisville.org",
  },
  {
    id: 225,
    name: "Commonwealth Credit Union — 20/20 Checking",
    category: "Financial Assistance",
    description: "Second-chance checking account for people with negative banking history. Based in Lexington and serving Central Kentucky. Provides a fresh start for those who have been turned away by traditional banks.",
    description_es: "Cuenta corriente de segunda oportunidad para personas con historial bancario negativo. Con sede en Lexington, atendiendo al centro de Kentucky. Proporciona un nuevo comienzo para quienes han sido rechazados por bancos tradicionales.",
    city: "Lexington",
    region: "Lexington / Fayette County",
    website: "https://ccuky.org",
  },

  // ── TRANSPORTATION ───────────────────────────────────────────────────────────
  {
    id: 240,
    name: "Transit Authority of River City (TARC) — Louisville",
    category: "Transportation",
    description: "Public bus transit for Louisville and Jefferson County. 24 routes serving 3,458+ stops. Primary transportation option for people without vehicles in Louisville.",
    description_es: "Transporte público en autobús para Louisville y el Condado de Jefferson. 24 rutas que atienden más de 3,458 paradas. Principal opción de transporte para personas sin vehículo en Louisville.",
    address: "1000 West Broadway",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 585-1234",
    website: "https://ridetarc.org",
  },
  {
    id: 241,
    name: "Lextran — Lexington Public Transit",
    category: "Transportation",
    description: "Public bus system serving Lexington and Fayette County. Operates 7 days a week, 5am–midnight. Hub at Lexington Transit Center, 220 East Vine Street.",
    description_es: "Sistema de autobús público que atiende a Lexington y el Condado de Fayette. Opera 7 días a la semana, de 5am a medianoche. Centro en la Terminal de Tránsito de Lexington, 220 East Vine Street.",
    address: "200 West Loudon Avenue",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 253-4636",
    website: "https://lextran.com",
  },
  {
    id: 242,
    name: "TANK — Transit Authority of Northern Kentucky",
    category: "Transportation",
    description: "Public transit serving Boone, Kenton, and Campbell counties in Northern Kentucky with connections to Cincinnati.",
    description_es: "Transporte público que atiende a los condados de Boone, Kenton y Campbell en el norte de Kentucky con conexiones a Cincinnati.",
    city: "Covington",
    region: "Northern Kentucky",
    website: "https://tankbus.org",
  },

  // ── FAMILY & CHILDREN ────────────────────────────────────────────────────────
  {
    id: 260,
    name: "Kentucky Child Support Services — Attorney General",
    category: "Family & Children",
    description: "As of July 1, 2025, Kentucky's child support program is administered by the Office of Attorney General. Handles child support orders, modification, enforcement, and payment tracking statewide.",
    description_es: "A partir del 1 de julio de 2025, el programa de manutención de menores de Kentucky es administrado por la Oficina del Fiscal General. Maneja órdenes de manutención de menores, modificaciones, ejecución y seguimiento de pagos en todo el estado.",
    region: "Statewide",
    phone: "1-800-248-1163",
    website: "https://kentuckychildsupport.ky.gov",
  },
  {
    id: 261,
    name: "Louisville Metro Child Support Division",
    category: "Family & Children",
    description: "Child support services for Jefferson County residents. Hours: Monday–Friday 8:30am–4:30pm.",
    description_es: "Servicios de manutención de menores para residentes del Condado de Jefferson. Horario: lunes a viernes, 8:30am–4:30pm.",
    address: "1930 Bishop Lane, Suite 100",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 574-8300",
  },
  {
    id: 262,
    name: "KVC Kentucky — Family Reunification Services",
    category: "Family & Children",
    description: "Nonprofit providing Family First Prevention and Reunification Services to help families stay together and reunify children who have been removed. Serves more than 12,000 children and families annually in eight Kentucky regions.",
    description_es: "Organización sin fines de lucro que proporciona Servicios de Preservación y Reunificación Familiar para ayudar a las familias a permanecer juntas y reunificar a los niños que han sido separados. Atiende a más de 12,000 niños y familias anualmente en ocho regiones de Kentucky.",
    address: "2250 Thunderstick Drive",
    city: "Lexington",
    region: "Statewide",
    phone: "(859) 254-1035",
    website: "https://kentucky.kvc.org",
  },
  {
    id: 263,
    name: "Center for Women and Families — Louisville",
    category: "Family & Children",
    description: "24/7 trauma-informed advocacy and support for individuals and families affected by intimate partner violence and sexual assault. 24/7 crisis advocates and emergency shelter available. Highly relevant for women leaving incarceration with a history of domestic violence.",
    description_es: "Defensa y apoyo informado sobre trauma disponible las 24 horas para personas y familias afectadas por violencia de pareja íntima y agresión sexual. Defensores de crisis y refugio de emergencia disponibles las 24 horas. Muy relevante para mujeres que salen del encarcelamiento con historial de violencia doméstica.",
    address: "927 South 2nd Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 581-7222",
    website: "https://thecenteronline.org",
  },

  // ── PEER SUPPORT ─────────────────────────────────────────────────────────────
  {
    id: 280,
    name: "Reflections of Hope",
    category: "Peer Support",
    description: "Organization operating inside the justice system providing certification programs and peer support to prepare individuals for reentry and reduce recidivism. Offers Adult Peer Support Specialist training certified in both Kentucky and Ohio.",
    description_es: "Organización que opera dentro del sistema judicial que proporciona programas de certificación y apoyo entre pares para preparar a las personas para la reinserción y reducir la reincidencia. Ofrece capacitación de Especialista en Apoyo entre Pares para Adultos certificada en Kentucky y Ohio.",
    region: "Statewide",
    website: "https://reflecthope.org",
  },
  {
    id: 281,
    name: "EKCEP — Peer Recovery Coaches (Eastern KY)",
    category: "Peer Support",
    description: "Provides peer-informed recovery and reentry services in 23 Appalachian counties through the SITE program. Recovery coaches connect justice-involved individuals with workforce services, benefits, and community supports.",
    description_es: "Proporciona servicios de recuperación y reinserción informados por pares en 23 condados del Apalache a través del programa SITE. Los entrenadores de recuperación conectan a las personas involucradas con el sistema de justicia con servicios de empleo, beneficios y apoyos comunitarios.",
    city: "Hazard",
    region: "Eastern Kentucky",
    phone: "(606) 436-5751",
    website: "https://ekcep.org/recovery",
  },
  {
    id: 282,
    name: "Baptist Fellowship Center — Reentry Mentor Program",
    category: "Peer Support",
    description: "Works with the Kentucky Department of Corrections to identify and train reentry mentors who assist people reintegrating after incarceration. Faith-based community support and accountability.",
    description_es: "Trabaja con el Departamento de Correcciones de Kentucky para identificar y capacitar a mentores de reinserción que ayuden a las personas a reintegrarse después del encarcelamiento. Apoyo comunitario de base religiosa y responsabilidad.",
    address: "1351 Catalpa Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 774-2734",
    email: "bfc@bfcenter.org",
    website: "https://bfcenterky.org",
  },
  {
    id: 283,
    name: "NA / Narcotics Anonymous — Kentucky",
    category: "Peer Support",
    description: "Free peer support meetings for people in recovery from addiction. Meetings available across all Kentucky counties, including in-person and online options. No dues or fees.",
    description_es: "Reuniones gratuitas de apoyo entre pares para personas en recuperación de la adicción. Reuniones disponibles en todos los condados de Kentucky, incluidas opciones en persona y en línea. Sin cuotas ni tarifas.",
    region: "Statewide",
    website: "https://naky.org",
    notes: "Meeting finder: naky.org/find-a-meeting",
  },
  {
    id: 284,
    name: "AA / Alcoholics Anonymous — Kentucky",
    category: "Peer Support",
    description: "Free peer support meetings for people in recovery from alcohol use. Meetings available statewide including online options. No dues or fees.",
    description_es: "Reuniones gratuitas de apoyo entre pares para personas en recuperación del uso de alcohol. Reuniones disponibles en todo el estado, incluidas opciones en línea. Sin cuotas ni tarifas.",
    region: "Statewide",
    website: "https://aa-ky.org",
  },

  // ── EDUCATION ────────────────────────────────────────────────────────────────
  {
    id: 300,
    name: "KCTCS — Adult Education & GED (Statewide)",
    category: "Education",
    description: "Kentucky Community and Technical College System administers free GED preparation and testing statewide through 13 college providers. GED testing fees waived for first-time test takers in Kentucky. Classes held in communities, jails, and prisons. Over 4,460 GEDs awarded to incarcerated individuals 2020–2024.",
    description_es: "El Sistema de Colegios Comunitarios y Técnicos de Kentucky administra la preparación gratuita para el GED y pruebas en todo el estado a través de 13 proveedores universitarios. Las tarifas de las pruebas del GED son exoneradas para los primeros solicitantes en Kentucky. Clases impartidas en comunidades, cárceles y prisiones. Más de 4,460 GEDs otorgados a personas encarceladas de 2020 a 2024.",
    region: "Statewide",
    website: "https://kctcs.edu/education-training/initiatives/adult-education.aspx",
    notes: "Contact your local KCTCS college to find the nearest program",
  },
  {
    id: 301,
    name: "Bluegrass Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation classes for adults in Central Kentucky. In-person and online options available. Serves Fayette, Bourbon, Clark, Harrison, Jessamine, Mercer, Scott, and Woodford counties.",
    description_es: "Clases gratuitas de preparación para el GED para adultos en el centro de Kentucky. Opciones en persona y en línea disponibles. Atiende a los condados de Fayette, Bourbon, Clark, Harrison, Jessamine, Mercer, Scott y Woodford.",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 246-6806",
    email: "BCTCAdultEd@kctcs.edu",
    website: "https://bluegrass.kctcs.edu/education-training/adult-education",
  },
  {
    id: 302,
    name: "Gateway Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation classes in Northern Kentucky. Serves Boone, Kenton, Campbell, Grant, Owen, and surrounding counties.",
    description_es: "Clases gratuitas de preparación para el GED en el norte de Kentucky. Atiende a los condados de Boone, Kenton, Campbell, Grant, Owen y circundantes.",
    address: "500 Technology Way",
    city: "Florence",
    region: "Northern Kentucky",
    phone: "(859) 442-1695",
    website: "https://gateway.kctcs.edu/commons/adult-education.aspx",
  },
  {
    id: 303,
    name: "South Central KY CTC (SKYCTC) — Adult Education",
    category: "Education",
    description: "Free GED preparation classes serving Warren, Barren, Simpson, and Metcalfe counties in south-central Kentucky.",
    description_es: "Clases gratuitas de preparación para el GED que atienden a los condados de Warren, Barren, Simpson y Metcalfe en el centro-sur de Kentucky.",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 901-1017",
    website: "https://southcentral.kctcs.edu/workforce-solutions/adult-education",
  },
  {
    id: 304,
    name: "Kentucky Adult Education — Find a Program",
    category: "Education",
    description: "Find free adult education (GED, literacy, ESL, workforce skills) programs across all 120 Kentucky counties through the state's adult education locator.",
    description_es: "Encuentre programas gratuitos de educación para adultos (GED, alfabetización, ESL, habilidades laborales) en los 120 condados de Kentucky a través del localizador de educación para adultos del estado.",
    region: "Statewide",
    website: "https://adulted.ky.gov",
  },

  // ── VETERANS ─────────────────────────────────────────────────────────────────
  {
    id: 400,
    name: "Robley Rex VA Medical Center — Louisville",
    category: "Veterans",
    description: "Full-service VA hospital serving Louisville-area veterans. Includes substance use treatment, mental health, primary care, and Veterans Justice Outreach services for justice-involved veterans. Open 24/7.",
    description_es: "Hospital del VA de servicio completo que atiende a veteranos del área de Louisville. Incluye tratamiento de uso de sustancias, salud mental, atención primaria y servicios de Alcance de Justicia para Veteranos. Abierto las 24 horas.",
    address: "800 Zorn Avenue",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 287-4000",
    website: "https://va.gov/louisville-health-care",
  },
  {
    id: 401,
    name: "Louisville VA — Veterans Justice Outreach (VJO)",
    category: "Veterans",
    description: "Four VJO coordinators embedded at the Robley Rex VA work directly with courts, jails, and probation/parole to connect justice-involved veterans to VA services. Ask for Mental Health/VJO when calling.",
    description_es: "Cuatro coordinadores de VJO integrados en el VA Robley Rex trabajan directamente con tribunales, cárceles y libertad condicional/vigilada para conectar a los veteranos involucrados con el sistema de justicia con los servicios del VA. Solicite Salud Mental/VJO al llamar.",
    address: "800 Zorn Avenue",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 287-4000",
    website: "https://va.gov/louisville-health-care",
    notes: "VJO emails: sonny.hatfield@va.gov | scott.huisman@va.gov | dawne.james@va.gov | Keather.Likins@va.gov",
  },
  {
    id: 402,
    name: "Lexington VA Medical Center",
    category: "Veterans",
    description: "Full-service VA system for Central and Eastern Kentucky veterans. Located on Leestown and Sousley campuses.",
    description_es: "Sistema del VA de servicio completo para veteranos del centro y el este de Kentucky. Ubicado en los campus Leestown y Sousley.",
    address: "1101 Veterans Way",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 281-4900",
    website: "https://va.gov/lexington-health-care",
  },
  {
    id: 403,
    name: "Lexington VA — Veterans Justice Outreach (VJO)",
    category: "Veterans",
    description: "VJO coordinators at the Lexington VA connect justice-involved veterans in Central and Eastern Kentucky to VA services through courts and jails.",
    description_es: "Los coordinadores de VJO en el VA de Lexington conectan a los veteranos involucrados con el sistema de justicia en el centro y el este de Kentucky con los servicios del VA a través de tribunales y cárceles.",
    address: "1101 Veterans Way",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 281-4900",
    notes: "VJO emails: kathy.vasquez2@va.gov | janis.skilling@va.gov",
  },
  {
    id: 404,
    name: "National Call Center for Homeless Veterans",
    category: "Veterans",
    description: "Free, confidential 24/7 hotline. Connects veterans leaving incarceration who need housing to the nearest VA homeless program. Critical first contact for veterans without a place to stay after release.",
    description_es: "Línea de ayuda gratuita, confidencial y disponible las 24 horas. Conecta a los veteranos que salen del encarcelamiento y necesitan vivienda con el programa de vivienda para veteranos sin hogar del VA más cercano. Primer contacto esencial para veteranos sin un lugar donde quedarse después de la liberación.",
    region: "Statewide",
    phone: "1-877-424-3838",
    website: "https://va.gov/homeless",
  },
  {
    id: 405,
    name: "Veterans Crisis Line",
    category: "Veterans",
    description: "Free, confidential crisis support for veterans 24/7. Call or text 988 then press 1. Chat at veteranscrisisline.net.",
    description_es: "Apoyo gratuito y confidencial en crisis para veteranos las 24 horas. Llame o envíe un mensaje de texto al 988 y luego presione 1. Chat en veteranscrisisline.net.",
    region: "Statewide",
    phone: "988 (press 1)",
    website: "https://veteranscrisisline.net",
  },
  {
    id: 406,
    name: "Louisville Vet Center",
    category: "Veterans",
    description: "Non-VA community setting offering counseling, PTSD treatment, MST support, reentry navigation, and job training — at no cost to veterans. Easier to access than a VA Medical Center.",
    description_es: "Entorno comunitario no perteneciente al VA que ofrece asesoramiento, tratamiento de TEPT, apoyo por MST, orientación de reinserción y capacitación laboral, sin costo para los veteranos. Más fácil de acceder que un Centro Médico del VA.",
    address: "1347 South Third Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "1-877-927-8387",
    website: "https://va.gov/louisville-vet-center",
    notes: "Hours: Mon–Fri 8am–4:30pm. 24/7 crisis support at same number.",
  },
  {
    id: 407,
    name: "Lexington Vet Center",
    category: "Veterans",
    description: "Counseling and reentry support in a non-clinical setting for veterans in Central Kentucky. Satellite locations in Corbin, Lawrenceburg, London, Mt. Sterling, and Richmond.",
    description_es: "Asesoramiento y apoyo para la reinserción en un entorno no clínico para veteranos en el centro de Kentucky. Ubicaciones satélite en Corbin, Lawrenceburg, London, Mt. Sterling y Richmond.",
    address: "1500 Leestown Road, Suite 104",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "1-877-927-8387",
    website: "https://va.gov/lexington-vet-center",
  },
  {
    id: 408,
    name: "Louisville VA Regional Benefit Office",
    category: "Veterans",
    description: "Handles disability claims, vocational rehabilitation (Chapter 31), education benefits, and employment assistance for veterans in Kentucky. Hours: Mon–Fri 8am–4pm.",
    description_es: "Maneja reclamaciones de discapacidad, rehabilitación vocacional (Capítulo 31), beneficios educativos y asistencia para el empleo para veteranos en Kentucky. Horario: lunes a viernes, 8am–4pm.",
    address: "321 West Main Street, Suite 390",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(800) 827-1000",
    website: "https://benefits.va.gov/louisville",
    notes: "Chapter 31 Voc Rehab: (502) 566-4453",
  },
  {
    id: 409,
    name: "HUD-VASH — Housing Vouchers for Homeless Veterans",
    category: "Veterans",
    description: "Pairs HUD rental vouchers with VA case management for homeless veterans. Access begins at the VA Medical Center. Louisville Metro Housing Authority administers vouchers locally. VOA Mid-States also administers SSVF (Supportive Services for Veterans and Families) in Kentucky.",
    description_es: "Combina vales de alquiler HUD con gestión de casos del VA para veteranos sin hogar. El acceso comienza en el Centro Médico del VA. La Autoridad de Vivienda de Louisville Metro administra los vales localmente. VOA Mid-States también administra SSVF (Servicios de Apoyo para Veteranos y Familias) en Kentucky.",
    region: "Statewide",
    phone: "(502) 287-4000",
    website: "https://va.gov/homeless/hud-vash/",
    notes: "Louisville Metro Housing Authority: (502) 569-6060 | VOA SSVF: (502) 384-0868",
  },
  {
    id: 410,
    name: "Kentucky Department of Veterans Affairs (KDVA)",
    category: "Veterans",
    description: "State agency with 20 federally accredited VSOs statewide. Offers Veterans High School Diploma Program, Homeless Veterans Program, Women Veterans Program, and benefits assistance.",
    description_es: "Agencia estatal con 20 representantes de servicios para veteranos acreditados federalmente en todo el estado. Ofrece el Programa de Diploma de Escuela Secundaria para Veteranos, Programa para Veteranos sin Hogar, Programa para Mujeres Veteranas y asistencia con beneficios.",
    address: "1111B Louisville Road",
    city: "Frankfort",
    region: "Statewide",
    phone: "(502) 564-9203",
    website: "https://veterans.ky.gov",
  },
  {
    id: 411,
    name: "VFW Department of Kentucky",
    category: "Veterans",
    description: "Free VA-accredited service officers help veterans file disability, pension, rehabilitation, and employment benefit claims. Post-level VSOs located throughout the state.",
    description_es: "Oficiales de servicio acreditados por el VA gratuitos ayudan a los veteranos a presentar reclamaciones de discapacidad, pensión, rehabilitación y beneficios de empleo. Representantes locales ubicados en todo el estado.",
    address: "3031 Poplar Level Road",
    city: "Louisville",
    region: "Statewide",
    phone: "(502) 635-2638",
    email: "vfwdeptky@gmail.com",
    website: "https://vfwky.org",
  },
  {
    id: 412,
    name: "Kentucky American Legion",
    category: "Veterans",
    description: "VSO network providing free claims assistance and benefits navigation for veterans statewide. Local posts throughout all 120 counties.",
    description_es: "Red de representantes de servicios para veteranos que proporciona asistencia gratuita en reclamaciones y orientación en beneficios en todo el estado. Publicaciones locales en los 120 condados.",
    address: "970 South 4th Street",
    city: "Louisville",
    region: "Statewide",
    phone: "(502) 587-1414",
    website: "https://kylegion.org",
  },

  // ── BASIC NEEDS ───────────────────────────────────────────────────────────────
  {
    id: 430,
    name: "Wayside Christian Mission — Louisville",
    category: "Basic Needs",
    description: "Provides clothing, hygiene supplies, meals, and emergency shelter for men and women. Sober Living Recovery Program and Work Therapy Program also available. Accepts and distributes donated clothing and toiletries to clients.",
    description_es: "Proporciona ropa, artículos de higiene, comidas y refugio de emergencia para hombres y mujeres. También disponible el Programa de Vida Sobria y el Programa de Terapia Laboral. Acepta y distribuye ropa donada y artículos de tocador a los clientes.",
    address: "432 East Jefferson Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-3711",
    website: "https://waysidechristianmission.org",
  },
  {
    id: 431,
    name: "St. Vincent de Paul — Louisville",
    category: "Basic Needs",
    description: "Client-choice food pantry, Open Hand Kitchen, Ozanam Inn men's emergency shelter (58 beds, 24/7 case management), emergency financial assistance, and thrift stores selling affordable clothing and household items.",
    description_es: "Despensa de alimentos de elección del cliente, Open Hand Kitchen, refugio de emergencia para hombres Ozanam Inn (58 camas, gestión de casos las 24 horas), asistencia financiera de emergencia y tiendas de segunda mano con ropa y artículos para el hogar asequibles.",
    address: "1015-C South Preston Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-2480",
    website: "https://svdplou.org",
  },
  {
    id: 432,
    name: "Dress for Success Louisville — Women's Clothing & Career Support",
    category: "Basic Needs",
    description: "Professional attire, career coaching, and support services for women entering or re-entering the workforce. Referral required from a partner agency (Goodwill KY, Louisville Urban League, KY Career Centers, and others). Over 16,500 women served.",
    description_es: "Ropa profesional, orientación profesional y servicios de apoyo para mujeres que ingresan o regresan al mercado laboral. Se requiere referencia de una agencia asociada (Goodwill KY, Louisville Urban League, KY Career Centers y otras). Más de 16,500 mujeres atendidas.",
    address: "2722 Crittenden Drive LL200",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 584-8050",
    email: "louisville@dressforsuccess.org",
    website: "https://louisville.dressforsuccess.org",
    notes: "Referral required from a partner agency",
  },

  // ── PROBATION & PAROLE ───────────────────────────────────────────────────────
  {
    id: 450,
    name: "Kentucky Division of Probation and Parole — Central Office",
    category: "Probation & Parole",
    description: "Oversees all probation and parole supervision across Kentucky. Contact for general questions or to be directed to your local district office.",
    description_es: "Supervisa toda la supervisión de libertad condicional y vigilada en Kentucky. Comuníquese para preguntas generales o para que lo dirijan a su oficina de distrito local.",
    city: "Frankfort",
    region: "Frankfort / Franklin County",
    phone: "(502) 782-2277",
    website: "https://corrections.ky.gov/Probation-and-Parole",
  },
  {
    id: 451,
    name: "Probation & Parole — Louisville (Jefferson County)",
    category: "Probation & Parole",
    description: "Multiple P&P districts serve Jefferson County. Primary reporting location for most Louisville-area parolees and probationers.",
    description_es: "Múltiples distritos de libertad condicional y vigilada atienden al Condado de Jefferson. Ubicación de reporte principal para la mayoría de los liberados condicionales y vigilados en el área de Louisville.",
    address: "410 West Chestnut Street, 7th Floor",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 896-1775",
  },
  {
    id: 452,
    name: "Probation & Parole — Lexington (Fayette County)",
    category: "Probation & Parole",
    description: "District 9 probation and parole office serving Fayette County and surrounding area.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 9 que atiende al Condado de Fayette y el área circundante.",
    address: "2008 Mercer Road",
    city: "Lexington",
    region: "Lexington / Fayette County",
    phone: "(859) 246-2177",
  },
  {
    id: 453,
    name: "Probation & Parole — Covington (Northern KY)",
    category: "Probation & Parole",
    description: "District 7 probation and parole office serving Kenton County and Northern Kentucky.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 7 que atiende al Condado de Kenton y el norte de Kentucky.",
    address: "303 Court Street, Suite 706",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 292-6555",
  },
  {
    id: 454,
    name: "Probation & Parole — Bowling Green (Warren County)",
    category: "Probation & Parole",
    description: "District 3 probation and parole office serving Warren, Adair, Barren, Casey, Cumberland, and Metcalfe counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 3 que atiende a los condados de Warren, Adair, Barren, Casey, Cumberland y Metcalfe.",
    address: "140 Old Porter Pike, Unit #8",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 746-7420",
  },
  {
    id: 455,
    name: "Probation & Parole — Paducah (Western KY)",
    category: "Probation & Parole",
    description: "District 1 probation and parole office serving McCracken County and surrounding Western Kentucky counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 1 que atiende al Condado de McCracken y los condados circundantes del oeste de Kentucky.",
    address: "400 South 6th Street",
    city: "Paducah",
    region: "Paducah / Western Kentucky",
    phone: "(270) 575-7235",
  },
  {
    id: 456,
    name: "Probation & Parole — Pikeville (Eastern KY)",
    category: "Probation & Parole",
    description: "District 11 probation and parole office serving Pike County and surrounding Eastern Kentucky.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 11 que atiende al Condado de Pike y el este de Kentucky circundante.",
    address: "172 Division Street",
    city: "Pikeville",
    region: "Eastern Kentucky",
    phone: "(606) 889-1694",
  },

  // ── REENTRY ORGANIZATIONS ────────────────────────────────────────────────────
  {
    id: 470,
    name: "Center for Employment Opportunities (CEO) — Louisville",
    category: "Reentry Organizations",
    description: "National reentry employment nonprofit exclusively serving people recently returned from incarceration (probation or parole required). Provides one-week job-readiness orientation, paid transitional work with daily pay, job coaching, placement, and retention support.",
    description_es: "Organización nacional de empleo para la reinserción que atiende exclusivamente a personas recién liberadas del encarcelamiento (se requiere libertad condicional o vigilada). Proporciona orientación de preparación laboral de una semana, trabajo de transición pagado con pago diario, orientación laboral, colocación y apoyo para la retención.",
    address: "321 Guthrie Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 694-7878",
    email: "sshabazz@ceoworks.org",
    website: "https://ceoworks.org/locations/louisville",
    notes: "Hours: Mon–Fri 8:30am–4:30pm",
  },
  {
    id: 471,
    name: "Louisville Metro Reentry Task Force",
    category: "Reentry Organizations",
    description: "Louisville-based coalition coordinating reentry services across agencies. Connects individuals with local resources and maintains a resource platform for service providers.",
    description_es: "Coalición con sede en Louisville que coordina los servicios de reinserción entre las agencias. Conecta a las personas con recursos locales y mantiene una plataforma de recursos para los proveedores de servicios.",
    region: "Louisville / Jefferson County",
    phone: "(502) 290-2725",
    email: "glenn@louisvillereentry.org",
    website: "https://louisvillereentry.org",
  },
  {
    id: 472,
    name: "Louisville Metro Criminal Justice Commission — Reentry Toolkit",
    category: "Reentry Organizations",
    description: "Operates the Kentucky Reentry Toolkit — a free online resource platform with a dedicated reentry coordinator. Provides life skills resources, case coordination, and connection to services across Louisville Metro.",
    description_es: "Opera la Herramienta de Reinserción de Kentucky, una plataforma de recursos en línea gratuita con un coordinador de reinserción dedicado. Proporciona recursos de habilidades para la vida, coordinación de casos y conexión con servicios en Louisville Metro.",
    address: "514 West Liberty Street, Suite 106",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 574-5088",
    website: "https://reentrytool.ky.gov",
  },
  {
    id: 473,
    name: "Louisville Urban League — Workforce Development Center",
    category: "Reentry Organizations",
    description: "Career counseling, case management, job readiness training, job placement referrals, and post-placement support for individuals facing employment barriers. Partners with Dress for Success for women. Serves Louisville Metro.",
    description_es: "Orientación profesional, gestión de casos, capacitación para la preparación laboral, referencias de colocación laboral y apoyo posterior a la colocación para personas que enfrentan barreras de empleo. Asociado con Dress for Success para mujeres. Atiende a Louisville Metro.",
    address: "1535 West Broadway",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 585-4622",
    website: "https://lul.org",
  },
  {
    id: 474,
    name: "AMPED Louisville",
    category: "Reentry Organizations",
    description: "Nonprofit serving Black and Latinx communities in Louisville through technology workforce training, small business incubation, and economic mobility programming for marginalized communities including those with justice involvement.",
    description_es: "Organización sin fines de lucro que atiende a comunidades negras y latinas en Louisville a través de capacitación en tecnología, incubación de pequeñas empresas y programación de movilidad económica para comunidades marginadas, incluidas aquellas con participación judicial.",
    address: "1701 West Market Street",
    city: "Louisville",
    region: "Louisville / Jefferson County",
    phone: "(502) 822-1953",
    email: "AMPEDLouisville@gmail.com",
    website: "https://ampedlouisville.org",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  return phone.replace(/[^+\d]/g, "");
}

function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────

const KY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    Icon: BookOpen,
    title: "Welcome to the Kentucky Directory",
    body: `This directory has ${RESOURCES.length} resources for housing, employment, healthcare, legal aid, and more — for people re-entering from incarceration.`,
    targetId: null,
  },
  {
    Icon: Search,
    title: "Search anything",
    body: "Type any keyword — a resource name, city, phone number, or topic — to instantly filter the list.",
    targetId: "ky-search-input",
  },
  {
    Icon: SlidersHorizontal,
    title: "Filter by category",
    body: "Narrow results to one resource type: Housing, Employment, Healthcare, Legal Aid, and more.",
    targetId: "ky-category-select",
  },
  {
    Icon: MapPin,
    title: "Filter by region",
    body: "Focus on resources near you by selecting a region or county of Kentucky.",
    targetId: "ky-region-select",
  },
  {
    Icon: CheckCircle2,
    title: "You're all set",
    body: "Each card shows contact details, address, and website links. Use the search and filters to find exactly what you need.",
    targetId: "ky-first-card",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function KentuckyPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [region, setRegion] = useState<Region | "">("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return RESOURCES.filter((r) => {
      if (category && r.category !== category) return false;
      if (region && r.region !== region) return false;
      if (!q) return true;
      const haystack = normalizeSearch(
        [r.name, r.description, r.description_es, r.address, r.city, r.region, r.phone, r.email, r.website, r.notes]
          .filter(Boolean)
          .join(" ")
      );
      return q.split(" ").every((word) => haystack.includes(word));
    });
  }, [query, category, region]);

  const hasFilters = !!query || !!category || !!region;

  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem("ky-tutorial-seen"); } catch { return true; }
  });

  const closeTutorial = () => {
    try { localStorage.setItem("ky-tutorial-seen", "1"); } catch {}
    setShowTutorial(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showTutorial && (
        <SpotlightTutorial steps={KY_TUTORIAL_STEPS} onComplete={closeTutorial} />
      )}
      <SiteHeader />

      {/* Hero */}
      <section className="bg-foreground text-background px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-medium uppercase tracking-widest opacity-60 mb-2">
            {t("ky.stateLabel")}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            {t("ky.title")}
          </h1>
          <p className="mt-4 text-base sm:text-lg opacity-80 max-w-2xl">
            {t("ky.subtitle")}
          </p>
          <p className="mt-3 text-sm opacity-60">
            {t("ky.resourceCount", {
              count: RESOURCES.length,
              cats: CATEGORIES.length,
              regions: REGIONS.length,
            })}
          </p>
        </div>
      </section>

      {/* Sticky search + filters */}
      <div id="ky-sticky-bar" className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder={t("ky.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              id="ky-search-input"
              className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v === "__all__" ? "" : v as Category)}>
            <SelectTrigger id="ky-category-select" className="sm:w-56 bg-background">
              <SelectValue placeholder={t("ky.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("ky.allCategories")}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{t(CATEGORY_KEY[c])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={(v) => setRegion(v === "__all__" ? "" : v as Region)}>
            <SelectTrigger id="ky-region-select" className="sm:w-60 bg-background">
              <SelectValue placeholder={t("ky.allRegions")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("ky.allRegions")}</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{t(REGION_KEY[r])}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setQuery(""); setCategory(""); setRegion(""); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              {t("ky.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length === RESOURCES.length
            ? t("ky.showingAll", { count: RESOURCES.length })
            : t("ky.showingFiltered", { count: filtered.length, total: RESOURCES.length })}
        </p>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium">{t("ky.noResultsTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("ky.noResultsBody")}</p>
            <button
              type="button"
              onClick={() => { setQuery(""); setCategory(""); setRegion(""); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              {t("ky.clearFilters")}
            </button>
          </div>
        )}

        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
          {filtered.map((r, i) => (
            <div key={r.id} id={i === 0 ? "ky-first-card" : undefined} className="break-inside-avoid mb-6">
              <ResourceCard resource={r} />
            </div>
          ))}
        </div>
      </main>

      {/* Disclaimer */}
      <div className="border-t border-border bg-muted/30 px-4 py-6">
        <p className="mx-auto max-w-4xl text-xs text-muted-foreground text-center leading-relaxed">
          {t("ky.disclaimer")}
        </p>
      </div>

      <SiteFooter />
    </div>
  );
}

// ─── Resource Card ────────────────────────────────────────────────────────────

function ResourceCard({ resource: r }: { resource: Resource }) {
  const { lang, t } = useI18n();
  const description = pickLang(lang, r.description, r.description_es);
  const notes = pickLang(lang, r.notes ?? "", r.notes_es);

  return (
    <div
      className="flex flex-col rounded-xl border border-border bg-card p-5 gap-3 transition-all hover:-translate-y-0.5 hover:border-[var(--card-color)] hover:shadow-[var(--shadow-card)]"
      style={{ "--card-color": CATEGORY_COLOR[r.category] } as React.CSSProperties}
    >
      <BadgeGroup>
        {(() => { const Icon = CATEGORY_ICONS[r.category]; return (
          <span className={`inline-flex items-center leading-none rounded-[8px] border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 gap-1 ${CATEGORY_COLORS[r.category]}`}>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {t(CATEGORY_KEY[r.category])}
          </span>
        ); })()}
        {r.region === "Statewide" && (
          <span className="inline-flex items-center leading-none rounded-[8px] border border-border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 gap-1 bg-muted text-muted-foreground">
            <Globe className="h-3.5 w-3.5" strokeWidth={2} />
            {t("ky.statewide")}
          </span>
        )}
      </BadgeGroup>
      <h2 className="text-base font-semibold leading-snug mt-1">{r.name}</h2>

      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>

      {notes && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{notes}</p>
      )}

      <div className="flex flex-col gap-1.5 pt-3 border-t border-border">
        {(r.address || r.city) && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{[r.address, r.city].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {r.phone && (
          <a
            href={`tel:${formatPhone(r.phone)}`}
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors"
          >
            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
            {r.phone}
          </a>
        )}
        {r.email && (
          <a
            href={`mailto:${r.email}`}
            className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors break-all"
          >
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            {r.email}
          </a>
        )}
        {r.website && (
          <a
            href={r.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline break-all"
          >
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="flex items-center gap-1">
              {r.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </span>
          </a>
        )}
        {!r.address && !r.city && !r.phone && !r.email && !r.website && (
          <span className="text-xs text-muted-foreground italic">{t("ky.noContact")}</span>
        )}
      </div>
    </div>
  );
}
