/**
 * The one way the client calls its own API.
 *
 * Every endpoint answers `{ success: true, data, meta? }` or `{ success: false, error: { code, message } }`
 * (server/utils/responseFormatters.ts). `apiCall` attaches the bearer token and the region, unwraps
 * `data`, and turns every failure into an `ApiError`, so callers branch on `status`/`code` and show
 * `message`, never on raw response text.
 */
import { supabase } from "@/lib/supabase";
import { getStoredRegion } from "@/lib/regionStorage";

/** Shown when the server gave no message of its own. */
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_MESSAGE = "Could not reach Glas. Check your connection and try again.";

/** A failed API call. `status` is 0 when no answer arrived (offline, connection dropped). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const isApiError = (error: unknown, status?: number): error is ApiError =>
  error instanceof ApiError && (status === undefined || error.status === status);

/** Text fit to show a person: the server's message for an API failure, a generic one otherwise. */
export const userMessage = (error: unknown): string => (error instanceof ApiError ? error.message : FALLBACK_MESSAGE);

/**
 * The error for a failed response. Reads the standard envelope, and also the older `{ message }`
 * shape the rate limiter sends.
 */
export function toApiError(status: number, payload: unknown): ApiError {
  const body = (payload ?? {}) as { error?: unknown; message?: unknown };
  const error = body.error as { code?: unknown; message?: unknown } | string | undefined;
  const code = typeof error === "object" && error && typeof error.code === "string" ? error.code : `HTTP_${status}`;
  const message =
    typeof error === "object" && error && typeof error.message === "string"
      ? error.message
      : typeof error === "string"
        ? error
        : typeof body.message === "string"
          ? body.message
          : FALLBACK_MESSAGE;
  return new ApiError(status, code, message);
}

async function accessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** The full success envelope, for the few endpoints that put something in `meta`. */
export async function apiEnvelope<T, M = undefined>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T; meta?: M }> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const token = await accessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const region = getStoredRegion();
  if (region) headers["x-region-code"] = region;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_MESSAGE);
  }

  const payload = (await response.json().catch(() => null)) as { success?: unknown; data: T; meta?: M } | null;
  if (response.ok && payload?.success === true) return { data: payload.data, meta: payload.meta };
  if (response.ok) throw new ApiError(response.status, "BAD_RESPONSE", FALLBACK_MESSAGE);
  throw toApiError(response.status, payload);
}

/** Calls the API and returns the envelope's `data`. Throws `ApiError`. */
export async function apiCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  return (await apiEnvelope<T>(method, path, body)).data;
}

/** The call's data, or null when the server answers 404. */
export async function orNullOn404<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (isApiError(error, 404)) return null;
    throw error;
  }
}
