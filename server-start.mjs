// Node.js HTTP server wrapper for the TanStack Start fetch handler.
// Used by Render (and any Node.js host) — run with: node server-start.mjs
import { createServer } from "node:http";
import handler from "./dist/server/server.js";

const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
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
