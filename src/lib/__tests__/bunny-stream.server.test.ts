import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  streamPlaybackUrl,
  streamCdnHostname,
  createStreamCollection,
  createStreamVideo,
  deleteStreamVideo,
  getStreamVideoStatus,
  computeTusSignature,
} from "@/lib/bunny-stream.server";

const LIBRARY_ID = "12345";
const API_KEY = "test-api-key";
const CDN_HOST = "vz-example.b-cdn.net";

beforeEach(() => {
  vi.stubEnv("BUNNY_STREAM_LIBRARY_ID", LIBRARY_ID);
  vi.stubEnv("BUNNY_STREAM_API_KEY", API_KEY);
  vi.stubEnv("BUNNY_STREAM_CDN_HOSTNAME", CDN_HOST);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("streamPlaybackUrl / streamCdnHostname", () => {
  it("builds the playback URL from the configured CDN hostname", () => {
    expect(streamPlaybackUrl("abc-123")).toBe(`https://${CDN_HOST}/abc-123/playlist.m3u8`);
  });

  it("throws a clear error naming the missing var when unconfigured", () => {
    vi.stubEnv("BUNNY_STREAM_CDN_HOSTNAME", "");
    expect(() => streamCdnHostname()).toThrow("BUNNY_STREAM_CDN_HOSTNAME");
  });
});

describe("computeTusSignature", () => {
  it("matches the known-good vector: SHA256(libraryId + apiKey + expiration + videoId)", () => {
    vi.setSystemTime(new Date(1699996400 * 1000)); // so Date.now()+3600 = 1700000000
    const { signature, expiration, libraryId } = computeTusSignature("abc-123-def");
    expect(expiration).toBe(1700000000);
    expect(libraryId).toBe(LIBRARY_ID);
    expect(signature).toBe("80b420115c7746cca8045210b20bc30bc0f48cb14afc3c2b44f1bf98d10d7d28");
    vi.useRealTimers();
  });
});

function mockFetchOnce(body: unknown, status = 200) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("createStreamCollection", () => {
  it("POSTs to /collections and returns the guid", async () => {
    const fn = mockFetchOnce({ guid: "col-1" });
    const id = await createStreamCollection("My Item");
    expect(id).toBe("col-1");
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`https://video.bunnycdn.com/library/${LIBRARY_ID}/collections`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ AccessKey: API_KEY });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "My Item" });
  });
});

describe("createStreamVideo", () => {
  it("POSTs to /videos with title only when no collection given", async () => {
    const fn = mockFetchOnce({ guid: "vid-1" });
    const id = await createStreamVideo("My Item");
    expect(id).toBe("vid-1");
    const [, init] = fn.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ title: "My Item" });
  });

  it("includes collectionId when provided", async () => {
    const fn = mockFetchOnce({ guid: "vid-2" });
    await createStreamVideo("My Item", "col-1");
    const [, init] = fn.mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      title: "My Item",
      collectionId: "col-1",
    });
  });

  it("throws with the response body on a non-ok status", async () => {
    mockFetchOnce({ Message: "bad request" }, 400);
    await expect(createStreamVideo("x")).rejects.toThrow(/400/);
  });
});

describe("deleteStreamVideo", () => {
  it("DELETEs the video and resolves on success", async () => {
    const fn = mockFetchOnce(null, 200);
    await expect(deleteStreamVideo("vid-1")).resolves.toBeUndefined();
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(`https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/vid-1`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("treats 404 as success", async () => {
    mockFetchOnce(null, 404);
    await expect(deleteStreamVideo("missing")).resolves.toBeUndefined();
  });

  it("throws on other error statuses", async () => {
    mockFetchOnce(null, 500);
    await expect(deleteStreamVideo("vid-1")).rejects.toThrow(/500/);
  });
});

describe("getStreamVideoStatus", () => {
  it("maps status 4 to isFinished with duration and encode progress", async () => {
    mockFetchOnce({ status: 4, length: 125, encodeProgress: 100 });
    const result = await getStreamVideoStatus("vid-1");
    expect(result).toEqual({
      isFinished: true,
      isError: false,
      durationSeconds: 125,
      encodeProgress: 100,
    });
  });

  it("maps status 2 (Processing) to neither finished nor error", async () => {
    mockFetchOnce({ status: 2, length: 0, encodeProgress: 40 });
    const result = await getStreamVideoStatus("vid-1");
    expect(result.isFinished).toBe(false);
    expect(result.isError).toBe(false);
    expect(result.encodeProgress).toBe(40);
  });

  it("maps status 5 and 6 to isError", async () => {
    mockFetchOnce({ status: 5 });
    expect((await getStreamVideoStatus("vid-1")).isError).toBe(true);
    mockFetchOnce({ status: 6 });
    expect((await getStreamVideoStatus("vid-1")).isError).toBe(true);
  });
});
