// Node.js HTTP server wrapper for the TanStack Start fetch handler.
// Used by Render (and any Node.js host) — run with: node server-start.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./dist/server/server.js";

const PORT = process.env.PORT || 3000;

// In-process token-bucket rate limiter (Issue 13 — scalability audit).
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
const CLIENT_DIR = join(fileURLToPath(import.meta.url), "../dist/client");

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
      const filePath = join(CLIENT_DIR, pathname);
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

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
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
  const reader = response.body.getReader();
  const pump = async () => {
    const { done, value } = await reader.read();
    if (done) { res.end(); return; }
    res.write(value, pump);
  };
  pump();
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
