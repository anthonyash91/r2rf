import { Upload } from "tus-js-client";
import { createStreamUploadSession, getStreamUploadStatus } from "@/lib/bunny-stream.functions";

// 6s (not 3s): halves our own server-side polling volume. The UI shows an
// indeterminate bar during processing (Bunny's encodeProgress jumps too
// unevenly to drive a literal fill), so there's no UX cost to polling less
// often.
const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // generous — video transcoding can be slow
// A poll request failing (network blip, or our own server's rate limiter
// during a big batch upload) doesn't mean the video failed — Bunny is still
// processing it regardless of whether WE could check in. Only give up after
// several consecutive failures; a lone hiccup just retries next tick.
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

/**
 * Polls a Stream video's processing status until it's finished (or errors/
 * times out), returning Bunny's own reported duration. Shared by
 * StreamUploader.tsx and the chapter batch uploader in admin.category.$id.tsx
 * so there's one polling/timeout implementation, not two.
 */
export function waitForStreamProcessing(
  videoId: string,
  onProgress?: (encodePct: number) => void,
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let consecutiveErrors = 0;
    const timer: ReturnType<typeof setInterval> = setInterval(async () => {
      try {
        const status = await getStreamUploadStatus({ data: { videoId } });
        consecutiveErrors = 0;
        if (typeof status.encodeProgress === "number") onProgress?.(status.encodeProgress);
        if (status.isFinished) {
          clearInterval(timer);
          resolve(status.durationSeconds);
          return;
        }
        if (status.isError) {
          clearInterval(timer);
          reject(new Error("Video processing failed."));
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          clearInterval(timer);
          reject(new Error("Video processing timed out — check the Bunny dashboard."));
        }
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          clearInterval(timer);
          reject(err);
        }
        // else: transient — swallow and retry on the next tick
      }
    }, POLL_INTERVAL_MS);
  });
}

type StreamUploadSession = Awaited<ReturnType<typeof createStreamUploadSession>>;

/**
 * Creates the Stream video (and, lazily, its collection) and returns the
 * presigned credential needed to drive the TUS upload — a small, fast JSON
 * round trip with no file bytes involved. Split out from the actual byte
 * transfer (runTusUpload) so a caller uploading several files can create
 * every session up front, sequentially (so only the very first call can ever
 * need to lazily create the shared collection — every later call already has
 * its id, instead of racing to each create a duplicate), then run the slow
 * part — the transfer and transcode wait — for all of them in parallel.
 */
export async function beginStreamUpload(opts: {
  title: string;
  collectionId: string | null;
  collectionName: string;
  onCollectionCreated?: (collectionId: string) => void;
}): Promise<StreamUploadSession> {
  const session = await createStreamUploadSession({
    data: {
      title: opts.title,
      collectionId: opts.collectionId,
      collectionName: opts.collectionId ? undefined : opts.collectionName,
    },
  });
  if (!opts.collectionId && session.collectionId) {
    opts.onCollectionCreated?.(session.collectionId);
  }
  return session;
}

/** Drives the actual TUS byte transfer for an already-created session. */
export function runTusUpload(
  file: File,
  session: StreamUploadSession,
  onProgress?: (pct: number) => void,
): Promise<{ videoId: string; playbackUrl: string }> {
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: session.uploadEndpoint,
      retryDelays: [0, 1000, 3000, 5000],
      // Every session is brand new, so there's never anything valid to
      // resume. Without this, tus-js-client's default localStorage
      // fingerprint cache (keyed by name/size/type) can match an unrelated
      // earlier attempt with the same filename and try to resume its now-dead
      // upload URL — which fails against the new signature and silently
      // drops that file during a multi-file batch.
      storeFingerprintForResuming: false,
      headers: {
        AuthorizationSignature: session.signature,
        AuthorizationExpire: String(session.expiration),
        VideoId: session.videoId,
        LibraryId: session.libraryId,
      },
      metadata: {
        filetype: file.type || "application/octet-stream",
        title: file.name,
      },
      onError: reject,
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => resolve({ videoId: session.videoId, playbackUrl: session.playbackUrl }),
    });
    upload.start();
  });
}

/**
 * Uploads a video/audio file directly to Bunny Stream via the TUS resumable
 * protocol. Unlike src/lib/upload-client.ts's content-file flow, the bytes
 * never pass through our server — createStreamUploadSession only issues a
 * presigned credential, then tus-js-client drives the upload straight to
 * Bunny from the browser. Thin wrapper over beginStreamUpload + runTusUpload
 * for the single-file case (StreamUploader.tsx); the batch chapter uploader
 * in admin.category.$id.tsx calls the two halves separately instead.
 */
export async function uploadFileToStream(opts: {
  file: File;
  /** Title for this individual Stream video (e.g. "Lesson — Chapter 3"). */
  title: string;
  /** Pass the item's already-created collection id to reuse it; omit (null) to create one. */
  collectionId: string | null;
  /** Name for the collection itself — the overall content item's title, stable
   * regardless of which specific file happens to upload first. Deliberately
   * kept separate from `title` (which includes the chapter name) so the
   * collection doesn't end up named after whichever chapter uploaded first. */
  collectionName: string;
  onCollectionCreated?: (collectionId: string) => void;
  /** Fires as soon as the video id (and therefore its deterministic playback
   * URL) exists — right after session creation, before any bytes upload.
   * Lets the caller populate the URL field immediately instead of waiting
   * for the TUS upload and transcoding to finish. */
  onUrlAvailable?: (videoId: string, playbackUrl: string) => void;
  onProgress?: (pct: number) => void;
}): Promise<{ videoId: string; playbackUrl: string }> {
  const session = await beginStreamUpload(opts);
  opts.onUrlAvailable?.(session.videoId, session.playbackUrl);
  return runTusUpload(opts.file, session, opts.onProgress);
}
