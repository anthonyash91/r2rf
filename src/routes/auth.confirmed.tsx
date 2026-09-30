import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { LoadingButton } from "@/components/LoadingButton";
import { useAuth } from "@/hooks/use-auth";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { supabase, createEphemeralSupabaseClient } from "@/integrations/supabase/client";
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
  // or #error=...&error_description=... (expired/invalid link). The shared
  // client has detectSessionInUrl disabled (see client.ts) precisely so
  // landing here never signs the browser in on its own — this route parses
  // the fragment itself and decides explicitly per flow type below.
  const [hasError, setHasError] = useState<{ description: string | null } | null>(null);
  const [flowType, setFlowType] = useState<FlowType | null>(null);
  const [loginTimedOut, setLoginTimedOut] = useState(false);
  const [tokens, setTokens] = useState<{ access_token: string; refresh_token: string } | null>(
    null,
  );

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("error")) {
      setHasError({ description: hash.get("error_description") });
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setHasError({ description: null });
      return;
    }
    setTokens({ access_token: accessToken, refresh_token: refreshToken });
    setFlowType(hash.get("type") === "recovery" ? "recovery" : "signup");
  }, []);

  // Signup confirmation: every account that lands here via email confirmation
  // (admin/contributor/facilityUser) belongs in the admin dashboard — go
  // straight there once signed in, instead of bouncing through the sign-in
  // page it would just redirect away from anyway. Unlike recovery, signing
  // in here is the whole point (confirming the email IS the proof of
  // identity), so this flow explicitly signs the shared client in.
  useEffect(() => {
    if (flowType !== "signup" || !tokens) return;
    supabase.auth.setSession(tokens);
  }, [flowType, tokens]);

  useEffect(() => {
    if (flowType !== "signup" || hasError || !user) return;
    navigate({ to: "/admin" });
  }, [flowType, hasError, user, navigate]);

  useEffect(() => {
    if (flowType !== "signup" || hasError) return;
    const timer = setTimeout(() => setLoginTimedOut(true), LOGIN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [flowType, hasError]);

  // Password recovery: unlike signup, this flow never signs the shared
  // client in at all. Otherwise the recovery-link session — indistinguishable
  // from a real login to the rest of the app (SiteHeader, admin guards,
  // etc.) — would grant full account access the instant the page loads,
  // before anyone has proven a new password. Instead, an isolated, throwaway
  // client (never touches localStorage, never fires the shared auth
  // listeners) briefly authenticates only to make the updateUser call, then
  // is discarded — signing in afterward requires the new password like any
  // other login.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setPasswordMut = useToastMutation({
    mutationFn: async (password: string) => {
      if (!tokens) {
        throw new Error(
          lang === "es"
            ? "El enlace ha expirado. Solicita uno nuevo."
            : "This link has expired. Please request a new one.",
        );
      }
      const ephemeral = createEphemeralSupabaseClient();
      const { error: sessionError } = await ephemeral.auth.setSession(tokens);
      if (sessionError) throw sessionError;

      const { error: updateError } = await ephemeral.auth.updateUser({ password });
      if (updateError) throw updateError;
    },
    successMessage:
      lang === "es"
        ? "Contraseña actualizada. Inicia sesión con tu nueva contraseña."
        : "Password updated. Please sign in with your new password.",
    onSuccess: () => {
      navigate({ to: "/signup" });
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
      <main
        className={
          flowType === "recovery" && !hasError
            ? "flex-1 mx-auto w-full max-w-xl px-6 pt-16 pb-11"
            : "flex-1 mx-auto w-full max-w-md px-6 py-24 text-center"
        }
      >
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
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
                <KeyRound className="h-7 w-7 text-[var(--color-accent)]" />
                {lang === "es" ? "Elige una nueva contraseña" : "Set a new password"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "es"
                  ? "Elige una contraseña nueva para tu cuenta."
                  : "Choose a new password for your account."}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-[#fffdf8] px-6 pt-4 pb-2">
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium">
                    {lang === "es" ? "Nueva contraseña" : "New password"}
                  </label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    wrapperClassName="mt-1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <PasswordStrengthMeter password={newPassword} />
                </div>
                <div>
                  <label htmlFor="confirm-new-password" className="text-sm font-medium">
                    {lang === "es" ? "Confirmar contraseña" : "Confirm password"}
                  </label>
                  <PasswordInput
                    id="confirm-new-password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    wrapperClassName="mt-1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end !mt-6">
                  <LoadingButton
                    type="submit"
                    variant="primary"
                    pending={setPasswordMut.isPending}
                    pendingText={lang === "es" ? "Guardando…" : "Saving…"}
                  >
                    {lang === "es" ? "Guardar contraseña" : "Save password"}
                  </LoadingButton>
                </div>
              </form>
            </div>
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
              {lang === "es" ? "Tu correo electrónico ha sido confirmado" : "Your email has been confirmed"}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {lang === "es" ? "Iniciando sesión…" : "Logging you in now…"}
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
