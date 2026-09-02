import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type PlatformIdentity = { facilityId: string | null; residentId: string | null };

// Reads the app-platform's identity headers off the CURRENT request. Used
// from a route `loader`, which runs this server-side against the real
// page-navigation request on the initial load (same request category
// /api/debug-headers uses) and client-side (with nothing to read) on
// subsequent SPA navigations — falling back to whatever's already cached in
// sessionStorage from that initial load is fine, and expected.
//
// This must NOT be read via a client-triggered serverFn/RPC call: the
// platform (and most "inject a header" mechanisms generally, including some
// browser header-override extensions by default) attaches these headers to
// the top-level navigation only, not to follow-up fetch/XHR calls the page's
// own JS fires afterward — so an RPC-based read can silently come back empty
// even though the page itself has the headers.
export const readPlatformIdentity = createIsomorphicFn()
  .server((): PlatformIdentity => {
    const request = getRequest();
    return {
      facilityId: request?.headers.get("x-facility-id") || null,
      residentId: request?.headers.get("x-resident-id") || null,
    };
  })
  .client((): PlatformIdentity => ({ facilityId: null, residentId: null }));
