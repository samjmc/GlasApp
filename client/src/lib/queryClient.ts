import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
 * 1. Gets the Supabase JWT token from localStorage
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

  // CRITICAL: Get bearer token from localStorage
  // This token is set by auth routes after successful login
  let token: string | null = null;
  try {
    const tokenData = localStorage.getItem('supabase.auth.token');
    if (tokenData) {
      // Token might be JSON-encoded or plain string
      try {
        const parsed = JSON.parse(tokenData);
        token = parsed.access_token || parsed;
      } catch {
        token = tokenData;
      }
    }
  } catch (error) {
    console.debug('Error reading bearer token from localStorage:', error);
  }

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
 * - Supabase JWT bearer token from localStorage
 * - Session credentials (cookies)
 *
 * Without bearer token, server returns 401 Unauthorized.
 *
 * @param on401 - How to handle 401: "throw" (default) or "returnNull"
 * @returns QueryFunction for React Query
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // CRITICAL: Get bearer token from localStorage
    let token: string | null = null;
    try {
      const tokenData = localStorage.getItem('supabase.auth.token');
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          token = parsed.access_token || parsed;
        } catch {
          token = tokenData;
        }
      }
    } catch (error) {
      console.debug('Error reading bearer token:', error);
    }

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
