import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, getMyFacilityCustomHome } from "@/lib/user-signup.functions";
import { facilityLabel } from "@/lib/user-signup";
import { getMySecurityQuestions, updateSecurityAnswers } from "@/lib/password-reset.functions";
import { questionLabel } from "@/lib/security-questions";
import { useI18n, pickLang } from "@/lib/i18n";
import { SecurityQuestionsForm, type SecurityAnswerInput } from "@/components/SecurityQuestionsForm";
import { User as UserIcon, Building2, Calendar, Shield, Check, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import type { Category } from "@/lib/categories";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Reentry to Recovery" }] }),
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

  const categoryIds = (categoriesQuery.data ?? []).map((c) => c.id);
  const userId = user?.id ?? null;

  const progressQuery = useQuery({
    queryKey: ["dashboard-progress", userId, categoryIds.join(",")],
    enabled: !!userId && categoryIds.length > 0,
    queryFn: async () => {
      const [itemsRes, readRes] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, category_id, title, title_es, description, description_es, sort_order")
          .eq("published", true)
          .in("category_id", categoryIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("user_content_progress")
          .select("content_item_id, category_id")
          .eq("user_id", userId!)
          .in("category_id", categoryIds),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (readRes.error) throw readRes.error;
      type CatItem = { id: string; title: string; title_es: string | null; description: string; description_es: string | null };
      const itemsByCat = new Map<string, CatItem[]>();
      const totals = new Map<string, number>();
      for (const row of itemsRes.data ?? []) {
        const list = itemsByCat.get(row.category_id as string) ?? [];
        list.push(row as CatItem);
        itemsByCat.set(row.category_id as string, list);
        totals.set(row.category_id as string, (totals.get(row.category_id as string) ?? 0) + 1);
      }
      const reads = new Map<string, number>();
      const readSet = new Set<string>();
      for (const row of readRes.data ?? []) {
        reads.set(row.category_id as string, (reads.get(row.category_id as string) ?? 0) + 1);
        readSet.add(row.content_item_id as string);
      }
      return { totals, reads, itemsByCat, readSet };
    },
  });


  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<SecurityAnswerInput[]>([]);
  const [busy, setBusy] = useState(false);

  const profile = data?.profile;
  const currentKeys = questionsQuery.data?.keys ?? [];
  const mustSetup = !questionsQuery.isLoading && currentKeys.length < 2;
  const isEditing = editing || mustSetup;

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
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold">{t("nav.dashboard")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>

        <Tabs defaultValue="categories" className="mt-8">
          <TabsList>
            <TabsTrigger value="categories">{t("home.categories")}</TabsTrigger>
            <TabsTrigger value="account">{t("nav.dashboard")}</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-6">
            {categoriesQuery.isLoading || facilityHomeQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("home.loading")}</p>
            ) : (categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">{t("home.empty")}</p>
            ) : (
              <Accordion
                type="multiple"
                className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden"
              >
                {(categoriesQuery.data ?? []).map((c) => {
                  const total = progressQuery.data?.totals.get(c.id) ?? 0;
                  const read = progressQuery.data?.reads.get(c.id) ?? 0;
                  const pct = total > 0 ? Math.round((read / total) * 100) : 0;
                  const description = pickLang(lang, c.description, c.description_es);
                  const tagline = pickLang(lang, c.tagline, c.tagline_es);
                  const items = progressQuery.data?.itemsByCat.get(c.id) ?? [];
                  const readSet = progressQuery.data?.readSet ?? new Set<string>();
                  return (
                    <AccordionItem key={c.id} value={c.id} className="border-b-0">
                      <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-muted/40">
                        <div className="flex items-start gap-4 flex-1 text-left">
                          {c.icon_url ? (
                            <img
                              src={c.icon_url}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover bg-muted"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-border bg-muted/40" />
                          )}
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-lg font-semibold text-foreground truncate">
                              {pickLang(lang, c.name, c.name_es)}
                            </h3>
                            {tagline && (
                              <p className="text-xs text-muted-foreground truncate font-normal">{tagline}</p>
                            )}
                            {description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2 font-normal">{description}</p>
                            )}
                            {!isAdmin && (
                              <div className="mt-3 space-y-1">
                                <Progress value={pct} className="h-1.5" />
                                <p className="text-[11px] text-muted-foreground font-normal">
                                  {t("dashboard.progressItems")
                                    .replace("{done}", String(read))
                                    .replace("{total}", String(total))}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-0">
                        {items.length === 0 ? (
                          <p className="text-sm text-muted-foreground pl-16">{t("category.noContent")}</p>
                        ) : (
                          <ul className="ml-16 divide-y divide-border rounded-lg border border-border overflow-hidden bg-background">
                            {items.map((it) => {
                              const isRead = readSet.has(it.id);
                              return (
                                <li key={it.id} className="p-3 flex items-start gap-3">
                                  {isRead ? (
                                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-accent)]" />
                                  ) : (
                                    <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Link
                                        to="/category/$slug"
                                        params={{ slug: c.slug }}
                                        hash={`item-${it.id}`}
                                        className="font-medium text-sm text-foreground hover:underline"
                                      >
                                        {pickLang(lang, it.title, it.title_es)}
                                      </Link>
                                      <span className={`text-[10px] uppercase tracking-wide font-medium ${isRead ? "text-[var(--color-accent)]" : "text-muted-foreground"}`}>
                                        {isRead ? t("category.markedRead") : t("category.markAsRead")}
                                      </span>
                                    </div>
                                    {pickLang(lang, it.description, it.description_es) && (
                                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                        {pickLang(lang, it.description, it.description_es)}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
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
                    <dd className="mt-1 font-medium">{facilityLabel(profile.facility)}</dd>
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" /> {t("security.heading")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("security.intro")}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:border-[var(--color-accent)] transition-colors"
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
                    <button
                      onClick={handleSave}
                      disabled={busy}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {busy ? "…" : t("security.save")}
                    </button>
                    {!mustSetup && (
                      <button
                        onClick={() => { setEditing(false); setPending([]); }}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)] transition-colors"
                      >
                        {t("security.cancel")}
                      </button>
                    )}
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
