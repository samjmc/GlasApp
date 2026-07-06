import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentSession } from "@/lib/supabase";

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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getCurrentSession();
  const accessToken = session?.access_token;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function apiRequest<T = any>(options: ApiRequestOptions): Promise<T> {
  const { method, path, body, on401 = "throw" } = options;
  const authHeaders = await getAuthHeaders();
  const headers = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
  };
  
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
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(queryKey[0] as string, {
      headers: authHeaders,
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
