import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "es";

type Dict = Record<string, string>;

const translations: Record<Language, Dict> = {
  en: {
    "nav.categories": "Categories",
    "nav.admin": "Admin",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "nav.language": "Español",
    "site.tagline": "Content library",
    "footer.crisis": "If you are in crisis, call or text",

    "home.loading": "Loading…",
    "home.categories": "Categories",
    "home.collections": "{count} collections",
    "home.collection": "{count} collection",
    "home.empty": "No categories yet.",

    "category.allCategories": "All categories",
    "category.notFound": "Category not found",
    "category.backToAll": "Back to all categories",
    "category.resource": "resource",
    "category.resources": "resources",
    "category.noContent": "No content yet — check back soon.",
    "category.downloadFile": "Download file",
    "category.source": "Source",
    "category.exploreOthers": "Explore other categories",
    "category.newContent": "New content",
    "category.newContentAdded": "New content added",

    "auth.signIn": "Sign in",
    "auth.createAccount": "Create account",
    "auth.subtitle": "Admin access for managing the content library.",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.toggleToSignUp": "Need an account? Sign up",
    "auth.toggleToSignIn": "Already have an account? Sign in",
    "auth.note": "After signing up, you'll need admin access granted from the backend.",
    "auth.backToSite": "Back to site",
    "auth.created": "Account created. Check your email to confirm.",
    "auth.failed": "Authentication failed",
  },
  es: {
    "nav.categories": "Categorías",
    "nav.admin": "Administración",
    "nav.signIn": "Iniciar sesión",
    "nav.signOut": "Cerrar sesión",
    "nav.language": "English",
    "site.tagline": "Biblioteca de contenido",
    "footer.crisis": "Si está en crisis, llame o envíe un mensaje al",

    "home.loading": "Cargando…",
    "home.categories": "Categorías",
    "home.collections": "{count} colecciones",
    "home.collection": "{count} colección",
    "home.empty": "Aún no hay categorías.",

    "category.allCategories": "Todas las categorías",
    "category.notFound": "Categoría no encontrada",
    "category.backToAll": "Volver a todas las categorías",
    "category.resource": "recurso",
    "category.resources": "recursos",
    "category.noContent": "Aún no hay contenido; vuelva pronto.",
    "category.downloadFile": "Descargar archivo",
    "category.source": "Fuente",
    "category.exploreOthers": "Explore otras categorías",

    "auth.signIn": "Iniciar sesión",
    "auth.createAccount": "Crear cuenta",
    "auth.subtitle": "Acceso de administrador para gestionar la biblioteca de contenido.",
    "auth.email": "Correo electrónico",
    "auth.password": "Contraseña",
    "auth.toggleToSignUp": "¿Necesita una cuenta? Regístrese",
    "auth.toggleToSignIn": "¿Ya tiene cuenta? Inicie sesión",
    "auth.note": "Después de registrarse, necesitará acceso de administrador desde el backend.",
    "auth.backToSite": "Volver al sitio",
    "auth.created": "Cuenta creada. Revise su correo para confirmar.",
    "auth.failed": "Error de autenticación",
  },
};

type Ctx = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "app.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === "en" || stored === "es") setLangState(stored);
    } catch {}
  }, []);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = translations[lang][key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Pick a localized value, falling back to the English value when the Spanish one is empty. */
export function pickLang<T>(lang: Language, en: T, es: T | null | undefined): T {
  if (lang === "es") {
    if (es === null || es === undefined) return en;
    if (typeof es === "string" && es.trim() === "") return en;
    return es as T;
  }
  return en;
}

const TYPE_ES: Record<string, string> = {
  article: "Artículo",
  video: "Video",
  podcast: "Pódcast",
  worksheet: "Hoja de trabajo",
  meeting: "Reunión",
  guide: "Guía",
};

/** Translate a content type label (Article, Video, etc.) into the active language. */
export function translateType(lang: Language, type: string): string {
  if (lang !== "es" || !type) return type;
  return TYPE_ES[type.trim().toLowerCase()] ?? type;
}

/** Translate duration strings like "8 min read", "1 hr 20 min", "45 sec". */
export function translateDuration(lang: Language, duration: string): string {
  if (lang !== "es" || !duration) return duration;
  if (duration.trim().toLowerCase() === "click for more") return "Haz clic para más";
  const units: Record<string, string> = {
    sec: "seg",
    second: "segundo",
    seconds: "segundos",
    min: "min",
    minute: "minuto",
    minutes: "minutos",
    hr: "h",
    hrs: "h",
    hour: "hora",
    hours: "horas",
    day: "día",
    days: "días",
    week: "semana",
    weeks: "semanas",
    read: "de lectura",
    watch: "de video",
    listen: "de audio",
    complete: "para completar",
    meeting: "de reunión",
    call: "de llamada",
    view: "de vista",
  };
  return duration.replace(/[A-Za-z]+/g, (word) => {
    const lower = word.toLowerCase();
    return units[lower] ?? word;
  });
}
