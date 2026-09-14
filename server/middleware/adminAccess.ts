import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { isAdmin } from '../auth/supabaseAuth';

const adminJobSecret =
  process.env.ADMIN_API_SECRET ||
  process.env.ADMIN_SECRET ||
  process.env.CRON_SECRET ||
  process.env.JOB_SECRET;

/** Constant-time comparison of two secrets. */
export function safeSecretEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

/** Extract an admin secret from the request headers. */
export function getAdminSecretFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

  return (
    req.header('x-admin-secret') ||
    req.header('x-cron-secret') ||
    bearerToken
  );
}

/** Express middleware enforcing admin access. */
export const requireAdminAccess: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestSecret = getAdminSecretFromRequest(req);

  if (adminJobSecret && requestSecret && safeSecretEquals(requestSecret, adminJobSecret)) {
    return next();
  }

  return isAdmin(req, res, next);
};
