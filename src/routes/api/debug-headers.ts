import { createFileRoute } from "@tanstack/react-router";

// Visit this URL from a device to confirm whether the app-platform is
// actually attaching x-facility-id/x-resident-id — no devtools or server
// log access needed. Not exempt from the IP allowlist (see server.ts):
// checking from the facility device itself should pass it the same way the
// rest of the site does; checking from elsewhere requires the usual
// temporary allowlist entry.
export const Route = createFileRoute("/api/debug-headers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(
          JSON.stringify({
            "x-facility-id": request.headers.get("x-facility-id"),
            "x-resident-id": request.headers.get("x-resident-id"),
          }, null, 2),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
