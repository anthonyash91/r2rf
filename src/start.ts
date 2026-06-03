import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

// Server-side error boundary for route handlers. Re-throws h3 routing errors
// (those with statusCode) so redirects and 404s still propagate correctly;
// all other unhandled throws are caught and returned as the branded 500 page.
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  // requestMiddleware: runs around every HTTP request, server-side only.
  requestMiddleware: [errorMiddleware],
  // functionMiddleware: runs around every server function call, including on
  // the client side. attachSupabaseAuth forwards the session bearer token into
  // the Authorization header that requireSupabaseAuth reads on the server.
  functionMiddleware: [attachSupabaseAuth],
}));
