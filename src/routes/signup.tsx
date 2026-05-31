import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  checkInmatePin,
} from "@/lib/user-signup.functions";
import { getResetQuestions, resetPassword } from "@/lib/password-reset.functions";
import { syntheticEmail } from "@/lib/user-signup";
import { listFacilities } from "@/lib/facilities.functions";
import { useActiveFacilitySlug, setActiveFacilitySlug } from "@/lib/facility-context";
import { useActiveInmatePin, setActiveInmatePin } from "@/lib/inmate-pin-context";
import { useAuthChecking } from "@/lib/auth-checking-context";
import { questionLabel } from "@/lib/security-questions";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, KeyRound, Lock, Loader2, LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { PasswordInput } from "@/components/PasswordInput";
import { OnScreenKeyboardProvider, useKeyboardInput } from "@/components/OnScreenKeyboard";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create your account — Reentry to Recovery" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: SignupPage,
});

type Mode = "sign-up" | "sign-in" | "reset";

function SignupPage() {
  return (
    <OnScreenKeyboardProvider>
      <SignupPageContent />
    </OnScreenKeyboardProvider>
  );
}

function SignupPageContent() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [facility, setFacility] = useState<string>("");
  const [facilityOpen, setFacilityOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const { isChecking: checkingSignIn, setIsChecking: setCheckingSignIn } = useAuthChecking();
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  

  // Reset flow
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetUsername, setResetUsername] = useState("");
  const [resetQuestionKeys, setResetQuestionKeys] = useState<string[]>([]);
  const [resetAnswer1, setResetAnswer1] = useState("");
  const [resetAnswer2, setResetAnswer2] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const getChallenge = useServerFn(getSignupChallenge);
  const submitSignup = useServerFn(signupUser);
  const fetchResetQuestions = useServerFn(getResetQuestions);
  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilities = facilitiesQuery.data?.facilities ?? [];
  const activeFacilitySlug = useActiveFacilitySlug();
  const activeInmatePin = useActiveInmatePin();
  // If the user arrived via a facility slug, that facility is forced
  const lockedFacility = activeFacilitySlug
    ? (facilities.find((f) => f.siteId === activeFacilitySlug) ?? null)
    : null;
  useEffect(() => {
    if (lockedFacility) {
      setFacility(lockedFacility.value);
    } else if (!facility && facilities.length) {
      setFacility(facilities[0].value);
    }
  }, [facilities, facility, lockedFacility]);

  // Check whether the persisted inmate PIN is already registered for this facility
  const checkPin = useServerFn(checkInmatePin);
  const pinCheckQuery = useQuery({
    queryKey: ["inmate-pin-check", lockedFacility?.value, activeInmatePin],
    enabled: !!lockedFacility?.value && !!activeInmatePin,
    staleTime: 30 * 1000,
    queryFn: () => checkPin({ data: { facilityValue: lockedFacility!.value, inmatePin: activeInmatePin! } }),
  });

  // Signup disabled reasons (sign-in and reset modes are never blocked)
  const facilitySlugActive = !!activeFacilitySlug;
  const signupBlockReason: "no-facility" | "no-pin" | "pin-taken" | null =
    mode !== "sign-up" ? null
    : !facilitySlugActive ? "no-facility"
    : !activeInmatePin ? "no-pin"
    : pinCheckQuery.data?.available === false ? "pin-taken"
    : null;
  const submitReset = useServerFn(resetPassword);

  // On-screen keyboard bindings (suppress native keyboard, route key presses)
  const kbUsername = useKeyboardInput(username, setUsername);
  const kbPassword = useKeyboardInput(password, setPassword);
  const kbConfirm = useKeyboardInput(confirmPassword, setConfirmPassword);
  const kbFirst = useKeyboardInput(firstName, setFirstName);
  const kbLast = useKeyboardInput(lastName, setLastName);
  const kbAnswer = useKeyboardInput(answer, setAnswer);
  const kbResetUsername = useKeyboardInput(resetUsername, setResetUsername);
  const kbResetA1 = useKeyboardInput(resetAnswer1, setResetAnswer1);
  const kbResetA2 = useKeyboardInput(resetAnswer2, setResetAnswer2);
  const kbResetNew = useKeyboardInput(resetNewPassword, setResetNewPassword);
  const kbResetConfirm = useKeyboardInput(resetConfirmPassword, setResetConfirmPassword);

  const challengeQuery = useQuery({
    queryKey: ["signup-challenge"],
    queryFn: () => getChallenge(),
    enabled: mode === "sign-up",
    staleTime: 4 * 60 * 1000,
  });

  useEffect(() => {
    if (loading || !user || checkingSignIn) return;
    // Role-based redirect after auth state is known
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const roles = (data ?? []).map((r: any) => r.role as string);
        const goesAdmin = roles.includes("admin") || roles.includes("contributor") || roles.includes("facilityUser");
        if (redirectTo) {
          // Always honour an explicit redirect param (e.g. from requireAdminBeforeLoad)
          navigate({ to: redirectTo as any });
        } else if (goesAdmin) {
          navigate({ to: "/admin" });
        } else if (mode === "sign-up") {
          navigate({ to: "/dashboard", search: { tab: "account" } as any });
        } else {
          navigate({ to: "/dashboard", search: {} as any });
        }
      });
  }, [user, loading, navigate, mode, redirectTo, checkingSignIn]);

  // Debounced username availability check (sign-up only)
  useEffect(() => {
    if (mode !== "sign-up") {
      setUsernameStatus("idle");
      return;
    }
    const uname = username.trim().toLowerCase();
    if (!uname) {
      setUsernameStatus("idle");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,32}$/.test(uname)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_exists", { _username: uname });
      if (error) {
        setUsernameStatus("idle");
        return;
      }
      setUsernameStatus(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(handle);
  }, [username, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const uname = username.trim().toLowerCase();
        if (usernameStatus === "taken") {
          toast.error(t("signup.usernameTaken"));
          return;
        }
        if (password !== confirmPassword) {
          toast.error(t("signup.passwordMismatch"));
          return;
        }
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
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            password,
            facility,
            inmatePin: activeInmatePin ?? undefined,
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
        // redirect handled by useEffect once role loads
      } else {
        const id = username.trim();
        const email = id.includes("@") ? id.toLowerCase() : syntheticEmail(id.toLowerCase());
        // Block the redirect useEffect until our post-auth check finishes
        setCheckingSignIn(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(t("signup.invalidLogin"));

        // Role-aware post-auth checks:
        // - Privileged users (admin/contributor/facilityUser) → clear facility/PIN context
        //   so nav links don't send them to ?site= URLs
        // - Regular users via facility link → verify facility + PIN match
        const { data: { user: authedUser } } = await supabase.auth.getUser();
        if (authedUser) {
          const { data: roleRow } = await supabase.from("user_roles").select("role")
            .eq("user_id", authedUser.id)
            .in("role", ["admin", "contributor", "facilityUser"])
            .maybeSingle();

          if (roleRow) {
            // Privileged — clear session so nav/redirects don't carry facility params
            setActiveFacilitySlug(null);
            setActiveInmatePin(null);
          } else if (lockedFacility) {
            // Regular user via ?site= link — verify they belong to this facility + PIN
            const { data: profile } = await (supabase as any)
              .from("user_profiles").select("facility, inmate_pin")
              .eq("user_id", authedUser.id).maybeSingle();
            const facilityMatch = profile?.facility === lockedFacility.value;
            const pinMatch = !activeInmatePin || profile?.inmate_pin === activeInmatePin;
            if (!facilityMatch || !pinMatch) {
              await supabase.auth.signOut();
              setFacilityError(t("signup.facilityMismatch"));
              return; // don't show toast — inline error handles it
            }
          }
        }
        // Check passed — unblock the redirect useEffect
        setCheckingSignIn(false);
        // redirect handled by useEffect once role loads
      }
    } catch (err: any) {
      setCheckingSignIn(false); // unblock even on failure so UI isn't stuck
      toast.error(err.message ?? t("signup.genericError"));
      if (mode === "sign-up") challengeQuery.refetch();
      setAnswer("");
    } finally {
      setBusy(false);
    }
  }


  async function handleResetStart(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const uname = resetUsername.trim().toLowerCase();
      const { keys } = await fetchResetQuestions({ data: { username: uname } });
      setResetQuestionKeys(keys);
      setResetStep(2);
    } catch (err: any) {
      toast.error(err.message ?? t("signup.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (resetNewPassword !== resetConfirmPassword) {
        toast.error(t("signup.passwordMismatch"));
        setBusy(false);
        return;
      }
      const uname = resetUsername.trim().toLowerCase();
      await submitReset({
        data: {
          username: uname,
          answers: [
            { key: resetQuestionKeys[0], value: resetAnswer1 },
            { key: resetQuestionKeys[1], value: resetAnswer2 },
          ],
          newPassword: resetNewPassword,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail(uname),
        password: resetNewPassword,
      });
      if (error) throw error;
      toast.success(t("security.resetSuccess"));
      navigate({ to: "/dashboard", search: {} as any });
    } catch (err: any) {
      toast.error(err.message ?? t("signup.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-xl px-6 pt-16 pb-11">

        {mode === "reset" ? (
          <>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
                <KeyRound className="h-7 w-7 text-[var(--color-accent)]" />
                {t("security.resetTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {resetStep === 1 ? t("security.resetStep1") : t("security.resetStep2")}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-[#fffdf8] px-6 pt-4 pb-6">
            {resetStep === 1 ? (
              <form onSubmit={handleResetStart} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t("signup.username")}</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9_]{3,32}"
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)} {...kbResetUsername}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end !mt-6">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Saving…" : t("security.continue")}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    {questionLabel(t, resetQuestionKeys[0] ?? "")}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={200}
                    value={resetAnswer1}
                    onChange={(e) => setResetAnswer1(e.target.value)} {...kbResetA1}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {questionLabel(t, resetQuestionKeys[1] ?? "")}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={200}
                    value={resetAnswer2}
                    onChange={(e) => setResetAnswer2(e.target.value)} {...kbResetA2}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("security.newPassword")}</label>
                  <PasswordInput
                    required
                    minLength={8}
                    maxLength={72}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)} {...kbResetNew}
                    wrapperClassName="mt-1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <PasswordStrengthMeter password={resetNewPassword} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t("signup.confirmPassword")}</label>
                  <PasswordInput
                    required
                    minLength={8}
                    maxLength={72}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)} {...kbResetConfirm}
                    wrapperClassName="mt-1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  {resetConfirmPassword.length > 0 && resetConfirmPassword !== resetNewPassword && (
                    <p className="mt-1 text-xs text-destructive">{t("signup.passwordMismatch")}</p>
                  )}
                </div>
                <div className="flex justify-end !mt-6">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Saving…" : t("security.resetSubmit")}
                  </button>
                </div>
              </form>
            )}

            </div>

            <button
              onClick={() => {
                setMode("sign-in");
                setResetStep(1);
                setResetAnswer1("");
                setResetAnswer2("");
                setResetNewPassword("");
                setResetConfirmPassword("");
              }}
              className="mt-4 text-sm text-muted-foreground hover:text-foreground"
            >
              {t("security.backToSignIn")}
            </button>
          </>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
                {mode === "sign-up" ? (
                  <UserPlus className="h-7 w-7 text-[var(--color-accent)]" />
                ) : (
                  <LogIn className="h-7 w-7 text-[var(--color-accent)]" />
                )}
                {mode === "sign-up" ? t("signup.title") : t("signup.signInTitle")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "sign-up" ? t("signup.subtitleSignUp") : t("signup.subtitleSignIn")}
              </p>
            </div>

            <div className={cn("rounded-lg border border-border bg-[#fffdf8] px-6 pb-2", mode === "sign-up" ? "pt-6" : "pt-4")}>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {mode === "sign-up" && !signupBlockReason && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                  Please sign up using your <strong>correct, real information</strong>. Accurate details ensure you can receive credit in the future for participating in this program.
                </div>
              )}



              {!(mode === "sign-up" && signupBlockReason === "pin-taken") && (
                <>
                  <div>
                    <label className="text-sm font-medium">
                      {mode === "sign-up" ? t("signup.username") : t("signup.usernameOrEmail")}
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={mode === "sign-up" ? 32 : 254}
                      pattern={mode === "sign-up" ? "[A-Za-z0-9_]{3,32}" : undefined}
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setFacilityError(null); }} {...kbUsername}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder={mode === "sign-up" ? t("signup.usernamePlaceholder") : undefined}
                      autoComplete={mode === "sign-up" ? "username" : "username email"}
                    />
                    {mode === "sign-up" && usernameStatus === "checking" && (
                      <p className="mt-1 text-xs text-muted-foreground">{t("signup.usernameChecking")}</p>
                    )}
                    {mode === "sign-up" && usernameStatus === "available" && (
                      <p className="mt-1 text-xs text-[var(--color-accent)]">{t("signup.usernameAvailable")}</p>
                    )}
                    {mode === "sign-up" && usernameStatus === "taken" && (
                      <p className="mt-1 text-xs text-destructive">{t("signup.usernameTaken")}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">{t("signup.password")}</label>
                    <PasswordInput
                      required
                      minLength={8}
                      maxLength={72}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)} {...kbPassword}
                      wrapperClassName="mt-1"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    {mode === "sign-up" && <PasswordStrengthMeter password={password} />}
                  </div>
                </>
              )}

              {mode === "sign-up" && signupBlockReason && (
                <div className="py-2 space-y-2">
                  {signupBlockReason === "no-facility" && (
                    <p className="text-sm text-muted-foreground text-center">
                      Signup is disabled for non-facility users. Contact the admin if you feel you need an account created.
                    </p>
                  )}
                  {signupBlockReason === "no-pin" && (
                    <p className="text-sm text-muted-foreground text-center">
                      A valid inmate PIN is required to sign up. Please use the link provided by your facility.
                    </p>
                  )}
                  {signupBlockReason === "pin-taken" && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive leading-snug">
                      {t("signup.pinAlreadyRegistered")}
                    </div>
                  )}
                </div>
              )}

              {mode === "sign-up" && !signupBlockReason && (
                <>
                  <div>
                    <label className="text-sm font-medium">{t("signup.confirmPassword")}</label>
                    <PasswordInput
                      required
                      minLength={8}
                      maxLength={72}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} {...kbConfirm}
                      wrapperClassName="mt-1"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="mt-1 text-xs text-destructive">{t("signup.passwordMismatch")}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">First name</label>
                      <input
                        type="text"
                        required
                        minLength={1}
                        maxLength={100}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)} {...kbFirst}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Last name</label>
                      <input
                        type="text"
                        required
                        minLength={1}
                        maxLength={100}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)} {...kbLast}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("signup.facility")}</label>
                    {lockedFacility ? (
                      // Facility locked — arrived via a facility slug
                      <div className="mt-1 w-full inline-flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm cursor-not-allowed opacity-80">
                        <span>{lockedFacility.label}</span>
                        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </div>
                    ) : (
                    <Popover open={facilityOpen} onOpenChange={setFacilityOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={facilityOpen}
                          className="mt-1 w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal hover:bg-muted/40"
                        >
                          <span className={cn(!facility && "text-muted-foreground")}>
                            {(() => {
                              const sel = facilities.find((f) => f.value === facility);
                              if (!sel) return "Search and select your facility";
                              const k = `facility.${sel.value}`;
                              const tr = t(k);
                              return tr === k ? sel.label : tr;
                            })()}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search facilities..." className="focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" />
                          <CommandList>
                            <CommandEmpty>No facility found.</CommandEmpty>
                            <CommandGroup>
                              {facilities.map((f) => {
                                const i18nKey = `facility.${f.value}`;
                                const translated = t(i18nKey);
                                const display = translated === i18nKey ? f.label : translated;
                                return (
                                  <CommandItem
                                    key={f.value}
                                    value={display}
                                    onSelect={() => {
                                      setFacility(f.value);
                                      setFacilityOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", facility === f.value ? "opacity-100" : "opacity-0")} />
                                    {display}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Inmate PIN</label>
                    <div className="mt-1 w-full inline-flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2 text-sm cursor-not-allowed opacity-80">
                      <span className="font-mono">{activeInmatePin}</span>
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>
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
                      onChange={(e) => setAnswer(e.target.value)} {...kbAnswer}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {facilityError && mode === "sign-in" && (
                <div className="!mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive leading-snug">
                  {facilityError}
                </div>
              )}

              {(!signupBlockReason || mode !== "sign-up") && (
                <div className="flex justify-end !mt-6">
                  <button
                    type="submit"
                    disabled={busy || (mode === "sign-up" && (!challengeQuery.data || usernameStatus === "taken" || usernameStatus === "checking"))}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Saving…" : mode === "sign-up" ? t("signup.createAccount") : t("signup.signIn")}
                  </button>
                </div>
              )}
              {/* honeypot — anchored to top so it never adds layout space at the bottom */}
              <div className="!mt-0 absolute top-0 -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
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
            </form>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMode(mode === "sign-up" ? "sign-in" : "sign-up");
                  setAnswer("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground text-left"
              >
                {mode === "sign-up" ? t("signup.toggleToSignIn") : t("signup.toggleToSignUp")}
              </button>
              {mode === "sign-in" && (
                <button
                  onClick={() => {
                    setMode("reset");
                    setResetStep(1);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground text-left"
                >
                  {t("security.forgotPassword")}
                </button>
              )}
            </div>
          </>
        )}

      </main>
      <SiteFooter />
    </div>
  );
}
