// Node.js HTTP server wrapper for the TanStack Start fetch handler.
// Used by Render (and any Node.js host) — run with: node server-start.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./dist/server/server.js";

const PORT = process.env.PORT || 3000;

// ── Process-level crash handlers (Issue 4) ───────────────────────────────────
// Node 15+ exits on unhandled rejections by default. These handlers ensure
// every crash is logged before exit so Render's log stream captures the cause.
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection:", reason);
  process.exit(1);
});

// ── Request body size limit (Issue 1) ────────────────────────────────────────
// Prevents OOM-crash via a client streaming an arbitrarily large body.
// 10 MB covers any realistic JSON payload; file uploads go directly to Supabase Storage.
const MAX_BODY_BYTES = 10 * 1024 * 1024;

// ── In-process token-bucket rate limiter (Issue 13 — scalability audit).
// Rejects requests before they reach the DB rate-limit RPCs, preventing
// bots from exhausting the Supabase connection pool at the first line of defense.
// Tokens refill at 2/sec; bucket holds 60 tokens (30-second burst capacity).
// Static assets bypass the limiter — they are served before this check.
const RATE_BUCKETS = new Map();
const RATE_REFILL_PER_SEC = 2;
const RATE_MAX_TOKENS = 60;
const RATE_CLEANUP_INTERVAL_MS = 60_000;

function checkRateLimit(ip) {
  if (!ip) return false;
  const now = Date.now();
  let bucket = RATE_BUCKETS.get(ip);
  if (!bucket) {
    bucket = { tokens: RATE_MAX_TOKENS, lastRefill: now };
    RATE_BUCKETS.set(ip, bucket);
  }
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(RATE_MAX_TOKENS, bucket.tokens + elapsed * RATE_REFILL_PER_SEC);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return true; // rate limited
  bucket.tokens -= 1;
  return false;
}

// Periodically evict buckets for IPs that haven't been seen recently to prevent
// unbounded memory growth if many unique IPs hit the server.
setInterval(() => {
  const cutoff = Date.now() - RATE_CLEANUP_INTERVAL_MS;
  for (const [ip, bucket] of RATE_BUCKETS) {
    if (bucket.lastRefill < cutoff) RATE_BUCKETS.delete(ip);
  }
}, RATE_CLEANUP_INTERVAL_MS).unref();
import { resolve } from "node:path";
const CLIENT_DIR = resolve(join(fileURLToPath(import.meta.url), "../dist/client"));

const MIME = {
  ".js":    "application/javascript; charset=utf-8",
  ".css":   "text/css; charset=utf-8",
  ".html":  "text/html; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".svg":   "image/svg+xml",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".ico":   "image/x-icon",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".webp":  "image/webp",
};

const server = createServer(async (req, res) => {
  // Serve client-side static assets directly — the SSR handler has no
  // static file logic, so asset requests would 404 without this.
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname.startsWith("/assets/")) {
    try {
      const filePath = resolve(join(CLIENT_DIR, pathname));
      // Containment guard: verify the resolved path stays inside CLIENT_DIR.
      // URL normalization already strips ../  sequences before this point, but
      // this explicit check is defense-in-depth against any edge case.
      if (!filePath.startsWith(CLIENT_DIR + "/") && filePath !== CLIENT_DIR) {
        res.writeHead(403); res.end(); return;
      }
      const content = await readFile(filePath);
      const ext = extname(filePath);
      const headers = {
        "content-type": MIME[ext] ?? "application/octet-stream",
        // Hashed filenames are immutable — cache aggressively.
        "cache-control": "public, max-age=31536000, immutable",
      };
      res.writeHead(200, headers);
      res.end(content);
      return;
    } catch {
      // Fall through to SSR handler (e.g. /assets/ route that isn't a file).
    }
  }

  // Rate limit check — runs after static assets (which are fast/cheap) but
  // before SSR handler (which triggers DB queries). Static assets already returned above.
  const xff = req.headers["x-forwarded-for"];
  const clientIp = xff ? xff.split(",")[0].trim() : req.socket.remoteAddress;
  if (checkRateLimit(clientIp)) {
    res.writeHead(429, { "content-type": "text/plain", "retry-after": "1" });
    res.end("Too Many Requests");
    return;
  }

  const protocol = req.headers["x-forwarded-proto"] ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }

  // Issue 3: refuse new requests while draining after SIGTERM
  if (isShuttingDown) {
    res.writeHead(503, { "content-type": "text/plain", "connection": "close" });
    res.end("Service Unavailable");
    return;
  }

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        res.writeHead(413, { "content-type": "text/plain" });
        res.end("Payload Too Large");
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }
    if (chunks.length) body = Buffer.concat(chunks);
  }

  let response;
  try {
    response = await handler.fetch(new Request(url, { method: req.method, headers, body }));
  } catch (err) {
    console.error("[server] handler threw:", err);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
    return;
  }

  res.statusCode = response.status;
  for (const [key, value] of response.headers.entries()) res.setHeader(key, value);

  if (!response.body) { res.end(); return; }
  // Issue 2: proper streaming with error handling on both the reader and the socket.
  // The old recursive callback approach had no error handler — a client disconnect
  // or SSR stream failure would throw an unhandled rejection and crash the process.
  const reader = response.body.getReader();
  res.on("error", () => reader.cancel().catch(() => {}));
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        // Respect backpressure: pause reading if the socket buffer is full.
        if (!res.write(value)) {
          await new Promise((resolve) => res.once("drain", resolve));
        }
      }
    } catch (err) {
      console.error("[server] stream error:", err);
      if (!res.writableEnded) res.destroy();
    }
  })();
});

// ── Graceful shutdown on SIGTERM (Issue 3) ───────────────────────────────────
// Render sends SIGTERM when deploying a new version. Without this handler,
// the process exits immediately and drops every in-flight request.
// server.close() stops accepting new connections and waits for existing ones
// to finish. closeAllConnections() immediately closes idle keep-alive sockets
// so the drain completes quickly. A 10s hard timeout ensures the old process
// always exits even if a long-running request is stuck.
let isShuttingDown = false;
process.on("SIGTERM", () => {
  isShuttingDown = true;
  console.log("[server] SIGTERM received — draining connections");
  server.closeAllConnections();
  server.close(() => {
    console.log("[server] graceful shutdown complete");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[server] forced shutdown after 10s timeout");
    process.exit(1);
  }, 10_000).unref();
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
