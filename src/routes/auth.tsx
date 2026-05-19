import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { recordMySignupIp } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Reentry to Recovery" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const recordIp = useServerFn(recordMySignupIp);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/admin" });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        if (data.session) {
          try { await recordIp({}); } catch {}
        }
        toast.success(t("auth.created"));
        setSignedUp(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try { await recordIp({}); } catch {}
        navigate({ to: "/admin" });
      }
    } catch (err: any) {
      toast.error(err.message ?? t("auth.failed"));
    } finally {
      setBusy(false);
    }
  }



  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-md px-6 py-16">
        {signedUp ? (
          <>
            <h1 className="font-display text-3xl font-semibold">{t("auth.createAccount")}</h1>
            <div className="mt-8 rounded-md border border-border bg-muted/40 p-6 text-sm">
              Your account has been created. Please verify your account using the email we sent you.
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-semibold">
              {mode === "sign-in" ? t("auth.signIn") : t("auth.createAccount")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("auth.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium">{t("auth.email")}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("auth.password")}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "…" : mode === "sign-in" ? t("auth.signIn") : t("auth.createAccount")}
              </button>
            </form>

            <button
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
            >
              {mode === "sign-in" ? t("auth.toggleToSignUp") : t("auth.toggleToSignIn")}
            </button>
          </>
        )}

        <p className="mt-8 text-xs text-muted-foreground">
          {t("auth.note")}
          <Link to="/" className="ml-1 underline">{t("auth.backToSite")}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
