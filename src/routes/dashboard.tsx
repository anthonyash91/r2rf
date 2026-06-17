import { createFileRoute, redirect, Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { useKeyboardInput } from "@/components/OnScreenKeyboard";
import { useI18n, pickLang, translateDuration, translateType, type TranslationKey } from "@/lib/i18n";
import { QK } from "@/lib/query-keys";
import { withActionWord, parseMinutes } from "@/lib/duration";
import { weightedCompletionPct } from "@/lib/content-progress";
import { formatTimeSpent, fmtDateShort } from "@/lib/date-format";
import { readStatusLabels } from "@/lib/read-status";
import { getMyBookmarkedItems } from "@/lib/bookmarks.functions";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { useAchievements } from "@/hooks/use-achievements";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { capFirst } from "@/lib/utils";
import { getMyMonthlySummary } from "@/lib/monthly-summary.functions";
// TestingTab is lazy-loaded so the 147 KB qa-test-plan bundle is only
// downloaded by tester accounts, not by every user visiting the dashboard.
const TestingTab = lazy(() => import("@/components/TestingTab"));

import { SecurityQuestionsForm, type SecurityAnswerInput } from "@/components/SecurityQuestionsForm";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { User as UserIcon, Building2, Calendar, Shield, ChevronDown, BookOpen, CheckCircle2, Loader2, Clock, Flame, Trophy, Circle, Bookmark, ThumbsUp, ThumbsDown, Award, Compass, GraduationCap, Medal, Lock, Info, ArrowRight, ClipboardCheck } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-sm text-center">
          <p className="font-semibold text-foreground">Dashboard didn't load</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message ?? "Something went wrong."}</p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  ),
});

function DashboardRoute() {
  return <DashboardRouter />;
}

// Splits tester accounts onto their own minimal page so they only see the QA
// testing interface — no regular user dashboard content at all.
function DashboardRouter() {
  const { rolesLoaded } = useAuth();

  if (!rolesLoaded) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
  return <DashboardPage />;
}

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin, isUser, isTester } = useAuth();
  const queryClient = useQueryClient();
  const badgeStyles = useBadgeStyles();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchQuestions = useServerFn(getMySecurityQuestions);
  const submitUpdate = useServerFn(updateSecurityAnswers);

  const { data, isLoading } = useQuery({
    queryKey: QK.myProfile,
    staleTime: Infinity, // profile only changes on explicit edit
    queryFn: () => fetchProfile(),
  });
  const questionsQuery = useQuery({
    queryKey: QK.mySecurityQuestions,
    staleTime: Infinity, // questions only change on explicit edit
    queryFn: () => fetchQuestions(),
  });

  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: QK.facilities,
    staleTime: 10 * 60 * 1000, // facility list changes rarely
    queryFn: () => fetchFacilities(),
  });
  const facilityNameMap = new Map(
    (facilitiesQuery.data?.facilities ?? []).map((f) => [f.value, f.label]),
  );

  const userFacility = (data?.profile as any)?.facility ?? null;

  const categoriesQuery = useQuery({
    queryKey: QK.dashboardCategoriesFor(userFacility),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000, // categories change rarely; 5 min is fine
    queryFn: async (): Promise<Category[]> => {
      // Fetch all published categories + their facility assignments
      const { data: cats, error } = await supabase
        .from("categories")
        .select("id, slug, name, tagline, description, icon_url, icon_name, icon_color, sort_order, published, home_page_mode, name_es, tagline_es, description_es")
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
    queryKey: QK.myEngagementTier(user?.id),
    enabled: !!user?.id && isUser,
    staleTime: 60 * 60 * 1000, // 1 hr — data is daily anyway
    queryFn: () => fetchTier(),
  });

  const loginsQuery = useQuery({
    queryKey: QK.myLoginDays(user?.id ?? null),
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

  const categoryIds = useMemo(
    () => (categoriesQuery.data ?? []).map((c) => c.id),
    [categoriesQuery.data],
  );
  const userId = user?.id ?? null;

  const progressQuery = useQuery({
    queryKey: QK.dashboardProgressFor(userId, categoryIds.join(",")),
    enabled: !!userId && categoryIds.length > 0,
    staleTime: 30 * 1000, // progress should feel near-live; 30s is enough
    queryFn: async () => {
      const [itemsRes, readRes, seenRes, engRes, ratingsRes] = await Promise.all([
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
        (supabase as any)
          .from("user_content_engagement")
          .select("content_item_id, session_seconds, media_progress_seconds, media_duration_seconds, manual_completion_pct")
          .eq("user_id", userId!),
        (supabase as any)
          .from("user_content_ratings")
          .select("content_item_id, rating")
          .eq("user_id", userId!),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (readRes.error) throw readRes.error;

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
      const totalSeconds = ((engRes.data ?? []) as any[]).reduce(
        (sum: number, r: any) => sum + ((r.session_seconds as number) || 0), 0,
      );
      const engagementMap = new Map<string, { sessionSeconds: number; mediaProgressSeconds: number | null; mediaDurationSeconds: number | null; manualCompletionPct: number | null }>();
      for (const r of (engRes.data ?? []) as any[]) {
        engagementMap.set(r.content_item_id as string, {
          sessionSeconds: (r.session_seconds as number) || 0,
          mediaProgressSeconds: r.media_progress_seconds as number | null,
          mediaDurationSeconds: r.media_duration_seconds as number | null,
          manualCompletionPct: r.manual_completion_pct as number | null,
        });
      }
      const ratingsMap = new Map<string, 1 | -1>();
      for (const r of (ratingsRes.data ?? []) as any[]) {
        if (r.rating === 1 || r.rating === -1) ratingsMap.set(r.content_item_id as string, r.rating as 1 | -1);
      }

      return { totals, reads, itemsByCat, readSet, readAtMap, recentCats, newItemSet, totalSeconds, readDays, engagementMap, ratingsMap };
    },
  });



  const { bookmarkIds, toggle: toggleBookmarkItem } = useBookmarks();
  const fetchMonthlySummary = useServerFn(getMyMonthlySummary);
  const monthlySummaryQuery = useQuery({
    queryKey: QK.myMonthlySummary(user?.id),
    enabled: !!user?.id && isUser,
    staleTime: 10 * 60 * 1000,
    queryFn: () => fetchMonthlySummary(),
  });
  const resumeQuery = useQuery({
    queryKey: QK.resumeItem(user?.id),
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
    queryKey: QK.myBookmarkedItems(user?.id),
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
  const kbResetPw = useKeyboardInput(resetPw, setResetPw);
  const kbResetPw2 = useKeyboardInput(resetPw2, setResetPw2);
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
      // Ensure the session token is fresh before the server call — a recent
      // password reset / refreshSession() can briefly leave getSession() null,
      // which causes attachSupabaseAuth to send an empty Authorization header.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.refreshSession();
      await submitUpdate({ data: { answers: pending.slice(0, 2) } });
      toast.success(t("security.updateSuccess"));
      setEditing(false);
      setPending([]);
      queryClient.invalidateQueries({ queryKey: QK.mySecurityQuestions });
    } catch (err: any) {
      toast.error(err.message ?? t("signup.genericError"));
    } finally {
      setBusy(false);
    }
  }

  // ── Tab overflow nav (mirrors AdminNav logic) ──────────────────────────
  const { tab: searchTab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(searchTab ?? "categories");
  const effectiveTab = mustSetup ? "account" : activeTab;

  const tabContainerRef = useRef<HTMLDivElement | null>(null);
  const tabMeasureRef = useRef<HTMLUListElement | null>(null);
  const [visibleTabCount, setVisibleTabCount] = useState(5);

  const TAB_NAV_CLS = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors";

  const tabItems: Array<{ value: string; label: React.ReactNode; disabled?: boolean }> = [
    {
      value: "categories",
      disabled: mustSetup,
      label: <><BookOpen className="h-3.5 w-3.5" />{t("dashboard.tabProgress")}</>,
    },
    {
      value: "saved",
      disabled: mustSetup,
      label: (
        <>
          <Bookmark className="h-3.5 w-3.5" />
          {t("dashboard.tabSaved")}
          {bookmarkIds.size > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)]/15 px-1 text-[10px] font-semibold leading-none text-[var(--color-accent)]">
              {bookmarkIds.size}
            </span>
          )}
        </>
      ),
    },
    {
      value: "achievements",
      disabled: mustSetup,
      label: (
        <>
          <Trophy className="h-3.5 w-3.5" />
          {t("dashboard.tabAchievements")}
          {Object.keys(earnedAchievements).length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-accent)]/15 px-1 text-[10px] font-semibold leading-none text-[var(--color-accent)]">
              {Object.keys(earnedAchievements).length}
            </span>
          )}
        </>
      ),
    },
    { value: "account", label: <><UserIcon className="h-3.5 w-3.5" />{t("dashboard.tabAccount")}</> },
    ...(isTester ? [{ value: "testing", label: <><ClipboardCheck className="h-3.5 w-3.5" />Testing</> }] : []),
  ];

  const recomputeTabs = () => {
    const container = tabContainerRef.current;
    const measure = tabMeasureRef.current;
    if (!container || !measure) return;
    const itemEls = Array.from(measure.querySelectorAll<HTMLElement>("[data-tab-measure]"));
    const moreEl = measure.querySelector<HTMLElement>("[data-more-tab-measure]");
    if (!itemEls.length || !moreEl) return;
    const itemWidths = itemEls.map((el) => el.getBoundingClientRect().width);
    const moreWidth = moreEl.getBoundingClientRect().width;
    const available = container.clientWidth - 16;
    const totalAll = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? 4 : 0), 0);
    if (totalAll <= available) { setVisibleTabCount(itemWidths.length); return; }
    let used = moreWidth;
    let count = 0;
    for (let i = 0; i < itemWidths.length; i++) {
      const next = used + itemWidths[i] + 4;
      if (next > available) break;
      used = next;
      count++;
    }
    const activeIdx = tabItems.findIndex((tab) => tab.value === effectiveTab);
    if (activeIdx >= count && count > 0) {
      const activeWidth = itemWidths[activeIdx] ?? 0;
      const replacedWidth = itemWidths[count - 1] ?? 0;
      if (activeWidth > replacedWidth && used - replacedWidth + activeWidth > available) {
        count = Math.max(0, count - 1);
      }
    }
    setVisibleTabCount(Math.max(0, count));
  };

  useLayoutEffect(() => {
    recomputeTabs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabItems.length, effectiveTab]);

  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => recomputeTabs());
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize the heavy cross-category aggregations that run on every render.
  const dashboardStats = useMemo(() => {
    if (!categoriesQuery.data || !progressQuery.data) return null;
    let totalAll = 0, readAll = 0, activeCats = 0, completedCats = 0;
    for (const c of categoriesQuery.data) {
      const t2 = progressQuery.data.totals.get(c.id) ?? 0;
      const r2 = progressQuery.data.reads.get(c.id) ?? 0;
      totalAll += t2;
      readAll += r2;
      if (r2 > 0) activeCats += 1;
      if (t2 > 0 && r2 >= t2) completedCats += 1;
    }
    const allItems = categoriesQuery.data.flatMap((c) => progressQuery.data!.itemsByCat.get(c.id) ?? []);
    const allTrackableItems = allItems.filter((it) => !it.exempt_from_progress);
    const pctAll = weightedCompletionPct(allTrackableItems, progressQuery.data.readSet ?? new Set(), progressQuery.data.engagementMap ?? new Map());
    const totalSeconds = progressQuery.data.totalSeconds ?? 0;
    return { totalAll, readAll, activeCats, completedCats, pctAll, totalSeconds };
  }, [categoriesQuery.data, progressQuery.data]);

  const loginStreak = useMemo(() => {
    const loginDays = loginsQuery.data ?? new Set<string>();
    if (loginDays.size === 0) return 0;
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    let streak = 0;
    let cursor = new Date();
    if (!loginDays.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (loginDays.has(fmt(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [loginsQuery.data]);

  const achievementsGrouped = useMemo(() => {
    const cats = ["first_steps", "completion", "streaks", "time"] as const;
    const byCategory = Object.fromEntries(
      cats.map((cat) => [cat, ACHIEVEMENTS.filter((a) => a.category === cat)])
    );
    const earnedCount = ACHIEVEMENTS.filter((a) => !!earnedAchievements[a.key]).length;
    return { cats, byCategory, earnedCount };
  }, [earnedAchievements]);

  let primaryTabs = tabItems.slice(0, visibleTabCount);
  let overflowTabs = tabItems.slice(visibleTabCount);
  const activeTabInOverflow = overflowTabs.find((tab) => tab.value === effectiveTab);
  if (activeTabInOverflow && primaryTabs.length > 0) {
    const displaced = primaryTabs[primaryTabs.length - 1];
    primaryTabs = [...primaryTabs.slice(0, -1), activeTabInOverflow];
    overflowTabs = overflowTabs.map((tab) => (tab === activeTabInOverflow ? displaced : tab));
  }
  const overflowTabActive = overflowTabs.some((tab) => tab.value === effectiveTab);

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
                  {...kbResetPw}
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
                {...kbResetPw2}
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
        <Tabs value={effectiveTab} className="mt-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {(() => {
                const firstName = ((data as any)?.profile?.first_name ?? "").trim();
                return (
                  <h1 className="font-display text-3xl font-semibold">
                    {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.greetingNoName")}
                  </h1>
                );
              })()}
              <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
            </div>
            <div ref={tabContainerRef} className="relative w-full sm:w-auto overflow-hidden self-stretch sm:self-center">
              {/* Hidden measurement row — renders off-screen to measure item widths */}
              <ul ref={tabMeasureRef} aria-hidden="true" className="invisible pointer-events-none absolute inset-0 flex items-center gap-1 p-2">
                {tabItems.map((tab) => (
                  <li key={tab.value} data-tab-measure className="shrink-0">
                    <span className={TAB_NAV_CLS}>{tab.label}</span>
                  </li>
                ))}
                <li data-more-tab-measure className="shrink-0">
                  <span className={TAB_NAV_CLS}>More <ChevronDown className="h-3.5 w-3.5 opacity-60" /></span>
                </li>
              </ul>
              {/* Visible tab row */}
              <ul className="flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-muted/40 p-2 text-muted-foreground">
                {primaryTabs.map((tab) => (
                  <li key={tab.value} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => tab.disabled ? toast.error(t("dashboard.lockedNav")) : setActiveTab(tab.value)}
                      className={[
                        TAB_NAV_CLS,
                        effectiveTab === tab.value
                          ? "bg-background text-foreground"
                          : tab.disabled
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-background hover:text-foreground",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  </li>
                ))}
                {overflowTabs.length > 0 && (
                  <li className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={[
                          TAB_NAV_CLS,
                          "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-background data-[state=open]:text-foreground",
                          overflowTabActive ? "bg-background text-foreground" : "hover:bg-background hover:text-foreground",
                        ].join(" ")}
                      >
                        More
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {overflowTabs.map((tab) => (
                          <DropdownMenuItem
                            key={tab.value}
                            onSelect={() => tab.disabled ? toast.error(t("dashboard.lockedNav")) : setActiveTab(tab.value)}
                            className={`cursor-pointer ${effectiveTab === tab.value ? "bg-muted" : ""}`}
                          >
                            {tab.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )}
              </ul>
            </div>
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
                              className="flex items-center justify-center h-8 w-8 rounded-[8px] border transition-colors"
                              style={{
                                backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
                                borderColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                                color,
                              }}
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

                {!isAdmin && dashboardStats && (() => {
                  const { totalAll, readAll, completedCats, pctAll, totalSeconds } = dashboardStats;
                  const streak = loginStreak;
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
                                                    <div
                                                      className="flex h-7 w-7 items-center justify-center rounded-md border cursor-default"
                                                      style={{
                                                        backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
                                                        borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
                                                        color: "var(--color-accent)",
                                                      }}
                                                    >
                                                      <Icon className="h-3.5 w-3.5" />
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
                                className="inline-flex items-center justify-center rounded-[8px] border border-input bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
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
                          <Badge variant="type" type={item.type} className="rounded-[8px]">
                            {translateType(lang, item.type, badgeStyles.typeNamesEs)}
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
              const { cats, byCategory, earnedCount } = achievementsGrouped;
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
                                  className="flex h-10 w-10 items-center justify-center rounded-xl border"
                                  style={earned
                                    ? {
                                        backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
                                        borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
                                        color: "var(--color-accent)",
                                      }
                                    : {
                                        backgroundColor: "var(--muted)",
                                        borderColor: "var(--border)",
                                      }}
                                >
                                  {earned
                                    ? <Icon className="h-5 w-5" />
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
                      <UserIcon className="h-3.5 w-3.5" />
                      {profile.username.match(/\d+$/) ? "PIN" : t("signup.username")}
                    </dt>
                    <dd className="mt-1 font-medium font-mono">
                      {profile.username.match(/\d+$/)?.[0] ?? capFirst(profile.username)}
                    </dd>
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
              <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}>
                <TestingTab />
              </Suspense>
            </TabsContent>
          )}
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
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
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
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  engagementMap: Map<string, { sessionSeconds: number; mediaProgressSeconds: number | null; mediaDurationSeconds: number | null; manualCompletionPct: number | null }>;
  bookmarkIds: Set<string>;
  ratingsMap: Map<string, 1 | -1>;
  isOpen: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  const open = isOpen;
  const badgeStyles = useBadgeStyles();
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
        <CircleProgress value={pct} size={52} stroke={5} />
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-base sm:text-lg font-semibold truncate">
                {pickLang(lang, category.name, category.name_es)}
              </h2>
              {hasRecent && (
                <Badge variant="new" className="rounded-[8px] shrink-0">
                  {t("category.newContentAdded")}
                </Badge>
              )}
            </div>
            {isAdmin && tagline && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">{tagline}</p>
            )}
          </div>
          {!isAdmin && (() => {
            const catSecs = items.reduce((sum, it) => sum + (engagementMap.get(it.id)?.sessionSeconds ?? 0), 0);
            return (
              <div className="flex items-center gap-0 flex-shrink-0">
                <span className={[
                  "inline-flex items-center gap-1 border border-input bg-background px-2.5 py-[5px] text-xs font-medium tabular-nums",
                  catSecs > 0 ? "rounded-l-[8px] rounded-r-none" : "rounded-[8px]",
                ].join(" ")}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  {t("dashboard.itemsCompleted", { done: read.toLocaleString(), total: total.toLocaleString() } as any)}
                </span>
                {catSecs > 0 && (
                  <span className="inline-flex items-center gap-1 border border-input bg-background px-2.5 py-[5px] text-xs font-medium tabular-nums rounded-r-[8px] -ml-px">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatTimeSpent(catSecs)}
                  </span>
                )}
              </div>
            );
          })()}
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
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <BadgeGroup className="shrink-0">
                        {newItemSet.has(it.id) && !isRead && (
                          <Badge variant="new" className="rounded-[8px]">{t("category.newContent")}</Badge>
                        )}
                        <Badge variant="type" type={it.type} className="rounded-[8px]">
                          {translateType(lang, it.type, badgeStyles.typeNamesEs)}
                        </Badge>
                      </BadgeGroup>
                      {it.duration && (
                        <span className="text-xs text-muted-foreground truncate min-w-0">
                          {translateDuration(lang, withActionWord(it.duration, it.type))}
                        </span>
                      )}
                    </div>

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
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${mediaPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{mediaPct}% {watchedLabel}</span>
                          </span>
                        );
                      } else if (pdfPct !== null && pdfPct >= 1) {
                        actionBadge = (
                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium flex-shrink-0 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pdfPct}%`, background: "color-mix(in oklab, var(--color-accent) 22%, transparent)" }} />
                            <Circle className="h-3.5 w-3.5 flex-shrink-0 relative" />
                            <span className="relative">{pdfPct}% {t("category.markedRead").toLowerCase()}</span>
                          </span>
                        );
                      } else if (it.exempt_from_progress) {
                        actionBadge = (
                          <span className={`inline-flex items-center leading-none gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 ${
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
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="flex items-center gap-1.5">
                            {myRating !== null && (
                              <span className={`inline-flex items-center justify-center rounded-[8px] border px-2 py-1.5 ${
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
                              <span className="inline-flex items-center justify-center rounded-[8px] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-1.5">
                                <Bookmark className="h-3.5 w-3.5 fill-[var(--color-accent)]" />
                              </span>
                            )}
                            {actionBadge}
                          </div>
                          {it.exempt_from_progress && (
                            // Zero-height wrapper: disclaimer renders visually but doesn't
                            // contribute to the column's flex height, so the action column
                            // stays the same height as the type badge and both top-align naturally.
                            <div className="h-0 overflow-visible flex items-start justify-end">
                              <p className="text-[10px] text-muted-foreground leading-tight">{t("category.exemptDisclaimer")}</p>
                            </div>
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

