/**
 * Client for /api/consent (server/consent/routes.ts): the signed-in user's consent to store
 * their political answers. Every response is the `{ success, data }` envelope.
 */
import { apiRequest } from "@/lib/queryClient";
import type { ConsentStatus } from "@shared/consent";

type Envelope<T> = { success: true; data: T } | { success: false; error: { message: string } };

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await apiRequest<Envelope<T>>({ method, path: "/api/consent", body });
  if (!res || !res.success) throw new Error(res && !res.success ? res.error.message : "Empty response");
  return res.data;
}

export const fetchConsent = () => call<ConsentStatus>("GET");
export const grantConsent = (version: string) => call<ConsentStatus>("POST", { version });
/** Also deletes the political answers the consent covered. */
export const withdrawConsent = () => call<{ deleted: Record<string, number> }>("DELETE");
