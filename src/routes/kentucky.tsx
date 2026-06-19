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

  // ── NORTHERN KENTUCKY — COUNTY-SPECIFIC ──────────────────────────────────────
  {
    id: 475,
    name: "Brighton Center — Newport (Campbell County)",
    category: "Reentry Organizations",
    description: "Comprehensive human services nonprofit serving Campbell and surrounding Northern Kentucky counties. Provides workforce development, financial coaching, housing navigation, and family stability services for people facing barriers including justice involvement.",
    description_es: "Organización integral de servicios sociales que atiende al Condado de Campbell y los condados circundantes del norte de Kentucky. Proporciona desarrollo de la fuerza laboral, asesoramiento financiero, orientación de vivienda y servicios de estabilidad familiar para personas con barreras, incluida la participación judicial.",
    address: "741 Central Avenue",
    city: "Newport",
    region: "Northern Kentucky",
    phone: "(859) 491-8303",
    website: "https://brightoncenter.com",
  },
  {
    id: 476,
    name: "Life Learning Center — Covington (Kenton County)",
    category: "Employment",
    description: "Workforce development nonprofit focused on adults facing significant employment barriers including criminal records. Provides job-readiness training, digital literacy, placement assistance, and employer connections in Northern Kentucky.",
    description_es: "Organización sin fines de lucro de desarrollo de la fuerza laboral enfocada en adultos con barreras significativas de empleo, incluidos los antecedentes penales. Proporciona capacitación para la preparación laboral, alfabetización digital, asistencia de colocación y conexiones con empleadores en el norte de Kentucky.",
    address: "629 Madison Avenue",
    city: "Covington",
    region: "Northern Kentucky",
    phone: "(859) 491-8300",
    website: "https://llcnky.com",
  },
  {
    id: 477,
    name: "Connect Ministries — Newport (Campbell County)",
    category: "Peer Support",
    description: "Faith-based community outreach serving justice-involved individuals and those in recovery in Campbell County. Provides mentoring, peer support, basic needs assistance, and connections to housing and employment resources near the Campbell County Detention Center.",
    description_es: "Alcance comunitario de base religiosa que atiende a personas involucradas con el sistema de justicia y en recuperación en el Condado de Campbell. Proporciona tutoría, apoyo entre pares, asistencia de necesidades básicas y conexiones a recursos de vivienda y empleo.",
    address: "21 East 7th Street",
    city: "Newport",
    region: "Northern Kentucky",
    phone: "(859) 261-9911",
    website: "https://connectministriesnky.org",
  },

  // ── NORTHEAST KENTUCKY — COUNTY-SPECIFIC ──────────────────────────────────────
  {
    id: 478,
    name: "Pathways Inc. — Regional Mental Health & Recovery",
    category: "Healthcare",
    description: "Community Mental Health Center serving 14 northeast Kentucky counties: Bath, Boyd, Carter, Elliott, Fleming, Greenup, Lawrence, Lewis, Mason, Menifee, Montgomery, Morgan, Rowan, and Wolfe. Provides mental health, substance use treatment, and crisis services to county jail populations through outreach and in-jail programming. Multiple county offices.",
    description_es: "Centro Comunitario de Salud Mental que atiende a 14 condados del noreste de Kentucky. Proporciona salud mental, tratamiento de uso de sustancias y servicios de crisis para poblaciones de cárceles del condado a través de extensión y programación dentro de las cárceles. Múltiples oficinas en el condado.",
    address: "207 24th Street",
    city: "Ashland",
    region: "Ashland / Boyd County",
    phone: "(606) 324-1141",
    website: "https://pathwaysinc.org",
    notes: "24/7 Crisis Line: (800) 562-8909 | Serves: Boyd, Carter, Greenup, Rowan, Lawrence, Lewis, and 8 other NE KY counties",
  },

  // ── EASTERN KENTUCKY — COUNTY-SPECIFIC ────────────────────────────────────────
  {
    id: 479,
    name: "Addiction Recovery Care (ARC) — Eastern Kentucky",
    category: "Substance Use Treatment",
    description: "One of Eastern Kentucky's largest substance use treatment networks. Operates residential treatment, outpatient, and recovery housing programs across Lawrence, Johnson, Martin, Floyd, Pike, Magoffin, Morgan, Wolfe, and surrounding counties. Recovery-focused reentry services including housing and peer support.",
    description_es: "Una de las redes de tratamiento de uso de sustancias más grandes del este de Kentucky. Opera programas de tratamiento residencial, ambulatorio y vivienda de recuperación en los condados de Lawrence, Johnson, Martin, Floyd, Pike, Magoffin, Morgan, Wolfe y circundantes. Servicios de reinserción centrados en la recuperación.",
    region: "Eastern Kentucky",
    phone: "(606) 638-0938",
    website: "https://arccenters.com",
    notes: "Multiple locations across Eastern KY — call for nearest facility",
  },
  {
    id: 480,
    name: "Mountain Comprehensive Care Center (MCCC)",
    category: "Healthcare",
    description: "Regional Community Mental Health Center serving 14 Eastern Kentucky counties: Breathitt, Floyd, Harlan, Johnson, Knott, Knox, Lawrence, Leslie, Letcher, Magoffin, Martin, Morgan, Perry, and Pike. Provides mental health, substance use, and crisis services. Offers in-jail mental health screening and linkage at multiple county detention centers.",
    description_es: "Centro Regional de Salud Mental Comunitario que atiende a 14 condados del este de Kentucky: Breathitt, Floyd, Harlan, Johnson, Knott, Knox, Lawrence, Leslie, Letcher, Magoffin, Martin, Morgan, Perry y Pike. Proporciona salud mental, uso de sustancias y servicios de crisis. Ofrece evaluación de salud mental en cárceles y vinculación.",
    region: "Eastern Kentucky",
    phone: "(606) 886-8572",
    website: "https://mcccare.com",
    notes: "Crisis Line: (800) 262-7491 | Locations in Prestonsburg, Hazard, Whitesburg, Harlan, Pikeville, and more",
  },
  {
    id: 481,
    name: "Big Sandy Area Community Action Program (BSAACAP)",
    category: "Basic Needs",
    description: "Community action agency serving Floyd, Johnson, Lawrence, Magoffin, Martin, and Pike counties in Eastern Kentucky. Provides housing assistance, utility help, food programs, emergency aid, and reentry-related case management for individuals leaving local jails. Closest agency to the Big Sandy Regional Jail.",
    description_es: "Agencia de acción comunitaria que atiende a los condados de Floyd, Johnson, Lawrence, Magoffin, Martin y Pike en el este de Kentucky. Proporciona asistencia de vivienda, ayuda con servicios públicos, programas de alimentos, ayuda de emergencia y gestión de casos relacionada con la reinserción.",
    address: "333 South Lake Drive",
    city: "Prestonsburg",
    region: "Eastern Kentucky",
    phone: "(606) 886-2374",
    website: "https://bsaacap.org",
  },
  {
    id: 482,
    name: "Appalachian Citizens' Law Center — Whitesburg (Letcher County)",
    category: "Legal Aid",
    description: "Nonprofit law firm providing free civil legal representation to low-income clients in Eastern Kentucky with a focus on Letcher, Harlan, Perry, Floyd, and Pike counties. Handles civil rights, housing, benefits, and expungement matters for individuals with justice involvement.",
    description_es: "Firma de abogados sin fines de lucro que proporciona representación legal civil gratuita a clientes de bajos ingresos en el este de Kentucky con un enfoque en los condados de Letcher, Harlan, Perry, Floyd y Pike. Maneja derechos civiles, vivienda, beneficios y eliminación de antecedentes penales.",
    address: "317 Main Street",
    city: "Whitesburg",
    region: "Eastern Kentucky",
    phone: "(606) 633-3929",
    website: "https://aclc.net",
    notes: "Also assists with black lung, mine safety, and workers' rights",
  },
  {
    id: 483,
    name: "Cumberland River Behavioral Health — Southeastern Kentucky",
    category: "Healthcare",
    description: "Community Mental Health Center serving Bell, Clay, Harlan, Jackson, Knox, Laurel, McCreary, Rockcastle, Wayne, and Whitley counties in Southeastern Kentucky. Provides mental health, substance use, and crisis intervention services near county jails in Corbin, Barbourville, London, and Williamsburg.",
    description_es: "Centro Comunitario de Salud Mental que atiende a los condados de Bell, Clay, Harlan, Jackson, Knox, Laurel, McCreary, Rockcastle, Wayne y Whitley en el sureste de Kentucky. Proporciona salud mental, uso de sustancias e intervención en crisis cerca de las cárceles del condado.",
    region: "Eastern Kentucky",
    phone: "(606) 528-7010",
    website: "https://crbh.net",
    notes: "24/7 Crisis Line: (800) 315-1246 | Main office: Corbin area | Serves Knox, Whitley, Bell, Harlan, Laurel, and 5 other SE KY counties",
  },
  {
    id: 484,
    name: "Cumberland Valley Area Development District (CVADD)",
    category: "Reentry Organizations",
    description: "Regional planning and service agency for Bell, Clay, Harlan, Jackson, Knox, Laurel, McCreary, Rockcastle, Wayne, and Whitley counties. Coordinates workforce, housing, and transportation resources across the 10-county region. Can connect individuals leaving county jails to area services.",
    description_es: "Agencia regional de planificación y servicios para los condados de Bell, Clay, Harlan, Jackson, Knox, Laurel, McCreary, Rockcastle, Wayne y Whitley. Coordina recursos de fuerza laboral, vivienda y transporte en la región de 10 condados.",
    address: "342 Old Whitley Road",
    city: "London",
    region: "Eastern Kentucky",
    phone: "(606) 864-7391",
    website: "https://cvadd.org",
  },
  {
    id: 485,
    name: "Lake Cumberland Community Action Agency — Somerset (Pulaski County)",
    category: "Basic Needs",
    description: "Community action agency serving Pulaski, Russell, Casey, Clinton, Cumberland, and Wayne counties in south-central Kentucky. Provides emergency assistance, housing aid, utility help, food programs, and case management for individuals leaving the Pulaski County Detention Center and surrounding county jails.",
    description_es: "Agencia de acción comunitaria que atiende a los condados de Pulaski, Russell, Casey, Clinton, Cumberland y Wayne en el centro-sur de Kentucky. Proporciona asistencia de emergencia, ayuda de vivienda, ayuda con servicios públicos, programas de alimentos y gestión de casos para personas que salen de la cárcel del condado.",
    address: "613 Harmon Road",
    city: "Somerset",
    region: "Eastern Kentucky",
    phone: "(606) 451-1700",
    website: "https://lakeaction.org",
  },
  {
    id: 486,
    name: "Probation & Parole — Hazard (Perry County)",
    category: "Probation & Parole",
    description: "District 14 probation and parole office serving Perry and surrounding Eastern Kentucky counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 14 que atiende al Condado de Perry y los condados circundantes del este de Kentucky.",
    address: "500 South Main Street, Suite 107",
    city: "Hazard",
    region: "Eastern Kentucky",
    phone: "(606) 435-6020",
  },
  {
    id: 487,
    name: "Probation & Parole — London (Laurel County)",
    category: "Probation & Parole",
    description: "District 10 probation and parole office serving Laurel, Whitley, Knox, Bell, and surrounding Southeastern Kentucky counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 10 que atiende a los condados de Laurel, Whitley, Knox, Bell y los circundantes del sureste de Kentucky.",
    address: "51 North Main Street",
    city: "London",
    region: "Eastern Kentucky",
    phone: "(606) 864-2187",
  },

  // ── ELIZABETHTOWN / HARDIN COUNTY — EXPANDED ──────────────────────────────────
  {
    id: 488,
    name: "Lincoln Trail Behavioral Health System",
    category: "Healthcare",
    description: "Community Mental Health Center serving Hardin, LaRue, Marion, Meade, and Washington counties. Provides mental health, substance use treatment, and crisis services in the Elizabethtown region. Partners with local county jails for mental health screenings and in-jail programming.",
    description_es: "Centro Comunitario de Salud Mental que atiende a los condados de Hardin, LaRue, Marion, Meade y Washington. Proporciona salud mental, tratamiento de uso de sustancias y servicios de crisis en la región de Elizabethtown. Asociado con cárceles locales para evaluaciones de salud mental.",
    address: "3909 US Highway 60 West",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 769-1304",
    website: "https://ltbhs.com",
    notes: "24/7 Crisis Line: (270) 769-1304",
  },
  {
    id: 489,
    name: "Kentucky Career Center — Elizabethtown",
    category: "Employment",
    description: "American Job Center serving Hardin, LaRue, and surrounding counties. Free job search, resume assistance, skills training referrals, and employer connections for individuals with barriers including criminal records.",
    description_es: "Centro de Trabajo Americano que atiende a los condados de Hardin, LaRue y circundantes. Búsqueda de empleo gratuita, asistencia con currículum, referencias de capacitación en habilidades y conexiones con empleadores para personas con barreras, incluidos antecedentes penales.",
    address: "506 Commerce Drive",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 766-5115",
    website: "https://ltadd.org/workforce-development",
  },
  {
    id: 490,
    name: "Probation & Parole — Elizabethtown (Hardin County)",
    category: "Probation & Parole",
    description: "District 5 probation and parole office serving Hardin, LaRue, Marion, Meade, and Washington counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 5 que atiende a los condados de Hardin, LaRue, Marion, Meade y Washington.",
    address: "422 South Mulberry Street",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 766-5012",
  },
  {
    id: 491,
    name: "LifeSkills Inc. — Elizabethtown",
    category: "Healthcare",
    description: "Community Mental Health Center branch serving Hardin, LaRue, Meade, Breckinridge, and Grayson counties from the Elizabethtown area. Provides mental health, substance use, and crisis services for individuals leaving the Hardin County Detention Center and surrounding facilities.",
    description_es: "Sucursal del Centro Comunitario de Salud Mental que atiende a los condados de Hardin, LaRue, Meade, Breckinridge y Grayson desde el área de Elizabethtown. Proporciona salud mental, uso de sustancias y servicios de crisis.",
    address: "1311 Ring Road",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 769-1832",
    website: "https://lifeskills-inc.org",
    notes: "24/7 Crisis Line: (270) 901-5151 | Main Bowling Green office: (270) 901-5000",
  },

  // ── FRANKFORT / FRANKLIN COUNTY — EXPANDED ────────────────────────────────────
  {
    id: 492,
    name: "Kentucky Career Center — Frankfort",
    category: "Employment",
    description: "American Job Center in Franklin County providing free job search assistance, resume help, career counseling, and training referrals. Also hosts state-level employment services for individuals on probation or parole completing DOC requirements.",
    description_es: "Centro de Trabajo Americano en el Condado de Franklin que proporciona asistencia gratuita para búsqueda de empleo, ayuda con currículum, orientación profesional y referencias de capacitación. También alberga servicios de empleo estatales para personas en libertad condicional o vigilada.",
    address: "921 Cherokee Road",
    city: "Frankfort",
    region: "Frankfort / Franklin County",
    phone: "(502) 564-5566",
    website: "https://frankfortcareercenter.org",
  },
  {
    id: 493,
    name: "Probation & Parole — Frankfort (Franklin County)",
    category: "Probation & Parole",
    description: "District 12 probation and parole office serving Franklin, Anderson, Owen, Carroll, Trimble, Henry, and Shelby counties from the Frankfort area.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 12 que atiende a los condados de Franklin, Anderson, Owen, Carroll, Trimble, Henry y Shelby desde el área de Frankfort.",
    address: "165 East Main Street",
    city: "Frankfort",
    region: "Frankfort / Franklin County",
    phone: "(502) 564-4780",
  },

  // ── WESTERN KENTUCKY — COUNTY-SPECIFIC ────────────────────────────────────────
  {
    id: 494,
    name: "Pennyroyal Center — Hopkinsville (Christian County)",
    category: "Healthcare",
    description: "Community Mental Health Center serving Christian, Todd, Trigg, Caldwell, Crittenden, and Livingston counties in Western Kentucky. Provides mental health, substance use treatment, and crisis intervention. Offers in-jail mental health services at the Christian County Jail and surrounding county detention centers.",
    description_es: "Centro Comunitario de Salud Mental que atiende a los condados de Christian, Todd, Trigg, Caldwell, Crittenden y Livingston en el oeste de Kentucky. Proporciona salud mental, tratamiento de uso de sustancias e intervención en crisis. Ofrece servicios de salud mental en la cárcel del Condado de Christian.",
    address: "735 North Drive",
    city: "Hopkinsville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 886-5163",
    website: "https://pennyroyalcenter.org",
    notes: "24/7 Crisis Line: (270) 886-5163",
  },
  {
    id: 495,
    name: "Audubon Area Community Services — Henderson County",
    category: "Basic Needs",
    description: "Community action agency serving Henderson, Ohio, and Daviess counties. Provides emergency financial assistance, utility aid, food resources, housing support, and case management for low-income individuals — including those leaving the Henderson County Detention Center.",
    description_es: "Agencia de acción comunitaria que atiende a los condados de Henderson, Ohio y Daviess. Proporciona asistencia financiera de emergencia, ayuda con servicios públicos, recursos alimentarios, apoyo de vivienda y gestión de casos para personas de bajos ingresos, incluidas las que salen de la cárcel del Condado de Henderson.",
    address: "401 Frederica Street",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 683-5278",
    website: "https://audubonareaservices.org",
    notes: "Henderson County office: (270) 826-5531",
  },
  {
    id: 496,
    name: "Probation & Parole — Hopkinsville (Christian County)",
    category: "Probation & Parole",
    description: "District 2 probation and parole office serving Christian, Todd, Trigg, and surrounding Western Kentucky counties.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 2 que atiende a los condados de Christian, Todd, Trigg y los circundantes del oeste de Kentucky.",
    address: "107 North Main Street",
    city: "Hopkinsville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 889-6501",
  },

  // ── SOUTH CENTRAL KY — BOWLING GREEN EXPANSION ────────────────────────────────
  {
    id: 497,
    name: "LifeSkills Inc. — Bowling Green (South Central Kentucky)",
    category: "Healthcare",
    description: "Community Mental Health Center serving 14 south-central Kentucky counties: Barren, Breckinridge, Butler, Edmonson, Grayson, Green, Hart, LaRue, Marion, Metcalfe, Monroe, Nelson, Taylor, and Washington. Provides mental health, substance use, and crisis services for individuals in county jails across the region.",
    description_es: "Centro Comunitario de Salud Mental que atiende a 14 condados del centro-sur de Kentucky. Proporciona salud mental, uso de sustancias y servicios de crisis para personas en cárceles del condado en toda la región.",
    address: "380 East 16th Avenue",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 901-5000",
    website: "https://lifeskills-inc.org",
    notes: "24/7 Crisis Line: (270) 901-5151",
  },

  // ── EMPLOYMENT — ADDITIONAL KENTUCKY CAREER CENTERS ────────────────────────────
  {
    id: 500,
    name: "Kentucky Career Center — Paducah / West Kentucky",
    category: "Employment",
    description: "American Job Center serving western Kentucky's Purchase Area. Free job search, resume workshops, career counseling, skills training funding, and employer connections for individuals with criminal records. Operated through the West Kentucky Workforce Development Board.",
    description_es: "Centro de Trabajo Americano que atiende el Área de Purchase en el oeste de Kentucky. Búsqueda de empleo gratuita, talleres de currículum, orientación profesional, financiamiento de capacitación y conexiones con empleadores para personas con antecedentes penales. Operado a través del West Kentucky Workforce Development Board.",
    address: "1530 Lone Oak Road",
    city: "Paducah",
    region: "Paducah / Western Kentucky",
    phone: "(270) 575-7240",
    website: "https://wkwdb.com",
  },
  {
    id: 501,
    name: "Kentucky Career Center — Owensboro / Green River",
    category: "Employment",
    description: "American Job Center serving Daviess County and six surrounding Green River counties. Free job search, skills assessment, resume assistance, career coaching, and training referrals for individuals with barriers including criminal history. Operated through the Green River Workforce Development Board.",
    description_es: "Centro de Trabajo Americano que atiende el Condado de Daviess y seis condados circundantes del Río Verde. Búsqueda de empleo gratuita, evaluación de habilidades, asistencia con currículum, orientación profesional y referencias de capacitación para personas con antecedentes penales.",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 687-7244",
    website: "https://greenriverworkforce.com",
  },
  {
    id: 502,
    name: "Kentucky Career Center — Pikeville (EKCEP)",
    category: "Employment",
    description: "American Job Center in Pike County operated through EKCEP. Provides free job search, resume help, career counseling, training funding, and employer connections with a recovery-informed lens for individuals with justice involvement. Same organization as the SITE program (id 107) with a dedicated Pikeville location serving Pike and surrounding counties.",
    description_es: "Centro de Trabajo Americano en el Condado de Pike operado a través de EKCEP. Proporciona búsqueda de empleo gratuita, ayuda con currículum, orientación profesional, financiamiento de capacitación y conexiones con empleadores con un enfoque informado en recuperación.",
    address: "126 Town Mountain Road",
    city: "Pikeville",
    region: "Eastern Kentucky",
    phone: "(606) 433-7675",
    website: "https://ekcep.org",
  },
  {
    id: 503,
    name: "Kentucky Career Center — Somerset / Lake Cumberland",
    category: "Employment",
    description: "American Job Center serving Pulaski County and the Lake Cumberland region. Free job seeker services including job search, resume assistance, career assessment, and training referrals. Assists individuals with criminal records navigating employment barriers in the south-central Kentucky area.",
    description_es: "Centro de Trabajo Americano que atiende el Condado de Pulaski y la región de Lake Cumberland. Servicios gratuitos para buscadores de empleo que incluyen búsqueda de empleo, asistencia con currículum, evaluación profesional y referencias de capacitación.",
    city: "Somerset",
    region: "Eastern Kentucky",
    phone: "(606) 677-2100",
    website: "https://kcc.ky.gov",
  },
  {
    id: 504,
    name: "Kentucky Career Center — Hopkinsville / Pennyrile",
    category: "Employment",
    description: "American Job Center for Christian County and nine surrounding Pennyrile region counties. Free career services including job readiness workshops, skills training funding, resume help, and second-chance employer connections. Operated through the Pennyrile Workforce Investment Board.",
    description_es: "Centro de Trabajo Americano para el Condado de Christian y nueve condados circundantes de la región de Pennyrile. Servicios profesionales gratuitos que incluyen talleres de preparación laboral, financiamiento de capacitación en habilidades, ayuda con currículum y conexiones con empleadores de segunda oportunidad.",
    address: "3715 Fort Campbell Blvd",
    city: "Hopkinsville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 707-0550",
    website: "https://kcc.ky.gov",
  },
  {
    id: 505,
    name: "Kentucky Career Center — Corbin / Cumberland Valley",
    category: "Employment",
    description: "American Job Center serving Laurel County and the Cumberland Valley region of southeastern Kentucky. Free job search, resume assistance, career coaching, and skills training referrals. Serves individuals with criminal records across Laurel, Knox, Bell, Whitley, Harlan, Clay, and surrounding counties.",
    description_es: "Centro de Trabajo Americano que atiende el Condado de Laurel y la región del Valle de Cumberland en el sureste de Kentucky. Búsqueda de empleo gratuita, asistencia con currículum, orientación profesional y referencias de capacitación en habilidades.",
    city: "Corbin",
    region: "Eastern Kentucky",
    website: "https://kcc.ky.gov",
    notes: "Locate the nearest KCC office at kcc.ky.gov",
  },

  // ── HEALTHCARE — REGIONAL CMHCs (GAPS FILLED) ──────────────────────────────────
  {
    id: 506,
    name: "Four Rivers Behavioral Health — Paducah",
    category: "Healthcare",
    description: "Community Mental Health Center for the eight Purchase Area counties of western Kentucky. Provides outpatient mental health therapy, psychiatric services, substance use treatment, crisis intervention, and in-jail mental health screening and linkage at McCracken County Regional Jail and surrounding county detention centers. 24/7 crisis line.",
    description_es: "Centro Comunitario de Salud Mental para los ocho condados del Área de Purchase en el oeste de Kentucky. Proporciona terapia ambulatoria de salud mental, servicios psiquiátricos, tratamiento de uso de sustancias, intervención en crisis y evaluación de salud mental en cárceles. Línea de crisis las 24 horas.",
    city: "Paducah",
    region: "Paducah / Western Kentucky",
    phone: "(270) 442-7121",
    website: "https://4rbh.org",
    notes: "24/7 Crisis Line: (270) 442-7121",
  },
  {
    id: 507,
    name: "River Valley Behavioral Health — Owensboro",
    category: "Healthcare",
    description: "Community Mental Health Center for Daviess County and six surrounding Green River region counties. Provides outpatient mental health therapy, psychiatric evaluation and medication management, substance use treatment, and crisis services. Offers in-jail mental health linkage at the Daviess County Detention Center and Henderson County Detention Center. 24/7 crisis line.",
    description_es: "Centro Comunitario de Salud Mental para el Condado de Daviess y seis condados circundantes de la región del Río Verde. Proporciona terapia ambulatoria de salud mental, evaluación psiquiátrica, tratamiento de uso de sustancias y servicios de crisis. Ofrece vinculación de salud mental en la cárcel del Condado de Daviess. Línea de crisis las 24 horas.",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 689-6500",
    website: "https://rvbh.com",
    notes: "24/7 Crisis Line: (270) 689-6500",
  },
  {
    id: 508,
    name: "Adanta Group — Somerset (South-Central Kentucky)",
    category: "Healthcare",
    description: "Community Mental Health Center for Adair, Casey, Clinton, Cumberland, McCreary, Pulaski, Russell, and Wayne counties in south-central Kentucky. Provides behavioral health outpatient services, psychiatric care, substance use treatment, and crisis intervention. Offers mental health linkage for individuals leaving the Pulaski County Detention Center and surrounding county jails. Multiple county offices — call for the location nearest to you.",
    description_es: "Centro Comunitario de Salud Mental para los condados de Adair, Casey, Clinton, Cumberland, McCreary, Pulaski, Russell y Wayne en el centro-sur de Kentucky. Proporciona servicios ambulatorios de salud conductual, atención psiquiátrica, tratamiento de uso de sustancias e intervención en crisis. Múltiples oficinas en el condado.",
    city: "Somerset",
    region: "Eastern Kentucky",
    phone: "(606) 679-1881",
    website: "https://adanta.com",
    notes: "24/7 Crisis: (606) 679-1881 | Multiple county offices — call for location nearest to you",
  },

  // ── PROBATION & PAROLE — MISSING DISTRICTS ─────────────────────────────────────
  {
    id: 509,
    name: "Probation & Parole — Owensboro (District 6)",
    category: "Probation & Parole",
    description: "District 6 probation and parole office serving Daviess, Ohio, Hancock, McLean, and Breckinridge counties in western Kentucky.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 6 que atiende los condados de Daviess, Ohio, Hancock, McLean y Breckinridge en el oeste de Kentucky.",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    website: "https://corrections.ky.gov/Probation-and-Parole",
    notes: "Call KY DOC central line (502) 782-2277 to be directed to the Owensboro district office",
  },
  {
    id: 510,
    name: "Probation & Parole — Ashland (District 8)",
    category: "Probation & Parole",
    description: "District 8 probation and parole office serving Boyd, Carter, Elliott, and Greenup counties in northeastern Kentucky.",
    description_es: "Oficina de libertad condicional y vigilada del Distrito 8 que atiende los condados de Boyd, Carter, Elliott y Greenup en el noreste de Kentucky.",
    city: "Ashland",
    region: "Ashland / Boyd County",
    website: "https://corrections.ky.gov/Probation-and-Parole",
    notes: "Call KY DOC central line (502) 782-2277 to be directed to the Ashland district office",
  },

  // ── BASIC NEEDS — COMMUNITY ACTION AGENCIES (GAPS FILLED) ─────────────────────
  {
    id: 511,
    name: "Pennyrile Allied Community Services (PACS)",
    category: "Basic Needs",
    description: "Community action agency serving nine counties in western and south-central Kentucky. Provides LIHEAP utility assistance, emergency financial aid, food programs, housing support, weatherization, Head Start, and case management for low-income individuals — including those leaving county jails in Christian, Hopkins, Muhlenberg, and surrounding counties.",
    description_es: "Agencia de acción comunitaria que atiende nueve condados en el oeste y el centro-sur de Kentucky. Proporciona asistencia de servicios públicos LIHEAP, ayuda financiera de emergencia, programas de alimentos, apoyo de vivienda, climatización, Head Start y gestión de casos para personas de bajos ingresos.",
    address: "312 E. 9th Street",
    city: "Hopkinsville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 886-5328",
    website: "https://pennyrileallied.org",
  },
  {
    id: 512,
    name: "Purchase Area Development District (PADD)",
    category: "Basic Needs",
    description: "Regional planning and community services organization for eight western Kentucky counties. Administers LIHEAP energy assistance, housing programs, senior services, and transportation coordination. Can connect individuals leaving McCracken County Regional Jail and surrounding county detention centers with available local resources.",
    description_es: "Organización regional de planificación y servicios comunitarios para ocho condados del oeste de Kentucky. Administra asistencia energética LIHEAP, programas de vivienda, servicios para personas mayores y coordinación de transporte. Puede conectar a las personas que salen de las cárceles del condado con recursos del área.",
    address: "1002 Medical Drive",
    city: "Mayfield",
    region: "Paducah / Western Kentucky",
    phone: "(270) 247-7171",
    website: "https://purchaseadd.org",
  },
  {
    id: 513,
    name: "Green River Area Development District (GRADD)",
    category: "Basic Needs",
    description: "Regional planning and community services agency for seven western Kentucky counties. Administers LIHEAP utility assistance, senior services, transportation, housing programs, and workforce development. Can connect individuals leaving the Daviess County Detention Center and surrounding jails with local resources.",
    description_es: "Agencia regional de planificación y servicios comunitarios para siete condados del oeste de Kentucky. Administra asistencia de servicios públicos LIHEAP, servicios para personas mayores, transporte, programas de vivienda y desarrollo de la fuerza laboral.",
    address: "300 GRADD Way",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 926-4433",
    website: "https://gradd.com",
  },
  {
    id: 514,
    name: "Buffalo Trace Area Development District (BTADD)",
    category: "Basic Needs",
    description: "Regional planning and community services agency for six northeastern Kentucky counties: Bath, Bracken, Fleming, Mason, Nicholas, and Robertson. Provides LIHEAP utility assistance, housing programs, transportation, senior services, and emergency aid. Headquartered in Maysville (Mason County) and can help individuals leaving the Mason County Detention Center and surrounding jails navigate local resources.",
    description_es: "Agencia regional de planificación y servicios comunitarios para seis condados del noreste de Kentucky: Bath, Bracken, Fleming, Mason, Nicholas y Robertson. Proporciona asistencia de servicios públicos LIHEAP, programas de vivienda, transporte, servicios para personas mayores y ayuda de emergencia.",
    city: "Maysville",
    region: "Ashland / Boyd County",
    phone: "(606) 564-6894",
    website: "https://btadd.com",
  },
  {
    id: 515,
    name: "Barren River Area Development District (BRADD)",
    category: "Basic Needs",
    description: "Regional planning and community services agency for eight south-central Kentucky counties. Administers LIHEAP energy assistance, senior and disability services, transportation coordination, housing programs, and workforce development. Serves rural communities in Barren, Butler, Edmonson, Hart, Logan, Metcalfe, Monroe, and Warren counties that may not have access to urban Bowling Green services.",
    description_es: "Agencia regional de planificación y servicios comunitarios para ocho condados del centro-sur de Kentucky. Administra asistencia energética LIHEAP, servicios para personas mayores y con discapacidades, coordinación de transporte, programas de vivienda y desarrollo de la fuerza laboral.",
    city: "Bowling Green",
    region: "Bowling Green / Warren County",
    phone: "(270) 781-2381",
    website: "https://bradd.org",
  },
  {
    id: 516,
    name: "Catholic Charities Diocese of Owensboro",
    category: "Basic Needs",
    description: "Social services arm of the Catholic Diocese of Owensboro, covering 33 counties across western and south-central Kentucky — one of the largest nonprofit footprints in the region. Provides emergency food, clothing, utility assistance, housing support, and case management. Open to all regardless of faith. Serves counties across the Green River, Purchase, and Pennyrile regions.",
    description_es: "Brazo de servicios sociales de la Diócesis Católica de Owensboro, que cubre 33 condados en el oeste y el centro-sur de Kentucky. Proporciona alimentos de emergencia, ropa, asistencia de servicios públicos, apoyo de vivienda y gestión de casos. Abierto a todos independientemente de la fe.",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 683-6525",
    website: "https://rcdowensboro.org/catholic-charities",
  },

  // ── EDUCATION — KCTCS ADULT EDUCATION (GAPS FILLED) ───────────────────────────
  {
    id: 517,
    name: "Ashland Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy classes for Boyd County and surrounding northeastern Kentucky counties. Part of the KCTCS statewide adult education network. Classes held in community and county jail settings. First-time GED test fees waived in Kentucky.",
    description_es: "Clases gratuitas de preparación para el GED y alfabetización adulta para el Condado de Boyd y los condados circundantes del noreste de Kentucky. Parte de la red de educación para adultos de KCTCS. Las clases se imparten en entornos comunitarios y en cárceles del condado.",
    city: "Ashland",
    region: "Ashland / Boyd County",
    phone: "(606) 326-2000",
    website: "https://ashland.kctcs.edu",
  },
  {
    id: 518,
    name: "Big Sandy Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation classes for Floyd, Johnson, Lawrence, Magoffin, Martin, and Pike counties in eastern Kentucky. Part of the KCTCS network. Offers GED instruction inside Big Sandy Regional Detention Center and Pike County Detention Center. First-time GED test fees waived.",
    description_es: "Clases gratuitas de preparación para el GED para los condados de Floyd, Johnson, Lawrence, Magoffin, Martin y Pike en el este de Kentucky. Parte de la red KCTCS. Ofrece instrucción para el GED dentro del Centro de Detención Regional Big Sandy y el Centro de Detención del Condado de Pike.",
    address: "One Bert T. Combs Drive",
    city: "Prestonsburg",
    region: "Eastern Kentucky",
    phone: "(606) 886-3863",
    website: "https://bigsandy.kctcs.edu",
  },
  {
    id: 519,
    name: "Somerset Community College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult education programs for Pulaski County and the Lake Cumberland region of south-central Kentucky. Part of the KCTCS statewide network. Serves adults in community settings and county jails. First-time GED test fees waived in Kentucky.",
    description_es: "Programas gratuitos de preparación para el GED y educación para adultos para el Condado de Pulaski y la región de Lake Cumberland en el centro-sur de Kentucky. Parte de la red estatal de KCTCS. Atiende a adultos en entornos comunitarios y cárceles del condado.",
    city: "Somerset",
    region: "Eastern Kentucky",
    phone: "(606) 679-8501",
    website: "https://somerset.kctcs.edu",
  },
  {
    id: 520,
    name: "Owensboro Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy programs for Daviess County and surrounding Green River counties. Part of the KCTCS statewide adult education network. Classes available in community locations and at the Daviess County Detention Center. First-time GED test fees waived.",
    description_es: "Programas gratuitos de preparación para el GED y alfabetización adulta para el Condado de Daviess y los condados circundantes del Río Verde. Parte de la red estatal de educación para adultos de KCTCS. Clases disponibles en ubicaciones comunitarias y en la cárcel del Condado de Daviess.",
    city: "Owensboro",
    region: "Owensboro / Daviess County",
    phone: "(270) 686-4400",
    website: "https://owensboro.kctcs.edu",
  },
  {
    id: 521,
    name: "Madisonville Community College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy classes for Hopkins County and surrounding western Kentucky counties. Part of the KCTCS statewide adult education network. Serves adults in community settings and those recently released from the Hopkins County Detention Center and Muhlenberg County Detention Center.",
    description_es: "Clases gratuitas de preparación para el GED y alfabetización adulta para el Condado de Hopkins y los condados circundantes del oeste de Kentucky. Parte de la red estatal de educación para adultos de KCTCS.",
    city: "Madisonville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 821-2250",
    website: "https://madisonville.kctcs.edu",
  },
  {
    id: 522,
    name: "Hazard Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult education for Perry County and the surrounding coalfields region of deep eastern Kentucky. Part of the KCTCS network. Offers GED instruction inside Perry County Detention Center and surrounding county jails. Covers Perry, Breathitt, Knott, Leslie, Letcher, Lee, Owsley, and Harlan counties. First-time GED test fees waived.",
    description_es: "Preparación gratuita para el GED y educación para adultos para el Condado de Perry y la región de los yacimientos de carbón del este profundo de Kentucky. Parte de la red KCTCS. Ofrece instrucción para el GED dentro del Centro de Detención del Condado de Perry y las cárceles circundantes.",
    city: "Hazard",
    region: "Eastern Kentucky",
    phone: "(606) 436-5721",
    website: "https://hazard.kctcs.edu",
  },
  {
    id: 523,
    name: "Elizabethtown Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy programs for Hardin County and surrounding Lincoln Trail counties. Part of the KCTCS statewide adult education network. Classes available in community and correctional settings in the Elizabethtown area. First-time GED test fees waived.",
    description_es: "Programas gratuitos de preparación para el GED y alfabetización adulta para el Condado de Hardin y los condados circundantes de Lincoln Trail. Parte de la red estatal de educación para adultos de KCTCS.",
    city: "Elizabethtown",
    region: "Elizabethtown / Hardin County",
    phone: "(270) 769-2371",
    website: "https://elizabethtown.kctcs.edu",
  },
  {
    id: 524,
    name: "Maysville Community & Technical College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy classes for Mason County and surrounding northeastern Kentucky counties including Bath, Bracken, Fleming, Nicholas, and Robertson. Part of the KCTCS network. Serves adults in community and county jail settings in the Maysville area. First-time GED test fees waived.",
    description_es: "Clases gratuitas de preparación para el GED y alfabetización adulta para el Condado de Mason y los condados circundantes del noreste de Kentucky. Parte de la red KCTCS. Atiende a adultos en entornos comunitarios y cárceles del condado en el área de Maysville.",
    city: "Maysville",
    region: "Ashland / Boyd County",
    phone: "(606) 759-7141",
    website: "https://maysville.kctcs.edu",
  },
  {
    id: 525,
    name: "Hopkinsville Community College — Adult Education",
    category: "Education",
    description: "Free GED preparation and adult literacy classes for Christian County and surrounding Pennyrile counties. Part of the KCTCS statewide adult education network. Offers adult education inside the Christian County Detention Center. First-time GED test fees waived.",
    description_es: "Clases gratuitas de preparación para el GED y alfabetización adulta para el Condado de Christian y los condados circundantes de Pennyrile. Parte de la red estatal de educación para adultos de KCTCS. Ofrece educación para adultos dentro del Centro de Detención del Condado de Christian.",
    city: "Hopkinsville",
    region: "Paducah / Western Kentucky",
    phone: "(270) 707-3700",
    website: "https://hopkinsville.kctcs.edu",
  },
];

// ─── County coverage map (keyed by resource id) ──────────────────────────────
// Statewide resources are omitted — their badge already conveys scope.

const COUNTY_MAP: Record<number, string[]> = {
  // State Agencies
  4:   ["Logan", "Simpson", "Butler", "Warren", "Edmonson", "Hart", "Barren", "Allen", "Metcalfe", "Monroe"],
  5:   ["Boyd", "Carter", "Elliott", "Greenup", "Lawrence"],

  // Housing — Louisville
  10: ["Jefferson"], 11: ["Jefferson"], 12: ["Jefferson"], 13: ["Jefferson"],
  14: ["Jefferson"], 15: ["Jefferson"], 16: ["Jefferson"], 17: ["Jefferson"], 18: ["Jefferson"],

  // Housing — Lexington
  20: ["Fayette"], 21: ["Fayette"], 22: ["Fayette"], 23: ["Fayette"], 24: ["Fayette"],
  25: ["Fayette", "Woodford", "Madison"],

  // Housing — Northern KY
  30: ["Boone", "Kenton", "Campbell"],
  31: ["Boone", "Kenton", "Campbell"],
  32: ["Boone", "Kenton", "Campbell"],

  // Housing — Bowling Green / Warren
  40: ["Warren"], 41: ["Warren"],

  // Housing — Richmond / Madison
  50: ["Madison"], 51: ["Madison"],

  // Housing — Owensboro / Daviess
  60: ["Daviess"],

  // Housing — Eastern & Western KY
  70: ["Pike"],
  71: ["McCracken"],

  // Employment
  102: ["Jefferson"],
  103: ["Fayette"],
  104: ["Boone", "Kenton", "Campbell"],
  105: ["Warren"],
  106: ["Boyd", "Greenup", "Carter"],
  107: ["Perry", "Floyd", "Pike", "Letcher", "Knott", "Johnson", "Martin", "Lawrence", "Magoffin", "Morgan", "Breathitt", "Harlan", "Leslie", "Lee", "Owsley", "Wolfe", "Menifee", "Elliott", "Rowan", "Powell", "Clay", "Bell", "Knox"],
  489: ["Hardin", "LaRue"],
  492: ["Franklin"],

  // Healthcare
  121: ["Jefferson"],
  122: ["Jefferson"],
  123: ["Fayette", "Anderson", "Bourbon", "Clark", "Fleming", "Harrison", "Jessamine", "Menifee", "Mercer", "Montgomery", "Nicholas", "Powell", "Robertson", "Scott", "Washington", "Wolfe", "Woodford"],
  124: ["Boone", "Kenton", "Campbell", "Grant", "Pendleton"],
  126: ["Jefferson"],
  127: ["Jefferson"],
  128: ["Fayette"],
  129: ["Jefferson"],
  478: ["Bath", "Boyd", "Carter", "Elliott", "Fleming", "Greenup", "Lawrence", "Lewis", "Mason", "Menifee", "Montgomery", "Morgan", "Rowan", "Wolfe"],
  480: ["Breathitt", "Floyd", "Harlan", "Johnson", "Knott", "Knox", "Lawrence", "Leslie", "Letcher", "Magoffin", "Martin", "Morgan", "Perry", "Pike"],
  483: ["Bell", "Clay", "Harlan", "Jackson", "Knox", "Laurel", "McCreary", "Rockcastle", "Wayne", "Whitley"],
  488: ["Hardin", "LaRue", "Marion", "Meade", "Washington"],
  491: ["Hardin", "LaRue", "Meade", "Breckinridge", "Grayson"],
  494: ["Christian", "Todd", "Trigg", "Caldwell", "Crittenden", "Livingston"],
  497: ["Barren", "Breckinridge", "Butler", "Edmonson", "Grayson", "Green", "Hart", "LaRue", "Marion", "Metcalfe", "Monroe", "Nelson", "Taylor", "Washington"],

  // Substance Use Treatment
  140: ["Jefferson"], 141: ["Jefferson"],
  479: ["Lawrence", "Johnson", "Martin", "Floyd", "Pike", "Magoffin", "Morgan", "Wolfe"],

  // Legal Aid
  160: ["Jefferson", "Breckinridge", "Bullitt", "Grayson", "Hardin", "Henry", "LaRue", "Marion", "Meade", "Nelson", "Oldham", "Shelby", "Spencer", "Trimble", "Washington"],
  161: ["Fayette", "Bath", "Boone", "Bourbon", "Boyd", "Bracken", "Campbell", "Carroll", "Carter", "Clark", "Elliott", "Fleming", "Grant", "Greenup", "Harrison", "Henry", "Lawrence", "Lewis", "Mason", "Menifee", "Montgomery", "Morgan", "Nicholas", "Pendleton", "Robertson", "Rowan", "Scott", "Shelby", "Trimble", "Woodford", "Anderson", "Mercer"],
  162: ["Warren", "Logan", "Todd", "Butler", "Muhlenberg", "McLean", "Ohio", "Hancock", "Breckinridge", "Meade", "Edmonson", "Barren", "Allen", "Simpson", "Monroe", "Metcalfe", "Adair", "Cumberland", "Green", "Taylor", "Hart", "Casey", "Russell"],
  163: ["Daviess", "Ohio", "Hancock", "McLean", "Henderson", "Union", "Webster"],
  164: ["McCracken", "Ballard", "Carlisle", "Hickman", "Fulton", "Graves", "Marshall", "Calloway", "Trigg", "Caldwell", "Lyon", "Crittenden", "Livingston", "Christian"],
  165: ["Bell", "Breathitt", "Carter", "Clay", "Elliott", "Estill", "Fleming", "Floyd", "Greenup", "Harlan", "Jackson", "Johnson", "Knott", "Knox", "Laurel", "Lawrence", "Lee", "Leslie", "Letcher", "Magoffin", "Martin", "Mason", "McCreary", "Menifee", "Montgomery", "Morgan", "Owsley", "Perry", "Pike", "Powell", "Pulaski", "Rockcastle", "Rowan", "Wayne", "Whitley", "Wolfe", "Bath"],
  169: ["Jefferson"],
  170: ["Jefferson"],
  171: ["Fayette"],
  482: ["Letcher", "Harlan", "Perry", "Floyd", "Pike"],

  // Food & Nutrition
  181: ["Jefferson"],
  182: ["Fayette", "Anderson", "Bath", "Bourbon", "Breathitt", "Clark", "Clay", "Elliott", "Estill", "Fleming", "Franklin", "Garrard", "Grant", "Harrison", "Jackson", "Jessamine", "Knott", "Lawrence", "Lee", "Leslie", "Letcher", "Lincoln", "Madison", "Magoffin", "Menifee", "Mercer", "Montgomery", "Morgan", "Nicholas", "Owsley", "Perry", "Powell", "Robertson", "Rockcastle", "Rowan", "Scott", "Washington", "Wolfe", "Woodford", "Boyd", "Carter", "Greenup", "Martin", "Johnson"],
  183: ["Hardin", "LaRue", "Marion", "Nelson", "Taylor", "Green", "Adair", "Casey", "Russell", "Clinton", "Cumberland", "Metcalfe", "Monroe", "Barren", "Allen", "Simpson", "Warren", "Butler", "Edmonson", "Hart", "Ohio", "Muhlenberg", "Logan", "Todd", "Christian", "Trigg", "Caldwell", "Lyon", "Crittenden", "Livingston", "Webster", "McLean", "Hancock", "Henderson", "Union", "Daviess"],
  481: ["Floyd", "Johnson", "Lawrence", "Magoffin", "Martin", "Pike"],
  485: ["Pulaski", "Russell", "Casey", "Clinton", "Cumberland", "Wayne"],
  484: ["Bell", "Clay", "Harlan", "Jackson", "Knox", "Laurel", "McCreary", "Rockcastle", "Wayne", "Whitley"],
  495: ["Henderson", "Ohio", "Daviess"],

  // ID & Documentation
  203: ["Jefferson"],
  204: ["Fayette"],

  // Financial Assistance
  221: ["Boone", "Kenton", "Campbell"],
  224: ["Jefferson"],
  225: ["Fayette"],

  // Transportation
  240: ["Jefferson"],
  241: ["Fayette"],
  242: ["Boone", "Kenton", "Campbell"],

  // Family & Children
  261: ["Jefferson"],
  263: ["Jefferson"],

  // Peer Support
  281: ["Perry", "Floyd", "Pike", "Letcher", "Knott", "Johnson", "Martin", "Lawrence", "Magoffin", "Morgan", "Breathitt", "Harlan", "Leslie", "Lee", "Owsley", "Wolfe", "Menifee", "Elliott", "Rowan", "Powell", "Clay", "Bell", "Knox"],
  282: ["Jefferson"],
  475: ["Campbell"],
  476: ["Kenton"],
  477: ["Campbell"],

  // Education
  301: ["Fayette", "Bourbon", "Clark", "Harrison", "Jessamine", "Mercer", "Scott", "Woodford"],
  302: ["Boone", "Kenton", "Campbell", "Grant", "Owen"],
  303: ["Warren", "Barren", "Simpson", "Metcalfe"],

  // Veterans
  400: ["Jefferson"], 401: ["Jefferson"],
  402: ["Fayette"], 403: ["Fayette"],
  406: ["Jefferson"],
  407: ["Fayette"],
  408: ["Jefferson"],

  // Basic Needs
  430: ["Jefferson"], 431: ["Jefferson"], 432: ["Jefferson"],

  // Probation & Parole
  450: ["Franklin"],
  451: ["Jefferson"],
  452: ["Fayette"],
  453: ["Kenton"],
  454: ["Warren", "Adair", "Barren", "Casey", "Cumberland", "Metcalfe"],
  455: ["McCracken"],
  456: ["Pike"],
  486: ["Perry"],
  487: ["Laurel", "Whitley", "Knox", "Bell"],
  490: ["Hardin", "LaRue", "Marion", "Meade", "Washington"],
  493: ["Franklin", "Anderson", "Owen", "Carroll", "Trimble", "Henry", "Shelby"],
  496: ["Christian", "Todd", "Trigg"],

  // Reentry Organizations
  470: ["Jefferson"], 471: ["Jefferson"], 472: ["Jefferson"], 473: ["Jefferson"], 474: ["Jefferson"],

  // Employment — additional KCC offices
  500: ["Ballard", "Calloway", "Carlisle", "Fulton", "Graves", "Hickman", "Marshall", "McCracken"],
  501: ["Daviess", "Hancock", "Henderson", "McLean", "Ohio", "Union", "Webster"],
  502: ["Pike", "Floyd", "Johnson", "Martin", "Lawrence", "Magoffin"],
  503: ["Pulaski", "Russell", "Adair", "Casey", "Clinton", "Cumberland", "McCreary", "Wayne"],
  504: ["Christian", "Caldwell", "Crittenden", "Hopkins", "Livingston", "Lyon", "Muhlenberg", "Todd", "Trigg"],
  505: ["Laurel", "Knox", "Bell", "Clay", "Harlan", "Jackson", "McCreary", "Rockcastle", "Whitley"],

  // Healthcare — regional CMHCs
  506: ["McCracken", "Ballard", "Calloway", "Carlisle", "Fulton", "Graves", "Hickman", "Marshall"],
  507: ["Daviess", "Hancock", "Henderson", "McLean", "Ohio", "Union", "Webster"],
  508: ["Adair", "Casey", "Clinton", "Cumberland", "McCreary", "Pulaski", "Russell", "Wayne"],

  // Probation & Parole — missing districts
  509: ["Daviess", "Ohio", "Hancock", "McLean", "Breckinridge"],
  510: ["Boyd", "Carter", "Elliott", "Greenup"],

  // Basic Needs — community action agencies
  511: ["Caldwell", "Christian", "Crittenden", "Hopkins", "Livingston", "Lyon", "Muhlenberg", "Todd", "Trigg"],
  512: ["Ballard", "Calloway", "Carlisle", "Fulton", "Graves", "Hickman", "Marshall", "McCracken"],
  513: ["Daviess", "Hancock", "Henderson", "McLean", "Ohio", "Union", "Webster"],
  514: ["Bath", "Bracken", "Fleming", "Mason", "Nicholas", "Robertson"],
  515: ["Barren", "Butler", "Edmonson", "Hart", "Logan", "Metcalfe", "Monroe", "Warren"],
  516: ["Daviess", "Hancock", "Ohio", "McLean", "Henderson", "Union", "Webster", "Hopkins", "Muhlenberg", "Caldwell", "Crittenden", "Lyon", "Livingston", "Marshall", "Calloway", "McCracken", "Graves", "Carlisle", "Hickman", "Fulton", "Ballard", "Logan", "Todd", "Christian", "Trigg"],

  // Education — KCTCS campuses
  517: ["Boyd", "Carter", "Greenup", "Lawrence"],
  518: ["Floyd", "Johnson", "Lawrence", "Magoffin", "Martin", "Pike"],
  519: ["Pulaski", "Russell", "Adair", "Casey", "Clinton", "Cumberland", "McCreary", "Wayne"],
  520: ["Daviess", "Hancock", "Henderson", "McLean", "Ohio"],
  521: ["Hopkins", "Muhlenberg", "Webster", "Caldwell", "Christian"],
  522: ["Perry", "Breathitt", "Knott", "Leslie", "Letcher", "Lee", "Owsley", "Harlan"],
  523: ["Hardin", "LaRue", "Marion", "Meade", "Nelson", "Breckinridge", "Grayson", "Washington"],
  524: ["Mason", "Bath", "Bracken", "Fleming", "Nicholas", "Robertson"],
  525: ["Christian", "Caldwell", "Crittenden", "Hopkins", "Todd", "Trigg"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(phone: string): string {
  return phone.replace(/[^+\d]/g, "");
}

function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────

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

  const kyTutorialSteps: TutorialStep[] = useMemo(() => [
    { Icon: BookOpen,        title: t("tutorial.ky.welcomeTitle"),  body: t("tutorial.ky.welcomeBody",  { count: RESOURCES.length }), targetId: null },
    { Icon: Search,          title: t("tutorial.ky.searchTitle"),   body: t("tutorial.ky.searchBody"),                               targetId: "ky-search-input" },
    { Icon: SlidersHorizontal, title: t("tutorial.ky.categoryTitle"), body: t("tutorial.ky.categoryBody"),                           targetId: "ky-category-select" },
    { Icon: MapPin,          title: t("tutorial.ky.regionTitle"),   body: t("tutorial.ky.regionBody"),                               targetId: "ky-region-select" },
    { Icon: CheckCircle2,    title: t("tutorial.ky.doneTitle"),     body: t("tutorial.ky.doneBody"),                                 targetId: "ky-first-card" },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

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
        <SpotlightTutorial steps={kyTutorialSteps} onComplete={closeTutorial} />
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
      <div id="ky-sticky-bar" className="sticky top-[69px] z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sm">
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
            <SelectTrigger id="ky-category-select" className="sm:w-56 bg-background h-auto">
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
            <SelectTrigger id="ky-region-select" className="sm:w-60 bg-background h-auto">
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
  const counties = COUNTY_MAP[r.id];

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
        {counties && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span><span className="font-medium text-foreground">{t("ky.countiesServed")}:</span> {counties.join(", ")}</span>
          </div>
        )}
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
