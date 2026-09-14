/** Returns whether an error message indicates a 401 Unauthorized response. */
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}