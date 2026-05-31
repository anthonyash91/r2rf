import { createFileRoute, redirect, Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { setSecurityLock } from "@/lib/security-lock";
import { toast } from "sonner";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { CircleProgress } from "@/components/CircleProgress";
import { StatCard } from "@/components/StatCard";
import { ReadStatusBadge } from "@/components/ReadStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/user-signup.functions";
import { facilityLabel } from "@/lib/user-signup";
import { listFacilities } from "@/lib/facilities.functions";
import { getMySecurityQuestions, updateSecurityAnswers } from "@/lib/password-reset.functions";
import { clearMustResetPassword } from "@/lib/users.functions";
import { getMyEngagementTier } from "@/lib/analytics-stats.functions";
import { questionLabel } from "@/lib/security-questions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingButton } from "@/components/LoadingButton";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { PasswordInput } from "@/components/PasswordInput";
import { OnScreenKeyboardProvider } from "@/components/OnScreenKeyboard";
import { useI18n, pickLang, translateDuration, translateType } from "@/lib/i18n";
import { withActionWord, parseMinutes } from "@/lib/duration";
import { weightedCompletionPct } from "@/lib/content-progress";
import { formatTimeSpent, fmtDateShort } from "@/lib/date-format";
import { readStatusLabels } from "@/lib/read-status";

import { SecurityQuestionsForm, type SecurityAnswerInput } from "@/components/SecurityQuestionsForm";
import { User as UserIcon, Building2, Calendar, Shield, ChevronDown, BookOpen, CheckCircle2, Loader2, Clock, Flame, Trophy, Circle } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Category } from "@/lib/categories";




export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Reentry to Recovery" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "account" ? "account" : undefined,
  }),
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/signup", search: { redirect: location.href } as any });
    }
  },
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <OnScreenKeyboardProvider>
      <DashboardPage />
    </OnScreenKeyboardProvider>
  );
}

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin, isUser } = useAuth();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchQuestions = useServerFn(getMySecurityQuestions);
  const submitUpdate = useServerFn(updateSecurityAnswers);

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const questionsQuery = useQuery({
    queryKey: ["my-security-questions"],
    queryFn: () => fetchQuestions(),
  });

  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilityNameMap = new Map(
    (facilitiesQuery.data?.facilities ?? []).map((f) => [f.value, f.label]),
  );

  const userFacility = (data?.profile as any)?.facility ?? null;

  const categoriesQuery = useQuery({
    queryKey: ["dashboard-categories", userFacility],
    enabled: !isLoading,
    queryFn: async (): Promise<Category[]> => {
      // Fetch all published categories + their facility assignments
      const { data: cats, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const allCats = (cats ?? []) as Category[];
      const catIds = allCats.map((c) => c.id);
      const facilityMap: Record<string, string[]> = {};
      if (catIds.length > 0) {
        const { data: links } = await (supabase as any)
          .from("category_facilities")
          .select("category_id, facility_value")
          .in("category_id", catIds);
        for (const r of (links ?? []) as { category_id: string; facility_value: string }[]) {
          if (!facilityMap[r.category_id]) facilityMap[r.category_id] = [];
          facilityMap[r.category_id].push(r.facility_value);
        }
      }
      // Show: categories with no facility restrictions + those matching the user's facility
      return allCats
        .filter((c) => {
          const f = facilityMap[c.id] ?? [];
          if (f.length === 0) return true;
          if (!userFacility) return false;
          return f.includes(userFacility);
        })
        .map((c) => ({ ...c, facilities: facilityMap[c.id] ?? [] }));
    },
  });

  const fetchTier = useServerFn(getMyEngagementTier);
  const tierQuery = useQuery({
    queryKey: ["my-engagement-tier", user?.id],
    enabled: !!user?.id && isUser,
    staleTime: 60 * 60 * 1000, // 1 hr — data is daily anyway
    queryFn: () => fetchTier(),
  });

  const loginsQuery = useQuery({
    queryKey: ["my-login-days", user?.id ?? null],
    enabled: !!user?.id,
    queryFn: async (): Promise<Set<string>> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("user_logins")
        .select("login_date")
        .eq("user_id", user!.id)
        .gte("login_date", sinceStr);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.login_date as string));
    },
  });

  const categoryIds = (categoriesQuery.data ?? []).map((c) => c.id);
  const userId = user?.id ?? null;

  const progressQuery = useQuery({
    queryKey: ["dashboard-progress", userId, categoryIds.join(",")],
    enabled: !!userId && categoryIds.length > 0,
    queryFn: async () => {
      const [itemsRes, readRes, seenRes, profileRes] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, category_id, title, title_es, description, description_es, type, duration, sort_order, created_at, url, file_url")
          .eq("published", true)
          .in("category_id", categoryIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("user_content_progress")
          .select("content_item_id, category_id, created_at")
          .eq("user_id", userId!)
          .in("category_id", categoryIds),
        supabase
          .from("user_content_seen")
          .select("content_item_id")
          .eq("user_id", userId!),
        supabase
          .from("user_profiles")
          .select("facility")
          .eq("user_id", userId!)
          .maybeSingle(),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (readRes.error) throw readRes.error;

      const userFacility: string | null = (profileRes.data as any)?.facility ?? null;

      // Fetch facility restrictions so we can exclude items the user can't see
      const allItemIds = (itemsRes.data ?? []).map((r: any) => r.id as string);
      const facilityMap: Record<string, string[]> = {};
      if (allItemIds.length > 0) {
        const { data: cifData } = await (supabase as any)
          .from("content_item_facilities")
          .select("content_item_id, facility_value")
          .in("content_item_id", allItemIds);
        for (const row of (cifData ?? []) as Array<{ content_item_id: string; facility_value: string }>) {
          if (!facilityMap[row.content_item_id]) facilityMap[row.content_item_id] = [];
          facilityMap[row.content_item_id].push(row.facility_value);
        }
      }

      const seenSet = new Set<string>((seenRes.data ?? []).map((r: any) => r.content_item_id as string));
      type CatItem = { id: string; title: string; title_es: string | null; description: string; description_es: string | null; type: string; duration: string | null; created_at: string | null; url: string | null; file_url: string | null };
      const itemsByCat = new Map<string, CatItem[]>();
      const totals = new Map<string, number>();
      const recentCats = new Set<string>();
      const newItemSet = new Set<string>();
      const itemDuration = new Map<string, string | null>();
      const visibleItemIds = new Set<string>();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const row of itemsRes.data ?? []) {
        // Filter by facility restriction
        const facilities = facilityMap[row.id as string] ?? [];
        if (facilities.length > 0) {
          if (!userFacility || !facilities.includes(userFacility)) continue;
        }
        visibleItemIds.add(row.id as string);
        const list = itemsByCat.get(row.category_id as string) ?? [];
        list.push(row as CatItem);
        itemsByCat.set(row.category_id as string, list);
        totals.set(row.category_id as string, (totals.get(row.category_id as string) ?? 0) + 1);
        itemDuration.set(row.id as string, (row as any).duration ?? null);
        if (row.created_at && new Date(row.created_at as string).getTime() >= cutoff && !seenSet.has(row.id as string)) {
          recentCats.add(row.category_id as string);
          newItemSet.add(row.id as string);
        }
      }
      const reads = new Map<string, number>();
      const readSet = new Set<string>();
      const readAtMap = new Map<string, string>();
      const readDays = new Set<string>();
      for (const row of readRes.data ?? []) {
        // Only count reads for items the user can see
        if (!visibleItemIds.has(row.content_item_id as string)) continue;
        reads.set(row.category_id as string, (reads.get(row.category_id as string) ?? 0) + 1);
        readSet.add(row.content_item_id as string);
        if ((row as any).created_at) {
          readAtMap.set(row.content_item_id as string, (row as any).created_at as string);
          const d = new Date((row as any).created_at as string);
          readDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
      // Real session seconds + per-item media progress from engagement tracking
      const { data: engData } = await (supabase as any)
        .from("user_content_engagement")
        .select("content_item_id, session_seconds, media_progress_seconds, media_duration_seconds, manual_completion_pct")
        .eq("user_id", userId);
      const totalSeconds = ((engData ?? []) as any[]).reduce(
        (sum: number, r: any) => sum + ((r.session_seconds as number) || 0), 0,
      );
      const engagementMap = new Map<string, { sessionSeconds: number; mediaProgressSeconds: number | null; mediaDurationSeconds: number | null; manualCompletionPct: number | null }>();
      for (const r of (engData ?? []) as any[]) {
        engagementMap.set(r.content_item_id as string, {
          sessionSeconds: (r.session_seconds as number) || 0,
          mediaProgressSeconds: r.media_progress_seconds as number | null,
          mediaDurationSeconds: r.media_duration_seconds as number | null,
          manualCompletionPct: r.manual_completion_pct as number | null,
        });
      }
      return { totals, reads, itemsByCat, readSet, readAtMap, recentCats, newItemSet, totalSeconds, readDays, engagementMap };
    },
  });



  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<SecurityAnswerInput[]>([]);
  const [busy, setBusy] = useState(false);

  // Forced password reset for tester first sign-in.
  const mustResetPassword = (user?.user_metadata as Record<string, unknown> | undefined)?.must_reset_password === true;
  const clearMustResetFn = useServerFn(clearMustResetPassword);
  const [resetPw, setResetPw] = useState("");
  const [resetPw2, setResetPw2] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  async function handleForcedReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (resetPw !== resetPw2) { toast.error("Passwords do not match"); return; }
    setResetBusy(true);
    try {
      // Server-side atomic update: rotates the password AND clears
      // must_reset_password in the same admin call. This is the only path
      // that can clear the flag — direct calls without a password change
      // are rejected by the server fn.
      await clearMustResetFn({ data: { newPassword: resetPw } });
      await supabase.auth.refreshSession();
      toast.success("Password updated");
      setResetPw(""); setResetPw2("");
      setResetDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update password");
    } finally {
      setResetBusy(false);
    }

  }

  const profile = data?.profile;
  const currentKeys = questionsQuery.data?.keys ?? [];
  const mustSetup = !questionsQuery.isLoading && currentKeys.length < 2;
  const isEditing = editing || mustSetup;

  useEffect(() => {
    setSecurityLock(mustSetup);
    return () => setSecurityLock(false);
  }, [mustSetup]);

  useBlocker({
    shouldBlockFn: () => {
      toast.error(t("dashboard.lockedNav"));
      return true;
    },
    enableBeforeUnload: mustSetup,
    disabled: !mustSetup,
  });


  async function handleSave() {
    if (pending.length < 2) {
      toast.error(t("security.needTwo"));
      return;
    }
    setBusy(true);
    try {
      await submitUpdate({ data: { answers: pending.slice(0, 2) } });
      toast.success(t("security.updateSuccess"));
      setEditing(false);
      setPending([]);
      queryClient.invalidateQueries({ queryKey: ["my-security-questions"] });
    } catch (err: any) {
      toast.error(err.message ?? t("signup.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Dialog open={mustResetPassword && !resetDone} onOpenChange={() => { /* non-dismissible */ }}>
        <DialogContent
          className="sm:max-w-md pt-[22px] [&>button.absolute]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>
              For security, please choose a new password before continuing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForcedReset} className="mt-[-4px] space-y-3">
              <div>
                <PasswordInput
                  autoComplete="new-password"
                  required
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                />
                <PasswordStrengthMeter password={resetPw} />
              </div>
              <PasswordInput
                autoComplete="new-password"
                required
                value={resetPw2}
                onChange={(e) => setResetPw2(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
              />
            <div className="flex justify-end">
              <LoadingButton type="submit" pending={resetBusy} pendingText="Saving…">
                Save password
              </LoadingButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <SiteHeader />

      <SiteMessageBanner kind="home" />
      <SiteMessageBanner kind="facility" facilityValue={userFacility ?? undefined} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-12">
        <Tabs
          value={mustSetup ? "account" : undefined}
          defaultValue={Route.useSearch().tab === "account" ? "account" : "categories"}
          className="mt-0"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {(() => {
                const firstName = ((data as any)?.profile?.first_name ?? "").trim();
                const inmatePin = ((data as any)?.profile?.inmate_pin ?? "").trim();
                return (
                  <h1 className="font-display text-3xl font-semibold">
                    {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.greetingNoName")}
                    {inmatePin && (
                      <span className="ml-2 text-muted-foreground font-normal text-2xl">({inmatePin})</span>
                    )}
                  </h1>
                );
              })()}
              <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
            </div>
            <TabsList className="h-auto p-2 gap-1 w-full sm:w-auto self-stretch sm:self-center bg-muted/40">
              <TabsTrigger
                value="categories"
                disabled={mustSetup}
                onClick={(e) => {
                  if (mustSetup) {
                    e.preventDefault();
                    toast.error(t("dashboard.lockedNav"));
                  }
                }}
                className={`flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground ${mustSetup ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {t("dashboard.tabProgress")}
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
              >
                {t("dashboard.tabAccount")}
              </TabsTrigger>
            </TabsList>
          </div>



          <TabsContent value="categories" className="mt-6">
            {categoriesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.loading")}</p>
            ) : (categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t("home.empty")}</p>
            ) : (
              <>
                {!isAdmin && (() => {
                  let totalAll = 0;
                  let readAll = 0;
                  let activeCats = 0;
                  let completedCats = 0;
                  for (const c of categoriesQuery.data ?? []) {
                    const t2 = progressQuery.data?.totals.get(c.id) ?? 0;
                    const r2 = progressQuery.data?.reads.get(c.id) ?? 0;
                    totalAll += t2;
                    readAll += r2;
                    if (r2 > 0) activeCats += 1;
                    if (t2 > 0 && r2 >= t2) completedCats += 1;
                  }
                  const allItems = (categoriesQuery.data ?? []).flatMap((c) => progressQuery.data?.itemsByCat.get(c.id) ?? []);
                  const pctAll = weightedCompletionPct(allItems, progressQuery.data?.readSet ?? new Set(), progressQuery.data?.engagementMap ?? new Map());
                  const totalSeconds = progressQuery.data?.totalSeconds ?? 0;
                  // Day streak: count consecutive days the user has logged in, ending today or yesterday
                  const loginDays = loginsQuery.data ?? new Set<string>();
                  let streak = 0;
                  if (loginDays.size > 0) {
                    const fmt = (d: Date) => {
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      return `${y}-${m}-${dd}`;
                    };
                    let cursor = new Date();
                    if (!loginDays.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
                    while (loginDays.has(fmt(cursor))) {
                      streak += 1;
                      cursor.setDate(cursor.getDate() - 1);
                    }
                  }
                  const totalCats = (categoriesQuery.data ?? []).length;
                  const fraction = (done: number, total: number) => (
                    <span className="inline-flex items-center gap-1.5">
                      <span>{done.toLocaleString()}</span>
                      <span className="font-serif italic text-base font-normal text-[var(--color-accent)] lowercase tracking-wide">of</span>
                      <span>{total.toLocaleString()}</span>
                    </span>
                  );
                  const stats: Array<{ icon: typeof BookOpen; label: string; value: ReactNode }> = [
                    { icon: CheckCircle2, label: t("dashboard.statCompleted"), value: fraction(readAll, totalAll) },
                    { icon: Trophy, label: t("dashboard.statCategoriesCompleted"), value: fraction(completedCats, totalCats) },
                    { icon: Clock, label: t("dashboard.statHours"), value: formatTimeSpent(totalSeconds) },
                    { icon: Flame, label: t("dashboard.statStreak"), value: streak.toLocaleString() },
                  ];
                  return (
                    <>
                      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 mb-6 flex items-center gap-6">
                        <CircleProgress value={pctAll} size={96} stroke={8} />
                        <div className="min-w-0">
                          <h2 className="font-display text-xl sm:text-2xl font-semibold">{t("dashboard.overallProgress")}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("dashboard.overallSummary", { done: readAll.toLocaleString(), total: totalAll.toLocaleString() } as any)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
                        {stats.map((s) => (
                          <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} />
                        ))}
                      </div>

                      {tierQuery.data?.tier && (
                        <div className="mb-8 rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Your engagement level at your facility:{" "}
                              <span className="text-[var(--color-accent)] font-semibold">{tierQuery.data.tier}</span>
                              {tierQuery.data.percentile != null && (
                                <span className="text-muted-foreground font-normal">
                                  {" "}· top {Math.round(100 - tierQuery.data.percentile)}% of readers
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Based on time spent reading · Updates daily
                              {tierQuery.data.updatedAt && (
                                <> · Last updated {new Date(tierQuery.data.updatedAt).toLocaleDateString()}</>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {tierQuery.data.itemsCompleted ?? 0} completed · {tierQuery.data.itemsStarted ?? 0} started
                            </p>
                          </div>
                        </div>
                      )}

                      <h2 className="font-display text-lg font-semibold mb-3">{t("dashboard.categoryProgress")}</h2>
                    </>
                  );
                })()}

                <CategoryAccordion
                  categories={categoriesQuery.data ?? []}
                  progress={progressQuery.data}
                  isAdmin={isAdmin}
                  lang={lang}
                  t={t}
                />

              </>
            )}
          </TabsContent>


          <TabsContent value="account" className="mt-6 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              {isLoading ? (
                <p className="text-muted-foreground">{t("dashboard.loading")}</p>
              ) : !profile ? (
                <div>
                  <p className="text-muted-foreground">{t("dashboard.noProfile")}</p>
                  <Link to="/" className="mt-3 inline-block text-sm underline">{t("dashboard.backHome")}</Link>
                </div>
              ) : (
                <dl className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" /> {t("signup.username")}
                    </dt>
                    <dd className="mt-1 font-medium">{profile.username}</dd>
                  </div>
                  {((profile as any).first_name || (profile as any).last_name) && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <UserIcon className="h-3.5 w-3.5" /> {t("dashboard.name")}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {`${(profile as any).first_name ?? ""} ${(profile as any).last_name ?? ""}`.trim()}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> {t("signup.facility")}
                    </dt>
                    <dd className="mt-1 font-medium">{facilityNameMap.get(profile.facility) ?? facilityLabel(profile.facility)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> {t("dashboard.joined")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {new Date(profile.created_at).toLocaleDateString(lang === "es" ? "es" : "en")}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0" /> {t("security.heading")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("security.intro")}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-full sm:w-auto shrink-0 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)] transition-colors"
                  >
                    {t("security.update")}
                  </button>
                )}
              </div>

              {mustSetup && (
                <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                  {t("security.setupPrompt")}
                </div>
              )}

              {!isEditing ? (
                <div className="mt-4">
                  {currentKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground">—</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {currentKeys.map((k) => (
                        <li key={k} className="text-foreground">
                          • {questionLabel(t, k)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <SecurityQuestionsForm onChange={setPending} rows={2} />
                  <div className="flex justify-end gap-2">
                    {!mustSetup && (
                      <button
                        onClick={() => { setEditing(false); setPending([]); }}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)] transition-colors"
                      >
                        {t("security.cancel")}
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {busy ? t("dashboard.saving") : t("security.save")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>


      </main>

      <SiteFooter />
    </div>
  );
}

type CatItem = {
  id: string;
  title: string;
  title_es: string | null;
  description: string;
  description_es: string | null;
  type: string;
  duration?: string | null;
  url?: string | null;
  file_url?: string | null;
};

function CategoryAccordion({
  categories,
  progress,
  isAdmin,
  lang,
  t,
}: {
  categories: Category[];
  progress: any;
  isAdmin: boolean;
  lang: "en" | "es";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const engagementMap = progress?.engagementMap ?? new Map();
  const readAtMap = progress?.readAtMap ?? new Map<string, string>();
  return (
    <div className="flex flex-col [&>section]:rounded-none [&>section:first-child]:rounded-t-2xl [&>section:last-child]:rounded-b-2xl [&>section:not(:first-child)]:-mt-px">
      {categories.map((c) => {
        const total = progress?.totals.get(c.id) ?? 0;
        const read = progress?.reads.get(c.id) ?? 0;
        const items = progress?.itemsByCat.get(c.id) ?? [];
        const readSet = progress?.readSet ?? new Set<string>();
        const newItemSet = progress?.newItemSet ?? new Set<string>();
        const hasRecent = items.some((it: CatItem) => newItemSet.has(it.id) && !readSet.has(it.id));
        return (
          <CategoryProgressSection
            key={c.id}
            category={c}
            items={items}
            readSet={readSet}
            readAtMap={readAtMap}
            newItemSet={newItemSet}
            hasRecent={hasRecent}
            total={total}
            read={read}
            isAdmin={isAdmin}
            lang={lang}
            t={t}
            engagementMap={engagementMap}
            isOpen={openId === c.id}
            dimmed={openId !== null && openId !== c.id}
            onToggle={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
          />
        );
      })}
    </div>
  );
}

function CategoryProgressSection({
  category,
  items,
  readSet,
  readAtMap,
  newItemSet,
  hasRecent,
  total,
  read,
  isAdmin,
  lang,
  t,
  engagementMap,
  isOpen,
  dimmed,
  onToggle,
}: {
  category: Category;
  items: CatItem[];
  readSet: Set<string>;
  readAtMap: Map<string, string>;
  newItemSet: Set<string>;
  hasRecent: boolean;
  total: number;
  read: number;
  isAdmin: boolean;
  lang: "en" | "es";
  t: (key: string, vars?: Record<string, string | number>) => string;
  engagementMap: Map<string, { sessionSeconds: number; mediaProgressSeconds: number | null; mediaDurationSeconds: number | null; manualCompletionPct: number | null }>;
  isOpen: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  const open = isOpen;
  const pct = weightedCompletionPct(items, readSet, engagementMap);
  const tagline = pickLang(lang, category.tagline, category.tagline_es);
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && sectionRef.current) {
      const el = sectionRef.current;
      requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: "smooth" });
      });
    }
  }, [isOpen]);

  return (
    <section ref={sectionRef} className={`scroll-mt-24 rounded-2xl bg-[#fffdf8] overflow-hidden transition-all duration-200 ${dimmed ? "opacity-40" : "opacity-100"} ${open ? "border-2 border-[var(--color-accent)]" : "border border-border"}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={open ? { backgroundColor: "#f7f5ec" } : undefined}
        className={`w-full flex items-center gap-4 p-6 ${open ? "border-b border-border" : ""} text-left hover:bg-muted/40 transition-colors`}
      >
        {!isAdmin ? (
          <CircleProgress value={pct} size={52} stroke={5} />
        ) : (
          <CategoryIcon name={category.icon_name} color={category.icon_color} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:flex-wrap min-w-0">
            <h2 className="font-display text-base sm:text-lg font-semibold truncate max-w-full">
              {pickLang(lang, category.name, category.name_es)}
            </h2>
            {hasRecent && (
              <Badge variant="new">{t("category.newContentAdded")}</Badge>
            )}
          </div>
          {!isAdmin ? (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground tabular-nums">
                {t("dashboard.itemsCompleted", { done: read.toLocaleString(), total: total.toLocaleString() } as any)}
              </p>
              {(() => {
                const catSecs = items.reduce((sum, it) => sum + (engagementMap.get(it.id)?.sessionSeconds ?? 0), 0);
                return catSecs > 0 ? (
                  <p className="text-xs text-muted-foreground tabular-nums">· {formatTimeSpent(catSecs)}</p>
                ) : null;
              })()}
            </div>
          ) : tagline ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{tagline}</p>
          ) : null}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        items.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("category.noContent")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const isRead = readSet.has(it.id);
              const description = pickLang(lang, it.description, it.description_es);
              return (
                <li key={it.id} className="flex flex-col gap-[10px] bg-[#fffdf8] p-6">
                  <div className="flex items-center gap-2 min-w-0">
                    <BadgeGroup className="shrink-0">
                      {newItemSet.has(it.id) && !isRead && (
                        <Badge variant="new">{t("category.newContent")}</Badge>
                      )}
                      <Badge variant="type" type={it.type}>
                        {translateType(lang, it.type)}
                      </Badge>
                    </BadgeGroup>
                    {it.duration && (
                      <span className="text-xs text-muted-foreground truncate min-w-0">
                        {translateDuration(lang, withActionWord(it.duration, it.type))}
                      </span>
                    )}

                    {!isAdmin && (() => {
                      const labels = readStatusLabels(t, it);
                      const eng = engagementMap.get(it.id);

                      // Video / Audio — playback progress
                      const isAV = it.type && (it.type.toLowerCase().includes("video") || it.type.toLowerCase().includes("audio") || it.type.toLowerCase().includes("podcast"));
                      const mediaPct = !isRead && isAV && eng?.mediaProgressSeconds && eng?.mediaDurationSeconds && eng.mediaDurationSeconds > 0
                        ? Math.min(100, Math.round((eng.mediaProgressSeconds / eng.mediaDurationSeconds) * 100))
                        : null;
                      if (mediaPct !== null && mediaPct >= 5) {
                        const watchedLabel = it.type.toLowerCase().includes("video")
                          ? t("category.markedWatched").toLowerCase()
                          : t("category.markedListened").toLowerCase();
                        return (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium ml-auto flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${mediaPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{mediaPct}% {watchedLabel}</span>
                          </span>
                        );
                      }

                      // PDF — time-based reading progress
                      const isPdf = (it.file_url && /\.pdf(\?|#|$)/i.test(it.file_url)) || (it.url && /\.pdf(\?|#|$)/i.test(it.url));
                      const pdfMins = isPdf ? parseMinutes(it.duration) : 0;
                      const pdfEstSec = pdfMins * 60;
                      const pdfPct = !isRead && isPdf && pdfEstSec > 0 && eng && eng.sessionSeconds > 0
                        ? Math.min(100, Math.round((eng.sessionSeconds / (pdfEstSec * 0.95)) * 100))
                        : null;
                      if (pdfPct !== null && pdfPct >= 1) {
                        return (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium ml-auto flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pdfPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{pdfPct}% {t("category.markedRead").toLowerCase()}</span>
                          </span>
                        );
                      }

                      return (
                        <ReadStatusBadge
                          read={isRead}
                          readLabel={
                            isRead && isPdf && eng?.manualCompletionPct != null
                              ? `${labels.read} at ${eng.manualCompletionPct}%`
                              : labels.read
                          }
                          unreadLabel={labels.unread}
                          readAt={isRead ? (fmtDateShort(readAtMap.get(it.id)) || null) : null}
                          className="ml-auto"
                        />
                      );
                    })()}

                  </div>

                  <div className="min-w-0">
                    <Link
                      to="/category/$slug"
                      params={{ slug: category.slug }}
                      hash={`item-${it.id}`}
                      className="block truncate text-lg font-semibold text-foreground hover:underline"
                    >
                      {pickLang(lang, it.title, it.title_es)}
                    </Link>
                    {description && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{description}</p>

                    )}
                  </div>
                </li>

              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
