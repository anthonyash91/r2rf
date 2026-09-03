import { createFileRoute } from "@tanstack/react-router";

// Visit this URL from a device to confirm whether the app-platform is
// actually attaching siteID/apin — no devtools or server log access needed.
// Not exempt from the IP allowlist (see server.ts): checking from the
// facility device itself should pass it the same way the rest of the site
// does; checking from elsewhere requires the usual temporary allowlist entry.
export const Route = createFileRoute("/api/debug-headers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return new Response(
          JSON.stringify(
            {
              siteID: request.headers.get("siteID"),
              apin: request.headers.get("apin"),
              firstName: request.headers.get("firstName"),
              lastName: request.headers.get("lastName"),
            },
            null,
            2,
          ),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
