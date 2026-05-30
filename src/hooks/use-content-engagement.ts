import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/** How long without activity before the timer stops counting. */
const IDLE_MS = 90_000;
/** Heartbeat interval — how often we check for activity. */
const TICK_MS = 30_000;
/** Flush accumulated time to DB every this many seconds of active time. */
const FLUSH_INTERVAL_S = 120;
/** Media position is sampled at most every this many seconds. */
const MEDIA_SAMPLE_S = 5;
/** Completion threshold for auto-marking an item as read. */
const AUTO_READ_PCT = 0.95;

export type EngagementRecord = {
  session_seconds: number;
  media_progress_seconds: number | null;
  media_duration_seconds: number | null;
};

type Params = {
  contentItemId: string | null;
  categoryId: string | null;
  userId: string | null;
  /** True while the content item's dialog/player is open. */
  isActive: boolean;
  /** Existing engagement data loaded from the DB for this item. */
  existing: EngagementRecord | null;
  /** Ref to the video element (only for video items). */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Ref to the audio element (only for audio items). */
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  /** True when the video dialog is open. */
  isVideoActive?: boolean;
  /** True when the audio dialog is open. */
  isAudioActive?: boolean;
  /** Called when 95%+ of the media has been reached. */
  onAutoMarkRead?: () => void;
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
  videoRef,
  audioRef,
  isVideoActive = false,
  isAudioActive = false,
  onAutoMarkRead,
}: Params): { mediaProgressPct: number | null } {
  // Timer state — all in refs so they never cause re-renders
  const lastActivityRef = useRef(Date.now());
  const accSecondsRef = useRef(0);   // accumulated THIS session
  const baseSecondsRef = useRef(0);  // DB value when item opened

  // Media state
  const furthestRef = useRef(0);       // furthest playback position reached
  const durationRef = useRef(0);       // total media duration
  const autoMarkedRef = useRef(false);

  // Sync base values when a new item opens
  useEffect(() => {
    if (!isActive || !contentItemId) return;
    baseSecondsRef.current = existing?.session_seconds ?? 0;
    furthestRef.current = existing?.media_progress_seconds ?? 0;
    durationRef.current = existing?.media_duration_seconds ?? 0;
    accSecondsRef.current = 0;
    lastActivityRef.current = Date.now();
    autoMarkedRef.current = false;
  }, [contentItemId, isActive, existing]);

  // Write combined record — reads from refs so always has current values.
  // Always writes the cumulative TOTAL (not a delta) so upserts are idempotent.
  const write = useCallback(() => {
    if (!userId || !contentItemId || !categoryId) return;
    ;(supabase as any)
      .from("user_content_engagement")
      .upsert(
        {
          user_id: userId,
          content_item_id: contentItemId,
          category_id: categoryId,
          session_seconds: baseSecondsRef.current + accSecondsRef.current,
          media_progress_seconds: furthestRef.current > 0 ? furthestRef.current : null,
          media_duration_seconds: durationRef.current > 0 ? durationRef.current : null,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,content_item_id" },
      )
      .catch(() => {});
  }, [userId, contentItemId, categoryId]);

  // Activity listener — resets idle clock on any user interaction
  useEffect(() => {
    if (!isActive) return;
    const refresh = () => { lastActivityRef.current = Date.now(); };
    const events = ["touchstart", "touchmove", "click", "keydown", "scroll", "mousemove"];
    events.forEach((e) => document.addEventListener(e, refresh, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, refresh));
  }, [isActive]);

  // Heartbeat timer — counts active seconds, flushes periodically and on close
  useEffect(() => {
    if (!isActive || !userId || !contentItemId) return;

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current > IDLE_MS;
      if (!idle) {
        accSecondsRef.current += 30;
        // Periodic flush so long sessions aren't lost
        if (accSecondsRef.current > 0 && accSecondsRef.current % FLUSH_INTERVAL_S === 0) {
          write();
        }
      }
    }, TICK_MS);

    return () => {
      clearInterval(interval);
      // Flush accumulated time when dialog closes
      if (accSecondsRef.current > 0) write();
    };
  }, [isActive, userId, contentItemId, write]);

  // Video progress tracking + resume
  useEffect(() => {
    const el = videoRef?.current; // captured at effect start — stays valid in cleanup
    if (!el || !isVideoActive) return;

    const onLoadedMetadata = () => {
      durationRef.current = el.duration || 0;
      // Resume from stored position (only seek if > 5s to avoid seeking near start)
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

      // Auto-mark as read at 95% completion
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

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      if (furthestRef.current > 0) write();
    };
  }, [videoRef, isVideoActive, write, onAutoMarkRead]);

  // Audio progress tracking + resume (same logic as video)
  useEffect(() => {
    const el = audioRef?.current;
    if (!el || !isAudioActive) return;

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

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      if (furthestRef.current > 0) write();
    };
  }, [audioRef, isAudioActive, write, onAutoMarkRead]);

  const mediaProgressPct =
    durationRef.current > 0 && furthestRef.current > 0
      ? Math.min(100, Math.round((furthestRef.current / durationRef.current) * 100))
      : null;

  return { mediaProgressPct };
}
