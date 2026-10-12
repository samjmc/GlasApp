/**
 * The query cache holds one person's data (priorities, daily session, ideology) and has no
 * expiry (staleTime is Infinity), so it must not outlive them. It is cleared when the person
 * signs out or a different person signs in. The first user seen after load is not a change:
 * `prevUserId` is `undefined` until the session has been read once.
 */
export function shouldClearCache(
  prevUserId: string | null | undefined,
  nextUserId: string | null,
  event: string,
): boolean {
  if (event === 'SIGNED_OUT') return true;
  if (prevUserId === undefined) return false;
  return prevUserId !== nextUserId;
}
