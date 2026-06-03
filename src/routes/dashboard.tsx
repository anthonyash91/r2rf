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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingButton } from "@/components/LoadingButton";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { PasswordInput } from "@/components/PasswordInput";
import { OnScreenKeyboardProvider } from "@/components/OnScreenKeyboard";
import { useI18n, pickLang, translateDuration, translateType } from "@/lib/i18n";
import { withActionWord, parseMinutes } from "@/lib/duration";
import { weightedCompletionPct } from "@/lib/content-progress";
import { formatTimeSpent, fmtDateShort } from "@/lib/date-format";
import { readStatusLabels } from "@/lib/read-status";
import { getMyBookmarkedItems } from "@/lib/bookmarks.functions";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useAchievements } from "@/hooks/use-achievements";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { getMyMonthlySummary } from "@/lib/monthly-summary.functions";
import {
  createTestRun, listMyTestRuns, getRunResults, upsertTestResult,
  completeTestRun, reopenTestRun, deleteTestRun, getQaScreenshotUploadUrl,
} from "@/lib/test-runs.functions";
import {
  QA_TESTS, QA_SECTIONS, PRIORITY_LABELS, STATUS_LABELS, STATUS_ICONS, STATUS_COLORS,
  type TestStatus,
} from "@/lib/qa-test-plan";

import { SecurityQuestionsForm, type SecurityAnswerInput } from "@/components/SecurityQuestionsForm";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { User as UserIcon, Building2, Calendar, Shield, ChevronDown, BookOpen, CheckCircle2, Loader2, Clock, Flame, Trophy, Circle, Bookmark, ThumbsUp, ThumbsDown, Award, Compass, GraduationCap, Medal, Lock, Info, ArrowRight, ClipboardCheck, Plus, Trash2, CheckCircle, XCircle, MinusCircle, SkipForward, ChevronRight, AlertCircle, ChevronUp, Minus, LayoutList, Layers, ImagePlus, ExternalLink, X } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Category } from "@/lib/categories";




export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Reentry to Recovery" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "account" ? "account" : search.tab === "saved" ? "saved" : search.tab === "achievements" ? "achievements" : search.tab === "testing" ? "testing" : undefined,
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
      <DashboardRouter />
    </OnScreenKeyboardProvider>
  );
}

// Splits tester accounts onto their own minimal page so they only see the QA
// testing interface — no regular user dashboard content at all.
function DashboardRouter() {
  const { isTester, rolesLoaded } = useAuth();
  // Wait until roles are confirmed before rendering either view — prevents a
  // brief flash of the regular user dashboard (or forced-reset dialog) while
  // the roles fetch is still in flight on first load.
  if (!rolesLoaded) return null;
  if (isTester) return <TesterDashboard />;
  return <DashboardPage />;
}

function TesterDashboard() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-12">
        <TestingTab />
      </main>
      <SiteFooter />
    </div>
  );
}

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin, isUser, isTester } = useAuth();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchQuestions = useServerFn(getMySecurityQuestions);
  const submitUpdate = useServerFn(updateSecurityAnswers);

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    staleTime: Infinity, // profile only changes on explicit edit
    queryFn: () => fetchProfile(),
  });
  const questionsQuery = useQuery({
    queryKey: ["my-security-questions"],
    staleTime: Infinity, // questions only change on explicit edit
    queryFn: () => fetchQuestions(),
  });

  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    staleTime: 10 * 60 * 1000, // facility list changes rarely
    queryFn: () => fetchFacilities(),
  });
  const facilityNameMap = new Map(
    (facilitiesQuery.data?.facilities ?? []).map((f) => [f.value, f.label]),
  );

  const userFacility = (data?.profile as any)?.facility ?? null;

  const categoriesQuery = useQuery({
    queryKey: ["dashboard-categories", userFacility],
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000, // categories change rarely; 5 min is fine
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
    staleTime: 60 * 60 * 1000, // login history only needs refreshing hourly
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
    staleTime: 30 * 1000, // progress should feel near-live; 30s is enough
    queryFn: async () => {
      const [itemsRes, readRes, seenRes, profileRes] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, category_id, title, title_es, description, description_es, type, duration, sort_order, created_at, url, file_url, exempt_from_progress")
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
      type CatItem = { id: string; title: string; title_es: string | null; description: string; description_es: string | null; type: string; duration: string | null; created_at: string | null; url: string | null; file_url: string | null; exempt_from_progress?: boolean };
      const itemsByCat = new Map<string, CatItem[]>();
      const totals = new Map<string, number>();
      const recentCats = new Set<string>();
      const newItemSet = new Set<string>();
      const itemDuration = new Map<string, string | null>();
      const visibleItemIds = new Set<string>();
      const exemptItemIds = new Set<string>();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const row of itemsRes.data ?? []) {
        // Filter by facility restriction
        const facilities = facilityMap[row.id as string] ?? [];
        if (facilities.length > 0) {
          if (!userFacility || !facilities.includes(userFacility)) continue;
        }
        visibleItemIds.add(row.id as string);
        if ((row as any).exempt_from_progress) exemptItemIds.add(row.id as string);
        const list = itemsByCat.get(row.category_id as string) ?? [];
        list.push(row as CatItem);
        itemsByCat.set(row.category_id as string, list);
        // Exclude exempt items from tracked totals
        if (!(row as any).exempt_from_progress) {
          totals.set(row.category_id as string, (totals.get(row.category_id as string) ?? 0) + 1);
        }
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
        // Only count reads for items the user can see, excluding exempt items
        if (!visibleItemIds.has(row.content_item_id as string)) continue;
        if (exemptItemIds.has(row.content_item_id as string)) {
          // Still add to readSet so the "Acknowledged" badge shows correctly
          readSet.add(row.content_item_id as string);
          if ((row as any).created_at) readAtMap.set(row.content_item_id as string, (row as any).created_at as string);
          continue;
        }
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
      const { data: ratingsData } = await (supabase as any)
        .from("user_content_ratings")
        .select("content_item_id, rating")
        .eq("user_id", userId);
      const ratingsMap = new Map<string, 1 | -1>();
      for (const r of (ratingsData ?? []) as any[]) {
        if (r.rating === 1 || r.rating === -1) ratingsMap.set(r.content_item_id as string, r.rating as 1 | -1);
      }

      return { totals, reads, itemsByCat, readSet, readAtMap, recentCats, newItemSet, totalSeconds, readDays, engagementMap, ratingsMap };
    },
  });



  const { bookmarkIds, toggle: toggleBookmarkItem } = useBookmarks();
  const fetchMonthlySummary = useServerFn(getMyMonthlySummary);
  const monthlySummaryQuery = useQuery({
    queryKey: ["my-monthly-summary", user?.id],
    enabled: !!user?.id && isUser,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchMonthlySummary(),
  });
  const resumeQuery = useQuery({
    queryKey: ["resume-item", user?.id],
    enabled: !!user?.id && isUser,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_content_engagement")
        .select("content_item_id, category_id, last_updated_at, session_seconds, media_progress_seconds, media_duration_seconds")
        .eq("user_id", user!.id)
        .order("last_updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{
        content_item_id: string; category_id: string; last_updated_at: string;
        session_seconds: number; media_progress_seconds: number | null; media_duration_seconds: number | null;
      }>;
    },
  });

  const { earned: earnedAchievements } = useAchievements();
  const fetchBookmarkedItems = useServerFn(getMyBookmarkedItems);
  const bookmarkedItemsQuery = useQuery({
    queryKey: ["my-bookmarked-items", user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: () => fetchBookmarkedItems(),
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
  // Testers are QA accounts — never require security question setup.
  const mustSetup = !isTester && !questionsQuery.isLoading && currentKeys.length < 2;
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
          defaultValue={Route.useSearch().tab === "account" ? "account" : Route.useSearch().tab === "saved" ? "saved" : Route.useSearch().tab === "achievements" ? "achievements" : "categories"}
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
                value="saved"
                disabled={mustSetup}
                onClick={(e) => {
                  if (mustSetup) { e.preventDefault(); toast.error(t("dashboard.lockedNav")); }
                }}
                className={`flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground ${mustSetup ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {t("dashboard.tabSaved")}
                {bookmarkIds.size > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)]/15 px-1 text-[10px] font-semibold text-[var(--color-accent)]">
                    {bookmarkIds.size}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="achievements"
                disabled={mustSetup}
                onClick={(e) => {
                  if (mustSetup) { e.preventDefault(); toast.error(t("dashboard.lockedNav")); }
                }}
                className={`flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground ${mustSetup ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {t("dashboard.tabAchievements")}
                {Object.keys(earnedAchievements).length > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)]/15 px-1 text-[10px] font-semibold text-[var(--color-accent)]">
                    {Object.keys(earnedAchievements).length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
              >
                {t("dashboard.tabAccount")}
              </TabsTrigger>
              {/* Testing tab — only visible to tester accounts */}
              {isTester && (
                <TabsTrigger
                  value="testing"
                  className="flex-1 sm:flex-none justify-center px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Testing
                </TabsTrigger>
              )}
            </TabsList>
          </div>



          <TabsContent value="categories" className="mt-6">
            {categoriesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.loading")}</p>
            ) : (categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t("home.empty")}</p>
            ) : (
              <>
                {/* Resume card — most recently touched incomplete item */}
                {(() => {
                  if (!resumeQuery.data || !progressQuery.data) return null;
                  const readSet = progressQuery.data.readSet;
                  const itemsByCat = progressQuery.data.itemsByCat;
                  for (const eng of resumeQuery.data) {
                    if (readSet.has(eng.content_item_id)) continue;
                    const catItems = itemsByCat.get(eng.category_id) ?? [];
                    const item = catItems.find((i: any) => i.id === eng.content_item_id);
                    if (!item || (item as any).exempt_from_progress) continue;
                    const category = (categoriesQuery.data ?? []).find((c: any) => c.id === eng.category_id);
                    if (!category) continue;
                    const isAV = item.type && (item.type.toLowerCase().includes("video") || item.type.toLowerCase().includes("audio") || item.type.toLowerCase().includes("podcast"));
                    const mediaPct = isAV && eng.media_progress_seconds && eng.media_duration_seconds && eng.media_duration_seconds > 0
                      ? Math.min(99, Math.round((eng.media_progress_seconds / eng.media_duration_seconds) * 100))
                      : null;
                    const isPdf = item.file_url && /\.pdf(\?|#|$)/i.test(item.file_url as string);
                    const pdfMins = isPdf ? parseMinutes(item.duration) : 0;
                    const sessionMins = Math.round((eng.session_seconds ?? 0) / 60);
                    const color = (category as any).icon_color || "var(--color-accent)";
                    return (
                      <Link
                        key={eng.content_item_id}
                        to="/category/$slug"
                        params={{ slug: (category as any).slug }}
                        hash={`item-${eng.content_item_id}`}
                        className="block mb-6 rounded-2xl border border-border bg-[#fffdf8] p-5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card)] transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon
                            name={(category as any).icon_name}
                            color={(category as any).icon_color}
                            size="lg"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">
                              {pickLang(lang, (category as any).name, (category as any).name_es)}
                            </p>
                            <p className="font-semibold text-foreground truncate leading-snug">
                              {pickLang(lang, item.title, (item as any).title_es)}
                            </p>
                            {mediaPct !== null && mediaPct >= 5 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {mediaPct}% {item.type?.toLowerCase().includes("video") ? t("category.markedWatched").toLowerCase() : t("category.markedListened").toLowerCase()}
                              </p>
                            )}
                            {isPdf && pdfMins > 0 && sessionMins > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {Math.min(sessionMins, pdfMins)} / {pdfMins} min
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-4">
                            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{t("dashboard.resumeLabel")}</span>
                            <span
                              className="flex items-center justify-center h-8 w-8 rounded-full transition-colors"
                              style={{ backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  }
                  return null;
                })()}

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
                  const allTrackableItems = allItems.filter((it) => !it.exempt_from_progress);
                  const pctAll = weightedCompletionPct(allTrackableItems, progressQuery.data?.readSet ?? new Set(), progressQuery.data?.engagementMap ?? new Map());
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

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
                        {stats.map((s) => (
                          <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} />
                        ))}
                      </div>

                      {(() => {
                        const ms = monthlySummaryQuery.data;
                        if (!ms?.hasActivity) return null;
                        const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                        const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                        const monthName = lang === "es" ? MONTH_NAMES_ES[ms.monthIndex] : MONTH_NAMES_EN[ms.monthIndex];
                        const msgIdx = ms.dayOfMonth % 15;
                        const message = t(`monthly.msg${msgIdx}` as any);
                        const itemsDelta = ms.itemsThisMonth - ms.itemsLastMonth;
                        const timeDelta = ms.secondsThisMonth - ms.secondsLastMonth;
                        const itemsDeltaLabel = ms.itemsLastMonth === 0
                          ? t("monthly.newThisMonth" as any)
                          : itemsDelta > 0 ? t("monthly.more" as any, { n: itemsDelta })
                          : itemsDelta < 0 ? t("monthly.fewer" as any, { n: Math.abs(itemsDelta) })
                          : t("monthly.same" as any);
                        const timeDeltaLabel = ms.secondsLastMonth === 0
                          ? t("monthly.newThisMonth" as any)
                          : timeDelta > 0 ? t("monthly.more" as any, { n: formatTimeSpent(timeDelta) })
                          : timeDelta < 0 ? t("monthly.fewer" as any, { n: formatTimeSpent(Math.abs(timeDelta)) })
                          : t("monthly.same" as any);
                        return (
                          <details className="group mb-6 rounded-2xl border border-border bg-card overflow-hidden">
                            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 sm:px-6 list-none hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <p className="font-display text-sm font-semibold">{monthName} {ms.year}</p>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {ms.itemsThisMonth} {t("monthly.items" as any)} · {formatTimeSpent(ms.secondsThisMonth)}
                                  {(ms as any).achievementKeysThisMonth?.length > 0 && <> · {(ms as any).achievementKeysThisMonth.length} {t("monthly.achievements" as any)}</>}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {ms.achievementsThisMonth > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] font-medium">
                                    <Trophy className="h-3.5 w-3.5" />
                                    {ms.achievementsThisMonth}
                                  </span>
                                )}
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                              </div>
                            </summary>
                            <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 border-t border-border/40">
                              {(() => {
                                const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
                                  BookOpen, Compass, CheckCircle2, Award, Trophy, GraduationCap, Medal, Flame, Clock,
                                };
                                const earnedThisMonth = ACHIEVEMENTS.filter((a) => (ms as any).achievementKeysThisMonth?.includes(a.key));
                                const hasAchievements = earnedThisMonth.length > 0;
                                return (
                                  <div className={`grid gap-4 mb-4 pt-4 ${hasAchievements ? "grid-cols-3" : "grid-cols-2"}`}>
                                    <div>
                                      <p className="font-display text-2xl font-semibold tabular-nums">{ms.itemsThisMonth.toLocaleString()}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{t("monthly.items" as any)}</p>
                                      <p className="text-xs mt-1 text-muted-foreground/70">{itemsDeltaLabel}</p>
                                    </div>
                                    <div>
                                      <p className="font-display text-2xl font-semibold tabular-nums">{formatTimeSpent(ms.secondsThisMonth)}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">{t("monthly.timeSpent" as any)}</p>
                                      <p className="text-xs mt-1 text-muted-foreground/70">{timeDeltaLabel}</p>
                                    </div>
                                    {hasAchievements && (
                                      <div>
                                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                                          {earnedThisMonth.map((a) => {
                                            const Icon = ICON_MAP[a.icon] ?? Trophy;
                                            return (
                                              <TooltipProvider key={a.key} delayDuration={150}>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 cursor-default">
                                                      <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                                                    <p className="font-semibold">{t(`achievement.${a.key}.title` as any)}</p>
                                                    <p>{t(`achievement.${a.key}.desc` as any)}</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            );
                                          })}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t("monthly.achievements" as any)}</p>
                                        <p className="text-xs mt-1 text-muted-foreground/70">{t("monthly.achievementsEarned" as any)}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                              <p className="text-xs text-muted-foreground/80 italic leading-relaxed border-t border-border/40 pt-3">{message}</p>
                            </div>
                          </details>
                        );
                      })()}

                      {tierQuery.data?.tier && (
                        <div className="mb-6 rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {t("dashboard.tierLabel")}{" "}
                              <span className="text-[var(--color-accent)] font-semibold">
                                {t(`dashboard.tierName.${tierQuery.data.tier}` as any) || tierQuery.data.tier}
                              </span>
                              {tierQuery.data.percentile != null && (
                                <span className="text-muted-foreground font-normal">
                                  {" "}· {t("dashboard.tierTopReaders", { pct: String(Math.round(100 - tierQuery.data.percentile)) })}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("dashboard.tierMeta")}
                              {tierQuery.data.updatedAt && (
                                <> · {t("dashboard.tierUpdated", { date: new Date(tierQuery.data.updatedAt).toLocaleDateString() })}</>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {t("dashboard.tierStats", {
                                completed: String(tierQuery.data.itemsCompleted ?? 0),
                                started: String(tierQuery.data.itemsStarted ?? 0),
                              })}
                            </p>
                          </div>
                        </div>
                      )}

                    </>
                  );
                })()}

                <h2 className="font-display text-lg font-semibold mb-3">{t("dashboard.categoryProgress")}</h2>
                <CategoryAccordion
                  categories={categoriesQuery.data ?? []}
                  progress={progressQuery.data}
                  isAdmin={isAdmin}
                  lang={lang}
                  t={t}
                  bookmarkIds={bookmarkIds}
                />

              </>
            )}
          </TabsContent>


          <TabsContent value="saved" className="mt-6">
            {bookmarkedItemsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.loading")}</p>
            ) : (bookmarkedItemsQuery.data?.items ?? []).length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 flex flex-col items-center gap-3 text-center">
                <Bookmark className="h-8 w-8 text-muted-foreground/40" />
                <p className="font-medium text-foreground">{t("dashboard.savedEmpty")}</p>
                <p className="text-sm text-muted-foreground max-w-xs">{t("dashboard.savedEmptyHint")}</p>
              </div>
            ) : (
              <ul className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {(bookmarkedItemsQuery.data?.items ?? []).map((row: any) => {
                  const item = row.content_items;
                  const cat = item.categories;
                  const title = pickLang(lang, item.title, item.title_es) || item.title;
                  const catName = pickLang(lang, cat.name, cat.name_es);
                  const isBookmarked = bookmarkIds.has(item.id);
                  return (
                    <li key={item.id} className="flex items-center gap-4 p-5">
                      <CategoryIcon
                        name={cat.icon_name}
                        color={cat.icon_color}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <a
                          href={`/category/${cat.slug}#item-${item.id}`}
                          className="text-sm font-medium text-foreground hover:underline line-clamp-2 leading-tight"
                        >
                          {title}
                        </a>
                        <div>
                          <span className="text-xs text-muted-foreground">{catName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={t("bookmark.remove")}
                                onClick={() => toggleBookmarkItem(item.id)}
                                className="inline-flex items-center justify-center rounded-[4px] border border-input bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                              >
                                <Bookmark
                                  className={`h-3.5 w-3.5 transition-colors ${isBookmarked ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : "text-muted-foreground"}`}
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {t("bookmark.remove")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {item.type && (
                          <Badge variant="type" type={item.type}>
                            {translateType(lang, item.type)}
                          </Badge>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            {(() => {
              const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
                BookOpen, Compass, CheckCircle2, Award, Trophy, GraduationCap, Medal, Flame, Clock,
              };
              const cats = ["first_steps", "completion", "streaks", "time"] as const;
              const byCategory = Object.fromEntries(
                cats.map((cat) => [cat, ACHIEVEMENTS.filter((a) => a.category === cat)])
              );
              const earnedCount = ACHIEVEMENTS.filter((a) => !!earnedAchievements[a.key]).length;
              return (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-lg font-semibold">{t("dashboard.tabAchievements")}</h2>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {t("dashboard.achievementsCount", { earned: earnedCount, total: ACHIEVEMENTS.length })}
                    </span>
                  </div>
                  <div className="space-y-6">
                    {cats.map((cat) => (
                      <div key={cat}>
                        <p className="text-xs font-medium text-muted-foreground tracking-wide mb-2">
                          {t(`achievement.category.${cat}` as any)}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {byCategory[cat].map((a) => {
                            const earned = !!earnedAchievements[a.key];
                            const Icon = ICON_MAP[a.icon] ?? Trophy;
                            const earnedAt = earnedAchievements[a.key];
                            return (
                              <div
                                key={a.key}
                                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                                  earned
                                    ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
                                    : "border-border bg-card opacity-40"
                                }`}
                              >
                                <div
                                  className="flex h-10 w-10 items-center justify-center rounded-full"
                                  style={earned
                                    ? { background: "color-mix(in oklab, var(--color-accent) 15%, transparent)" }
                                    : { background: "var(--muted)" }}
                                >
                                  {earned
                                    ? <Icon className="h-5 w-5 text-[var(--color-accent)]" />
                                    : <Lock className="h-4 w-4 text-muted-foreground" />
                                  }
                                </div>
                                <div>
                                  <p className="text-xs font-semibold leading-tight">
                                    {t(`achievement.${a.key}.title` as any)}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-tight">
                                    {t(`achievement.${a.key}.desc` as any)}
                                  </p>
                                  {earnedAt && (
                                    <p className="mt-1 text-[10px] text-[var(--color-accent)]">
                                      {new Date(earnedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
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

          {/* ── Testing Tab (tester role only) ─────────────────────────────── */}
          {isTester && (
            <TabsContent value="testing" className="mt-6">
              <TestingTab />
            </TabsContent>
          )}
        </Tabs>


      </main>

      <SiteFooter />
    </div>
  );
}

// ── Testing Tab ────────────────────────────────────────────────────────────────

const TOTAL_TESTS = QA_TESTS.length;

const STATUS_ICON_COMPONENTS: Record<TestStatus, typeof CheckCircle> = {
  pass:     CheckCircle,
  fail:     XCircle,
  blocked:  MinusCircle,
  skipped:  SkipForward,
  untested: Circle,
};

function TestingTab() {
  const qc = useQueryClient();
  const createRunFn    = useServerFn(createTestRun);
  const listRunsFn     = useServerFn(listMyTestRuns);
  const getResultsFn   = useServerFn(getRunResults);
  const upsertFn       = useServerFn(upsertTestResult);
  const completeFn     = useServerFn(completeTestRun);
  const reopenFn       = useServerFn(reopenTestRun);
  const deleteRunFn    = useServerFn(deleteTestRun);
  const getUploadUrlFn = useServerFn(getQaScreenshotUploadUrl);

  const confirmDelete = useConfirmDelete();

  // Single hidden file input shared across all test items.
  // uploadTestIdRef tracks which test the next file-picker result belongs to.
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const uploadTestIdRef    = useRef<string | null>(null);
  const [uploadingTests, setUploadingTests] = useState<Set<string>>(new Set());

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [creating, setCreating]       = useState(false);
  const [newLabel, setNewLabel]       = useState("");
  const [saving, setSaving]           = useState(false);

  const runsQuery = useQuery({
    queryKey: ["my-test-runs"],
    queryFn:  () => listRunsFn(),
    staleTime: 30_000,
  });
  const runs = runsQuery.data?.runs ?? [];

  const resultsQuery = useQuery({
    queryKey: ["my-test-run-results", activeRunId],
    enabled:  !!activeRunId,
    queryFn:  () => getResultsFn({ data: { runId: activeRunId! } }),
    staleTime: 0,
  });

  // resultMap: testId → { status, notes, screenshot_url }
  const resultMap = new Map<string, { status: TestStatus; notes: string | null; screenshot_url: string | null }>();
  for (const r of resultsQuery.data?.results ?? []) {
    resultMap.set(r.test_id, { status: r.status as TestStatus, notes: r.notes ?? null, screenshot_url: r.screenshot_url ?? null });
  }

  const activeRun = runs.find((r: any) => r.id === activeRunId);
  const isCompleted = !!activeRun?.completed_at;

  // ── Local optimistic state for note editing ─────────────────────────────
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set()); // briefly populated after a successful save
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set()); // tracks which test items have the notes section expanded
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<TestStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  function toggleSection(n: number) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function handleSetStatus(testId: string, status: TestStatus) {
    if (!activeRunId || isCompleted) return;
    setSaving(true);
    try {
      const currentNotes = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
      await upsertFn({ data: { runId: activeRunId, testId, status, notes: currentNotes } });
      qc.invalidateQueries({ queryKey: ["my-test-run-results", activeRunId] });
      // Auto-expand the notes section for statuses that typically need an explanation.
      if (status === "fail" || status === "blocked") {
        setOpenNotes((prev) => new Set(prev).add(testId));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save result");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote(testId: string) {
    if (!activeRunId || isCompleted) return;
    const notes = pendingNotes[testId];
    if (notes === undefined) return;
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    try {
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes } });
      qc.invalidateQueries({ queryKey: ["my-test-run-results", activeRunId] });
      setPendingNotes((prev) => { const next = { ...prev }; delete next[testId]; return next; });
      // "Saved ✓" persists until the user types again (onChange clears it).
      setSavedNotes((prev) => new Set(prev).add(testId));
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save note");
    }
  }

  async function handleRemoveNote(testId: string) {
    if (!activeRunId || isCompleted) return;
    // Clear local state immediately so the UI collapses.
    setPendingNotes((prev) => { const next = { ...prev }; delete next[testId]; return next; });
    setSavedNotes((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    setOpenNotes((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    // Persist the cleared note to the DB.
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    try {
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: "" } });
      qc.invalidateQueries({ queryKey: ["my-test-run-results", activeRunId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove note");
    }
  }

  async function handleScreenshotUpload(testId: string, file: File) {
    if (!activeRunId) return;
    setUploadingTests((prev) => new Set(prev).add(testId));
    try {
      const { signedUrl, publicUrl } = await getUploadUrlFn({ data: { runId: activeRunId, testId, fileName: file.name } });
      const res = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/png" }, body: file });
      if (!res.ok) throw new Error("Upload failed");
      const currentStatus = resultMap.get(testId)?.status ?? "untested";
      const currentNotes  = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
      await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: currentNotes, screenshotUrl: publicUrl } });
      qc.invalidateQueries({ queryKey: ["my-test-run-results", activeRunId] });
      toast.success("Screenshot attached");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploadingTests((prev) => { const next = new Set(prev); next.delete(testId); return next; });
    }
  }

  async function handleRemoveScreenshot(testId: string) {
    if (!activeRunId) return;
    const currentStatus = resultMap.get(testId)?.status ?? "untested";
    const currentNotes  = pendingNotes[testId] ?? resultMap.get(testId)?.notes ?? undefined;
    await upsertFn({ data: { runId: activeRunId, testId, status: currentStatus, notes: currentNotes, screenshotUrl: null } });
    qc.invalidateQueries({ queryKey: ["my-test-run-results", activeRunId] });
  }

  async function handleCreateRun() {
    const label = newLabel.trim();
    if (!label) return;
    try {
      const { run } = await createRunFn({ data: { label } });
      await qc.invalidateQueries({ queryKey: ["my-test-runs"] });
      setActiveRunId((run as any).id);
      setCreating(false);
      setNewLabel("");
      setOpenSections(new Set());
      setFilterStatus("all");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create run");
    }
  }

  async function handleComplete() {
    if (!activeRunId) return;
    await completeFn({ data: { runId: activeRunId } });
    qc.invalidateQueries({ queryKey: ["my-test-runs"] });
  }

  async function handleReopen() {
    if (!activeRunId) return;
    await reopenFn({ data: { runId: activeRunId } });
    qc.invalidateQueries({ queryKey: ["my-test-runs"] });
  }

  async function handleDeleteRun(runId: string, label: string) {
    await confirmDelete({
      title: `Delete "${label}"?`,
      description: "This will permanently delete the test run and all its results, statuses, notes, and screenshots.",
      onConfirm: async () => {
        await deleteRunFn({ data: { runId } });
        if (activeRunId === runId) setActiveRunId(null);
        qc.invalidateQueries({ queryKey: ["my-test-runs"] });
      },
    });
  }

  // ── Stats for the active run ───────────────────────────────────────────
  const passCount    = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "pass").length;
  const failCount    = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail").length;
  const blockedCount = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "blocked").length;
  const skippedCount = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "skipped").length;
  const actionedCount = passCount + failCount + blockedCount + skippedCount;
  const progressPct = Math.round((actionedCount / TOTAL_TESTS) * 100);
  const failures = QA_TESTS.filter((t) => resultMap.get(t.id)?.status === "fail");

  // ── Run list view ─────────────────────────────────────────────────────
  if (!activeRunId) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-7 w-7 text-[var(--color-accent)]" /> QA Test Runs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{TOTAL_TESTS} test cases across {QA_SECTIONS.length} sections</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New run
          </button>
        </div>

        {creating && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateRun(); if (e.key === "Escape") { setCreating(false); setNewLabel(""); } }}
              placeholder="Run label (e.g. Post-deploy June 3)"
              className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateRun}
              disabled={!newLabel.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewLabel(""); }}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {runsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium">No test runs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a new run to start working through the QA checklist.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run: any) => {
              const counts: Record<string, number> = {};
              // We don't have counts in the list view — just show the run metadata
              return (
                <div
                  key={run.id}
                  className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => { setActiveRunId(run.id); setOpenSections(new Set()); setFilterStatus("all"); }}
                >
                  <ClipboardCheck className={`h-5 w-5 shrink-0 ${run.completed_at ? "text-green-600" : "text-[var(--color-accent)]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{run.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(run.created_at).toLocaleDateString()}
                      {run.completed_at ? " · Completed" : " · In progress"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id, run.label); }}
                    className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Active run view ───────────────────────────────────────────────────
  return (
    <div>
      {/* Hidden file input shared across all test items */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const testId = uploadTestIdRef.current;
          if (file && testId) handleScreenshotUpload(testId, file);
          e.target.value = "";
        }}
      />
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          type="button"
          onClick={() => setActiveRunId(null)}
          className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> All runs
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-semibold truncate">{activeRun?.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(activeRun?.created_at).toLocaleDateString()}
            {isCompleted ? " · Completed" : " · In progress"}
          </p>
        </div>
        {isCompleted ? (
          <button
            type="button"
            onClick={handleReopen}
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Reopen
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            className="shrink-0 inline-flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
          >
            <CheckCircle className="h-4 w-4" /> Mark complete
          </button>
        )}
      </div>

      {/* Progress summary */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-6 flex items-center gap-5">
        <CircleProgress value={progressPct} size={64} stroke={6} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-2">{actionedCount} of {TOTAL_TESTS} tests actioned</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-green-600 font-medium">{passCount} passed</span>
            <span className="text-red-600 font-medium">{failCount} failed</span>
            <span className="text-yellow-600 font-medium">{blockedCount} blocked</span>
            <span className="text-muted-foreground">{skippedCount} skipped</span>
            <span className="text-muted-foreground">{TOTAL_TESTS - actionedCount} untested</span>
          </div>
        </div>
      </div>

      {/* Failures summary */}
      {failures.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-6">
          <p className="text-sm font-semibold text-red-700 mb-3">
            {failures.length} failure{failures.length !== 1 ? "s" : ""} require attention
          </p>
          <ul className="space-y-1.5">
            {failures.map((t) => {
              const notes = resultMap.get(t.id)?.notes;
              return (
                <li key={t.id} className="text-sm">
                  <span className="font-medium text-red-700">{t.id}</span>
                  <span className="text-red-600"> — {t.title}</span>
                  {notes && <p className="text-xs text-red-600/80 mt-0.5 pl-8">{notes}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Filters — two connected pills; active state matches the badge color in the test list */}
      {(() => {
        const PRIORITY_ICONS = { all: Layers, critical: AlertCircle, high: ChevronUp, medium: Minus, low: ChevronDown } as const;
        const DEFAULT_ACTIVE = "relative z-10 bg-foreground text-background border-foreground";
        const renderPill = (buttons: { key: string; Icon: any; label: string; active: boolean; activeClass: string; onClick: () => void }[]) =>
          buttons.map(({ key, Icon, label, active, activeClass, onClick }, i) => {
            const isFirst = i === 0;
            const isLast = i === buttons.length - 1;
            return (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className={[
                  "inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors",
                  isFirst ? "rounded-l-md" : "-ml-px rounded-l-none",
                  isLast  ? "rounded-r-md" : "rounded-r-none",
                  active ? `relative z-10 ${activeClass}` : "bg-background text-muted-foreground border-border hover:bg-muted",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          });

        const STATUS_ACTIVE: Record<string, string> = {
          all:      DEFAULT_ACTIVE,
          pass:     "text-green-700 bg-green-50 border-green-300",
          fail:     "text-red-700 bg-red-50 border-red-300",
          blocked:  "text-yellow-700 bg-yellow-50 border-yellow-300",
          skipped:  "text-muted-foreground bg-muted/60 border-border",
          untested: "text-muted-foreground bg-muted border-border",
        };
        const PRIORITY_ACTIVE: Record<string, string> = {
          all:      DEFAULT_ACTIVE,
          critical: "text-red-600 bg-red-50 border-red-200",
          high:     "text-orange-600 bg-orange-50 border-orange-200",
          medium:   "text-yellow-600 bg-yellow-50 border-yellow-200",
          low:      "text-green-600 bg-green-50 border-green-200",
        };

        return (
          <div className="flex items-center gap-3 my-6">
            <div className="flex items-center">
              {renderPill((["all", "pass", "fail", "blocked", "skipped", "untested"] as const).map((s) => ({
                key: `s-${s}`,
                Icon: s === "all" ? LayoutList : STATUS_ICON_COMPONENTS[s],
                label: s === "all" ? "All" : STATUS_LABELS[s],
                active: filterStatus === s,
                activeClass: STATUS_ACTIVE[s],
                onClick: () => setFilterStatus(s),
              })))}
            </div>
            <span className="h-5 w-px bg-border shrink-0" />
            <div className="flex items-center">
              {renderPill((["all", "critical", "high", "medium", "low"] as const).map((p) => ({
                key: `p-${p}`,
                Icon: PRIORITY_ICONS[p],
                label: p === "all" ? "All priorities" : p.charAt(0).toUpperCase() + p.slice(1),
                active: filterPriority === p,
                activeClass: PRIORITY_ACTIVE[p],
                onClick: () => setFilterPriority(p),
              })))}
            </div>
          </div>
        );
      })()}

      {/* Section accordions */}
      <div className="space-y-2">
        {QA_SECTIONS.map((section) => {
          const sectionTests = QA_TESTS.filter((t) => t.sectionNum === section.num);
          const filtered = sectionTests.filter((t) => {
            const statusMatch = filterStatus === "all" || (resultMap.get(t.id)?.status ?? "untested") === filterStatus;
            const priorityMatch = filterPriority === "all" || t.priority === filterPriority;
            return statusMatch && priorityMatch;
          });
          if (filtered.length === 0) return null;

          const sPass    = sectionTests.filter((t) => resultMap.get(t.id)?.status === "pass").length;
          const sFail    = sectionTests.filter((t) => resultMap.get(t.id)?.status === "fail").length;
          const sActioned = sectionTests.filter((t) => {
            const s = resultMap.get(t.id)?.status ?? "untested";
            return s !== "untested";
          }).length;
          const sPct = Math.round((sActioned / sectionTests.length) * 100);
          const isOpen = openSections.has(section.num);

          return (
            <div key={section.num} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection(section.num)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
              >
                <CircleProgress value={sPct} size={44} stroke={4} className="shrink-0" />
                <span className="font-medium text-sm flex-1">
                  {section.num}. {section.title}
                </span>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  {sPass > 0 && <span className="text-green-600 font-medium">{sPass}✓</span>}
                  {sFail > 0 && <span className="text-red-600 font-medium">{sFail}✗</span>}
                  <span className="text-muted-foreground">{sActioned}/{sectionTests.length}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border/60">
                  {filtered.map((test) => {
                    const result = resultMap.get(test.id);
                    const status: TestStatus = result?.status ?? "untested";
                    const currentNote = pendingNotes[test.id] ?? result?.notes ?? "";
                    const noteDirty = pendingNotes[test.id] !== undefined && pendingNotes[test.id] !== (result?.notes ?? "");
                    const StatusIcon = STATUS_ICON_COMPONENTS[status];

                    return (
                      <div key={test.id} className={`p-5 ${status === "fail" ? "bg-red-50/40" : ""}`}>
                        {/* Test header */}
                        <div className="flex items-start gap-3">
                          <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${
                            status === "pass"     ? "text-green-600" :
                            status === "fail"     ? "text-red-600" :
                            status === "blocked"  ? "text-yellow-600" :
                            status === "skipped"  ? "text-muted-foreground" :
                            "text-muted-foreground/30"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-muted-foreground">{test.id}</span>
                              {(() => {
                                const priorityConfig = {
                                  critical: { icon: AlertCircle, label: "Critical", cls: "text-red-600 bg-red-50 border-red-200" },
                                  high:     { icon: ChevronUp,   label: "High",     cls: "text-orange-600 bg-orange-50 border-orange-200" },
                                  medium:   { icon: Minus,        label: "Medium",   cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
                                  low:      { icon: ChevronDown,  label: "Low",      cls: "text-green-600 bg-green-50 border-green-200" },
                                }[test.priority];
                                const PIcon = priorityConfig.icon;
                                return (
                                  <span className={`inline-flex items-center leading-none gap-1 rounded-[4px] border px-2.5 py-[5px] text-xs font-medium flex-shrink-0 ${priorityConfig.cls}`}>
                                    <PIcon className="h-3 w-3" />
                                    {priorityConfig.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm font-medium mb-1">{test.title}</p>
                            {(() => {
                              // Split the description at the pass-criteria marker so we can
                              // control the gap between steps and ✅ Pass independently.
                              const parts = test.description.split('\n\n✅ Pass:');
                              return parts.length === 2 ? (
                                <>
                                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{parts[0]}</p>
                                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line mt-1.5">✅ Pass:{parts[1]}</p>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{test.description}</p>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Status buttons + Add note button on the same row */}
                        {!isCompleted && (() => {
                          // Notes section is open when: manually opened, already has content, or status requires explanation.
                          const notesOpen = openNotes.has(test.id) || !!currentNote || status === "fail" || status === "blocked";
                          return (
                            <>
                              <div className="flex items-center mt-4 ml-7">
                                {/* Status buttons as a connected pill matching the filter pills */}
                                {(["pass", "fail", "blocked", "skipped", "untested"] as TestStatus[]).map((s, i, arr) => {
                                  const SIcon = STATUS_ICON_COMPONENTS[s];
                                  const isFirst = i === 0;
                                  const isLast = i === arr.length - 1;
                                  return (
                                    <button
                                      key={s}
                                      type="button"
                                      disabled={saving}
                                      onClick={() => handleSetStatus(test.id, s)}
                                      className={[
                                        "inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60",
                                        isFirst ? "rounded-l-md" : "-ml-px rounded-l-none",
                                        isLast  ? "rounded-r-md" : "rounded-r-none",
                                        status === s ? `relative z-10 ${STATUS_COLORS[s]}` : "bg-background text-muted-foreground border-border hover:bg-muted",
                                      ].join(" ")}
                                    >
                                      <SIcon className="h-3.5 w-3.5" />
                                      {STATUS_LABELS[s]}
                                    </button>
                                  );
                                })}
                                {/* Add note / Remove note — hidden for fail/blocked where notes are always expected */}
                                {status !== "fail" && status !== "blocked" && (
                                  <button
                                    type="button"
                                    onClick={() => notesOpen ? handleRemoveNote(test.id) : setOpenNotes((prev) => new Set(prev).add(test.id))}
                                    className={`ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                                      notesOpen
                                        ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                                        : "border-border text-muted-foreground hover:bg-muted"
                                    }`}
                                  >
                                    {notesOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                    {notesOpen ? "Remove note" : "Add note"}
                                  </button>
                                )}
                              </div>

                              {/* Notes textarea + action row — only shown when notesOpen */}
                              {notesOpen && (
                                <div className="ml-7 mt-[32px]">
                                  <textarea
                                    rows={3}
                                    value={currentNote}
                                    placeholder="Add notes (required for failures)…"
                                    onChange={(e) => {
                                      setPendingNotes((prev) => ({ ...prev, [test.id]: e.target.value }));
                                      // Typing resets the "Saved ✓" state back to "Save note".
                                      setSavedNotes((prev) => { const next = new Set(prev); next.delete(test.id); return next; });
                                    }}
                                    onBlur={() => { if (noteDirty) handleSaveNote(test.id); }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                                  />
                                  <div className="flex items-center justify-between gap-2 mt-[32px]">
                                    {/* Left: screenshot button (only for fail/blocked/skipped) */}
                                    <div>
                                      {result?.screenshot_url ? (
                                        <div className="flex items-center gap-2">
                                          <a
                                            href={result.screenshot_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                                          >
                                            <ImagePlus className="h-3.5 w-3.5" />
                                            View screenshot
                                            <ExternalLink className="h-3 w-3 opacity-60" />
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveScreenshot(test.id)}
                                            className="inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            title="Remove screenshot"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (status === "fail" || status === "blocked" || status === "skipped") && (
                                        <button
                                          type="button"
                                          disabled={uploadingTests.has(test.id)}
                                          onClick={() => {
                                            uploadTestIdRef.current = test.id;
                                            fileInputRef.current?.click();
                                          }}
                                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-md px-3 py-2 transition-colors disabled:opacity-60"
                                        >
                                          {uploadingTests.has(test.id) ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <ImagePlus className="h-3.5 w-3.5" />
                                          )}
                                          {uploadingTests.has(test.id) ? "Uploading…" : "Attach screenshot"}
                                        </button>
                                      )}
                                    </div>
                                    {/* Right: Save note — always visible */}
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNote(test.id)}
                                      className={`inline-flex items-center gap-1.5 justify-center rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                                        savedNotes.has(test.id)
                                          ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                                          : "border-input bg-background text-foreground hover:bg-muted"
                                      }`}
                                    >
                                      {savedNotes.has(test.id) ? (
                                        <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
                                      ) : "Save note"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Completed state: notes + screenshot (only if content exists) */}
                        {isCompleted && (currentNote || result?.screenshot_url) && (
                          <div className="ml-7 mt-3">
                            {currentNote && (
                              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground whitespace-pre-line">
                                {currentNote}
                              </div>
                            )}
                            {result?.screenshot_url && (
                              <a
                                href={result.screenshot_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                              >
                                <ImagePlus className="h-3.5 w-3.5" />
                                View screenshot
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
  exempt_from_progress?: boolean;
};

function CategoryAccordion({
  categories,
  progress,
  isAdmin,
  lang,
  t,
  bookmarkIds,
}: {
  categories: Category[];
  progress: any;
  isAdmin: boolean;
  lang: "en" | "es";
  t: (key: string, vars?: Record<string, string | number>) => string;
  bookmarkIds: Set<string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const engagementMap = progress?.engagementMap ?? new Map();
  const readAtMap = progress?.readAtMap ?? new Map<string, string>();
  const ratingsMap: Map<string, 1 | -1> = progress?.ratingsMap ?? new Map();
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
            bookmarkIds={bookmarkIds}
            ratingsMap={ratingsMap}
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
  bookmarkIds,
  ratingsMap,
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
  bookmarkIds: Set<string>;
  ratingsMap: Map<string, 1 | -1>;
  isOpen: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  const open = isOpen;
  const trackableItems = items.filter((it) => !(it as any).exempt_from_progress);
  const pct = weightedCompletionPct(trackableItems, readSet, engagementMap);

  const tagline = pickLang(lang, category.tagline, category.tagline_es);
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen && sectionRef.current) {
      const el = sectionRef.current;
      // rAF defers the scroll until after the expand animation has begun and
      // the element has its updated layout — measuring getBoundingClientRect()
      // synchronously would use the collapsed (zero-height) dimensions.
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
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {(() => {
                const catSecs = items.reduce((sum, it) => sum + (engagementMap.get(it.id)?.sessionSeconds ?? 0), 0);
                const completedText = t("dashboard.itemsCompleted", { done: read.toLocaleString(), total: total.toLocaleString() } as any);
                return catSecs > 0 ? `${completedText} · ${formatTimeSpent(catSecs)} spent` : completedText;
              })()}
            </p>
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
                      const isBookmarked = bookmarkIds.has(it.id);
                      const myRating = ratingsMap.get(it.id) ?? null;

                      // Determine action badge
                      let actionBadge: React.ReactNode;
                      const isAV = it.type && (it.type.toLowerCase().includes("video") || it.type.toLowerCase().includes("audio") || it.type.toLowerCase().includes("podcast"));
                      const mediaPct = !isRead && isAV && eng?.mediaProgressSeconds && eng?.mediaDurationSeconds && eng.mediaDurationSeconds > 0
                        ? Math.min(100, Math.round((eng.mediaProgressSeconds / eng.mediaDurationSeconds) * 100))
                        : null;
                      const isPdf = (it.file_url && /\.pdf(\?|#|$)/i.test(it.file_url)) || (it.url && /\.pdf(\?|#|$)/i.test(it.url));
                      const pdfMins = isPdf ? parseMinutes(it.duration) : 0;
                      const pdfEstSec = pdfMins * 60;
                      const pdfPct = !isRead && isPdf && pdfEstSec > 0 && eng && eng.sessionSeconds > 0
                        ? Math.min(100, Math.round((eng.sessionSeconds / (pdfEstSec * 0.95)) * 100))
                        : null;

                      if (mediaPct !== null && mediaPct >= 5) {
                        const watchedLabel = it.type.toLowerCase().includes("video")
                          ? t("category.markedWatched").toLowerCase()
                          : t("category.markedListened").toLowerCase();
                        actionBadge = (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${mediaPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{mediaPct}% {watchedLabel}</span>
                          </span>
                        );
                      } else if (pdfPct !== null && pdfPct >= 1) {
                        actionBadge = (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pdfPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{pdfPct}% {t("category.markedRead").toLowerCase()}</span>
                          </span>
                        );
                      } else if (it.exempt_from_progress) {
                        actionBadge = (
                          <span className={`inline-flex items-center leading-none gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 ${
                            isRead
                              ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                              : "border-input bg-background text-foreground"
                          }`}>
                            {isRead ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> : <Circle className="h-3.5 w-3.5 flex-shrink-0" />}
                            {isRead ? t("category.acknowledged") : t("category.acknowledge")}
                          </span>
                        );
                      } else {
                        actionBadge = (
                          <ReadStatusBadge
                            read={isRead}
                            readLabel={
                              isRead && isPdf && eng?.manualCompletionPct != null
                                ? `${labels.read} at ${eng.manualCompletionPct}%`
                                : labels.read
                            }
                            unreadLabel={labels.unread}
                            readAt={isRead ? (fmtDateShort(readAtMap.get(it.id)) || null) : null}
                          />
                        );
                      }

                      return (
                        <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            {myRating !== null && (
                              <span className={`inline-flex items-center justify-center rounded-[4px] border px-2 py-1.5 ${
                                myRating === 1
                                  ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                  : "border-destructive/30 bg-destructive/10 text-destructive"
                              }`}>
                                {myRating === 1
                                  ? <ThumbsUp className="h-3.5 w-3.5 fill-[var(--color-accent)]" />
                                  : <ThumbsDown className="h-3.5 w-3.5 fill-destructive" />}
                              </span>
                            )}
                            {isBookmarked && (
                              <span className="inline-flex items-center justify-center rounded-[4px] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-1.5">
                                <Bookmark className="h-3.5 w-3.5 fill-[var(--color-accent)]" />
                              </span>
                            )}
                            {actionBadge}
                          </div>
                          {it.exempt_from_progress && (
                            <p className="text-[10px] text-muted-foreground leading-tight">{t("category.exemptDisclaimer")}</p>
                          )}
                        </div>
                      );
                    })()}

                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link
                        to="/category/$slug"
                        params={{ slug: category.slug }}
                        hash={`item-${it.id}`}
                        className="truncate text-lg font-semibold text-foreground hover:underline"
                      >
                        {pickLang(lang, it.title, it.title_es)}
                      </Link>
                      {(it as any).exempt_from_progress && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex flex-shrink-0 cursor-help text-muted-foreground">
                                <Info className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                              {t("category.exemptTooltip")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
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
