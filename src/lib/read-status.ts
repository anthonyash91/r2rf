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

function detectMediaFor(item: {
  url?: string | null;
  file_url?: string | null;
}): MediaKind | null {
  // file_url takes priority: an uploaded file is more authoritative than a
  // linked URL, which may point to a landing page rather than the media itself.
  return detectMedia(item.file_url) ?? detectMedia(item.url);
}

export function readStatusLabels(
  t: (key: string) => string,
  item: { url?: string | null; file_url?: string | null },
): { read: string; unread: string } {
  const kind = detectMediaFor(item);
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
