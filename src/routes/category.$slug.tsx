import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";

// Lazy-load PdfViewer so pdfjs-dist (large) is only bundled for users who
// actually open a PDF — it's not needed on the initial category page load.
const PdfViewer = lazy(() => import("@/components/PdfViewer"));
import { trackCategoryView, trackContentClick } from "@/lib/analytics";
import { weightedCompletionPct } from "@/lib/content-progress";
import { detectMedia, type MediaKind } from "@/lib/read-status";
import { supabase } from "@/integrations/supabase/client";
import type { Category, ContentItem } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang, translateType, translateDuration } from "@/lib/i18n";
import { useBadgeStyles } from "@/hooks/use-badge-styles";
import { withActionWord, parseMinutes } from "@/lib/duration";
import { fmtDateShort } from "@/lib/date-format";
import { ArrowLeft, ExternalLink, Download, ArrowUpRight, PlayCircle, Headphones, FileText, Image as ImageIcon, Circle, CheckCircle2, Bookmark, ThumbsUp, ThumbsDown, Info } from "lucide-react";
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
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useRatings } from "@/hooks/use-ratings";
import { useAchievements } from "@/hooks/use-achievements";

const PDF_EXT = /\.pdf(\?|#|$)/i;
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


function IdlePrompt({ countdown, onStillHere }: { countdown: number; onStillHere: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-prompt-title"
      aria-describedby="idle-prompt-desc"
      className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 flex flex-col gap-4">
        <div>
          <p id="idle-prompt-title" className="font-display text-base font-semibold text-foreground">Are you still here?</p>
          <p id="idle-prompt-desc" className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Your session will stop tracking in <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>. Tap or scroll any time to keep the timer running automatically without this prompt appearing.
          </p>
        </div>
        <button
          type="button"
          autoFocus
          onClick={onStillHere}
          className="inline-flex items-center justify-center rounded-[8px] border px-4 py-2 text-sm font-medium transition-colors"
          style={{
            color: "var(--color-accent)",
            backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
            borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in oklab, var(--color-accent) 20%, transparent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "color-mix(in oklab, var(--color-accent) 12%, transparent)"; }}
        >
          Yes, I'm still here
        </button>
      </div>
    </div>
  );
}


function CategoryError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-sm text-center">
          <p className="font-semibold text-foreground">This page didn't load</p>
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
  );
}

export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
  errorComponent: CategoryError,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { isAdmin, canAccessAdmin, isFacilityUser, isTester, user } = useAuth();
  const badgeStyles = useBadgeStyles();
  const { bookmarkIds, toggle: toggleBookmark } = useBookmarks();
  const { myRatings, rate } = useRatings();
  const { check: checkAchievements } = useAchievements();
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
  type ActiveMedia = { type: "video" | "audio" | "pdf" | "image"; url: string; title: string; itemId: string } | null;
  const [activeMedia, setActiveMedia] = useState<ActiveMedia>(null);
  const videoPlayer  = activeMedia?.type === "video"  ? activeMedia : null;
  const audioPlayer  = activeMedia?.type === "audio"  ? activeMedia : null;
  const pdfViewer    = activeMedia?.type === "pdf"    ? activeMedia : null;
  const imageViewer  = activeMedia?.type === "image"  ? activeMedia : null;

  // Callback refs (useState) so the engagement hook re-runs its effect when
  // the element actually mounts inside the Radix Dialog Portal — useRef alone
  // would give null because the Portal renders asynchronously.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  // Track PDF item IDs opened this session so we only show the progress
  // button after the user has actually opened the viewer at least once.
  const openedPdfsRef = useRef(new Set<string>());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryComplete, setCategoryComplete] = useState(false);
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
        .select("id, slug, name, tagline, description, icon_url, icon_name, icon_color, sort_order, published, home_page_mode, name_es, tagline_es, description_es")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (e1) throw e1;
      if (!cat) throw notFound();
      const { data: items, error: e2 } = await supabase
        .from("content_items")
        .select("id, category_id, title, title_es, type, source, source_es, duration, description, description_es, url, file_url, file_url_es, file_name, file_name_es, sort_order, published, exempt_from_progress")
        .eq("category_id", cat.id)
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      const { data: others, error: e3 } = await supabase
        .from("categories")
        .select("id, slug, name, tagline, description, icon_url, icon_name, icon_color, sort_order, published, home_page_mode, name_es, tagline_es, description_es")
        .eq("published", true)
        .neq("id", cat.id)
        .order("sort_order", { ascending: true });
      if (e3) throw e3;

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
        others: (others ?? []) as Category[],
      };
    },
  });

  const trackedViewRef = useRef<string | null>(null);
  // Shuffle once per fetch result so the carousel is stable across re-renders
  // and background refetches don't reorder items mid-view.
  const shuffledOthers = useMemo(
    () => [...(data?.others ?? [])].sort(() => Math.random() - 0.5),
    [data?.others],
  );

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
        .select("content_item_id, created_at")
        .eq("user_id", user!.id)
        .eq("category_id", categoryId!);
      if (error) throw error;
      const readSet = new Set((rows ?? []).map((r) => r.content_item_id as string));
      const readAtMap = new Map<string, string>();
      for (const r of rows ?? []) {
        readAtMap.set(r.content_item_id as string, r.created_at as string);
      }
      return { readSet, readAtMap };
    },
  });
  const readSet = progressQuery.data?.readSet ?? new Set<string>();
  const readAtMap = progressQuery.data?.readAtMap ?? new Map<string, string>();

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
      const prev = queryClient.getQueryData<{ readSet: Set<string>; readAtMap: Map<string, string> }>(key);
      const nextReadSet = new Set(prev?.readSet ?? []);
      const nextReadAtMap = new Map(prev?.readAtMap ?? []);
      if (vars.markRead) {
        nextReadSet.add(vars.itemId);
        nextReadAtMap.set(vars.itemId, new Date().toISOString());
        // Check if this item just completed the entire category
        const trackable = visibleItems.filter((i) => !(i as any).exempt_from_progress);
        if (trackable.length > 0 && trackable.every((i) => nextReadSet.has(i.id))) {
          setTimeout(() => setCategoryComplete(true), 600);
        }
      } else {
        nextReadSet.delete(vars.itemId);
        nextReadAtMap.delete(vars.itemId);
      }
      queryClient.setQueryData(key, { readSet: nextReadSet, readAtMap: nextReadAtMap });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["content-progress", user?.id, categoryId], ctx.prev);
      toast.error(t("category.markReadError"));
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["content-progress", user?.id, categoryId] });
      queryClient.invalidateQueries({ queryKey: ["content-seen", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-progress", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["home-user-progress", user?.id] });
      if (vars.markRead) checkAchievements();
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
        .select("content_item_id, session_seconds, media_progress_seconds, media_duration_seconds, manual_completion_pct")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<string, EngagementRecord>();
      for (const r of (data ?? []) as any[]) {
        map.set(r.content_item_id as string, {
          session_seconds: r.session_seconds as number,
          media_progress_seconds: r.media_progress_seconds as number | null,
          media_duration_seconds: r.media_duration_seconds as number | null,
          manual_completion_pct: r.manual_completion_pct as number | null,
        });
      }
      return map;
    },
  });
  const engagementMap = engagementQuery.data ?? new Map<string, EngagementRecord>();

  // Derive which item is currently open and its media kind
  const activeItemId = activeMedia?.itemId ?? null;

  const invalidateEngagement = () => {
    // Delay slightly so the hook's write() cleanup has time to land in the DB
    // before the refetch reads it back — without this, the refetch races the
    // write and returns stale data, making progress not appear until refresh.
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["engagement", user?.id, categoryId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-progress"] });
    }, 600);
  };

  // For PDF items: derive estimated reading time in seconds from the duration field
  const activeItem = activeItemId ? data?.items.find((it) => it.id === activeItemId) : null;
  const activePdfEstimatedSeconds = (() => {
    if (!activeItem) return undefined;
    // Uploaded files are saved to `url` (file_url is always null in the DB)
    const pdfUrl = activeItem.file_url || activeItem.url;
    if (!pdfUrl || !PDF_EXT.test(pdfUrl)) return undefined;
    const mins = parseMinutes(activeItem.duration);
    return mins > 0 ? mins * 60 : undefined;
  })();

  // Debug idle counter — only runs for tester accounts
  const [debugIdleSecs, setDebugIdleSecs] = useState(0);
  const debugLastActivityRef = useRef(Date.now());
  useEffect(() => {
    if (!isTester) return;
    const reset = () => { debugLastActivityRef.current = Date.now(); setDebugIdleSecs(0); };
    const events = ["touchstart", "touchmove", "click", "keydown", "scroll", "mousemove"];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    const t = setInterval(() => {
      setDebugIdleSecs(Math.floor((Date.now() - debugLastActivityRef.current) / 1000));
    }, 500);
    return () => { clearInterval(t); events.forEach((e) => document.removeEventListener(e, reset)); };
  }, [isTester]);

  // Progressive idle thresholds: 90s → 3min → 5min cap
  const IDLE_THRESHOLDS_MS = [90_000, 180_000, 300_000];
  const [idleConfirmCount, setIdleConfirmCount] = useState(0);
  const currentIdleMs = IDLE_THRESHOLDS_MS[Math.min(idleConfirmCount, IDLE_THRESHOLDS_MS.length - 1)];

  // "Are you still here?" idle prompt state
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(20);
  const idleCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearIdleCountdown = () => {
    if (idleCountdownRef.current) {
      clearInterval(idleCountdownRef.current);
      idleCountdownRef.current = null;
    }
  };

  // Engagement tracking hook: timer (all types) + media progress (video/audio) + PDF auto-mark
  const isMediaItem = !!(videoEl || audioEl || activeMedia?.type === "video" || activeMedia?.type === "audio");
  const { resetIdle, _debug: engDebug } = useContentEngagement({
    idleMs: currentIdleMs,
    contentItemId: activeItemId,
    categoryId: categoryId ?? null,
    userId: user?.id ?? null,
    isActive: !!activeItemId && !isAdmin && !isFacilityUser,
    existing: activeItemId ? (engagementMap.get(activeItemId) ?? null) : null,
    videoEl,
    audioEl,
    pdfEstimatedSeconds: activePdfEstimatedSeconds,
    onAutoMarkRead: activeItemId
      ? () => toggleRead.mutate({ itemId: activeItemId, markRead: true })
      : undefined,
    // Only show idle prompt for static content — video/audio use position tracking
    onIdle: isMediaItem ? undefined : () => {
      setIdleCountdown(20);
      setShowIdlePrompt(true);
      clearIdleCountdown();
      idleCountdownRef.current = setInterval(() => {
        setIdleCountdown((n) => {
          if (n <= 1) {
            clearIdleCountdown();
            setShowIdlePrompt(false);
            return 0;
          }
          return n - 1;
        });
      }, 1000);
    },
  });

  // Clean up countdown on unmount or when item closes
  useEffect(() => {
    if (!activeItemId) {
      clearIdleCountdown();
      setShowIdlePrompt(false);
      setIdleConfirmCount(0);
    }
  }, [activeItemId]);

  const visibleItemIds = useMemo(
    () => (data?.items ?? []).map((i) => i.id as string),
    [data?.items],
  );

  const { data: ratingTotals = {} } = useQuery({
    queryKey: ["rating-totals", visibleItemIds.join(",")],
    enabled: visibleItemIds.length > 0 && !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: rows } = await (supabase as any)
        .from("content_item_rating_totals")
        .select("content_item_id, thumbs_up, thumbs_down")
        .in("content_item_id", visibleItemIds);
      const map: Record<string, { thumbs_up: number; thumbs_down: number }> = {};
      for (const r of (rows ?? []) as any[]) {
        map[r.content_item_id] = { thumbs_up: r.thumbs_up, thumbs_down: r.thumbs_down };
      }
      return map;
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {isLoading && (
        <div className="flex-1 mx-auto max-w-5xl w-full px-6 py-12 animate-pulse">
          <div className="h-8 w-48 rounded bg-muted mb-2" />
          <div className="h-4 w-72 rounded bg-muted mb-10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
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
                  {user && !isAdmin && !isFacilityUser && visibleItems.length > 0 && (() => {
                    const normEngMap = new Map(
                      Array.from(engagementMap.entries()).map(([id, r]) => [id, {
                        sessionSeconds: r.session_seconds,
                        mediaProgressSeconds: r.media_progress_seconds,
                        mediaDurationSeconds: r.media_duration_seconds,
                        manualCompletionPct: r.manual_completion_pct,
                      }])
                    );
                    const trackableItems = visibleItems.filter((it) => !(it as any).exempt_from_progress);
                    const completedCount = trackableItems.filter((it) => readSet.has(it.id)).length;
                    return (
                      <div className="mt-6 max-w-md space-y-1.5">
                        <Progress
                          value={weightedCompletionPct(trackableItems, readSet, normEngMap)}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.progressItems")
                            .replace("{done}", String(completedCount))
                            .replace("{total}", String(trackableItems.length))}
                        </p>
                      </div>
                    );
                  })()}
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
                              <SelectItem value="all">{t("home.allTypes")}</SelectItem>
                              {orderedKinds.map((k) => (
                                <SelectItem key={k} value={k} className="capitalize">{translateType(lang, k, badgeStyles.typeNamesEs)}</SelectItem>
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
                      if (mediaKind === "video") setActiveMedia({ type: "video", ...payload });
                      else if (mediaKind === "audio") setActiveMedia({ type: "audio", ...payload });
                      else if (mediaKind === "pdf") {
                        setActiveMedia({ type: "pdf", ...payload });
                        openedPdfsRef.current.add(item.id);
                      }
                      else if (mediaKind === "image") {
                        setActiveMedia({ type: "image", ...payload });
                        // Opening an image = viewed — auto-mark immediately
                        if (!readSet.has(item.id)) {
                          toggleRead.mutate({ itemId: item.id, markRead: true });
                        }
                      }
                    };

                    const isMeetingOrCall = item.type && (
                      item.type.toLowerCase().includes("meeting") ||
                      item.type.toLowerCase().includes("call")
                    );
                    const isExternalLink = !isMedia && !!item.url && !isMeetingOrCall;

                    const handleActivate = () => {
                      if (!canAccessAdmin && !isFacilityUser) trackContentClick(item.id, data.category.id);
                      // External links: auto-mark as accessed the moment the link is clicked
                      if (!isAdmin && !isFacilityUser && isExternalLink && !readSet.has(item.id) && user?.id) {
                        toggleRead.mutate({ itemId: item.id, markRead: true });
                      }
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
                      <li key={item.id} id={`item-${item.id}`} className="relative scroll-mt-24 flex items-stretch hover:bg-[var(--color-secondary)]/60 transition-colors">
                        {highlightedId === item.id && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-[var(--color-accent)]/15 opacity-0 animate-highlight-pulse"
                          />
                        )}




                        <Wrapper
                          {...wrapperProps}
                          className="flex-1 min-w-0 text-left flex flex-col gap-4 p-6 pb-[20px] cursor-pointer"
                        >
                          <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
                            <BadgeGroup>
                              {isNew && (
                                <Badge variant="new" className="rounded-[8px]">{t("category.newContent")}</Badge>
                              )}
                              <Badge variant="type" type={item.type} className="rounded-[8px]">
                                {translateType(lang, item.type, badgeStyles.typeNamesEs)}
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
                              <div className="flex items-center gap-1 mt-1 flex-shrink-0">
                                {(item as any).exempt_from_progress && !isAdmin && !isFacilityUser && (
                                  <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex cursor-help text-muted-foreground">
                                          <Info className="h-4 w-4" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                                        {t("category.exemptTooltip")}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {MediaIcon ? (
                                  <MediaIcon className="h-4 w-4 text-muted-foreground" />
                                ) : item.url ? (
                                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                ) : null}
                              </div>
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


                        {user && !isAdmin && !isFacilityUser && (() => {
                          const isRead = readSet.has(item.id);
                          let readLabel = t("category.markedRead");
                          let unreadLabel = t("category.notRead");
                          if (isMeetingOrCall) {
                            readLabel = t("category.markedAttended");
                            unreadLabel = t("category.notAttended");
                          } else if (mediaKind === "video") {
                            readLabel = t("category.markedWatched");
                            unreadLabel = t("category.notWatched");
                          } else if (mediaKind === "audio") {
                            readLabel = t("category.markedListened");
                            unreadLabel = t("category.notListened");
                          } else if (mediaKind === "image") {
                            readLabel = t("category.markedViewed");
                            unreadLabel = t("category.notViewed");
                          } else if (isExternalLink) {
                            readLabel = t("category.markedClicked");
                            unreadLabel = t("category.notClicked");
                          }
                          const isBookmarked = bookmarkIds.has(item.id);
                          const myRating = myRatings.get(item.id) ?? null;
                          return (
                            <div className="flex flex-col items-end justify-start gap-1 flex-shrink-0 pr-6 pt-6 pb-5">
                              <div className="flex items-center gap-1.5 justify-end">
                              {isRead && <div className="inline-flex items-center rounded-[8px] border border-input overflow-hidden">
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label={t("rating.helpful")}
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); rate(item.id, myRating === 1 ? null : 1); }}
                                        className={`inline-flex items-center justify-center px-2 py-1.5 transition-colors ${myRating === 1 ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                      >
                                        <ThumbsUp className={`h-3.5 w-3.5 ${myRating === 1 ? "fill-[var(--color-accent)]" : ""}`} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">{t("rating.helpful")}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <div className="w-px self-stretch bg-border" />
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label={t("rating.notHelpful")}
                                        onClick={(e) => { e.stopPropagation(); e.preventDefault(); rate(item.id, myRating === -1 ? null : -1); }}
                                        className={`inline-flex items-center justify-center px-2 py-1.5 transition-colors ${myRating === -1 ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground hover:bg-muted"}`}
                                      >
                                        <ThumbsDown className={`h-3.5 w-3.5 ${myRating === -1 ? "fill-destructive" : ""}`} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">{t("rating.notHelpful")}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>}
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={isBookmarked ? t("bookmark.remove") : t("bookmark.save")}
                                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleBookmark(item.id); }}
                                      className="inline-flex items-center justify-center rounded-[8px] border border-input bg-background px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                                    >
                                      <Bookmark
                                        className={`h-3.5 w-3.5 transition-colors ${isBookmarked ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : "text-muted-foreground"}`}
                                      />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {isBookmarked ? t("bookmark.remove") : t("bookmark.save")}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {(() => {
                                const eng = engagementMap.get(item.id);

                                // ── Exempt items: "Acknowledged" button, no progress tracking ──
                                if ((item as any).exempt_from_progress) {
                                  const isAcknowledged = readSet.has(item.id);
                                  return (
                                    <TooltipProvider delayDuration={150}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              if (!isAcknowledged) toggleRead.mutate({ itemId: item.id, markRead: true });
                                            }}
                                            className={`inline-flex items-center leading-none gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-xs font-medium transition-colors flex-shrink-0 ${
                                              isAcknowledged
                                                ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)] cursor-default"
                                                : "border-input bg-background hover:bg-muted"
                                            }`}
                                          >
                                            {isAcknowledged
                                              ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                              : <Circle className="h-3.5 w-3.5 flex-shrink-0" />}
                                            <span>{isAcknowledged ? t("category.acknowledged") : t("category.acknowledge")}</span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                                          {t("category.exemptDisclaimer")}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }

                                // ── Video / Audio: progress fill based on playback position ──
                                const mediaPct = !isRead && eng && (mediaKind === "video" || mediaKind === "audio") && eng.media_progress_seconds && eng.media_duration_seconds && eng.media_duration_seconds > 0
                                  ? Math.min(100, Math.round((eng.media_progress_seconds / eng.media_duration_seconds) * 100))
                                  : null;

                                if (mediaPct !== null && mediaPct >= 5) {
                                  // Display-only progress fill — no manual click; auto-mark fires at 95%
                                  return (
                                    <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium overflow-hidden flex-shrink-0">
                                      <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${mediaPct}%`, background: `color-mix(in oklab, var(--color-accent) 22%, transparent)` }} />
                                      <Circle className="h-3.5 w-3.5 flex-shrink-0 relative text-foreground" />
                                      <span className="relative text-foreground">
                                        {mediaPct}%{" "}
                                        {mediaKind === "video" ? t("category.markedWatched").toLowerCase() : t("category.markedListened").toLowerCase()}
                                      </span>
                                    </span>
                                  );
                                }

                                // ── PDF: progress fill based on time open vs estimated reading time ──
                                if (!isRead && mediaKind === "pdf") {
                                  const hasOpened = openedPdfsRef.current.has(item.id) || !!eng;

                                  if (!hasOpened) {
                                    // Not yet opened — show dimmed badge with tooltip nudging them to open it
                                    return (
                                      <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMedia(); }}
                                              className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium opacity-40 cursor-pointer"
                                            >
                                              <Circle className="h-3.5 w-3.5 flex-shrink-0" />
                                              <span>{unreadLabel}</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                            Open the PDF to start tracking your reading time
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  }

                                  const pdfMins = parseMinutes(item.duration);
                                  const pdfEstSec = pdfMins > 0 ? pdfMins * 60 : 0;
                                  const sessionSec = eng?.session_seconds ?? 0;
                                  const pdfPct = pdfEstSec > 0
                                    ? Math.min(100, Math.round((sessionSec / (pdfEstSec * 0.95)) * 100))
                                    : null;

                                  if (pdfPct !== null && pdfPct >= 1) {
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          // Record the % they were at when manually marking as read (before auto-mark)
                                          if (!isRead && pdfPct < 100 && user?.id) {
                                            Promise.resolve(
                                              (supabase as any)
                                                .from("user_content_engagement")
                                                .update({ manual_completion_pct: pdfPct, last_updated_at: new Date().toISOString() })
                                                .eq("user_id", user.id)
                                                .eq("content_item_id", item.id)
                                            ).catch(() => {});
                                          }
                                          toggleRead.mutate({ itemId: item.id, markRead: !isRead });
                                        }}
                                        className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium cursor-pointer overflow-hidden transition-colors hover:bg-muted"
                                      >
                                        <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${pdfPct}%`, background: `color-mix(in oklab, var(--color-accent) 22%, transparent)` }} />
                                        <Circle className="h-3.5 w-3.5 flex-shrink-0 relative text-foreground" />
                                        <span className="relative text-foreground">
                                          {pdfPct}% {t("category.markedRead").toLowerCase()}
                                        </span>
                                      </button>
                                    );
                                  }

                                  // Opened but no estimated duration or < 1% — show plain unread badge
                                  return (
                                    <ReadStatusBadge
                                      read={false}
                                      readLabel={readLabel}
                                      unreadLabel={unreadLabel}
                                      unreadIcon="circle"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        toggleRead.mutate({ itemId: item.id, markRead: true });
                                      }}
                                    />
                                  );
                                }

                                // ── Unread video/audio with no tracked progress yet: dimmed + tooltip ──
                                if (!isRead && (mediaKind === "video" || mediaKind === "audio")) {
                                  const tipLabel = mediaKind === "video"
                                    ? "Watch the video to track your progress"
                                    : "Listen to the audio to track your progress";
                                  return (
                                    <TooltipProvider delayDuration={100}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMedia(); }}
                                            className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium opacity-40 cursor-pointer flex-shrink-0"
                                          >
                                            <Circle className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span>{unreadLabel}</span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                          {tipLabel}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }

                                // ── Unread image: dimmed + tooltip (auto-marks the moment they open it) ──
                                if (!isRead && mediaKind === "image") {
                                  return (
                                    <TooltipProvider delayDuration={100}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMedia(); }}
                                            className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium opacity-40 cursor-pointer flex-shrink-0"
                                          >
                                            <Circle className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span>{unreadLabel}</span>
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                          View the image to mark it as seen
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }

                                // ── Unread external link: dimmed — clicking the card auto-marks ──
                                if (!isRead && isExternalLink) {
                                  return (
                                    <TooltipProvider delayDuration={100}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="relative inline-flex items-center leading-none gap-1.5 rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs font-medium opacity-40 flex-shrink-0">
                                            <Circle className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span>{unreadLabel}</span>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
                                          Click the link to access this resource
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                }

                                // ── All other types (worksheet, meeting/call, no-URL items): standard badge ──
                                return (
                                  <ReadStatusBadge
                                    read={isRead}
                                    readLabel={readLabel}
                                    unreadLabel={unreadLabel}
                                    unreadIcon="circle"
                                    readAt={isRead ? (fmtDateShort(readAtMap.get(item.id)) || null) : null}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      toggleRead.mutate({ itemId: item.id, markRead: !isRead });
                                    }}
                                  />
                                );
                              })()}
                              </div>
                              {(item as any).exempt_from_progress && (
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                  {t("category.exemptDisclaimer")}
                                </p>
                              )}
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

            {shuffledOthers.length > 0 && (
              <section className="mx-auto max-w-5xl px-6 pb-20">
                <div className="border-t border-border/60 pt-20">
                  <h2 className="font-display text-xl font-semibold mb-6">{t("category.exploreOthers")}</h2>
                  <Carousel setApi={setOthersApi} opts={{ align: "start", loop: false }} plugins={[AutoHeight()]} className="relative">
                    <CarouselContent className="items-start transition-[height] duration-300 ease-out">
                      {Array.from({ length: Math.ceil(shuffledOthers.length / 9) }).map((_, slideIdx) => {
                        const slide = shuffledOthers.slice(slideIdx * 9, slideIdx * 9 + 9);
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

      <Dialog open={!!videoPlayer} onOpenChange={(open) => { if (!open) { setActiveMedia(null); setVideoEl(null); invalidateEngagement(); } }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-0 max-h-[calc(100dvh-2rem)]" onInteractOutside={(e) => { if (showIdlePrompt) e.preventDefault(); }}>
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

      <Dialog open={!!audioPlayer} onOpenChange={(open) => { if (!open) { setActiveMedia(null); setAudioEl(null); invalidateEngagement(); } }}>
        <DialogContent className="max-w-lg pt-[18px] max-h-[calc(100dvh-2rem)] overflow-auto" onInteractOutside={(e) => { if (showIdlePrompt) e.preventDefault(); }}>
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

      <Dialog open={!!pdfViewer} onOpenChange={(open) => { if (!open) { setActiveMedia(null); invalidateEngagement(); } }}>
        <DialogContent className="w-[95vw] min-w-0 max-w-[95vw] sm:max-w-[95vw] p-0 overflow-hidden max-h-[calc(100dvh-2rem)]">
          <DialogTitle className="sr-only">{pdfViewer?.title ?? "PDF"}</DialogTitle>
          {pdfViewer && (
            <Suspense fallback={<div className="p-8 text-sm text-muted-foreground h-[calc(100dvh-4rem)]">Loading PDF…</div>}>
              <PdfViewer key={pdfViewer.url} url={pdfViewer.url} />
            </Suspense>
          )}
          {showIdlePrompt && <IdlePrompt countdown={idleCountdown} onStillHere={() => { clearIdleCountdown(); setShowIdlePrompt(false); setIdleConfirmCount((n) => n + 1); resetIdle(); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!imageViewer} onOpenChange={(open) => { if (!open) { setActiveMedia(null); invalidateEngagement(); } }}>
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
          {showIdlePrompt && <IdlePrompt countdown={idleCountdown} onStillHere={() => { clearIdleCountdown(); setShowIdlePrompt(false); setIdleConfirmCount((n) => n + 1); resetIdle(); }} />}
        </DialogContent>
      </Dialog>

      {/* Category completion celebration */}
      <Dialog open={categoryComplete} onOpenChange={(open) => { if (!open) setCategoryComplete(false); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] text-center rounded-2xl border border-border bg-card p-8 shadow-xl">
          <DialogTitle className="sr-only">
            {t("category.completedHeadline").replace("{name}", pickLang(lang, data?.category?.name ?? "", data?.category?.name_es))}
          </DialogTitle>
          {data?.category && (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <CategoryIcon
                    name={data.category.icon_name}
                    color={data.category.icon_color}
                    size="lg"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </span>
                </div>
              </div>
              <h2 className="font-display text-2xl font-bold leading-tight">
                {t("category.completedHeadline").replace("{name}", pickLang(lang, data.category.name, data.category.name_es))}
              </h2>
              <p className="mt-1 text-muted-foreground leading-relaxed">
                {t("category.completedMessage")}
              </p>
              <button
                type="button"
                onClick={() => setCategoryComplete(false)}
                className="mt-3 w-full rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t("category.completedClose")}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Debug overlay — only shown for tester accounts */}
      {isTester && createPortal(
        <div className="fixed top-4 right-4 z-[200] rounded-md border border-border bg-card px-3 py-2 text-xs font-mono shadow-lg leading-loose w-64">
          <div className="font-semibold text-foreground mb-1">⏱ Engagement Debug</div>
          <div>idle: <span className={debugIdleSecs >= Math.floor(currentIdleMs / 1000) ? "text-red-600 font-bold" : "text-foreground"}>{debugIdleSecs}s</span> / {currentIdleMs / 1000}s trigger</div>
          <div>hook active: {!!activeItemId && !isAdmin && !isFacilityUser ? <span className="text-green-600">✓ yes</span> : <span className="text-red-600">✗ no — open a PDF/image</span>}</div>
          <div>idle fired: {engDebug.isIdle.current ? <span className="text-amber-600">yes</span> : "no"}</div>
          <div>confirmations: {idleConfirmCount} → next: {IDLE_THRESHOLDS_MS[Math.min(idleConfirmCount, IDLE_THRESHOLDS_MS.length - 1)] / 1000}s {idleConfirmCount >= IDLE_THRESHOLDS_MS.length - 1 ? "(capped)" : ""}</div>
          <div className="border-t border-border/40 mt-1 pt-1">
            <div>base (DB): {engDebug.baseSeconds.current}s</div>
            <div>this session: <span className="text-green-600 font-semibold">{engDebug.accSeconds.current}s</span></div>
            <div>total (will save): <span className="font-semibold">{engDebug.baseSeconds.current + engDebug.accSeconds.current}s</span></div>
          </div>
          {engDebug.durationSeconds.current > 0 && (
            <div className="border-t border-border/40 mt-1 pt-1">
              <div>media pos: {Math.round(engDebug.furthestSeconds.current)}s / {Math.round(engDebug.durationSeconds.current)}s</div>
              <div>media %: {Math.round((engDebug.furthestSeconds.current / engDebug.durationSeconds.current) * 100)}%</div>
            </div>
          )}
          <div className="border-t border-border/40 mt-1 pt-1 text-muted-foreground">
            item: {activeItemId ? (isMediaItem ? "media (no modal)" : "static ✓ modal") : "none"}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
