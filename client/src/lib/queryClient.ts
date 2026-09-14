import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Get the current Supabase session's access token.
 *
 * The Supabase client is configured with a custom `storageKey`
 * ("glas-politics-auth"), so the session must be read through the client
 * rather than a hard-coded localStorage key. Going through
 * `supabase.auth.getSession()` also lets Supabase refresh an expired token
 * before it is attached to an API request.
 *
 * @returns The bearer token, or null when no session exists.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch (error) {
    console.debug("Error reading bearer token:", error);
    return null;
  }
}

type ApiRequestOptions = {
  method: string;
  path: string;
  body?: unknown;
  on401?: "returnNull" | "throw";
};

/**
 * Make an API request with automatic bearer token attachment
 *
 * This function:
 * 1. Gets the Supabase JWT token from the current session
 * 2. Attaches it as Authorization: Bearer header
 * 3. Sends the request (with session credentials)
 *
 * Without the bearer token, the server will return 401 Unauthorized.
 *
 * @param options - { method, path, body, on401 }
 * @returns Parsed JSON response
 * @throws If response is not ok (unless on401="returnNull")
 */
export async function apiRequest<T = any>(options: ApiRequestOptions): Promise<T> {
  const { method, path, body, on401 = "throw" } = options;

  // CRITICAL: Get bearer token from the Supabase session
  // This token is set by auth routes after successful login
  const token = await getAccessToken();

  // Build headers
  const headers: Record<string, string> = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (on401 === "returnNull" && res.status === 401) {
    return null as T;
  }

  await throwIfResNotOk(res);
  return await res.json();
}

// API Client with axios-like interface
/** API client with axios-like methods for authorized requests. */
export const apiClient = {
  get: <T = any>(path: string) => apiRequest<T>({ method: "GET", path }),
  post: <T = any>(path: string, body?: unknown) => apiRequest<T>({ method: "POST", path, body }),
  put: <T = any>(path: string, body?: unknown) => apiRequest<T>({ method: "PUT", path, body }),
  patch: <T = any>(path: string, body?: unknown) => apiRequest<T>({ method: "PATCH", path, body }),
  delete: <T = any>(path: string) => apiRequest<T>({ method: "DELETE", path }),
};

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Query function factory with automatic bearer token attachment
 *
 * Used by React Query to fetch data. Automatically includes:
 * - Supabase JWT bearer token from the current session
 * - Session credentials (cookies)
 *
 * Without bearer token, server returns 401 Unauthorized.
 *
 * @param on401 - How to handle 401: "throw" (default) or "returnNull"
 * @returns QueryFunction for React Query
 */
/** Factory returning a React Query queryFn with automatic bearer-token attachment. */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // CRITICAL: Get bearer token from the Supabase session
    const token = await getAccessToken();

    // Build headers with bearer token
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/** Shared React Query client with default query options. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
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
