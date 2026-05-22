import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "es";

type Dict = Record<string, string>;

const translations: Record<Language, Dict> = {
  en: {
    "nav.categories": "Categories",
    "nav.admin": "Admin",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",
    "nav.signUp": "Sign In",
    "nav.dashboard": "Dashboard",
    "dashboard.greeting": "Hello, {name}!",
    "dashboard.greetingNoName": "Hello!",
    "dashboard.subtitle": "Continue your journey.",
    "dashboard.loading": "Loading…",
    "dashboard.noProfile": "No profile found for your account.",
    "dashboard.backHome": "Back home",
    "dashboard.name": "Name",
    "dashboard.joined": "Joined",
    "dashboard.tabProgress": "Progress",
    "dashboard.tabAccount": "Account Settings",
    "dashboard.overallProgress": "Overall Progress",
    "dashboard.overallSummary": "You've completed {done} of {total} available items. Keep going!",
    "dashboard.statCompleted": "Completed Items",
    "dashboard.statCategories": "Categories Started",
    "dashboard.statCategoriesCompleted": "Categories Completed",
    "dashboard.statHours": "Hours Spent",
    "dashboard.statStreak": "Day Streak",
    "dashboard.categoryProgress": "Category Progress",
    "dashboard.itemsCompleted": "{done} of {total} completed",
    "dashboard.lockedNav": "Please set up your security questions before leaving this page.",
    "dashboard.saving": "Saving…",
    "nav.adminSignIn": "Admin",
    "nav.adminSignOut": "Sign out",
    "nav.language": "Español",
    "site.tagline": "Content library",
    "footer.crisis": "If you are in crisis, call or text",

    "home.loading": "Loading…",
    "home.categories": "Categories",
    "home.collections": "{count} collections",
    "home.collection": "{count} collection",
    "home.empty": "No categories yet.",
    "home.item": "Item",
    "home.items": "Items",

    "category.allCategories": "All categories",
    "category.notFound": "Category not found",
    "category.backToAll": "Back to all categories",
    "category.resource": "resource",
    "category.resources": "resources",
    "category.noContent": "No content yet — check back soon.",
    "category.downloadFile": "Download file",
    "category.source": "Source",
    "category.exploreOthers": "Explore other categories",
    "category.newContent": "New",
    "category.newContentAdded": "New Content",
    "category.markAsRead": "Mark as read",
    "category.markedRead": "Read",
    "category.notRead": "Not read",

    "category.markReadError": "Couldn't update progress.",

    "dashboard.progress": "Your progress",
    "dashboard.progressItems": "{done}/{total} items read",
    "dashboard.progressEmpty": "Start a category to track your progress.",

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

    "signup.title": "Create your account",
    "signup.signInTitle": "Sign in",
    "signup.subtitleSignUp": "Sign up with a username and password. No email required.",
    "signup.subtitleSignIn": "Sign in with your username and password.",
    "signup.username": "Username",
    "signup.usernameOrEmail": "Username or email",
    "signup.usernameChecking": "Checking availability…",
    "signup.usernameAvailable": "Username is available.",
    "signup.usernameTaken": "That username is already taken.",
    "signup.usernamePlaceholder": "e.g. jdoe_92",
    "signup.password": "Password",
    "signup.confirmPassword": "Confirm password",
    "signup.passwordMismatch": "Passwords do not match",
    "password.tooShort": "Too short",
    "password.weak": "Weak",
    "password.fair": "Fair",
    "password.good": "Good",
    "password.strong": "Strong",
    "signup.facility": "Facility",
    "signup.verification": "Verification:",
    "signup.verificationQuestion": "What is {a} + {b}?",
    "signup.loading": "Loading…",
    "signup.createAccount": "Create account",
    "signup.signIn": "Sign in",
    "signup.toggleToSignIn": "Already have an account? Sign in",
    "signup.toggleToSignUp": "Need an account? Sign up",
    "signup.backToSite": "Back to site",
    "signup.honeypot": "Leave this field empty",
    "signup.welcome": "Welcome!",
    "signup.loadingVerification": "Loading verification, please wait.",
    "signup.answerVerification": "Please answer the verification question.",
    "signup.invalidLogin": "Incorrect username or password.",
    "signup.genericError": "Something went wrong.",
    "facility.pennington_sd": "Pennington, SD",
    "facility.campbell_ky": "Campbell, KY",

    "security.heading": "Security questions",
    "security.intro": "Choose 2 questions and provide answers. You'll use these to reset your password.",
    "security.setupPrompt": "Please choose and answer two security questions. These security questions will be used to reset your password if ever needed.",
    "security.chooseQuestion": "Choose a question",
    "security.yourAnswer": "Your answer",
    "security.update": "Update security questions",
    "security.updateSuccess": "Security questions updated.",
    "security.needTwo": "Please answer 2 different questions.",
    "security.current": "Current security questions",
    "security.cancel": "Cancel",
    "security.save": "Save",
    "security.forgotPassword": "Forgot password?",
    "security.resetTitle": "Reset password",
    "security.resetStep1": "Enter your username to begin.",
    "security.resetStep2": "Answer your security questions and choose a new password.",
    "security.continue": "Continue",
    "security.newPassword": "New password",
    "security.resetSubmit": "Reset password",
    "security.resetSuccess": "Password reset. You're now signed in.",
    "security.backToSignIn": "Back to sign in",

    "security.q.first_pet": "What was the name of your first pet?",
    "security.q.birth_city": "What city were you born in?",
    "security.q.mothers_maiden": "What is your mother's maiden name?",
    "security.q.first_car": "What was the make of your first car?",
    "security.q.elementary_school": "What was the name of your elementary school?",
    "security.q.favorite_food": "What is your favorite food?",
    "security.q.childhood_nickname": "What was your childhood nickname?",
    "security.q.street_grew_up": "What street did you grow up on?",
    "security.q.favorite_color": "What is your favorite color?",
    "security.q.favorite_movie": "What is your favorite movie?",
  },
  es: {
    "nav.categories": "Categorías",
    "nav.admin": "Administración",
    "nav.signIn": "Iniciar sesión",
    "nav.signOut": "Cerrar sesión",
    "nav.signUp": "Iniciar sesión",
    "nav.dashboard": "Panel",
    "dashboard.greeting": "¡Hola, {name}!",
    "dashboard.greetingNoName": "¡Hola!",
    "dashboard.subtitle": "Continúa tu camino.",
    "dashboard.loading": "Cargando…",
    "dashboard.noProfile": "No se encontró un perfil para su cuenta.",
    "dashboard.backHome": "Volver al inicio",
    "dashboard.name": "Nombre",
    "dashboard.joined": "Se unió",
    "dashboard.tabProgress": "Progreso",
    "dashboard.tabAccount": "Configuración de la cuenta",
    "dashboard.overallProgress": "Progreso general",
    "dashboard.overallSummary": "Has completado {done} de {total} recursos disponibles. ¡Sigue así!",
    "dashboard.statCompleted": "Recursos completados",
    "dashboard.statCategories": "Categorías iniciadas",
    "dashboard.statCategoriesCompleted": "Categorías terminadas",
    "dashboard.statHours": "Horas dedicadas",
    "dashboard.statStreak": "Días seguidos",
    "dashboard.categoryProgress": "Progreso por categoría",
    "dashboard.itemsCompleted": "{done} de {total} completados",
    "dashboard.lockedNav": "Por favor configure sus preguntas de seguridad antes de salir de esta página.",
    "dashboard.saving": "Guardando…",
    "nav.adminSignIn": "Administrador",
    "nav.adminSignOut": "Cerrar sesión",
    "nav.language": "English",
    "site.tagline": "Biblioteca de contenido",
    "footer.crisis": "Si está en crisis, llame o envíe un mensaje al",

    "home.loading": "Cargando…",
    "home.categories": "Categorías",
    "home.collections": "{count} colecciones",
    "home.collection": "{count} colección",
    "home.empty": "Aún no hay categorías.",
    "home.item": "Recurso",
    "home.items": "Recursos",

    "category.allCategories": "Todas las categorías",
    "category.notFound": "Categoría no encontrada",
    "category.backToAll": "Volver a todas las categorías",
    "category.resource": "recurso",
    "category.resources": "recursos",
    "category.noContent": "Aún no hay contenido; vuelva pronto.",
    "category.downloadFile": "Descargar archivo",
    "category.source": "Fuente",
    "category.exploreOthers": "Explore otras categorías",
    "category.newContent": "Nuevo",
    "category.newContentAdded": "Contenido Nuevo",
    "category.markAsRead": "Marcar como leído",
    "category.markedRead": "Leído",
    "category.notRead": "No leído",

    "category.markReadError": "No se pudo actualizar el progreso.",

    "dashboard.progress": "Tu progreso",
    "dashboard.progressItems": "{done}/{total} recursos leídos",
    "dashboard.progressEmpty": "Comienza una categoría para ver tu progreso.",

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

    "signup.title": "Crea tu cuenta",
    "signup.signInTitle": "Iniciar sesión",
    "signup.subtitleSignUp": "Regístrese con un nombre de usuario y contraseña. No se requiere correo electrónico.",
    "signup.subtitleSignIn": "Inicie sesión con su nombre de usuario y contraseña.",
    "signup.username": "Nombre de usuario",
    "signup.usernameOrEmail": "Nombre de usuario o correo electrónico",
    "signup.usernameChecking": "Comprobando disponibilidad…",
    "signup.usernameAvailable": "El nombre de usuario está disponible.",
    "signup.usernameTaken": "Ese nombre de usuario ya está en uso.",
    "signup.usernamePlaceholder": "p. ej. jdoe_92",
    "signup.password": "Contraseña",
    "signup.confirmPassword": "Confirmar contraseña",
    "signup.passwordMismatch": "Las contraseñas no coinciden",
    "password.tooShort": "Demasiado corta",
    "password.weak": "Débil",
    "password.fair": "Aceptable",
    "password.good": "Buena",
    "password.strong": "Fuerte",
    "signup.facility": "Centro",
    "signup.verification": "Verificación:",
    "signup.verificationQuestion": "¿Cuánto es {a} + {b}?",
    "signup.loading": "Cargando…",
    "signup.createAccount": "Crear cuenta",
    "signup.signIn": "Iniciar sesión",
    "signup.toggleToSignIn": "¿Ya tiene cuenta? Inicie sesión",
    "signup.toggleToSignUp": "¿Necesita una cuenta? Regístrese",
    "signup.backToSite": "Volver al sitio",
    "signup.honeypot": "Deje este campo vacío",
    "signup.welcome": "¡Bienvenido!",
    "signup.loadingVerification": "Cargando verificación, por favor espere.",
    "signup.answerVerification": "Por favor responda la pregunta de verificación.",
    "signup.invalidLogin": "Nombre de usuario o contraseña incorrectos.",
    "signup.genericError": "Algo salió mal.",
    "facility.pennington_sd": "Pennington, SD",
    "facility.campbell_ky": "Campbell, KY",

    "security.heading": "Preguntas de seguridad",
    "security.intro": "Elija 2 preguntas y proporcione respuestas. Las usará para restablecer su contraseña.",
    "security.setupPrompt": "Por favor elija y responda dos preguntas de seguridad. Estas preguntas se usarán para restablecer su contraseña si alguna vez lo necesita.",
    "security.chooseQuestion": "Elija una pregunta",
    "security.yourAnswer": "Su respuesta",
    "security.update": "Actualizar preguntas de seguridad",
    "security.updateSuccess": "Preguntas de seguridad actualizadas.",
    "security.needTwo": "Por favor responda 2 preguntas diferentes.",
    "security.current": "Preguntas de seguridad actuales",
    "security.cancel": "Cancelar",
    "security.save": "Guardar",
    "security.forgotPassword": "¿Olvidó su contraseña?",
    "security.resetTitle": "Restablecer contraseña",
    "security.resetStep1": "Ingrese su nombre de usuario para comenzar.",
    "security.resetStep2": "Responda sus preguntas de seguridad y elija una nueva contraseña.",
    "security.continue": "Continuar",
    "security.newPassword": "Nueva contraseña",
    "security.resetSubmit": "Restablecer contraseña",
    "security.resetSuccess": "Contraseña restablecida. Ha iniciado sesión.",
    "security.backToSignIn": "Volver a iniciar sesión",

    "security.q.first_pet": "¿Cuál era el nombre de su primera mascota?",
    "security.q.birth_city": "¿En qué ciudad nació?",
    "security.q.mothers_maiden": "¿Cuál es el apellido de soltera de su madre?",
    "security.q.first_car": "¿Cuál era la marca de su primer auto?",
    "security.q.elementary_school": "¿Cómo se llamaba su escuela primaria?",
    "security.q.favorite_food": "¿Cuál es su comida favorita?",
    "security.q.childhood_nickname": "¿Cuál era su apodo de infancia?",
    "security.q.street_grew_up": "¿En qué calle creció?",
    "security.q.favorite_color": "¿Cuál es su color favorito?",
    "security.q.favorite_movie": "¿Cuál es su película favorita?",
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
