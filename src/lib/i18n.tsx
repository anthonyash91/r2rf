import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "es";

type Dict = Record<string, string>;

const translations: Record<Language, Dict> = {
  en: {
    "nav.categories": "Categories",
    "nav.privacy": "Privacy",
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
    "dashboard.statHours": "Time Spent",
    "dashboard.statStreak": "Day Streak",
    "dashboard.categoryProgress": "Category Progress",
    "dashboard.resumeLabel": "Pick Up Where You Left Off",
    "dashboard.resumeContinue": "Continue",
    "dashboard.itemsCompleted": "{done} of {total} completed",
    "dashboard.lockedNav": "Please set up your security questions before leaving this page.",
    "dashboard.saving": "Saving…",
    "nav.adminSignIn": "Admin",
    "nav.adminSignOut": "Sign out",
    "nav.language": "Español",
    "site.tagline": "Content library",
    "footer.crisis": "If you are in crisis, call or text",
    "footer.privacy": "Privacy",
    "footer.terms": "Terms of Service",

    "home.loading": "Loading…",
    "home.categories": "Categories",
    "home.category": "Category",
    "home.collections": "{count} collections",
    "home.collection": "{count} collection",
    "home.empty": "No categories yet.",
    "home.item": "Item",
    "home.items": "Items",
    "home.searchPlaceholder": "Search resources…",
    "home.searchResult": "{count} result for \"{query}\"",
    "home.searchResults": "{count} results for \"{query}\"",
    "home.searchNoResults": "No results found for \"{query}\"",
    "home.searchIn": "in {category}",

    "bookmark.save": "Save for later",
    "bookmark.saved": "Saved",
    "bookmark.remove": "Remove bookmark",

    "rating.helpful": "Helpful",
    "rating.notHelpful": "Not helpful",

    "monthly.items": "items",
    "monthly.timeSpent": "time spent",
    "monthly.achievements": "achievements",
    "monthly.achievementsEarned": "Keep it up!",
    "monthly.more": "↑ {n} more than last month",
    "monthly.fewer": "↓ {n} fewer than last month",
    "monthly.same": "Same as last month",
    "monthly.newThisMonth": "First month — keep it up!",
    "monthly.noTime": "No time tracked last month",
    "monthly.msg0": "Every resource you complete is a step forward.",
    "monthly.msg1": "Progress doesn't have to be big — it just has to be yours.",
    "monthly.msg2": "You're showing up for yourself. That matters.",
    "monthly.msg3": "One day at a time, one resource at a time.",
    "monthly.msg4": "The work you're doing now is building the life you want.",
    "monthly.msg5": "Consistency is how change happens.",
    "monthly.msg6": "Learning is an act of hope.",
    "monthly.msg7": "You're investing in yourself — that's never wasted.",
    "monthly.msg8": "Keep going. Every step counts.",
    "monthly.msg9": "Growth looks different every day. You're growing.",
    "monthly.msg10": "The fact that you're here says everything.",
    "monthly.msg11": "Small wins still count as wins.",
    "monthly.msg12": "You are more than your circumstances.",
    "monthly.msg13": "Every page you read is ground you've gained.",
    "monthly.msg14": "Showing up is the hardest part. You're doing it.",

    "dashboard.tabSaved": "Saved",
    "dashboard.savedEmpty": "No saved resources yet.",
    "dashboard.savedEmptyHint": "Tap the bookmark icon on any resource to save it here.",

    "dashboard.tabAchievements": "Achievements",
    "dashboard.achievementsCount": "{earned} of {total} earned",

    "achievement.category.first_steps": "First steps",
    "achievement.category.completion": "Completion",
    "achievement.category.streaks": "Streaks",
    "achievement.category.time": "Time spent",

    "achievement.first_item.title": "First resource",
    "achievement.first_item.desc": "Complete your first content item",
    "achievement.first_program.title": "Explorer",
    "achievement.first_program.desc": "Start your first category",
    "achievement.items_10.title": "10 resources",
    "achievement.items_10.desc": "Complete 10 content items",
    "achievement.items_25.title": "25 resources",
    "achievement.items_25.desc": "Complete 25 content items",
    "achievement.items_50.title": "50 resources",
    "achievement.items_50.desc": "Complete 50 content items",
    "achievement.items_100.title": "100 resources",
    "achievement.items_100.desc": "Complete 100 content items",
    "achievement.program_1.title": "Category graduate",
    "achievement.program_1.desc": "Complete all items in a category",
    "achievement.program_5.title": "5 categories finished",
    "achievement.program_5.desc": "Complete all items in 5 categories",
    "achievement.streak_7.title": "7-day streak",
    "achievement.streak_7.desc": "Log in 7 days in a row",
    "achievement.streak_30.title": "30-day streak",
    "achievement.streak_30.desc": "Log in 30 days in a row",
    "achievement.time_5h.title": "5 hours in",
    "achievement.time_5h.desc": "Spend 5 hours actively learning",
    "achievement.time_10h.title": "10 hours in",
    "achievement.time_10h.desc": "Spend 10 hours actively learning",
    "achievement.time_50h.title": "50 hours in",
    "achievement.time_50h.desc": "Spend 50 hours actively learning",
    "achievement.toast": "Achievement unlocked: {title}",

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
    "category.markedWatched": "Watched",
    "category.notWatched": "Not watched",
    "category.markedListened": "Listened",
    "category.notListened": "Not listened to",
    "category.markedClicked": "Clicked",
    "category.notClicked": "Not clicked",
    "category.markedAttended": "Attended",
    "category.notAttended": "Not attended",
    "category.markedViewed": "Viewed",
    "category.notViewed": "Not viewed",
    "category.acknowledge": "Acknowledge",
    "category.acknowledged": "Acknowledged",
    "category.exemptDisclaimer": "Doesn't count toward your progress",
    "category.exemptTooltip": "This item is informational and doesn't count toward your progress",

    "category.markReadError": "Couldn't update progress.",
    "category.completedHeadline": "You completed {name}",
    "category.completedMessage": "You put in the work. That's worth recognizing.",
    "category.completedClose": "Keep going",

    "pdf.loading": "Loading PDF…",
    "pdf.stillLoading": "Still loading, please be patient…",
    "pdf.failed": "Failed to load PDF.",

    "dashboard.progress": "Your progress",
    "dashboard.progressItems": "{done}/{total} items completed",
    "dashboard.progressEmpty": "Start a category to track your progress.",
    "dashboard.tierLabel": "Your engagement level at your facility:",
    "dashboard.tierTopReaders": "top {pct}% of readers",
    "dashboard.tierMeta": "Based on time spent reading · Updates daily",
    "dashboard.tierUpdated": "Last updated {date}",
    "dashboard.tierStats": "{completed} completed · {started} started",
    "dashboard.tierName.Top Reader": "Top Reader",
    "dashboard.tierName.Active Reader": "Active Reader",
    "dashboard.tierName.Getting Started": "Getting Started",
    "dashboard.tierName.Just Joined": "Just Joined",

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
    "signup.facilityMismatch": "The account you're trying to sign into's PIN doesn't match the PIN used to sign in to this device. Please sign in with your own account or sign out of this device and sign back in using your PIN.",
    "signup.pinAlreadyRegistered": "The PIN signed into this device already has an account associated with it. Please sign in with your username and password. If you feel this is an error, please contact tech support.",
    "signup.noFacilityBlock": "Sign up is only available when you access the website through the service on your device.",
    "signup.wrongLinkBlock": "Looks like you're trying to login using the wrong link. Make sure you're accessing this website through the service on your device.",
    "signup.genericError": "Something went wrong.",
    "signup.disclosureHeading": "Before you sign up — tap to read",
    "signup.disclosureBody": "The Reentry to Recovery library is free and your participation is completely voluntary. Creating an account has no effect on your status or privileges at your facility.\n\nWhat we save about you:\n• Your name, username, and password (your password is encrypted — we cannot read it)\n• Your facility and inmate PIN — used to connect your account to your device\n• Two security questions and answers — used only if you need to reset your password\n• Which resources you open, how far you get, and when you complete them\n• How much time you actively spend on each resource\n• Ratings you give to resources (\"Helpful\" / \"Not Helpful\") — visible to your facility staff in your individual progress report\n• Resources you bookmark for later\n• The dates you log in\n\nWhy we save it:\n• To show you your personal progress dashboard\n• To let facility staff and our organization see how the program is being used\n• To report outcomes to the organizations that fund this program\n\nWe do not sell your information. We do not use advertising.",
    "signup.disclosureCheckbox": "I understand what information is collected and agree to the Terms of Service and Privacy Policy.",
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
    "nav.privacy": "Privacidad",
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
    "dashboard.statHours": "Tiempo dedicado",
    "dashboard.statStreak": "Días seguidos",
    "dashboard.categoryProgress": "Progreso por categoría",
    "dashboard.resumeLabel": "Continúa Donde Lo Dejaste",
    "dashboard.resumeContinue": "Continuar",
    "dashboard.itemsCompleted": "{done} de {total} completados",
    "dashboard.lockedNav": "Por favor configure sus preguntas de seguridad antes de salir de esta página.",
    "dashboard.saving": "Guardando…",
    "nav.adminSignIn": "Administrador",
    "nav.adminSignOut": "Cerrar sesión",
    "nav.language": "English",
    "site.tagline": "Biblioteca de contenido",
    "footer.crisis": "Si está en crisis, llame o envíe un mensaje al",
    "footer.privacy": "Privacidad",
    "footer.terms": "Términos de servicio",

    "home.loading": "Cargando…",
    "home.categories": "Categorías",
    "home.category": "Categoría",
    "home.collections": "{count} colecciones",
    "home.collection": "{count} colección",
    "home.empty": "Aún no hay categorías.",
    "home.item": "Recurso",
    "home.items": "Recursos",
    "home.searchPlaceholder": "Buscar recursos…",
    "home.searchResult": "{count} resultado para \"{query}\"",
    "home.searchResults": "{count} resultados para \"{query}\"",
    "home.searchNoResults": "No se encontraron resultados para \"{query}\"",
    "home.searchIn": "en {category}",

    "bookmark.save": "Guardar para después",
    "bookmark.saved": "Guardado",
    "bookmark.remove": "Quitar marcador",

    "rating.helpful": "Útil",
    "rating.notHelpful": "No útil",

    "monthly.items": "recursos",
    "monthly.timeSpent": "tiempo dedicado",
    "monthly.achievements": "logros",
    "monthly.achievementsEarned": "¡Sigue así!",
    "monthly.more": "↑ {n} más que el mes pasado",
    "monthly.fewer": "↓ {n} menos que el mes pasado",
    "monthly.same": "Igual que el mes pasado",
    "monthly.newThisMonth": "¡Primer mes — sigue así!",
    "monthly.noTime": "Sin tiempo registrado el mes pasado",
    "monthly.msg0": "Cada recurso que completas es un paso adelante.",
    "monthly.msg1": "El progreso no tiene que ser grande — solo tiene que ser tuyo.",
    "monthly.msg2": "Estás apareciendo por ti mismo. Eso importa.",
    "monthly.msg3": "Un día a la vez, un recurso a la vez.",
    "monthly.msg4": "El trabajo que haces ahora construye la vida que quieres.",
    "monthly.msg5": "La constancia es como ocurre el cambio.",
    "monthly.msg6": "Aprender es un acto de esperanza.",
    "monthly.msg7": "Estás invirtiendo en ti mismo — eso nunca se desperdicia.",
    "monthly.msg8": "Sigue adelante. Cada paso cuenta.",
    "monthly.msg9": "El crecimiento se ve diferente cada día. Estás creciendo.",
    "monthly.msg10": "El hecho de que estés aquí lo dice todo.",
    "monthly.msg11": "Las pequeñas victorias también cuentan.",
    "monthly.msg12": "Eres más que tus circunstancias.",
    "monthly.msg13": "Cada página que lees es terreno ganado.",
    "monthly.msg14": "Aparecer es lo más difícil. Lo estás haciendo.",

    "dashboard.tabSaved": "Guardados",
    "dashboard.savedEmpty": "Aún no hay recursos guardados.",
    "dashboard.savedEmptyHint": "Toca el ícono de marcador en cualquier recurso para guardarlo aquí.",

    "dashboard.tabAchievements": "Logros",
    "dashboard.achievementsCount": "{earned} de {total} obtenidos",

    "achievement.category.first_steps": "Primeros pasos",
    "achievement.category.completion": "Completados",
    "achievement.category.streaks": "Rachas",
    "achievement.category.time": "Tiempo dedicado",

    "achievement.first_item.title": "Primer recurso",
    "achievement.first_item.desc": "Completa tu primer recurso de contenido",
    "achievement.first_program.title": "Explorador",
    "achievement.first_program.desc": "Comienza tu primera categoría",
    "achievement.items_10.title": "10 recursos",
    "achievement.items_10.desc": "Completa 10 recursos de contenido",
    "achievement.items_25.title": "25 recursos",
    "achievement.items_25.desc": "Completa 25 recursos de contenido",
    "achievement.items_50.title": "50 recursos",
    "achievement.items_50.desc": "Completa 50 recursos de contenido",
    "achievement.items_100.title": "100 recursos",
    "achievement.items_100.desc": "Completa 100 recursos de contenido",
    "achievement.program_1.title": "Graduado de categoría",
    "achievement.program_1.desc": "Completa todos los recursos de una categoría",
    "achievement.program_5.title": "5 categorías completadas",
    "achievement.program_5.desc": "Completa todos los recursos de 5 categorías",
    "achievement.streak_7.title": "Racha de 7 días",
    "achievement.streak_7.desc": "Inicia sesión 7 días seguidos",
    "achievement.streak_30.title": "Racha de 30 días",
    "achievement.streak_30.desc": "Inicia sesión 30 días seguidos",
    "achievement.time_5h.title": "5 horas dedicadas",
    "achievement.time_5h.desc": "Dedica 5 horas al aprendizaje activo",
    "achievement.time_10h.title": "10 horas dedicadas",
    "achievement.time_10h.desc": "Dedica 10 horas al aprendizaje activo",
    "achievement.time_50h.title": "50 horas dedicadas",
    "achievement.time_50h.desc": "Dedica 50 horas al aprendizaje activo",
    "achievement.toast": "Logro desbloqueado: {title}",

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
    "category.markedWatched": "Visto",
    "category.notWatched": "No visto",
    "category.markedListened": "Escuchado",
    "category.notListened": "No escuchado",
    "category.markedClicked": "Clicado",
    "category.notClicked": "No clicado",
    "category.markedAttended": "Asistido",
    "category.notAttended": "No asistido",
    "category.markedViewed": "Visto",
    "category.notViewed": "No visto",
    "category.acknowledge": "Confirmar",
    "category.acknowledged": "Confirmado",
    "category.exemptDisclaimer": "No cuenta para tu progreso",
    "category.exemptTooltip": "Este elemento es informativo y no cuenta para tu progreso",

    "category.markReadError": "No se pudo actualizar el progreso.",
    "category.completedHeadline": "Completaste {name}",
    "category.completedMessage": "Hiciste el trabajo. Eso merece reconocimiento.",
    "category.completedClose": "Sigue adelante",

    "pdf.loading": "Cargando PDF…",
    "pdf.stillLoading": "Aún cargando, por favor sea paciente…",
    "pdf.failed": "No se pudo cargar el PDF.",

    "dashboard.progress": "Tu progreso",
    "dashboard.progressItems": "{done}/{total} elementos completados",
    "dashboard.progressEmpty": "Comienza una categoría para ver tu progreso.",
    "dashboard.tierLabel": "Tu nivel de participación en tu institución:",
    "dashboard.tierTopReaders": "top {pct}% de lectores",
    "dashboard.tierMeta": "Basado en el tiempo de lectura · Se actualiza diariamente",
    "dashboard.tierUpdated": "Última actualización: {date}",
    "dashboard.tierStats": "{completed} completados · {started} iniciados",
    "dashboard.tierName.Top Reader": "Lector destacado",
    "dashboard.tierName.Active Reader": "Lector activo",
    "dashboard.tierName.Getting Started": "Comenzando",
    "dashboard.tierName.Just Joined": "Recién unido",

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
    "signup.facilityMismatch": "El PIN de la cuenta en la que intentas iniciar sesión no coincide con el PIN utilizado para iniciar sesión en este dispositivo. Por favor inicia sesión con tu propia cuenta o cierra sesión en este dispositivo y vuelve a iniciar sesión con tu PIN.",
    "signup.pinAlreadyRegistered": "El PIN ingresado en este dispositivo ya tiene una cuenta asociada. Por favor inicia sesión con tu nombre de usuario y contraseña. Si sientes que esto es un error, comunícate con soporte técnico.",
    "signup.noFacilityBlock": "El registro solo está disponible cuando accedes al sitio web a través del servicio en tu dispositivo.",
    "signup.wrongLinkBlock": "Parece que estás intentando iniciar sesión con el enlace incorrecto. Asegúrate de acceder a este sitio web a través del servicio en tu dispositivo.",
    "signup.genericError": "Algo salió mal.",
    "signup.disclosureHeading": "Antes de registrarte — toca para leer",
    "signup.disclosureBody": "La biblioteca Reentry to Recovery es gratuita y tu participación es completamente voluntaria. Crear una cuenta no afecta tu estatus ni tus privilegios en tu instalación.\n\nLo que guardamos sobre ti:\n• Tu nombre, nombre de usuario y contraseña (encriptada — no podemos leerla)\n• Tu instalación y PIN de recluso — para conectar tu cuenta a tu dispositivo\n• Dos preguntas de seguridad y respuestas — solo usadas si necesitas restablecer tu contraseña\n• Qué recursos abres, qué tan lejos llegas y cuándo los completas\n• Cuánto tiempo activo pasas en cada recurso\n• Calificaciones que das a los recursos (visibles al personal de tu instalación)\n• Recursos que guardas para después\n• Las fechas en que inicias sesión\n\nPor qué lo guardamos:\n• Para mostrarte tu tablero de progreso personal\n• Para que el personal de tu instalación vea cómo se usa el programa\n• Para reportar resultados a las organizaciones que financian este programa\n\nNo vendemos tu información. No usamos publicidad.",
    "signup.disclosureCheckbox": "Entiendo qué información se recopila y acepto los Términos de Servicio y la Política de Privacidad.",
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
      // URL parameter takes priority over localStorage.
      // Fix malformed `?user=1234?language=es` (two `?` characters) by converting
      // the second `?` to `&` so URLSearchParams can parse it correctly.
      const search = window.location.search.replace(/\?(?=.*=)/g, (m, o) => o === 0 ? m : "&");
      const params = new URLSearchParams(search);
      const urlLang = params.get("language") as Language | null;
      if (urlLang === "en" || urlLang === "es") {
        setLangState(urlLang);
        localStorage.setItem(STORAGE_KEY, urlLang);
        return;
      }
      // Fall back to the last language the user chose, persisted in localStorage.
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
    // Fallback chain: current language → English → the raw key itself.
    // Using the key as a last resort keeps the UI functional even when
    // a translation is missing rather than rendering an empty string.
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

/** Translate a content type label using admin-configured Spanish names.
 *  Falls back to the original type string when no translation is set. */
export function translateType(
  lang: Language,
  type: string,
  typeNamesEs?: Record<string, string>,
): string {
  if (lang !== "es" || !type) return type;
  return typeNamesEs?.[type.trim().toLowerCase()] ?? type;
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
