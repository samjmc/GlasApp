import { QueryClient } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** Raise a toast when the query fails. Only for queries with no error state of their own. */
      toastOnError?: boolean;
    };
  }
}

/** Shared React Query client. Every query passes its own `queryFn` (see lib/api.ts). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
