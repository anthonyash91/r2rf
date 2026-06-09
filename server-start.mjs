// Node.js HTTP server wrapper for the TanStack Start fetch handler.
// Used by Render (and any Node.js host) — run with: node server-start.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "./dist/server/server.js";

const PORT = process.env.PORT || 3000;
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
