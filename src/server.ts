import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getAllowedIps, getAuthAllowedIps, getClientIp, getCustomHomeRestrictions, renderBlockedPage } from "./lib/ip-allowlist";

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

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
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
      // Allow the self-service passkey endpoint through the site allowlist
      // so blocked visitors can request access with a shared passkey.
      const isPasskeyEndpoint = pathname === "/api/public/site-passkey";
      let allowed = false;
      try {
        const allowlist = await getAllowedIps();
        allowed = !!ip && allowlist.has(ip);
      } catch (err) {
        console.error("[ip-allowlist] check failed:", err);
      }
      if (!allowed && !isPasskeyEndpoint) {
        return new Response(renderBlockedPage(ip, "site"), {
          status: 403,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      // Additional gate for the login/sign-up page.
      if (pathname === "/auth" || pathname.startsWith("/auth/")) {
        let authAllowed = false;
        try {
          const authList = await getAuthAllowedIps();
          authAllowed = !!ip && authList.has(ip);
        } catch (err) {
          console.error("[auth-ip-allowlist] check failed:", err);
        }
        if (!authAllowed) {
          return new Response(renderBlockedPage(ip, "auth"), {
            status: 403,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
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
            return new Response(renderBlockedPage(ip, "custom-home"), {
              status: 403,
              headers: { "content-type": "text/html; charset=utf-8" },
            });
          }
        } catch (err) {
          console.error("[custom-home-restrictions] check failed:", err);
        }
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
