import React, { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Module-level cache of furthest playback positions for the current page
 * session. Keyed by contentItemId. Avoids the DB refetch race condition
 * where invalidateQueries fires at the same time as the flush write — the
 * read can complete before the write, returning stale data on resume.
 */
const SESSION_PROGRESS_MAX = 500;
const sessionProgress = new Map<string, number>();

// Module-level cache of per-chapter furthest positions for the current page
// session. Keyed by chapterId. Lets the hook correctly initialize when a
// chapter is revisited within the same session before the DB write has landed.
const sessionChapterProgress = new Map<string, number>();

/** Read the module-level session cache for a content item. Returns the furthest
 *  position written in the current page session, or undefined if never played. */
export function getSessionProgress(contentItemId: string): number | undefined {
  return sessionProgress.get(contentItemId);
}

function setSessionProgress(id: string, value: number) {
  if (!sessionProgress.has(id) && sessionProgress.size >= SESSION_PROGRESS_MAX) {
    sessionProgress.delete(sessionProgress.keys().next().value!);
  }
  sessionProgress.set(id, value);
}

/** Default idle threshold — overridden per-call via the idleMs param. */
const DEFAULT_IDLE_MS = 90_000;
/** Heartbeat interval — how often we check for activity. */
const TICK_MS = 5_000;
/** Seconds added per tick (must match TICK_MS). */
const TICK_S = TICK_MS / 1000;
/** Flush accumulated time to DB every this many seconds of active time. */
const FLUSH_INTERVAL_S = 60;
/** Media position is sampled at most every this many seconds. */
const MEDIA_SAMPLE_S = 5;
/** Completion threshold for auto-marking an item as read. */
const AUTO_READ_PCT = 0.95;

export type EngagementRecord = {
  session_seconds: number;
  media_progress_seconds: number | null;
  media_duration_seconds: number | null;
  manual_completion_pct: number | null;
};

type Params = {
  contentItemId: string | null;
  categoryId: string | null;
  userId: string | null;
  /** True while the content item's dialog/player is open. */
  isActive: boolean;
  /** Existing engagement data loaded from the DB for this item. */
  existing: EngagementRecord | null;
  /**
   * The actual video element — use a callback ref (useState) in the parent
   * so this updates when the element mounts inside the Dialog Portal.
   * Using useRef alone would give null here because the Portal renders async.
   */
  videoEl?: HTMLVideoElement | null;
  /** The actual audio element (same reasoning as videoEl). */
  audioEl?: HTMLAudioElement | null;
  /**
   * For chapter audio: the cumulative duration of all chapters that have
   * already completed before the currently playing one. Added to the element's
   * currentTime so furthest position is tracked as a single timeline offset.
   */
  mediaProgressOffset?: number;
  /**
   * For chapter audio: the total duration of all chapters combined. Overrides
   * the element's own .duration for the auto-mark threshold calculation so the
   * item isn't marked complete until the last chapter finishes.
   */
  totalMediaDuration?: number;
  /**
   * For chapter audio: the ID of the currently playing chapter. When set, the
   * hook tracks per-chapter furthest progress and writes it to
   * user_chapter_progress so progress can be summed across chapters.
   */
  chapterId?: string | null;
  /**
   * For chapter audio: the furthest_seconds already stored in the DB for the
   * currently playing chapter. Used to initialize chapterFurthestRef so that
   * revisiting a chapter in a new session never resets saved progress.
   */
  existingChapterFurthest?: number;
  /**
   * Estimated reading time in seconds for PDF items (derived from the
   * item's duration field). When provided, the hook auto-marks as read at
   * 95% of this value based on cumulative active session time.
   */
  pdfEstimatedSeconds?: number;
  /** Called when 95%+ of the media/PDF threshold has been reached. */
  onAutoMarkRead?: () => void;
  /** Called once when the idle threshold is crossed (for static content only). */
  onIdle?: () => void;
  /** How many ms of inactivity before idle fires. Defaults to DEFAULT_IDLE_MS. */
  idleMs?: number;
};

/**
 * Tracks both active session time (Tier 1) and media playback progress
 * (Tier 2) for a single content item.
 *
 * Writes are upserted to user_content_engagement. Every write sends the
 * cumulative total so the upsert is always idempotent.
 */
export function useContentEngagement({
  contentItemId,
  categoryId,
  userId,
  isActive,
  existing,
  videoEl,
  audioEl,
  mediaProgressOffset = 0,
  totalMediaDuration,
  chapterId = null,
  existingChapterFurthest = 0,
  pdfEstimatedSeconds,
  onAutoMarkRead,
  onIdle,
  idleMs = DEFAULT_IDLE_MS,
}: Params): { mediaProgressPct: number | null; chapterFurthestSeconds: number; getSessionChapterFurthest: (chapterId: string) => number; resetIdle: () => void; debugRefs: { baseSeconds: React.RefObject<number>; accSeconds: React.RefObject<number>; furthestSeconds: React.RefObject<number>; durationSeconds: React.RefObject<number>; isIdle: React.RefObject<boolean>; idleMs: React.RefObject<number> } } {
  // Timer state — all in refs so they never cause re-renders
  const lastActivityRef = useRef(Date.now());
  const accSecondsRef = useRef(0);
  const baseSecondsRef = useRef(0);
  // Tracks whether onIdle has already fired for the current idle period so we
  // don't spam the callback every tick while the user remains idle.
  const firedIdleRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  const onAutoMarkReadRef = useRef(onAutoMarkRead);
  useEffect(() => { onAutoMarkReadRef.current = onAutoMarkRead; }, [onAutoMarkRead]);
  const idleMsRef = useRef(idleMs);
  useEffect(() => { idleMsRef.current = idleMs; }, [idleMs]);

  // PDF: store estimated seconds in a ref so the timer effect stays stable
  const pdfEstimatedSecondsRef = useRef(pdfEstimatedSeconds ?? 0);
  useEffect(() => {
    pdfEstimatedSecondsRef.current = pdfEstimatedSeconds ?? 0;
  }, [pdfEstimatedSeconds]);

  // Media state
  const furthestRef = useRef(0);      // high-watermark: used only for auto-mark-read threshold
  const currentPositionRef = useRef(0); // actual current position: used for resume and DB writes
  const durationRef = useRef(0);
  const autoMarkedRef = useRef(false);

  // Updated synchronously during render (not in a useEffect) so the write()
  // callback always sees the latest value even during effect cleanups — which
  // run before the next effect's useEffect body executes.
  const totalMediaDurationRef = useRef<number | undefined>(undefined);
  totalMediaDurationRef.current = totalMediaDuration;

  // Per-chapter progress (chapter audio only)
  const chapterIdRef = useRef<string | null>(chapterId);
  useEffect(() => { chapterIdRef.current = chapterId; }, [chapterId]);
  const chapterFurthestRef = useRef(0); // furthest seconds within the current chapter

  // Sync base values when a new item opens or when existing data arrives late.
  // `sessionProgress` is preferred over DB when available — it's always the most
  // recent value and correctly reflects backward chapter navigation.
  useEffect(() => {
    if (!isActive || !contentItemId) return;
    baseSecondsRef.current = existing?.session_seconds ?? 0;
    const dbPos = existing?.media_progress_seconds ?? 0;
    const sessionPos = sessionProgress.get(contentItemId) ?? 0;
    // Prefer session cache when available (it's always more recent than DB in a
    // same-page-session reopen and correctly handles backward chapter navigation).
    const resumePos = sessionProgress.has(contentItemId) ? sessionPos : dbPos;
    furthestRef.current = resumePos;
    currentPositionRef.current = resumePos;
    durationRef.current = existing?.media_duration_seconds ?? 0;
    accSecondsRef.current = 0;
    lastActivityRef.current = Date.now();
    autoMarkedRef.current = false;

    // If the element is already loaded, seek immediately; otherwise the
    // loadedmetadata handler below will seek once metadata is available.
    // Chapter audio is NOT seeked here — the audio effect owns that seek using
    // chapterFurthestRef (driven by existingChapterFurthest). Seeking with the
    // cumulative resumePos on a single-chapter element would overshoot.
    if (resumePos > 5) {
      if (videoEl && videoEl.readyState >= 1) videoEl.currentTime = resumePos;
      if (audioEl && audioEl.readyState >= 1 && !chapterId) audioEl.currentTime = resumePos;
    }
  }, [contentItemId, isActive, existing, videoEl, audioEl]);

  // `write` upserts the cumulative record so every call is idempotent — if the
  // network retries, the DB ends up with the same value rather than doubling.
  const write = useCallback(() => {
    if (!userId || !contentItemId || !categoryId) return;
    Promise.resolve(
      (supabase as any)
        .from("user_content_engagement")
        .upsert(
          {
            user_id: userId,
            content_item_id: contentItemId,
            category_id: categoryId,
            // Always send base + accumulated so any previous partial write is overwritten.
            session_seconds: baseSecondsRef.current + accSecondsRef.current,
            media_progress_seconds: currentPositionRef.current > 0 ? currentPositionRef.current : null,
            media_duration_seconds: (totalMediaDurationRef.current ?? durationRef.current) > 0 ? (totalMediaDurationRef.current ?? durationRef.current) : null,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,content_item_id" },
        )
    ).catch(() => {});

    // Per-chapter furthest: only write when we actually have progress in this chapter.
    const cId = chapterIdRef.current;
    if (cId && chapterFurthestRef.current > 0) {
      Promise.resolve(
        (supabase as any)
          .from("user_chapter_progress")
          .upsert(
            {
              user_id: userId,
              chapter_id: cId,
              content_item_id: contentItemId,
              furthest_seconds: chapterFurthestRef.current,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,chapter_id" },
          )
      ).catch(() => {});
    }
  }, [userId, contentItemId, categoryId]);

  // Stamp `lastActivityRef` on any user interaction so the heartbeat can detect
  // idle periods. `passive: true` avoids blocking the browser's scroll/touch pipeline.
  useEffect(() => {
    if (!isActive) return;
    const refresh = () => { lastActivityRef.current = Date.now(); };
    const events = ["touchstart", "touchmove", "click", "keydown", "scroll", "mousemove"];
    events.forEach((e) => document.addEventListener(e, refresh, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, refresh));
  }, [isActive]);

  // Exposed so the parent can reset the idle state when the user confirms
  // they're still present via the "Are you still here?" modal.
  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    firedIdleRef.current = false;
  }, []);

  // Heartbeat timer
  useEffect(() => {
    if (!isActive || !userId || !contentItemId) return;
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current > idleMsRef.current;
      if (idle && !firedIdleRef.current) {
        firedIdleRef.current = true;
        onIdleRef.current?.();
      }
      if (!idle) {
        firedIdleRef.current = false;
        accSecondsRef.current += TICK_S;
        // PDF auto-mark: fire when cumulative active time reaches 95% of estimate
        const pdfThreshold = pdfEstimatedSecondsRef.current;
        if (!autoMarkedRef.current && pdfThreshold > 0) {
          const total = baseSecondsRef.current + accSecondsRef.current;
          if (total >= pdfThreshold * 0.95) {
            autoMarkedRef.current = true;
            onAutoMarkReadRef.current?.();
            write();
          }
        }
        if (accSecondsRef.current % FLUSH_INTERVAL_S === 0) {
          write();
        }
      }
    }, TICK_MS);
    return () => {
      clearInterval(interval);
      write(); // flush cumulative total to user_content_engagement (resume position)
      // Log this session to user_content_sessions for date-range-filterable analytics
      const sessionSecs = Math.round(accSecondsRef.current);
      if (sessionSecs > 0 && userId && contentItemId && categoryId) {
        Promise.resolve(
          (supabase as any)
            .from("user_content_sessions")
            .insert({
              user_id: userId,
              content_item_id: contentItemId,
              category_id: categoryId,
              session_seconds: sessionSecs,
            })
        ).catch(() => {});
      }
    };
  }, [isActive, userId, contentItemId, categoryId, write]);

  // Video progress tracking + resume.
  // Depends on `videoEl` (the actual element) — re-runs when the element
  // mounts inside the Dialog Portal, not just when isVideoActive changes.
  useEffect(() => {
    const el = videoEl;
    if (!el) return;

    const onLoadedMetadata = () => {
      durationRef.current = el.duration || 0;
      if (currentPositionRef.current > 5) {
        el.currentTime = currentPositionRef.current;
      }
    };

    let lastSample = 0;
    const onTimeUpdate = () => {
      const t = el.currentTime;
      if (t - lastSample < MEDIA_SAMPLE_S) return;
      lastSample = t;
      if (el.duration) durationRef.current = el.duration;
      currentPositionRef.current = t;
      furthestRef.current = Math.max(furthestRef.current, t);
      if (contentItemId) setSessionProgress(contentItemId, currentPositionRef.current);
      if (
        !autoMarkedRef.current &&
        el.duration > 0 &&
        furthestRef.current / el.duration >= AUTO_READ_PCT
      ) {
        autoMarkedRef.current = true;
        onAutoMarkReadRef.current?.();
        write();
      }
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("timeupdate", onTimeUpdate);
    if (el.readyState >= 1) onLoadedMetadata();

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      write();
    };
  }, [videoEl, write, contentItemId]);

  // Audio progress tracking + resume (same as video, but supports chapter offset).
  // mediaProgressOffset = cumulative duration of chapters already completed.
  // totalMediaDuration   = total duration of all chapters (overrides el.duration for auto-mark).
  useEffect(() => {
    const el = audioEl;
    if (!el) return;

    // Initialize chapterFurthestRef from DB value or within-session cache, whichever
    // is higher. Handles both first-open and same-session chapter revisits.
    if (chapterId) {
      const sessionMax = sessionChapterProgress.get(chapterId) ?? 0;
      chapterFurthestRef.current = Math.max(existingChapterFurthest, sessionMax);
    } else {
      chapterFurthestRef.current = 0;
    }

    const onLoadedMetadata = () => {
      // Use totalMediaDuration when set (chapter mode); otherwise use the element's own duration.
      durationRef.current = totalMediaDuration ?? el.duration ?? 0;
      // Chapter mode: seek to the chapter-level furthest position — this is the same
      // value the UI timestamp shows and is driven by existingChapterFurthest so the
      // audio effect re-runs (and re-seeks) whenever the chapter-progress data loads.
      // Non-chapter: use the cumulative position minus offset (always 0 for single files).
      const resumeWithinChapter = chapterId
        ? chapterFurthestRef.current
        : (currentPositionRef.current - mediaProgressOffset);
      if (resumeWithinChapter > 5 && resumeWithinChapter < (el.duration || Infinity)) {
        el.currentTime = resumeWithinChapter;
      }
    };

    let lastSample = 0;
    const onTimeUpdate = () => {
      const t = el.currentTime;
      if (t - lastSample < MEDIA_SAMPLE_S) return;
      lastSample = t;
      // In chapter mode, durationRef is the total across all chapters.
      if (!totalMediaDuration && el.duration) durationRef.current = el.duration;
      // currentPosition tracks where the user actually is (used for resume and DB writes).
      currentPositionRef.current = mediaProgressOffset + t;
      // furthest only moves forward — used exclusively for the auto-mark-read threshold.
      furthestRef.current = Math.max(furthestRef.current, currentPositionRef.current);
      if (contentItemId) setSessionProgress(contentItemId, currentPositionRef.current);
      // Per-chapter furthest: tracks how much of this specific chapter has been heard.
      if (chapterId) {
        chapterFurthestRef.current = Math.max(chapterFurthestRef.current, t);
        sessionChapterProgress.set(chapterId, chapterFurthestRef.current);
      }
      const effectiveDuration = totalMediaDuration ?? el.duration;
      if (
        !autoMarkedRef.current &&
        effectiveDuration > 0 &&
        furthestRef.current / effectiveDuration >= AUTO_READ_PCT
      ) {
        autoMarkedRef.current = true;
        onAutoMarkReadRef.current?.();
        write();
      }
    };

    // Fires when the audio element reaches the end of the file. Captures the
    // exact chapter duration so the last 0-5 seconds missed by the sampling
    // interval are always recorded — without this, full listens only credit
    // ~95-99% depending on chapter length.
    const onEnded = () => {
      const dur = el.duration || 0;
      currentPositionRef.current = mediaProgressOffset + dur;
      furthestRef.current = Math.max(furthestRef.current, currentPositionRef.current);
      if (contentItemId) setSessionProgress(contentItemId, currentPositionRef.current);
      if (chapterId) {
        chapterFurthestRef.current = dur;
        sessionChapterProgress.set(chapterId, dur);
      }
      const effectiveDuration = totalMediaDuration ?? dur;
      if (
        !autoMarkedRef.current &&
        effectiveDuration > 0 &&
        furthestRef.current / effectiveDuration >= AUTO_READ_PCT
      ) {
        autoMarkedRef.current = true;
        onAutoMarkReadRef.current?.();
      }
      write();
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnded);
    if (el.readyState >= 1) onLoadedMetadata();

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnded);
      write();
    };
  }, [audioEl, mediaProgressOffset, totalMediaDuration, chapterId, existingChapterFurthest, write, contentItemId]);

  // Exposed so the UI can show a progress bar. Null when no media has been played
  // (non-media content types) or before the player reports a duration.
  const mediaProgressPct =
    durationRef.current > 0 && furthestRef.current > 0
      ? Math.min(100, Math.round((furthestRef.current / durationRef.current) * 100))
      : null;

  return {
    mediaProgressPct,
    chapterFurthestSeconds: chapterFurthestRef.current,
    getSessionChapterFurthest: (chId: string) => sessionChapterProgress.get(chId) ?? 0,
    resetIdle,
    debugRefs: {
      baseSeconds: baseSecondsRef,
      accSeconds: accSecondsRef,
      furthestSeconds: furthestRef,
      durationSeconds: durationRef,
      isIdle: firedIdleRef,
      idleMs: idleMsRef,
    },
  };
}
