import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  bunnyObjectUrl,
  bunnyPublicUrl,
  bunnyCdnHostname,
  streamUploadToBunny,
} from "@/lib/bunny-storage.server";

const ZONE = "test-zone";
const ENDPOINT = "storage.bunnycdn.com";
const API_KEY = "test-access-key";
const CDN_HOST = "test.b-cdn.net";

beforeEach(() => {
  vi.stubEnv("BUNNY_STORAGE_ZONE", ZONE);
  vi.stubEnv("BUNNY_STORAGE_ENDPOINT", ENDPOINT);
  vi.stubEnv("BUNNY_STORAGE_API_KEY", API_KEY);
  vi.stubEnv("BUNNY_CDN_HOSTNAME", CDN_HOST);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bunnyObjectUrl / bunnyPublicUrl / bunnyCdnHostname", () => {
  it("builds the storage API URL from configured zone + endpoint", () => {
    expect(bunnyObjectUrl("uploads/foo.mp4")).toBe(`https://${ENDPOINT}/${ZONE}/uploads/foo.mp4`);
  });

  it("builds the public CDN URL from the configured hostname", () => {
    expect(bunnyPublicUrl("uploads/foo.mp4")).toBe(`https://${CDN_HOST}/uploads/foo.mp4`);
  });

  it("throws a clear error naming the missing var when unconfigured", () => {
    vi.stubEnv("BUNNY_CDN_HOSTNAME", "");
    expect(() => bunnyCdnHostname()).toThrow("BUNNY_CDN_HOSTNAME");
  });
});

// ---------------------------------------------------------------------------
// streamUploadToBunny — byte-counting / abort behavior.
//
// The mock fetch actively drains init.body (as a real fetch upload would),
// so the TransformStream's byte-counting logic actually runs during the test
// rather than sitting idle because nothing pulled from the stream.
// ---------------------------------------------------------------------------

function drainingFetchMock() {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const reader = (init.body as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
    return new Response(null, { status: 201 });
  });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function requestWithBody(
  body: ReadableStream<Uint8Array>,
  headers?: Record<string, string>,
): Request {
  return new Request("http://localhost/api/uploads/content-file", {
    method: "PUT",
    body,
    headers,
    // @ts-expect-error duplex is required by undici for streamed bodies
    duplex: "half",
  });
}

describe("streamUploadToBunny", () => {
  it("uploads successfully when under the byte limit", async () => {
    const mockFetch = drainingFetchMock();
    vi.stubGlobal("fetch", mockFetch);

    const req = requestWithBody(streamOf([new Uint8Array(4), new Uint8Array(4)]));
    const total = await streamUploadToBunny("uploads/small.bin", req, 100);

    expect(total).toBe(8);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe(bunnyObjectUrl("uploads/small.bin"));
    expect((mockFetch.mock.calls[0][1] as RequestInit & { method: string }).method).toBe("PUT");
  });

  it("aborts mid-stream and cleans up when real byte count exceeds maxBytes", async () => {
    const mockFetch = drainingFetchMock();
    vi.stubGlobal("fetch", mockFetch);

    // Two 8-byte chunks (16 bytes total) against a 10-byte limit — the limit
    // is only crossed once real bytes have flowed, not from a header alone.
    const req = requestWithBody(streamOf([new Uint8Array(8), new Uint8Array(8)]));

    await expect(streamUploadToBunny("uploads/big.bin", req, 10)).rejects.toThrow(
      /exceeds the 0 MB limit|exceeds the/,
    );

    // The PUT attempt (which observed the abort) plus a cleanup DELETE.
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect((mockFetch.mock.calls[1][1] as RequestInit & { method: string }).method).toBe("DELETE");
  });

  it("rejects immediately from a declared Content-Length over the limit, without calling fetch", async () => {
    const mockFetch = drainingFetchMock();
    vi.stubGlobal("fetch", mockFetch);

    const req = requestWithBody(streamOf([new Uint8Array(4)]), { "content-length": "999999" });

    await expect(streamUploadToBunny("uploads/big.bin", req, 10)).rejects.toThrow(/exceeds the/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
