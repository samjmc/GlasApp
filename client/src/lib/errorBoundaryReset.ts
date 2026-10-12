/**
 * A crashed boundary clears itself when the user navigates to another page, so the new page shows
 * instead of the fallback. A boundary that is not showing an error has nothing to clear: it must
 * not touch its children, which hold the auth, region and consent providers.
 */
export function shouldResetBoundary(hasError: boolean, prevKey: string, nextKey: string): boolean {
  return hasError && prevKey !== nextKey;
}
