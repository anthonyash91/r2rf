// Provider-agnostic storage URL parsing — isomorphic (client + server).
//
// Used client-side to detect whether an existing content URL is one of our
// managed files (safe to queue for deletion when replaced) vs. some other
// external URL (e.g. an admin-entered YouTube link) that must not be touched.
// Used server-side by deleteStorageFile, which re-derives the provider from
// the URL itself rather than trusting a client-asserted value.
//
// During the Supabase → Bunny migration both patterns are recognized so
// deleting/replacing a not-yet-migrated (still-Supabase) item keeps working
// unchanged. The Supabase branch can be removed once migration is complete
// and no content_items/content_chapters rows reference Supabase URLs anymore.

const BUCKET = "content-files";

// Read lazily (not as frozen module-level consts) so this stays testable and
// tolerant of env vars not being available yet at module-evaluation time.
function supabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
}
// Meant to be a bare hostname (e.g. "example.b-cdn.net") — strip an
// accidentally-included "https://" scheme or trailing path, same as the
// server-side equivalent in bunny-storage.server.ts.
function bunnyCdnHostname(): string | undefined {
  const raw = import.meta.env.VITE_BUNNY_CDN_HOSTNAME || process.env.BUNNY_CDN_HOSTNAME;
  return raw ? raw.replace(/^https?:\/\//i, "").split("/")[0] : raw;
}

function bunnyStreamCdnHostname(): string | undefined {
  const raw =
    import.meta.env.VITE_BUNNY_STREAM_CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  return raw ? raw.replace(/^https?:\/\//i, "").split("/")[0] : raw;
}

/** True if url is a Bunny Stream HLS playlist URL — used both for provider
 * detection here and for kind-detection/player wiring elsewhere, since a
 * Stream URL has no file extension to match against. */
export function isStreamPlaybackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const host = bunnyStreamCdnHostname();
  if (!host) return false;
  return url.startsWith(`https://${host}/`) && /\/playlist\.m3u8(\?|#|$)/.test(url);
}

export type StorageRef =
  | { provider: "supabase" | "bunny"; path: string }
  | { provider: "bunny-stream"; videoId: string };

export function extractStorageRef(url: string): StorageRef | null {
  if (!url) return null;

  const supaUrl = supabaseUrl();
  if (supaUrl && url.startsWith(supaUrl)) {
    const match = url.match(new RegExp(`/object/public/${BUCKET}/(.+)$`));
    if (match) return { provider: "supabase", path: decodeURIComponent(match[1]) };
  }

  const cdnHost = bunnyCdnHostname();
  if (cdnHost) {
    const prefix = `https://${cdnHost}/`;
    if (url.startsWith(prefix)) {
      return { provider: "bunny", path: decodeURIComponent(url.slice(prefix.length)) };
    }
  }

  if (isStreamPlaybackUrl(url)) {
    const streamHost = bunnyStreamCdnHostname()!;
    const match = url.match(
      new RegExp(`^https://${streamHost.replace(/\./g, "\\.")}/([^/]+)/playlist\\.m3u8`),
    );
    if (match) return { provider: "bunny-stream", videoId: decodeURIComponent(match[1]) };
  }

  return null;
}
