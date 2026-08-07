import type { TranslationKey } from "@/lib/i18n";
import { isStreamPlaybackUrl } from "@/lib/storage-url";

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|oga|opus)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|heic|heif)(\?|#|$)/i;

export type MediaKind = "video" | "audio" | "pdf" | "image";

export function detectMedia(url: string | null | undefined): MediaKind | null {
  if (!url) return null;
  if (VIDEO_EXT.test(url)) return "video";
  if (AUDIO_EXT.test(url)) return "audio";
  if (PDF_EXT.test(url)) return "pdf";
  if (IMAGE_EXT.test(url)) return "image";
  return null;
}

/** type → "video" | "audio" | null, for content with no matchable file
 * extension — chapter-only items with no URL on the item itself, and Bunny
 * Stream URLs (a `.m3u8` playlist has no extension to match at all). */
export function mediaKindFromType(type: string | null | undefined): "video" | "audio" | null {
  const tl = (type ?? "").toLowerCase();
  if (tl.includes("video")) return "video";
  if (tl.includes("audio") || tl.includes("podcast")) return "audio";
  return null;
}

export function detectMediaFor(item: {
  url?: string | null;
  file_url?: string | null;
  type?: string | null;
}): MediaKind | null {
  // file_url takes priority: an uploaded file is more authoritative than a
  // linked URL, which may point to a landing page rather than the media itself.
  const direct = detectMedia(item.file_url) ?? detectMedia(item.url);
  if (direct) return direct;
  // Bunny Stream URLs (.../playlist.m3u8) have no extension to match — fall
  // back to the item's type, the same signal content-progress.ts's isAV
  // check already trusts.
  if (isStreamPlaybackUrl(item.file_url) || isStreamPlaybackUrl(item.url)) {
    return mediaKindFromType(item.type);
  }
  return null;
}

export function readStatusLabels(
  t: (key: TranslationKey) => string,
  item: { url?: string | null; file_url?: string | null; type?: string | null },
): { read: string; unread: string } {
  // Detect from URL/file first; fall back to item type for chapter-only audio
  // items that have no URL on the item itself (URLs live on the chapters).
  const kind = detectMediaFor(item) ?? mediaKindFromType(item.type);
  if (kind === "video") {
    return { read: t("category.markedWatched"), unread: t("category.notWatched") };
  }
  if (kind === "audio") {
    return { read: t("category.markedListened"), unread: t("category.notListened") };
  }
  if (kind === "image") {
    return { read: t("category.markedViewed"), unread: t("category.notViewed") };
  }
  if (!kind && item.url) {
    return { read: t("category.markedClicked"), unread: t("category.notClicked") };
  }
  return { read: t("category.markedRead"), unread: t("category.notRead") };
}
