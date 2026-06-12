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
  pdfEstimatedSeconds,
  onAutoMarkRead,
  onIdle,
  idleMs = DEFAULT_IDLE_MS,
}: Params): { mediaProgressPct: number | null; resetIdle: () => void; debugRefs: { baseSeconds: React.RefObject<number>; accSeconds: React.RefObject<number>; furthestSeconds: React.RefObject<number>; durationSeconds: React.RefObject<number>; isIdle: React.RefObject<boolean>; idleMs: React.RefObject<number> } } {
  // Timer state — all in refs so they never cause re-renders
  const lastActivityRef = useRef(Date.now());
  const accSecondsRef = useRef(0);
  const baseSecondsRef = useRef(0);
  // Tracks whether onIdle has already fired for the current idle period so we
  // don't spam the callback every tick while the user remains idle.
  const firedIdleRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  const idleMsRef = useRef(idleMs);
  useEffect(() => { idleMsRef.current = idleMs; }, [idleMs]);

  // PDF: store estimated seconds in a ref so the timer effect stays stable
  const pdfEstimatedSecondsRef = useRef(pdfEstimatedSeconds ?? 0);
  useEffect(() => {
    pdfEstimatedSecondsRef.current = pdfEstimatedSeconds ?? 0;
  }, [pdfEstimatedSeconds]);

  // Media state
  const furthestRef = useRef(0);
  const durationRef = useRef(0);
  const autoMarkedRef = useRef(false);

  // Sync base values when a new item opens or when existing data arrives late.
  // `sessionProgress` may be ahead of the DB if the user interacted and the
  // flush hasn't landed yet — take the max to avoid seeking backward on reopen.
  useEffect(() => {
    if (!isActive || !contentItemId) return;
    baseSecondsRef.current = existing?.session_seconds ?? 0;
    const dbPos = existing?.media_progress_seconds ?? 0;
    const sessionPos = sessionProgress.get(contentItemId) ?? 0;
    const resumePos = Math.max(dbPos, sessionPos);
    furthestRef.current = resumePos;
    durationRef.current = existing?.media_duration_seconds ?? 0;
    accSecondsRef.current = 0;
    lastActivityRef.current = Date.now();
    autoMarkedRef.current = false;

    // If the element is already loaded, seek immediately; otherwise the
    // loadedmetadata handler below will seek once metadata is available.
    if (resumePos > 5) {
      if (videoEl && videoEl.readyState >= 1) videoEl.currentTime = resumePos;
      if (audioEl && audioEl.readyState >= 1) audioEl.currentTime = resumePos;
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
            media_progress_seconds: furthestRef.current > 0 ? furthestRef.current : null,
            media_duration_seconds: durationRef.current > 0 ? durationRef.current : null,
            last_updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,content_item_id" },
        )
    ).catch(() => {});
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
            onAutoMarkRead?.();
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
      if (furthestRef.current > 5) {
        el.currentTime = furthestRef.current;
      }
    };

    let lastSample = 0;
    const onTimeUpdate = () => {
      const t = el.currentTime;
      if (t - lastSample < MEDIA_SAMPLE_S) return;
      lastSample = t;
      if (el.duration) durationRef.current = el.duration;
      furthestRef.current = Math.max(furthestRef.current, t);
      if (contentItemId) setSessionProgress(contentItemId, furthestRef.current);
      if (
        !autoMarkedRef.current &&
        el.duration > 0 &&
        furthestRef.current / el.duration >= AUTO_READ_PCT
      ) {
        autoMarkedRef.current = true;
        onAutoMarkRead?.();
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
  }, [videoEl, write, onAutoMarkRead, contentItemId]);

  // Audio progress tracking + resume (same as video)
  useEffect(() => {
    const el = audioEl;
    if (!el) return;

    const onLoadedMetadata = () => {
      durationRef.current = el.duration || 0;
      if (furthestRef.current > 5) {
        el.currentTime = furthestRef.current;
      }
    };

    let lastSample = 0;
    const onTimeUpdate = () => {
      const t = el.currentTime;
      if (t - lastSample < MEDIA_SAMPLE_S) return;
      lastSample = t;
      if (el.duration) durationRef.current = el.duration;
      furthestRef.current = Math.max(furthestRef.current, t);
      if (contentItemId) setSessionProgress(contentItemId, furthestRef.current);
      if (
        !autoMarkedRef.current &&
        el.duration > 0 &&
        furthestRef.current / el.duration >= AUTO_READ_PCT
      ) {
        autoMarkedRef.current = true;
        onAutoMarkRead?.();
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
  }, [audioEl, write, onAutoMarkRead, contentItemId]);

  // Exposed so the UI can show a progress bar. Null when no media has been played
  // (non-media content types) or before the player reports a duration.
  const mediaProgressPct =
    durationRef.current > 0 && furthestRef.current > 0
      ? Math.min(100, Math.round((furthestRef.current / durationRef.current) * 100))
      : null;

  return {
    mediaProgressPct,
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
