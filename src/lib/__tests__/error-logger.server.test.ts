import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logServerError } from "@/lib/error-logger.server";

// Same mocking convention as server-auth.test.ts: vi.hoisted so the mock
// object exists before vi.mock's factory (which is itself hoisted) runs.
const { mockSupabase, insertMock } = vi.hoisted(() => {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    insertMock,
    mockSupabase: { from: vi.fn(() => ({ insert: insertMock })) },
  };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabase,
}));

// lastAlertedAt (the throttle map) is private module state that persists for
// the whole file — each test below uses a unique message/route combination
// so tests can't pollute each other's throttle window, rather than reaching
// into that private state.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  delete process.env.NTFY_TOPIC_URL;
  delete process.env.APP_BASE_URL;
  insertMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("logServerError — error_logs insert", () => {
  it("inserts a server-sourced row with the error's message", async () => {
    await logServerError({ error: new Error("boom"), route: "/api/thing" });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "server", level: "error", message: "boom", route: "/api/thing" }),
    );
  });

  it("falls back to 'Unknown error' for a falsy message", async () => {
    await logServerError({ error: "" });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ message: "Unknown error" }));
  });
});

describe("logServerError — ntfy alert", () => {
  it("does not call fetch when NTFY_TOPIC_URL is unset (alerting is opt-in)", async () => {
    await logServerError({ error: new Error("no topic configured") });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts to NTFY_TOPIC_URL when configured", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    await logServerError({ error: new Error("alert me 1"), route: "/api/a" });
    expect(fetch).toHaveBeenCalledWith(
      "https://ntfy.sh/my-topic",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Title: "Server error", Priority: "high" }),
      }),
    );
    const call = (fetch as any).mock.calls[0][1];
    expect(call.body).toContain("alert me 1");
    expect(call.body).toContain("/api/a");
  });

  it("includes a Click header pointing at /admin/errors when APP_BASE_URL is set", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    process.env.APP_BASE_URL = "https://example.com/";
    await logServerError({ error: new Error("alert me 2") });
    const headers = (fetch as any).mock.calls[0][1].headers;
    expect(headers.Click).toBe("https://example.com/admin/errors");
  });

  it("omits the Click header when APP_BASE_URL is unset", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    await logServerError({ error: new Error("alert me 3") });
    const headers = (fetch as any).mock.calls[0][1].headers;
    expect(headers.Click).toBeUndefined();
  });

  it("throttles a repeat alert for the identical (route, message) pair", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    await logServerError({ error: new Error("repeating error"), route: "/api/repeat" });
    await logServerError({ error: new Error("repeating error"), route: "/api/repeat" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not throttle a different message on the same route", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    await logServerError({ error: new Error("first distinct error"), route: "/api/varied" });
    await logServerError({ error: new Error("second distinct error"), route: "/api/varied" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("still inserts into error_logs even if the alert fetch rejects", async () => {
    process.env.NTFY_TOPIC_URL = "https://ntfy.sh/my-topic";
    (fetch as any).mockRejectedValueOnce(new Error("network down"));
    await expect(
      logServerError({ error: new Error("alert fails but log succeeds"), route: "/api/fail" }),
    ).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalled();
  });
});
