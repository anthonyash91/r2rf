import { describe, it, expect, afterEach, vi } from "vitest";
import { extractStorageRef, isStreamPlaybackUrl } from "@/lib/storage-url";

const SUPABASE_URL = "https://example.supabase.co";
const BUNNY_CDN_HOSTNAME = "example.b-cdn.net";
const BUNNY_STREAM_CDN_HOSTNAME = "vz-example.b-cdn.net";

// Stub both the unprefixed (SSR/process.env) and VITE_-prefixed (client
// build-time) names — the real project .env already sets VITE_SUPABASE_URL,
// which would otherwise win over an unprefixed-only stub via the `||` fallback.
function stubBothProviders() {
  vi.stubEnv("SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("VITE_SUPABASE_URL", SUPABASE_URL);
  vi.stubEnv("BUNNY_CDN_HOSTNAME", BUNNY_CDN_HOSTNAME);
  vi.stubEnv("VITE_BUNNY_CDN_HOSTNAME", BUNNY_CDN_HOSTNAME);
  vi.stubEnv("BUNNY_STREAM_CDN_HOSTNAME", BUNNY_STREAM_CDN_HOSTNAME);
  vi.stubEnv("VITE_BUNNY_STREAM_CDN_HOSTNAME", BUNNY_STREAM_CDN_HOSTNAME);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extractStorageRef", () => {
  it("extracts a Supabase-hosted path", () => {
    stubBothProviders();
    const url = `${SUPABASE_URL}/storage/v1/object/public/content-files/uploads/123-video.mp4`;
    expect(extractStorageRef(url)).toEqual({ provider: "supabase", path: "uploads/123-video.mp4" });
  });

  it("extracts a Bunny-hosted path", () => {
    stubBothProviders();
    const url = `https://${BUNNY_CDN_HOSTNAME}/uploads/123-video.mp4`;
    expect(extractStorageRef(url)).toEqual({ provider: "bunny", path: "uploads/123-video.mp4" });
  });

  it("decodes URL-encoded path segments", () => {
    stubBothProviders();
    const url = `https://${BUNNY_CDN_HOSTNAME}/uploads/my%20file.mp4`;
    expect(extractStorageRef(url)).toEqual({ provider: "bunny", path: "uploads/my file.mp4" });
  });

  it("returns null for an external URL that matches neither provider", () => {
    stubBothProviders();
    expect(extractStorageRef("https://youtube.com/watch?v=abc123")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractStorageRef("")).toBeNull();
  });

  it("returns null when neither provider is configured", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("BUNNY_CDN_HOSTNAME", "");
    vi.stubEnv("VITE_BUNNY_CDN_HOSTNAME", "");
    expect(extractStorageRef("https://example.com/foo.mp4")).toBeNull();
  });

  it("does not match a Bunny URL against the Supabase branch", () => {
    stubBothProviders();
    const url = `https://${BUNNY_CDN_HOSTNAME}/qa-screenshots/run-1/1.1/123.png`;
    const ref = extractStorageRef(url);
    expect(ref?.provider).toBe("bunny");
    expect(ref && "path" in ref ? ref.path : null).toBe("qa-screenshots/run-1/1.1/123.png");
  });

  it("extracts a videoId from a well-formed Bunny Stream playlist URL", () => {
    stubBothProviders();
    const url = `https://${BUNNY_STREAM_CDN_HOSTNAME}/abc-123-def/playlist.m3u8`;
    const ref = extractStorageRef(url);
    expect(ref).toEqual({ provider: "bunny-stream", videoId: "abc-123-def" });
  });

  it("returns null for a Stream-CDN-hosted URL missing the playlist.m3u8 suffix", () => {
    stubBothProviders();
    const url = `https://${BUNNY_STREAM_CDN_HOSTNAME}/abc-123-def/thumbnail.jpg`;
    expect(extractStorageRef(url)).toBeNull();
  });

  it("returns null for a Stream URL when the provider isn't configured", () => {
    vi.stubEnv("BUNNY_STREAM_CDN_HOSTNAME", "");
    vi.stubEnv("VITE_BUNNY_STREAM_CDN_HOSTNAME", "");
    expect(
      extractStorageRef(`https://${BUNNY_STREAM_CDN_HOSTNAME}/abc-123-def/playlist.m3u8`),
    ).toBeNull();
  });
});

describe("isStreamPlaybackUrl", () => {
  it("returns true for a well-formed playlist URL", () => {
    stubBothProviders();
    expect(isStreamPlaybackUrl(`https://${BUNNY_STREAM_CDN_HOSTNAME}/abc-123/playlist.m3u8`)).toBe(
      true,
    );
  });

  it("returns false for a non-Stream URL", () => {
    stubBothProviders();
    expect(isStreamPlaybackUrl(`https://${BUNNY_CDN_HOSTNAME}/uploads/foo.mp4`)).toBe(false);
  });

  it("returns false for null/empty input", () => {
    expect(isStreamPlaybackUrl(null)).toBe(false);
    expect(isStreamPlaybackUrl("")).toBe(false);
  });
});
