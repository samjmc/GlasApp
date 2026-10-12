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

/**
 * The quiz result, answers and draft kept in sessionStorage (quizStorage.ts) are one person's political
 * opinions and outlive a sign-out in the same tab. They are dropped when a signed-in person signs out or
 * a different person signs in. Unlike the query cache, they are KEPT when a visitor signs in (`prevUserId`
 * null): an anonymous result is saved to the account that signs in.
 */
export function shouldClearQuizStorage(
  prevUserId: string | null | undefined,
  nextUserId: string | null,
  event: string,
): boolean {
  if (event === 'SIGNED_OUT') return true;
  return typeof prevUserId === 'string' && prevUserId !== nextUserId;
}
