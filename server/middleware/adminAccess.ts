import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getCallerRole, getUserFromRequest, isAdmin } from '../auth/supabaseAuth';
import { logger } from '../utils/logger';

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

  if (adminJobSecret && requestSecret) {
    if (safeSecretEquals(requestSecret, adminJobSecret)) {
      logger.info(
        { actor: 'secret', route: `${req.method} ${req.path}`, grant: 'allow', reason: 'admin_job_secret' },
        'Admin access granted'
      );
      return next();
    }

    logger.warn(
      { actor: 'secret', route: `${req.method} ${req.path}`, grant: 'deny', reason: 'invalid_admin_job_secret' },
      'Admin access denied'
    );
  }

  return isAdmin(req, res, next);
};

/**
 * Express middleware enforcing that the caller's role is one of `roles`.
 * Identity is resolved from req.user (if set), else the bearer token, else the
 * session. Role comes from app_metadata.role only (never user_metadata); the
 * 'admin' role is additionally granted by the ADMIN_EMAILS allowlist.
 */
export function requireRole(...roles: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      const bearerUser = await getUserFromRequest(req);
      if (bearerUser) {
        req.user = bearerUser;
      }
    }

    const hasIdentity = Boolean(req.user || req.session?.userId);
    if (!hasIdentity) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const callerRole = getCallerRole(req);
    if (!callerRole || !roles.includes(callerRole)) {
      const actor =
        (req.user as { email?: string } | null | undefined)?.email ??
        req.session?.userId ??
        'anonymous';
      logger.warn(
        {
          actor,
          route: `${req.method} ${req.path}`,
          grant: 'deny',
          reason: 'insufficient_role',
          required: roles,
          actual: callerRole,
        },
        'Role access denied'
      );
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    const actor =
      (req.user as { email?: string } | null | undefined)?.email ??
      req.session?.userId ??
      'unknown';
    logger.info(
      { actor, route: `${req.method} ${req.path}`, grant: 'allow', role: callerRole },
      'Role access granted'
    );

    next();
  };
}

/** Log an admin action with actor identity, route, and optional detail. */
export function logAdminAction(
  req: Request,
  action: string,
  detail?: Record<string, unknown>
): void {
  const actor =
    (req.user as { email?: string } | null | undefined)?.email ??
    req.session?.userId ??
    'secret';

  logger.info({
    operation: `admin.${action}`,
    actor,
    route: `${req.method} ${req.path}`,
    ...detail,
  });
}
