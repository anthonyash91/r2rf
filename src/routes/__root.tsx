import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect, useLayoutEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { AuthCheckingProvider } from "@/lib/auth-checking-context";
import { installGlobalErrorReporter, reportError } from "@/lib/client-error-reporter";
import { OnScreenKeyboardProvider } from "@/components/OnScreenKeyboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  // Preserve ?site= so the "Go home" link keeps the user inside their facility's context
  // rather than landing on the generic homepage. Starts null (matching the
  // server, which has no sessionStorage) and is filled in by the layout
  // effect below right after hydration — reading it directly during render
  // made the link's href differ between server and client on first paint,
  // the same "Hydration failed" (React error #418) class fixed elsewhere.
  const [activeSite, setActiveSite] = useState<string | null>(null);
  useLayoutEffect(() => {
    setActiveSite(window.sessionStorage.getItem("active-facility-slug"));
  }, []);
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.body")}</p>
        <div className="mt-6">
          <Link
            to="/"
            search={activeSite ? { site: activeSite } : {}}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("notFound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  // Report the error to the server-side error log in addition to the console.
  // Effect runs on every new error so each distinct crash is recorded once.
  useEffect(() => {
    reportError(error, { kind: "react.errorBoundary" });
  }, [error]);
  const router = useRouter();

  // This is the root, catch-all error boundary — it can render for a crash
  // that originated anywhere in the tree, including inside I18nProvider
  // itself. Calling useI18n() here would throw a second error ("must be
  // used inside I18nProvider") if that's ever what broke, defeating the
  // point of a last-resort fallback. Showing both languages as static text
  // is the one thing that can't itself fail this way.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load / Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
          <br />
          Ocurrió un error de nuestra parte. Intenta actualizar la página o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again / Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home / Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Reentry to Recovery Content Library" },
      {
        name: "description",
        content:
          "A content library app organizing resources into categories like health, parenting, and recovery.",
      },
      { property: "og:title", content: "Reentry to Recovery Content Library" },
      {
        property: "og:description",
        content:
          "A content library app organizing resources into categories like health, parenting, and recovery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Reentry to Recovery Content Library" },
      {
        name: "twitter:description",
        content:
          "A content library app organizing resources into categories like health, parenting, and recovery.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Install window.onerror + unhandledrejection listeners exactly once at app boot.
  useEffect(() => {
    installGlobalErrorReporter();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthCheckingProvider>
        <I18nProvider>
          {/* App-wide, so every IconButton/TooltipWrap usage has a provider
              ancestor regardless of where it's rendered — components used to
              need their own local <TooltipProvider>, which was easy to forget
              (that gap is what caused the "Tooltip must be used within
              TooltipProvider" crashes logged from /admin/facilities). The
              existing local wrappers are harmless now, just redundant. */}
          <TooltipProvider delayDuration={150}>
            <OnScreenKeyboardProvider>
              <ConfirmDialogProvider>
                <Outlet />
                <Toaster />
                <RoleSwitcher />
              </ConfirmDialogProvider>
            </OnScreenKeyboardProvider>
          </TooltipProvider>
        </I18nProvider>
      </AuthCheckingProvider>
    </QueryClientProvider>
  );
}
