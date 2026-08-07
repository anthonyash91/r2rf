import { useEffect } from "react";
import { isStreamPlaybackUrl } from "@/lib/storage-url";

/**
 * Sets a <video>/<audio> element's source, transparently handling Bunny
 * Stream HLS playlists via hls.js where needed. For a direct file URL
 * (the existing Bunny Storage / Supabase / external-link case), this is
 * just `el.src = url`, unchanged. Safari has native HLS support and needs
 * no library either way.
 *
 * use-content-engagement.ts needs no changes to work with this — it only
 * reads/writes standard HTMLMediaElement properties (currentTime, duration,
 * paused) and already waits on loadedmetadata/readyState, which fire
 * identically whether hls.js or a plain `src` is driving playback.
 */
export function useHlsSource(el: HTMLMediaElement | null, url: string | null | undefined): void {
  useEffect(() => {
    if (!el || !url) return;

    if (!isStreamPlaybackUrl(url)) {
      el.src = url;
      return;
    }

    // Safari (and any browser with native HLS support) needs no library.
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = url;
      return;
    }

    let hls: import("hls.js").default | null = null;
    let cancelled = false;

    // Dynamic import keeps hls.js out of the main bundle — most content
    // stays on the direct-file Storage flow and never needs it.
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        el.src = url; // last-resort fallback on very old browsers
        return;
      }
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(el);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [el, url]);
}
