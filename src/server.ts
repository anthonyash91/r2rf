import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getAllowedIps, getBlockedIps, getClientIp, getCustomHomeRestrictions, isIpRestrictionEnabled, renderBlockedPage } from "./lib/ip-allowlist";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
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
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin",
  "x-xss-protection": "0",
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
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
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const ip = getClientIp(request);
      const pathname = new URL(request.url).pathname;

      // Permanent blocklist always applies, even when IP restrictions are off.
      let isBlocked = false;
      try {
        const blocked = await getBlockedIps();
        isBlocked = !!ip && blocked.has(ip);
      } catch (err) {
        console.error("[ip-blocklist] check failed:", err);
      }
      if (isBlocked) {
        return applySecurityHeaders(new Response(renderBlockedPage(ip, "permanent"), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        }));
      }

      // Global kill switch: when disabled, skip all other IP-based restrictions.
      let restrictionsEnabled = true;
      try {
        restrictionsEnabled = await isIpRestrictionEnabled();
      } catch (err) {
        console.error("[ip-restriction-toggle] check failed:", err);
      }
      if (!restrictionsEnabled) {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
      }

      // Allow the self-service passkey endpoint through the site allowlist
      // so blocked visitors can request access with a shared passkey.
      const isPasskeyEndpoint = pathname === "/api/public/site-passkey";
      // A successful passkey unlock sets this cookie so the immediate reload
      // works even if the new request lands on a different worker isolate
      // (whose in-memory allowlist cache hasn't been invalidated yet) or
      // before the freshly inserted row is visible.
      const hasPasskeyCookie = (request.headers.get("cookie") ?? "")
        .split(";")
        .some((c) => c.trim().startsWith("site_passkey_ok="));


      let allowed = false;
      try {
        const allowlist = await getAllowedIps();
        allowed = !!ip && allowlist.has(ip);
      } catch (err) {
        console.error("[ip-allowlist] check failed:", err);
      }
      if (!allowed && !isPasskeyEndpoint && !hasPasskeyCookie) {
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
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
