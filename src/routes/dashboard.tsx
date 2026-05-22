import { createFileRoute, redirect, Link, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { setSecurityLock } from "@/lib/security-lock";
import { toast } from "sonner";
import { Badge } from "@/components/Badge";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, getMyFacilityCustomHome } from "@/lib/user-signup.functions";
import { facilityLabel } from "@/lib/user-signup";
import { listFacilities } from "@/lib/facilities.functions";
import { getMySecurityQuestions, updateSecurityAnswers } from "@/lib/password-reset.functions";
import { questionLabel } from "@/lib/security-questions";
import { useI18n, pickLang, translateDuration, translateType } from "@/lib/i18n";
import { withActionWord } from "@/lib/duration";

import { SecurityQuestionsForm, type SecurityAnswerInput } from "@/components/SecurityQuestionsForm";
import { User as UserIcon, Building2, Calendar, Shield, Check, Circle, X, ChevronDown, BookOpen, CheckCircle2, Loader2, Layers, Clock, Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Category } from "@/lib/categories";

function CircleProgress({
  value,
  size = 56,
  stroke = 5,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {pct}%
      </div>
    </div>
  );
}

function parseMinutes(d?: string | null): number {
  if (!d) return 0;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const n = parseFloat(m[1]);
    const u = (m[2] ?? "min").toLowerCase();
    total += u.startsWith("h") ? n * 60 : n;
  }
  return total;
}


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
  component: DashboardPage,
});

function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchQuestions = useServerFn(getMySecurityQuestions);
  const submitUpdate = useServerFn(updateSecurityAnswers);

  const fetchFacilityHome = useServerFn(getMyFacilityCustomHome);

  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const questionsQuery = useQuery({
    queryKey: ["my-security-questions"],
    queryFn: () => fetchQuestions(),
  });

  const facilityHomeQuery = useQuery({
    queryKey: ["my-facility-custom-home"],
    queryFn: () => fetchFacilityHome(),
  });
  const customSlug = facilityHomeQuery.data?.slug ?? null;

  const fetchFacilities = useServerFn(listFacilities);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilities(),
  });
  const facilityNameMap = new Map(
    (facilitiesQuery.data?.facilities ?? []).map((f) => [f.value, f.label]),
  );


  const categoriesQuery = useQuery({
    queryKey: ["dashboard-categories", customSlug],
    enabled: !facilityHomeQuery.isLoading,
    queryFn: async (): Promise<Category[]> => {
      if (customSlug) {
        const { data: page, error: pe } = await supabase
          .from("custom_home_pages")
          .select("id")
          .eq("slug", customSlug)
          .maybeSingle();
        if (pe) throw pe;
        if (!page) return [];
        const { data: links, error: le } = await supabase
          .from("custom_home_page_categories")
          .select("category_id, sort_order")
          .eq("custom_home_page_id", page.id)
          .order("sort_order", { ascending: true });
        if (le) throw le;
        const ids = (links ?? []).map((l) => l.category_id);
        if (ids.length === 0) return [];
        const { data: cats, error: ce } = await supabase
          .from("categories")
          .select("*")
          .eq("published", true)
          .in("id", ids);
        if (ce) throw ce;
        const order = new Map(ids.map((id, i) => [id, i]));
        return ((cats ?? []) as Category[]).sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
        );
      }
      const { data: cats, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .eq("home_page_mode", "default")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (cats ?? []) as Category[];
    },
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
      const [itemsRes, readRes, seenRes] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, category_id, title, title_es, description, description_es, type, duration, sort_order, created_at")
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
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (readRes.error) throw readRes.error;
      type CatItem = { id: string; title: string; title_es: string | null; description: string; description_es: string | null; type: string; duration: string | null; created_at: string | null };
      const itemsByCat = new Map<string, CatItem[]>();
      const totals = new Map<string, number>();
      const recentCats = new Set<string>();
      const newItemSet = new Set<string>();
      const itemDuration = new Map<string, string | null>();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const row of itemsRes.data ?? []) {
        const list = itemsByCat.get(row.category_id as string) ?? [];
        list.push(row as CatItem);
        itemsByCat.set(row.category_id as string, list);
        totals.set(row.category_id as string, (totals.get(row.category_id as string) ?? 0) + 1);
        itemDuration.set(row.id as string, (row as any).duration ?? null);
        if (row.created_at && new Date(row.created_at as string).getTime() >= cutoff) {
          recentCats.add(row.category_id as string);
          newItemSet.add(row.id as string);
        }
      }
      const reads = new Map<string, number>();
      const readSet = new Set<string>();
      const readDays = new Set<string>();
      let minutesSpent = 0;
      for (const row of readRes.data ?? []) {
        reads.set(row.category_id as string, (reads.get(row.category_id as string) ?? 0) + 1);
        readSet.add(row.content_item_id as string);
        minutesSpent += parseMinutes(itemDuration.get(row.content_item_id as string));
        if ((row as any).created_at) {
          const d = new Date((row as any).created_at as string);
          readDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
      return { totals, reads, itemsByCat, readSet, recentCats, newItemSet, minutesSpent, readDays };
    },
  });



  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<SecurityAnswerInput[]>([]);
  const [busy, setBusy] = useState(false);

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
      <SiteHeader />
      <SiteMessageBanner kind="user" />
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
                return (
                  <h1 className="font-display text-3xl font-semibold">
                    {firstName ? t("dashboard.greeting", { name: firstName }) : t("dashboard.greetingNoName")}
                  </h1>
                );
              })()}
              <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
            </div>
            <TabsList className="h-auto p-2 gap-1 self-start sm:self-center bg-muted/40">
              <TabsTrigger
                value="categories"
                disabled={mustSetup}
                onClick={(e) => {
                  if (mustSetup) {
                    e.preventDefault();
                    toast.error(t("dashboard.lockedNav"));
                  }
                }}
                className={`px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground ${mustSetup ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {t("dashboard.tabProgress")}
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="px-4 py-2 data-[state=active]:shadow-none hover:bg-background hover:text-foreground"
              >
                {t("dashboard.tabAccount")}
              </TabsTrigger>
            </TabsList>
          </div>



          <TabsContent value="categories" className="mt-6">
            {categoriesQuery.isLoading || facilityHomeQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.loading")}</p>
            ) : (categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t("home.empty")}</p>
            ) : (
              <>
                {!isAdmin && (() => {
                  let totalAll = 0;
                  let readAll = 0;
                  let activeCats = 0;
                  for (const c of categoriesQuery.data ?? []) {
                    const t2 = progressQuery.data?.totals.get(c.id) ?? 0;
                    const r2 = progressQuery.data?.reads.get(c.id) ?? 0;
                    totalAll += t2;
                    readAll += r2;
                    if (r2 > 0) activeCats += 1;
                  }
                  const pctAll = totalAll > 0 ? Math.round((readAll / totalAll) * 100) : 0;
                  const minutes = progressQuery.data?.minutesSpent ?? 0;
                  const hours = Math.floor(minutes / 60);
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
                  const stats: Array<{ icon: typeof BookOpen; label: string; value: string }> = [
                    { icon: CheckCircle2, label: t("dashboard.statCompleted"), value: readAll.toLocaleString() },
                    { icon: Layers, label: t("dashboard.statCategories"), value: activeCats.toLocaleString() },
                    { icon: Clock, label: t("dashboard.statHours"), value: hours.toLocaleString() },
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

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        {stats.map((s) => {
                          const Icon = s.icon;
                          return (
                            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-[var(--color-accent)] flex-shrink-0">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-display text-2xl font-semibold leading-none tabular-nums">{s.value}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <h2 className="font-display text-lg font-semibold mb-3">{t("dashboard.categoryProgress")}</h2>
                    </>
                  );
                })()}

                <div className="flex flex-col gap-4">
                  {(categoriesQuery.data ?? []).map((c) => {
                    const total = progressQuery.data?.totals.get(c.id) ?? 0;
                    const read = progressQuery.data?.reads.get(c.id) ?? 0;
                    const items = progressQuery.data?.itemsByCat.get(c.id) ?? [];
                    const readSet = progressQuery.data?.readSet ?? new Set<string>();
                    const newItemSet = progressQuery.data?.newItemSet ?? new Set<string>();
                    const hasRecent = items.some((it) => newItemSet.has(it.id) && !readSet.has(it.id));
                    return (
                      <CategoryProgressSection
                        key={c.id}
                        category={c}
                        items={items}
                        readSet={readSet}
                        newItemSet={newItemSet}
                        hasRecent={hasRecent}
                        total={total}
                        read={read}
                        isAdmin={isAdmin}
                        lang={lang}
                        t={t}
                      />
                    );

                  })}
                </div>
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

};

function CategoryProgressSection({
  category,
  items,
  readSet,
  newItemSet,
  hasRecent,
  total,
  read,
  isAdmin,
  lang,
  t,
}: {
  category: Category;
  items: CatItem[];
  readSet: Set<string>;
  newItemSet: Set<string>;
  hasRecent: boolean;
  total: number;
  read: number;
  isAdmin: boolean;
  lang: "en" | "es";
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
  const tagline = pickLang(lang, category.tagline, category.tagline_es);

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={open ? { backgroundColor: "#f7f5ec" } : undefined}
        className={`w-full flex items-center gap-4 p-6 ${open ? "border-b border-border" : ""} text-left hover:bg-muted/40 transition-colors`}
      >
        {!isAdmin ? (
          <CircleProgress value={pct} size={52} stroke={5} />
        ) : category.icon_url ? (
          <img src={category.icon_url} alt="" className="h-12 w-12 object-cover border border-border bg-muted flex-shrink-0 rounded-md" />
        ) : (
          <div className="h-12 w-12 rounded-lg border border-dashed border-border bg-muted/40 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-base sm:text-lg font-semibold truncate">
              {pickLang(lang, category.name, category.name_es)}
            </h2>
            {hasRecent && (
              <Badge variant="new">{t("category.newContentAdded")}</Badge>
            )}
          </div>
          {!isAdmin ? (
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {t("dashboard.itemsCompleted", { done: read.toLocaleString(), total: total.toLocaleString() } as any)}
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
                <li key={it.id} className="flex flex-col gap-[10px] p-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    {newItemSet.has(it.id) && !isRead && (
                      <Badge variant="new">{t("category.newContent")}</Badge>
                    )}

                    <Badge variant="type" type={it.type}>
                      {translateType(lang, it.type)}
                    </Badge>
                    {it.duration && (
                      <span className="text-xs text-muted-foreground">
                        {translateDuration(lang, withActionWord(it.duration, it.type))}
                      </span>
                    )}

                    {!isAdmin && (
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium flex-shrink-0 ml-auto ${
                        isRead
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-background"
                          : "border-input bg-background text-foreground"
                      }`}>
                        {isRead ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            {t("category.markedRead")}
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5" />

                            {t("category.notRead")}
                          </>
                        )}
                      </span>
                    )}

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
