import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";

const PdfViewer = lazy(() => import("@/components/PdfViewer"));
import { trackCategoryView, trackContentClick } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { Category, ContentItem } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang, translateType, translateDuration } from "@/lib/i18n";
import { withActionWord } from "@/lib/duration";
import { ArrowLeft, ExternalLink, Download, ArrowUpRight, PlayCircle, Headphones, FileText, Image as ImageIcon, Pencil, Circle } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/Badge";
import { ReadStatusBadge } from "@/components/ReadStatusBadge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import AutoHeight from "embla-carousel-auto-height";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { listFacilities } from "@/lib/facilities.functions";
import { useContentEngagement, type EngagementRecord } from "@/hooks/use-content-engagement";

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|oga|opus)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|heic|heif)(\?|#|$)/i;
function FacilityBadge({ facilities, facilityLabelMap, className }: {
  facilities: string[];
  facilityLabelMap: Record<string, string>;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="cursor-default inline-flex p-0 m-0 h-auto w-auto border-none bg-transparent shadow-none leading-none"
        >
          <Badge variant="facility" className={className}>
            {facilities.length === 1
              ? (facilityLabelMap[facilities[0]] ?? facilities[0])
              : `${facilities.length} facilities`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {facilities.map((v) => facilityLabelMap[v] ?? v).join("; ")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function isVideoUrl(url: string | null | undefined) {
  return !!url && VIDEO_EXT.test(url);
}
function isAudioUrl(url: string | null | undefined) {
  return !!url && AUDIO_EXT.test(url);
}
function isPdfUrl(url: string | null | undefined) {
  return !!url && PDF_EXT.test(url);
}
function isImageUrl(url: string | null | undefined) {
  return !!url && IMAGE_EXT.test(url);
}
type MediaKind = "video" | "audio" | "pdf" | "image";
function detectMedia(url: string | null | undefined): MediaKind | null {
  if (isVideoUrl(url)) return "video";
  if (isAudioUrl(url)) return "audio";
  if (isPdfUrl(url)) return "pdf";
  if (isImageUrl(url)) return "image";
  return null;
}


export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { isAdmin, canAccessAdmin, isFacilityUser, user } = useAuth();
  const queryClient = useQueryClient();
  const fetchFacilityValue = useServerFn(getMyFacilityValue);
  const fetchFacilitiesList = useServerFn(listFacilities);
  const { data: facilitiesData } = useQuery({
    queryKey: ["facilities"],
    queryFn: () => fetchFacilitiesList(),
    enabled: isAdmin,
  });
  const facilityLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of facilitiesData?.facilities ?? []) map[f.value] = f.label;
    return map;
  }, [facilitiesData]);
  type PlayerPayload = { url: string; title: string; itemId: string };
  const [videoPlayer, setVideoPlayer] = useState<PlayerPayload | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<PlayerPayload | null>(null);
  const [pdfViewer, setPdfViewer] = useState<PlayerPayload | null>(null);
  const [imageViewer, setImageViewer] = useState<PlayerPayload | null>(null);

  // Callback refs (useState) so the engagement hook re-runs its effect when
  // the element actually mounts inside the Radix Dialog Portal — useRef alone
  // would give null because the Portal renders asynchronously.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [othersApi, setOthersApi] = useState<CarouselApi>();
  const [othersCurrent, setOthersCurrent] = useState(0);
  const [othersCount, setOthersCount] = useState(0);

  useEffect(() => {
    if (!othersApi) return;
    setOthersCount(othersApi.scrollSnapList().length);
    setOthersCurrent(othersApi.selectedScrollSnap());
    const onSelect = () => setOthersCurrent(othersApi.selectedScrollSnap());
    othersApi.on("select", onSelect);
    othersApi.on("reInit", () => {
      setOthersCount(othersApi.scrollSnapList().length);
      setOthersCurrent(othersApi.selectedScrollSnap());
    });
    return () => { othersApi.off("select", onSelect); };
  }, [othersApi]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data: cat, error: e1 } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (e1) throw e1;
      if (!cat) throw notFound();
      const { data: items, error: e2 } = await supabase
        .from("content_items")
        .select("*")
        .eq("category_id", cat.id)
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      const { data: others, error: e3 } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .neq("id", cat.id)
        .order("sort_order", { ascending: true });
      if (e3) throw e3;

      const filtered = (others ?? []) as typeof others;
      const shuffled = [...filtered].sort(() => Math.random() - 0.5);

      // Fetch facility restrictions for all items
      const itemIds = (items ?? []).map((i) => i.id as string);
      const facilityMap: Record<string, string[]> = {};
      let facilityFetchFailed = false;
      if (itemIds.length > 0) {
        const { data: facilityLinks, error: facilityLinksError } = await (supabase as any)
          .from("content_item_facilities")
          .select("content_item_id, facility_value")
          .in("content_item_id", itemIds);
        if (facilityLinksError) {
          console.error("[category] facility restrictions fetch failed:", facilityLinksError.message);
          facilityFetchFailed = true;
        } else {
          for (const link of (facilityLinks ?? []) as Array<{ content_item_id: string; facility_value: string }>) {
            if (!facilityMap[link.content_item_id]) facilityMap[link.content_item_id] = [];
            facilityMap[link.content_item_id].push(link.facility_value);
          }
        }
      }
      const itemsWithFacilities = (items ?? []).map((item) => ({
        ...item,
        // null = fetch failed; visibleItems treats null as "restricted, hide from non-admins"
        facilities: facilityFetchFailed ? null : (facilityMap[item.id as string] ?? []),
      })) as ContentItem[];

      return {
        category: cat as Category,
        items: itemsWithFacilities,
        others: shuffled as Category[],
      };
    },
  });

  const trackedViewRef = useRef<string | null>(null);
  useEffect(() => {
    const id = data?.category.id;
    if (!id || trackedViewRef.current === id || canAccessAdmin || isFacilityUser) return;
    trackedViewRef.current = id;
    trackCategoryView(id);
  }, [data?.category.id, canAccessAdmin, isFacilityUser]);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  useEffect(() => {
    if (!data?.items?.length) return;
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#item-")) return;
    const id = hash.slice(1);
    const itemId = id.replace(/^item-/, "");
    // Wait a tick for layout
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedId(itemId);
      window.setTimeout(() => setHighlightedId(null), 2500);
    }, 100);
    return () => window.clearTimeout(t);
  }, [data?.items]);


  const categoryId = data?.category.id;
  const progressQuery = useQuery({
    queryKey: ["content-progress", user?.id, categoryId],
    enabled: !!user?.id && !!categoryId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("user_content_progress")
        .select("content_item_id")
        .eq("user_id", user!.id)
        .eq("category_id", categoryId!);
      if (error) throw error;
      return new Set((rows ?? []).map((r) => r.content_item_id as string));
    },
  });
  const readSet = progressQuery.data ?? new Set<string>();

  const seenQuery = useQuery({
    queryKey: ["content-seen", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("user_content_seen")
        .select("content_item_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((rows ?? []).map((r) => r.content_item_id as string));
    },
  });
  const seenSet = seenQuery.data ?? new Set<string>();

  const facilityQuery = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: () => fetchFacilityValue(),
  });

  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (isAdmin) return data.items;
    if (facilityQuery.isLoading && !!user?.id) {
      return data.items.filter((item) => item.facilities !== null && (item.facilities?.length ?? 0) === 0);
    }
    const facility = facilityQuery.data?.facility ?? null;
    return data.items.filter((item) => {
      if (item.facilities === null) return false; // unknown restrictions — hide for safety
      const f = item.facilities ?? [];
      if (f.length === 0) return true;
      if (!facility) return false;
      return f.includes(facility);
    });
  }, [data, isAdmin, user?.id, facilityQuery.isLoading, facilityQuery.data]);

  const toggleRead = useMutation({
    mutationFn: async (vars: { itemId: string; markRead: boolean }) => {
      if (!user?.id || !categoryId) throw new Error("Not signed in");
      if (vars.markRead) {
        const { error } = await supabase
          .from("user_content_progress")
          .insert({ user_id: user.id, content_item_id: vars.itemId, category_id: categoryId });
        if (error && (error as any).code !== "23505") throw error;
        // Record a persistent "seen" entry so the New badge never reappears
        await supabase
          .from("user_content_seen")
          .insert({ user_id: user.id, content_item_id: vars.itemId });
      } else {
        const { error } = await supabase
          .from("user_content_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("content_item_id", vars.itemId);
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      const key = ["content-progress", user?.id, categoryId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<Set<string>>(key);
      const next = new Set(prev ?? []);
      if (vars.markRead) next.add(vars.itemId);
      else next.delete(vars.itemId);
      queryClient.setQueryData(key, next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["content-progress", user?.id, categoryId], ctx.prev);
      toast.error(t("category.markReadError"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["content-progress", user?.id, categoryId] });
      queryClient.invalidateQueries({ queryKey: ["content-seen", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-progress", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["home-user-progress", user?.id] });
    },
  });

  // Load engagement data for all items in this category (resume positions + progress %)
  const engagementQuery = useQuery({
    queryKey: ["engagement", user?.id, categoryId],
    enabled: !!user?.id && !!categoryId && !isAdmin && !isFacilityUser,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_content_engagement")
        .select("content_item_id, session_seconds, media_progress_seconds, media_duration_seconds")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<string, EngagementRecord>();
      for (const r of (data ?? []) as any[]) {
        map.set(r.content_item_id as string, {
          session_seconds: r.session_seconds as number,
          media_progress_seconds: r.media_progress_seconds as number | null,
          media_duration_seconds: r.media_duration_seconds as number | null,
        });
      }
      return map;
    },
  });
  const engagementMap = engagementQuery.data ?? new Map<string, EngagementRecord>();

  // Derive which item is currently open and its media kind
  const activeItemId =
    videoPlayer?.itemId ?? audioPlayer?.itemId ?? pdfViewer?.itemId ?? imageViewer?.itemId ?? null;

  const invalidateEngagement = () => {
    queryClient.invalidateQueries({ queryKey: ["engagement", user?.id, categoryId] });
    // Also mark the dashboard progress query stale so hours-spent refreshes
    // the next time the user visits the dashboard.
    queryClient.invalidateQueries({ queryKey: ["dashboard-progress"] });
  };

  // Engagement tracking hook: timer (all types) + media progress (video/audio)
  useContentEngagement({
    contentItemId: activeItemId,
    categoryId: categoryId ?? null,
    userId: user?.id ?? null,
    isActive: !!activeItemId && !isAdmin && !isFacilityUser,
    existing: activeItemId ? (engagementMap.get(activeItemId) ?? null) : null,
    videoEl,
    audioEl,
    onAutoMarkRead: activeItemId
      ? () => toggleRead.mutate({ itemId: activeItemId, markRead: true })
      : undefined,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {isLoading && (
        <div className="flex-1 mx-auto max-w-5xl px-6 py-24 text-muted-foreground">{t("home.loading")}</div>
      )}

      {error && !isLoading && (
        <div className="flex-1 mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-4xl font-semibold">{t("category.notFound")}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-[var(--color-accent)] font-medium">
            <ArrowLeft className="h-4 w-4" /> {t("category.backToAll")}
          </Link>
        </div>
      )}

      {data && (
        <>
          <section className="border-b border-border/60 bg-background">
            <div className="mx-auto max-w-5xl px-6 py-20">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                <CategoryIcon
                  name={data.category.icon_name}
                  color={data.category.icon_color}
                  size="lg"
                  className="h-24 w-24 sm:h-32 sm:w-32 lg:h-40 lg:w-40 rounded-2xl"
                  iconClassName="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20"
                />
                <div className="max-w-3xl flex-1">
                  <p className="text-sm font-medium text-[var(--color-accent)]">{pickLang(lang, data.category.tagline, data.category.tagline_es)}</p>
                  <h1 className="mt-2 font-display font-bold tracking-tight text-4xl">{pickLang(lang, data.category.name, data.category.name_es)}</h1>
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{pickLang(lang, data.category.description, data.category.description_es)}</p>
                  {user && !isAdmin && !isFacilityUser && visibleItems.length > 0 && (
                    <div className="mt-6 max-w-md space-y-1.5">
                      <Progress
                        value={Math.round((visibleItems.filter((it) => readSet.has(it.id)).length / visibleItems.length) * 100)}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.progressItems")
                          .replace("{done}", String(visibleItems.filter((it) => readSet.has(it.id)).length))
                          .replace("{total}", String(visibleItems.length))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <main className="flex-1">
            <section className="mx-auto max-w-5xl px-6 py-20">
              {(() => {
                const itemsWithKind = visibleItems.map((item) => {
                  const filterKey = (item.type ?? "other").trim().toLowerCase() || "other";
                  return { item, filterKey };
                });
                const availableKinds = Array.from(new Set(itemsWithKind.map((i) => i.filterKey)));
                const filteredItems = typeFilter === "all"
                  ? visibleItems
                  : itemsWithKind.filter((i) => i.filterKey === typeFilter).map((i) => i.item);
                const orderedKinds = availableKinds.sort((a, b) => a.localeCompare(b));
                const showFilter = orderedKinds.length > 1;
                return (
                  <>
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <h2 className="font-display text-xl font-semibold">
                        {filteredItems.length} {filteredItems.length === 1 ? t("category.resource") : t("category.resources")}
                      </h2>
                      {showFilter && (
                        <div className="sm:ml-auto">
                          <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full sm:w-[180px] shadow-none capitalize">
                              <SelectValue placeholder="Filter by type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All types</SelectItem>
                              {orderedKinds.map((k) => (
                                <SelectItem key={k} value={k} className="capitalize">{translateType(lang, k)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
              {filteredItems.length === 0 ? (
                <p className="text-muted-foreground">{t("category.noContent")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                  {filteredItems.map((item) => {
                    const title = pickLang(lang, item.title, item.title_es);
                    const description = pickLang(lang, item.description, item.description_es);
                    const source = pickLang(lang, item.source, item.source_es);
                    const fileUrl = lang === "es" && item.file_url_es ? item.file_url_es : item.file_url;
                    const fileName = lang === "es" && item.file_url_es ? (item.file_name_es ?? item.file_name) : item.file_name;
                    const fileMedia = detectMedia(fileUrl);
                    const urlMedia = detectMedia(item.url);
                    const mediaKind: MediaKind | null = fileMedia ?? urlMedia;
                    const mediaSrc = fileMedia ? fileUrl : urlMedia ? item.url : null;
                    const isMedia = !!mediaKind && !!mediaSrc;

                    const openMedia = () => {
                      if (!isMedia) return;
                      const payload = { url: mediaSrc!, title, itemId: item.id };
                      if (mediaKind === "video") setVideoPlayer(payload);
                      else if (mediaKind === "audio") setAudioPlayer(payload);
                      else if (mediaKind === "pdf") setPdfViewer(payload);
                      else if (mediaKind === "image") setImageViewer(payload);
                    };

                    const handleActivate = () => {
                      if (!canAccessAdmin && !isFacilityUser) trackContentClick(item.id, data.category.id);
                      // Mark as seen so the "New" badge is suppressed on any engagement
                      if (user?.id && !readSet.has(item.id) && !seenSet.has(item.id)) {
                        Promise.resolve(
                          supabase.from("user_content_seen")
                            .insert({ user_id: user.id, content_item_id: item.id })
                        ).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["content-seen", user.id] });
                        }).catch(() => {});
                      }
                    };

                    let Wrapper: any = "div";
                    let wrapperProps: any = {};
                    if (isMedia) {
                      Wrapper = "button";
                      wrapperProps = { type: "button", onClick: () => { handleActivate(); openMedia(); } };
                    } else if (item.url) {
                      Wrapper = "a";
                      wrapperProps = { href: item.url, target: "_blank", rel: "noopener noreferrer", onClick: handleActivate };
                    }

                    const MediaIcon =
                      mediaKind === "video"
                        ? PlayCircle
                        : mediaKind === "audio"
                          ? Headphones
                          : mediaKind === "pdf"
                            ? FileText
                            : mediaKind === "image"
                              ? ImageIcon
                              : null;

                    const isNew = !!item.created_at && (Date.now() - new Date(item.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000 && !readSet.has(item.id) && !seenSet.has(item.id) && !engagementMap.has(item.id);

                    return (
                      <li key={item.id} id={`item-${item.id}`} className="relative scroll-mt-24">
                        {highlightedId === item.id && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[var(--color-accent)]/15 opacity-0 animate-highlight-pulse"
                          />
                        )}




                        <Wrapper
                          {...wrapperProps}
                          className="w-full text-left flex flex-col gap-4 p-6 pb-[20px] hover:bg-[var(--color-secondary)]/60 transition-colors cursor-pointer"
                        >
                          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
                            <BadgeGroup>
                              {isNew && (
                                <Badge variant="new">{t("category.newContent")}</Badge>
                              )}
                              <Badge variant="type" type={item.type}>
                                {translateType(lang, item.type)}
                              </Badge>
                              {isAdmin && (item.facilities?.length ?? 0) > 0 && (
                                <FacilityBadge
                                  facilities={item.facilities!}
                                  facilityLabelMap={facilityLabelMap}
                                />
                              )}
                            </BadgeGroup>
                            {item.duration && (
                              <span className="text-xs text-muted-foreground">
                                {translateDuration(lang, withActionWord(item.duration, item.type))}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                                {title}
                              </h3>
                              {MediaIcon ? (
                                <MediaIcon className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                              ) : item.url ? (
                                <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                              ) : null}
                            </div>
                            {description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{description}</p>}
                            {fileUrl && !isMedia && (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => { e.stopPropagation(); handleActivate(); }}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {fileName || t("category.downloadFile")}
                              </a>
                            )}
                            {source && <p className="mt-2 text-xs text-muted-foreground/80">{t("category.source")} · {source}</p>}
                          </div>
                        </Wrapper>
                        {(isAdmin || isNew) && (
                          <div className="absolute top-3 right-3 mt-[7px] mr-[7px] flex items-center gap-1.5 flex-wrap justify-end z-10">
                            {isAdmin && isNew && (
                              <Badge variant="new" className="hidden">{t("category.newContent")}</Badge>
                            )}

                            {isAdmin && (
                              <Link
                                to="/admin/category/$id"
                                params={{ id: data.category.id }}
                                search={{ edit: item.id }}
                                title="Edit content"
                                aria-label="Edit content"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 hover:bg-muted"
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            )}
                          </div>
                        )}
                        {user && !isAdmin && !isFacilityUser && (() => {
                          const isRead = readSet.has(item.id);
                          let readLabel = t("category.markedRead");
                          let unreadLabel = t("category.notRead");
                          if (mediaKind === "video") {
                            readLabel = t("category.markedWatched");
                            unreadLabel = t("category.notWatched");
                          } else if (mediaKind === "audio") {
                            readLabel = t("category.markedListened");
                            unreadLabel = t("category.notListened");
                          } else if (mediaKind === "image") {
                            readLabel = t("category.markedViewed");
                            unreadLabel = t("category.notViewed");
                          } else if (!mediaKind && item.url) {
                            readLabel = t("category.markedClicked");
                            unreadLabel = t("category.notClicked");
                          }
                          return (
                            <div className="absolute top-6 right-6 flex items-center gap-1.5 justify-end z-10">
                              {(() => {
                                const eng = engagementMap.get(item.id);
                                const mediaPct = !isRead && eng && (mediaKind === "video" || mediaKind === "audio") && eng.media_progress_seconds && eng.media_duration_seconds && eng.media_duration_seconds > 0
                                  ? Math.min(100, Math.round((eng.media_progress_seconds / eng.media_duration_seconds) * 100))
                                  : null;

                                if (mediaPct !== null && mediaPct >= 5) {
                                  // Progress-filled button: accent fill grows left-to-right as content is consumed
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleRead.mutate({ itemId: item.id, markRead: !isRead });
                                      }}
                                      className="relative inline-flex items-center leading-none gap-1.5 rounded-[4px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium cursor-pointer overflow-hidden transition-colors hover:bg-muted"
                                    >
                                      {/* Progress fill — grows left-to-right proportional to % watched */}
                                      <span
                                        className="absolute inset-y-0 left-0 pointer-events-none"
                                        style={{
                                          width: `${mediaPct}%`,
                                          background: `color-mix(in oklab, var(--color-accent) 22%, transparent)`,
                                        }}
                                      />
                                      <Circle className="h-3.5 w-3.5 flex-shrink-0 relative text-foreground" />
                                      <span className="relative text-foreground">
                                        {mediaPct}%{" "}
                                        {mediaKind === "video"
                                          ? t("category.markedWatched").toLowerCase()
                                          : t("category.markedListened").toLowerCase()}
                                      </span>
                                    </button>
                                  );
                                }

                                return (
                                  <ReadStatusBadge
                                    read={isRead}
                                    readLabel={readLabel}
                                    unreadLabel={unreadLabel}
                                    unreadIcon="circle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      toggleRead.mutate({ itemId: item.id, markRead: !isRead });
                                    }}
                                  />
                                );
                              })()}
                            </div>
                          );
                        })()}

                      </li>
                    );
                  })}
                </ul>
              )}
                  </>
                );
              })()}
            </section>

            {data.others.length > 0 && (
              <section className="mx-auto max-w-5xl px-6 pb-20">
                <div className="border-t border-border/60 pt-20">
                  <h2 className="font-display text-xl font-semibold mb-6">{t("category.exploreOthers")}</h2>
                  <Carousel setApi={setOthersApi} opts={{ align: "start", loop: false }} plugins={[AutoHeight()]} className="relative">
                    <CarouselContent className="items-start transition-[height] duration-300 ease-out">
                      {Array.from({ length: Math.ceil(data.others.length / 9) }).map((_, slideIdx) => {
                        const slide = data.others.slice(slideIdx * 9, slideIdx * 9 + 9);
                        return (
                          <CarouselItem key={slideIdx}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {slide.map((other) => (
                                <Link
                                  key={other.id}
                                  to="/category/$slug"
                                  params={{ slug: other.slug }}
                                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card)]"
                                >
                                  <CategoryIcon
                                    name={other.icon_name}
                                    color={other.icon_color}
                                    className="h-14 w-14 rounded-xl"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-display text-base font-semibold text-foreground leading-tight truncate">
                                      {pickLang(lang, other.name, other.name_es)}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{pickLang(lang, other.tagline, other.tagline_es)}</p>
                                  </div>
                                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)] flex-shrink-0" />
                                </Link>
                              ))}
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>
                    {othersCount > 1 && (
                      <div className="mt-6 flex items-center justify-center gap-4">
                        <CarouselPrevious className="static translate-y-0" />
                        <div className="flex items-center gap-2">
                          {Array.from({ length: othersCount }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              aria-label={`Go to slide ${i + 1}`}
                              onClick={() => othersApi?.scrollTo(i)}
                              className={`h-2 rounded-full transition-all ${i === othersCurrent ? "w-6 bg-[var(--color-accent)]" : "w-2 bg-border hover:bg-muted-foreground/50"}`}
                            />
                          ))}
                        </div>
                        <CarouselNext className="static translate-y-0" />
                      </div>
                    )}
                  </Carousel>
                </div>
              </section>
            )}
          </main>
        </>
      )}

      <SiteFooter />

      <Dialog open={!!videoPlayer} onOpenChange={(open) => { if (!open) { setVideoPlayer(null); setVideoEl(null); invalidateEngagement(); } }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0 max-h-[calc(100dvh-2rem)]">
          <DialogTitle className="sr-only">{videoPlayer?.title ?? "Video"}</DialogTitle>
          {videoPlayer && (
            <video
              ref={setVideoEl}
              key={videoPlayer.url}
              src={videoPlayer.url}
              controls
              autoPlay
              className="w-full h-auto max-h-[calc(100dvh-2rem)] bg-black"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!audioPlayer} onOpenChange={(open) => { if (!open) { setAudioPlayer(null); setAudioEl(null); invalidateEngagement(); } }}>
        <DialogContent className="max-w-lg pt-[18px] max-h-[calc(100dvh-2rem)] overflow-auto">
          <DialogTitle className="text-base font-semibold pr-8 break-words">{audioPlayer?.title ?? "Audio"}</DialogTitle>
          {audioPlayer && (
            <audio
              ref={setAudioEl}
              key={audioPlayer.url}
              src={audioPlayer.url}
              controls
              autoPlay
              className="w-full mt-[-5px]"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdfViewer} onOpenChange={(open) => { if (!open) { setPdfViewer(null); invalidateEngagement(); } }}>
        <DialogContent className="w-[95vw] min-w-0 max-w-[95vw] sm:max-w-[95vw] p-0 overflow-hidden max-h-[calc(100dvh-2rem)]">
          <DialogTitle className="sr-only">{pdfViewer?.title ?? "PDF"}</DialogTitle>
          {pdfViewer && (
            <Suspense fallback={<div className="p-8 text-sm text-muted-foreground h-[calc(100dvh-4rem)]">Loading PDF…</div>}>
              <PdfViewer key={pdfViewer.url} url={pdfViewer.url} />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageViewer} onOpenChange={(open) => { if (!open) { setImageViewer(null); invalidateEngagement(); } }}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden bg-black border-0 max-h-[calc(100dvh-2rem)]">
          <DialogTitle className="sr-only">{imageViewer?.title ?? "Image"}</DialogTitle>
          {imageViewer && (
            <img
              key={imageViewer.url}
              src={imageViewer.url}
              alt={imageViewer.title}
              className="w-full h-auto max-h-[calc(100dvh-2rem)] object-contain bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
