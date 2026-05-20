import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { toast } from "sonner";
import {
  getSignupChallenge,
  signupUser,
  syntheticEmail,
  FACILITY_OPTIONS,
} from "@/lib/user-signup.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account — Reentry to Recovery" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
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
          toast.error("Loading verification, please wait.");
          return;
        }
        const ans = Number(answer);
        if (!Number.isFinite(ans)) {
          toast.error("Please answer the verification question.");
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
        toast.success("Welcome!");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail(uname),
          password,
        });
        if (error) throw new Error("Incorrect username or password.");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong.");
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
          {mode === "sign-up" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "sign-up"
            ? "Sign up with a username and password. No email required."
            : "Sign in with your username and password."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" autoComplete="off">
          {/* honeypot */}
          <div className="hidden" aria-hidden>
            <label>
              Leave this field empty
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
            <label className="text-sm font-medium">Username</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]{3,32}"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. jdoe_92"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
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
                <label className="text-sm font-medium">Facility</label>
                <Select value={facility} onValueChange={setFacility}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FACILITY_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">
                  Verification:{" "}
                  {challengeQuery.data
                    ? `What is ${challengeQuery.data.a} + ${challengeQuery.data.b}?`
                    : "Loading…"}
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
            {busy ? "…" : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "sign-up" ? "sign-in" : "sign-up");
            setAnswer("");
          }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "sign-up"
            ? "Already have an account? Sign in"
            : "Need an account? Sign up"}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="underline">Back to site</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
