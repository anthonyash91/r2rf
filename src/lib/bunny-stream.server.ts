// Server-only Bunny Stream integration. Never import from client code.
// Unlike Bunny Storage, Stream's TUS upload protocol supports a presigned
// credential computed with pure local SHA256 (no network call) — so uploads
// go straight from the browser to Bunny, same shape as the pre-migration
// Supabase flow. This module only handles the JSON control-plane calls
// (create/delete/status); the actual upload bytes never touch our server.
import { createHash } from "crypto";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing Bunny environment variable: ${name}`);
  return value;
}

// Mirrors bunny-storage.server.ts's hostname sanitization — tolerate an
// accidentally-included scheme or trailing path in the CDN hostname var.
function requiredHostnameEnv(name: string): string {
  const raw = requiredEnv(name).replace(/^https?:\/\//i, "");
  return raw.split("/")[0];
}

function streamLibraryId(): string {
  return requiredEnv("BUNNY_STREAM_LIBRARY_ID");
}
function streamApiKey(): string {
  return requiredEnv("BUNNY_STREAM_API_KEY");
}
export function streamCdnHostname(): string {
  return requiredHostnameEnv("BUNNY_STREAM_CDN_HOSTNAME");
}
export function streamPlaybackUrl(videoId: string): string {
  return `https://${streamCdnHostname()}/${videoId}/playlist.m3u8`;
}

async function bunnyStreamApi(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`https://video.bunnycdn.com/library/${streamLibraryId()}${path}`, {
    ...init,
    headers: {
      AccessKey: streamApiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny Stream API error (${res.status}): ${body}`);
  }
  return res;
}

export async function createStreamCollection(name: string): Promise<string> {
  const res = await bunnyStreamApi("/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const json = (await res.json()) as { guid: string };
  return json.guid;
}

export async function createStreamVideo(
  title: string,
  collectionId?: string | null,
): Promise<string> {
  const body: Record<string, unknown> = { title };
  if (collectionId) body.collectionId = collectionId;
  const res = await bunnyStreamApi("/videos", { method: "POST", body: JSON.stringify(body) });
  const json = (await res.json()) as { guid: string };
  return json.guid;
}

/** Deletes a Stream video. Treats "not found" as success, mirroring deleteFromBunny. */
export async function deleteStreamVideo(videoId: string): Promise<void> {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${streamLibraryId()}/videos/${videoId}`,
    {
      method: "DELETE",
      headers: { AccessKey: streamApiKey() },
    },
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunny Stream delete failed (${res.status}): ${body}`);
  }
}

export type StreamVideoStatus = {
  isFinished: boolean;
  isError: boolean;
  durationSeconds: number | null;
  encodeProgress: number | null;
};

// Bunny's numeric status enum for a video's encoding lifecycle, confirmed
// against a real created-then-uploaded test video's API response:
// 0 Created, 1 Uploaded, 2 Processing, 3 Transcoding, 4 Finished, 5 Error,
// 6 UploadFailed. Only Finished/Error/UploadFailed matter for polling.
const FINISHED_STATUS = 4;
const ERROR_STATUSES = new Set([5, 6]);

export async function getStreamVideoStatus(videoId: string): Promise<StreamVideoStatus> {
  const res = await bunnyStreamApi(`/videos/${videoId}`);
  const json = (await res.json()) as { status?: number; length?: number; encodeProgress?: number };
  return {
    isFinished: json.status === FINISHED_STATUS,
    isError: typeof json.status === "number" && ERROR_STATUSES.has(json.status),
    durationSeconds: typeof json.length === "number" ? json.length : null,
    encodeProgress: typeof json.encodeProgress === "number" ? json.encodeProgress : null,
  };
}

const TUS_EXPIRY_SECONDS = 3600;

/**
 * Computes the TUS upload presigned signature — pure local SHA256, no network
 * call. Per Bunny's docs: SHA256(libraryId + apiKey + expiration + videoId).
 */
export function computeTusSignature(videoId: string): {
  signature: string;
  expiration: number;
  libraryId: string;
} {
  const libraryId = streamLibraryId();
  const apiKey = streamApiKey();
  const expiration = Math.floor(Date.now() / 1000) + TUS_EXPIRY_SECONDS;
  const signature = createHash("sha256")
    .update(`${libraryId}${apiKey}${expiration}${videoId}`)
    .digest("hex");
  return { signature, expiration, libraryId };
}
