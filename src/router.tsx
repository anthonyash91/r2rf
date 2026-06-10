import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

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
    // 30s preload window: data preloaded on hover is reused if the user
    // navigates within 30 seconds, avoiding redundant refetches on quick
    // back-and-forth navigation while still feeling fresh.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
