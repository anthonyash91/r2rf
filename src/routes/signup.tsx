import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  getSignupChallenge,
  signupUser,
} from "@/lib/user-signup.functions";
import { syntheticEmail, FACILITY_OPTIONS } from "@/lib/user-signup";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account — Reentry to Recovery" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-up" | "sign-in">("sign-up");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [facility, setFacility] = useState<string>(FACILITY_OPTIONS[0].value);
  const [answer, setAnswer] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);

  const getChallenge = useServerFn(getSignupChallenge);
  const submitSignup = useServerFn(signupUser);

  const challengeQuery = useQuery({
    queryKey: ["signup-challenge"],
    queryFn: () => getChallenge(),
    enabled: mode === "sign-up",
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const uname = username.trim().toLowerCase();
      if (mode === "sign-up") {
        if (!challengeQuery.data) {
          toast.error(t("signup.loadingVerification"));
          return;
        }
        const ans = Number(answer);
        if (!Number.isFinite(ans)) {
          toast.error(t("signup.answerVerification"));
          return;
        }
        await submitSignup({
          data: {
            username: uname,
            password,
            facility: facility as "pennington_sd" | "campbell_ky",
            challengeToken: challengeQuery.data.token,
            challengeAnswer: ans,
            honeypot,
          },
        });
        const { error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail(uname),
          password,
        });
        if (error) throw error;
        toast.success(t("signup.welcome"));
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail(uname),
          password,
        });
        if (error) throw new Error(t("signup.invalidLogin"));
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? t("signup.genericError"));
      if (mode === "sign-up") challengeQuery.refetch();
      setAnswer("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          {mode === "sign-up" ? t("signup.title") : t("signup.signInTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "sign-up"
            ? t("signup.subtitleSignUp")
            : t("signup.subtitleSignIn")}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" autoComplete="off">
          {/* honeypot */}
          <div className="hidden" aria-hidden>
            <label>
              {t("signup.honeypot")}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium">{t("signup.username")}</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]{3,32}"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t("signup.usernamePlaceholder")}
            />
          </div>

          <div>
            <label className="text-sm font-medium">{t("signup.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {mode === "sign-up" && (
            <>
              <div>
                <label className="text-sm font-medium">{t("signup.facility")}</label>
                <Select value={facility} onValueChange={setFacility}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {t(`facility.${f.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  {t("signup.verification")}{" "}
                  {challengeQuery.data
                    ? t("signup.verificationQuestion", { a: challengeQuery.data.a, b: challengeQuery.data.b })
                    : t("signup.loading")}
                </label>
                <input
                  type="number"
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "sign-up" && !challengeQuery.data)}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "…" : mode === "sign-up" ? t("signup.createAccount") : t("signup.signIn")}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "sign-up" ? "sign-in" : "sign-up");
            setAnswer("");
          }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-up" ? t("signup.toggleToSignIn") : t("signup.toggleToSignUp")}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="underline">{t("signup.backToSite")}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
