import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Plain-string search serialization: avoids TanStack Router's default
// JSON encoding which wraps string values in quotes (e.g. "3325" → %223325%22).
// All search params in this app are simple strings so JSON encoding is unnecessary.
function parseSearch(search: string): Record<string, unknown> {
  const params = new URLSearchParams(search);
  const result: Record<string, unknown> = {};
  params.forEach((value, key) => { result[key] = value; });
  return result;
}

function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Treat data as fresh for 2 minutes — prevents refetching on every tab
        // focus or component remount, which is the React Query default behaviour.
        staleTime: 2 * 60 * 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
    parseSearch,
    stringifySearch,
  });

  return router;
};
