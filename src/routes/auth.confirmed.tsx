import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { LoadingButton } from "@/components/LoadingButton";
import { useAuth } from "@/hooks/use-auth";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { supabase } from "@/integrations/supabase/client";
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

// If the client never picks up a session from the URL fragment (should be
// near-instant), fall back to a manual sign-in prompt instead of hanging on
// "Logging you in..." forever.
const LOGIN_TIMEOUT_MS = 8000;

type FlowType = "signup" | "recovery";

function AuthConfirmedPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Supabase redirects here with either #access_token=...&type=signup|recovery
  // (success — the client auto-consumes the session from the fragment) or
  // #error=...&error_description=... (expired/invalid link).
  const [hasError, setHasError] = useState<{ description: string | null } | null>(null);
  const [flowType, setFlowType] = useState<FlowType | null>(null);
  const [loginTimedOut, setLoginTimedOut] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      setHasError({ description: hash.get("error_description") });
      return;
    }
    setFlowType(hash.get("type") === "recovery" ? "recovery" : "signup");
  }, []);

  // Signup confirmation: every account that lands here via email confirmation
  // (admin/contributor/facilityUser) belongs in the admin dashboard — go
  // straight there once the client has picked up the session, instead of
  // bouncing through the sign-in page it would just redirect away from anyway.
  useEffect(() => {
    if (flowType !== "signup" || hasError || !user) return;
    navigate({ to: "/admin" });
  }, [flowType, hasError, user, navigate]);

  useEffect(() => {
    if (flowType !== "signup" || hasError) return;
    const timer = setTimeout(() => setLoginTimedOut(true), LOGIN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [flowType, hasError]);

  // Password recovery: the click already established a session (that's how
  // updateUser below can set a new password without asking for the old one)
  // — but unlike signup, we can't skip straight to the dashboard, since the
  // whole point of this link was to let them choose a new password.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setPasswordMut = useToastMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    successMessage: lang === "es" ? "Contraseña actualizada" : "Password updated",
    onSuccess: () => {
      navigate({ to: "/admin" });
    },
  });

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(
        lang === "es"
          ? "La contraseña debe tener al menos 8 caracteres"
          : "Password must be at least 8 characters",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(lang === "es" ? "Las contraseñas no coinciden" : "Passwords don't match");
      return;
    }
    setPasswordMut.mutate(newPassword);
  };

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
            <button
              type="button"
              onClick={() => navigate({ to: "/signup" })}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {lang === "es" ? "Ir a iniciar sesión" : "Go to sign in"}
            </button>
          </>
        ) : flowType === "recovery" ? (
          <>
            <KeyRound className="h-12 w-12 mx-auto text-[var(--color-accent)]" />
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {lang === "es" ? "Elige una nueva contraseña" : "Set a new password"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es"
                ? "Elige una contraseña nueva para tu cuenta."
                : "Choose a new password for your account."}
            </p>
            <form onSubmit={handleSetPassword} className="mt-8 space-y-4 text-left">
              <label className="block">
                <span className="text-sm font-medium">
                  {lang === "es" ? "Nueva contraseña" : "New password"}
                </span>
                <PasswordInput
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">
                  {lang === "es" ? "Confirmar contraseña" : "Confirm password"}
                </span>
                <PasswordInput
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
              </label>
              <LoadingButton
                type="submit"
                variant="primary"
                pending={setPasswordMut.isPending}
                pendingText={lang === "es" ? "Guardando…" : "Saving…"}
                className="w-full justify-center"
              >
                {lang === "es" ? "Guardar contraseña" : "Save password"}
              </LoadingButton>
            </form>
          </>
        ) : loginTimedOut ? (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-[var(--color-accent)]" />
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {lang === "es" ? "Correo electrónico confirmado" : "Email confirmed"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es"
                ? "Tu dirección de correo electrónico ha sido confirmada."
                : "Your email address has been confirmed."}
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/signup" })}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {lang === "es" ? "Ir a iniciar sesión" : "Go to sign in"}
            </button>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-[var(--color-accent)] animate-pulse" />
            <h1 className="mt-6 font-display text-2xl font-semibold">
              {lang === "es" ? "Iniciando sesión…" : "Logging you in now…"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es"
                ? "Tu correo electrónico ha sido confirmado."
                : "Your email address has been confirmed."}
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
