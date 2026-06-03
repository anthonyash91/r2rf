import { parseMinutes } from "@/lib/duration";

export type ProgressEngagement = {
  sessionSeconds: number;
  mediaProgressSeconds: number | null;
  mediaDurationSeconds: number | null;
  manualCompletionPct: number | null;
};

export type ProgressItem = {
  id: string;
  type?: string | null;
  duration?: string | null;
  url?: string | null;
  file_url?: string | null;
};

/**
 * Returns a 0–1 score for a single item:
 * - Completed → 1.0
 * - Manual completion (user clicked read before 95%) → manualCompletionPct / 100
 * - Video/Audio in progress → mediaProgressSeconds / mediaDurationSeconds (capped at 0.95)
 * - PDF in progress → sessionSeconds / estimatedSeconds (capped at 0.95)
 * - No engagement → 0
 */
export function itemProgressScore(
  item: ProgressItem,
  readSet: Set<string>,
  engagementMap: Map<string, ProgressEngagement>,
): number {
  if (readSet.has(item.id)) return 1;

  const eng = engagementMap.get(item.id);
  if (!eng) return 0;

  if (eng.manualCompletionPct != null) return eng.manualCompletionPct / 100;

  const isAV =
    !!item.type &&
    (item.type.toLowerCase().includes("video") ||
      item.type.toLowerCase().includes("audio") ||
      item.type.toLowerCase().includes("podcast"));

  if (
    isAV &&
    eng.mediaProgressSeconds != null &&
    eng.mediaDurationSeconds != null &&
    eng.mediaDurationSeconds > 0
  ) {
    // Cap at 0.95 so the item doesn't show "almost done" until the user
    // explicitly marks it read — the auto-mark fires at 95% media position.
    return Math.min(eng.mediaProgressSeconds / eng.mediaDurationSeconds, 0.95);
  }

  const isPdf = !!(
    (item.file_url && /\.pdf(\?|#|$)/i.test(item.file_url)) ||
    (item.url && /\.pdf(\?|#|$)/i.test(item.url))
  );
  if (isPdf && eng.sessionSeconds > 0) {
    // pdfEstSec * 0.95: the hook auto-marks at 95% of estimated reading time,
    // so we normalise against that same threshold to keep scores consistent.
    const pdfEstSec = parseMinutes(item.duration) * 60;
    if (pdfEstSec > 0) return Math.min(eng.sessionSeconds / (pdfEstSec * 0.95), 0.95);
  }

  return 0;
}

/** Returns a 0–100 weighted completion percentage across a list of items. */
export function weightedCompletionPct(
  items: ProgressItem[],
  readSet: Set<string>,
  engagementMap: Map<string, ProgressEngagement>,
): number {
  if (items.length === 0) return 0;
  const score = items.reduce((sum, it) => sum + itemProgressScore(it, readSet, engagementMap), 0);
  return Math.round((score / items.length) * 100);
}
