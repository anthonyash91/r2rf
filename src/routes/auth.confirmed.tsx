import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";

// Destination for Supabase "Confirm signup" / "Reset password" email links
// (Authentication -> URL Configuration -> Site URL, plus the Redirect URLs
// allowlist) — see src/lib/users.functions.ts for the calls that set
// emailRedirectTo/redirectTo to this route.
export const Route = createFileRoute("/auth/confirmed")({
  head: () => ({
    meta: [{ title: "Email Confirmed — Reentry to Recovery" }],
  }),
  component: AuthConfirmedPage,
});

const REDIRECT_DELAY_MS = 3000;

function AuthConfirmedPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  // Supabase redirects here with either #access_token=... (success) or
  // #error=...&error_description=... (expired/invalid link) in the URL
  // fragment. The Supabase client auto-consumes a success token globally;
  // we only need to read the hash ourselves to tell the two cases apart.
  const [hasError, setHasError] = useState<{ description: string | null } | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription = hash.get("error_description");
    if (hash.get("error")) {
      setHasError({ description: errorDescription });
      return;
    }
    const timer = setTimeout(() => {
      navigate({ to: "/signup" });
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-md px-6 py-24 text-center">
        {hasError ? (
          <>
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {lang === "es" ? "Enlace no válido o expirado" : "Link expired or invalid"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es"
                ? "Este enlace ya no es válido. Pide a un administrador que te envíe uno nuevo."
                : "This link is no longer valid. Ask an admin to send you a new one."}
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-[var(--color-accent)]" />
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {lang === "es" ? "Correo electrónico confirmado" : "Email confirmed"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es"
                ? "Tu dirección de correo electrónico ha sido confirmada. Te estamos redirigiendo para iniciar sesión…"
                : "Your email address has been confirmed. Redirecting you to sign in…"}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => navigate({ to: "/signup" })}
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {lang === "es" ? "Ir a iniciar sesión" : "Go to sign in"}
        </button>
      </main>
      <SiteFooter />
    </div>
  );
}
