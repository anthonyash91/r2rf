export function extOf(url: string, name: string | null): string {
  const src = (name ?? url).toLowerCase().split("?")[0].split("#")[0];
  const m = src.match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "";
}

export const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "webm",
  "opus",
]);
export const VIDEO_EXT = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v"]);

export function mediaKindFor(
  type: string,
  url: string,
  name: string | null,
): "audio" | "video" | null {
  const ext = extOf(url, name);
  if (AUDIO_EXT.has(ext)) return "audio";
  if (VIDEO_EXT.has(ext)) return "video";
  const t = type.toLowerCase();
  if (t.includes("podcast") || t.includes("audio")) return "audio";
  if (t.includes("video")) return "video";
  return null;
}

const STREAM_VIDEO_ID_RE =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/playlist\.m3u8/i;

/**
 * Pulls the Bunny Stream video id out of a stored playback URL
 * (".../{videoId}/playlist.m3u8"). Returns null for anything else, e.g. a
 * direct (non-Stream) file URL or a PDF.
 */
export function extractStreamVideoId(url: string): string | null {
  return url.match(STREAM_VIDEO_ID_RE)?.[1] ?? null;
}
