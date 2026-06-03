import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getAllowedIps, getClientIp, getCustomHomeRestrictions, isIpRestrictionEnabled, renderBlockedPage } from "./lib/ip-allowlist";
import { logServerError } from "./lib/error-logger.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Singleton promise so the server entry module is only imported once per
// worker instance — repeated dynamic imports would resolve the same module
// from the module cache but waste microtask overhead on every request.
let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      // server-entry may export its handler as `default` or as the module itself.
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

// Baseline security headers applied to every response leaving the worker.
// CSP intentionally allows inline styles/scripts because the SSR shell and
// some libraries (recharts, sonner) inject them; tighten with nonces in a
// follow-up pass.
const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
  "x-xss-protection": "0",
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' https: blob:",
    "worker-src 'self' blob:",
  ].join("; "),
};


function applySecurityHeaders(response: Response): Response {
  // Clone headers so we don't mutate frozen response headers from upstream.
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function brandedErrorResponse(): Response {
  return applySecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

// Detects the specific JSON shape that h3 emits when an uncaught in-handler
// throw has been swallowed into a generic 500: {"unhandled":true,"message":"HTTPError"}.
// We fingerprint on the exact key set so we don't false-positive on legitimate
// JSON API error responses that happen to be 5xx.
function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response, request: Request): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const captured = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(captured);
  // Best-effort: persist to error_logs so admins can see SSR crashes too.
  void logServerError({
    error: captured,
    route: new URL(request.url).pathname,
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
    context: { kind: "ssr.catastrophic" },
  });
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const ip = getClientIp(request);
      const pathname = new URL(request.url).pathname;

      // Global kill switch: when disabled, bypass all IP checks so admins
      // can temporarily open the site without touching the allowlist.
      let restrictionsEnabled = true;
      try {
        restrictionsEnabled = await isIpRestrictionEnabled();
      } catch (err) {
        // Fail safe: if the toggle check throws, keep restrictions enabled.
        console.error("[ip-restriction-toggle] check failed:", err);
      }
      if (!restrictionsEnabled) {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response, request));
      }

      // Fail closed: if the allowlist fetch throws or returns empty,
      // `allowed` stays false and the request is blocked rather than let through.
      let allowed = false;
      try {
        const allowlist = await getAllowedIps();
        allowed = !!ip && allowlist.has(ip);
      } catch (err) {
        console.error("[ip-allowlist] check failed:", err);
      }
      if (!allowed) {
        return applySecurityHeaders(new Response(renderBlockedPage(ip, "site"), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        }));
      }




      // Per-custom-home-page IP restriction. The slug is the first path segment
      // (TanStack catch-all route `/$customHome`). Only enforce if the slug
      // has a non-empty allowed_ips list.
      const firstSegment = pathname.split("/")[1] ?? "";
      if (firstSegment) {
        try {
          const restrictions = await getCustomHomeRestrictions();
          const allowedForSlug = restrictions.get(firstSegment);
          if (allowedForSlug && (!ip || !allowedForSlug.has(ip))) {
            return applySecurityHeaders(new Response(renderBlockedPage(ip, "custom-home"), {
              status: 403,
              headers: { "content-type": "text/html; charset=utf-8" },
            }));
          }
        } catch (err) {
          console.error("[custom-home-restrictions] check failed:", err);
        }
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response, request));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
