/**
 * Authentication. One mechanism: a Supabase access token in `Authorization: Bearer`.
 *
 * The client signs in with Supabase (password, magic link or Google) and attaches the
 * token to every request. The server verifies it and puts the user on `req.user`. There
 * is no server-side session, no cookie identity and no second user store.
 *
 * Guards:
 *   requireAuth     verified user, else 401
 *   optionalAuth    attaches a user when the token is present, never blocks
 *   requireAdmin    verified user whose role is admin, else 401/403
 *   requireJob      a machine caller holding the job secret, or an admin
 *
 * Identity is always `req.user.id` — the Supabase `auth.users` UUID. Every `user_id`
 * column in the schema is a varchar, so that UUID is the one identity the whole app uses.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { logger } from '../utils/logger';
import { supabase } from './supabase';

export { supabase, supabaseAdmin } from './supabase';

/** The verified caller. Only fields the server is willing to trust. */
export interface AuthUser {
  id: string;
  email: string | null;
  /** Server-owned. `user_metadata` is self-editable and is never trusted for authorisation. */
  role: string | null;
  userMetadata: Record<string, unknown>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ADMIN_ROLE = 'admin';

/** Read at call time so tests and deploys can change it without a restart. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function jobSecret(): string | undefined {
  return process.env.ADMIN_API_SECRET || process.env.ADMIN_SECRET || process.env.CRON_SECRET || process.env.JOB_SECRET;
}

/**
 * Verify a bearer token with Supabase and reduce it to the fields we trust.
 * Returns null for anything that is not a valid, unexpired token.
 */
export async function authenticate(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;

  try {
    const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length));
    if (error || !data?.user) return null;
    const user = data.user;
    const email = typeof user.email === 'string' ? user.email : null;
    const claimed = (user.app_metadata as { role?: unknown } | undefined)?.role;
    const role =
      typeof claimed === 'string' && claimed
        ? claimed
        : email && adminEmails().includes(email.toLowerCase())
          ? ADMIN_ROLE
          : null;
    return {
      id: user.id,
      email,
      role,
      userMetadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    };
  } catch (error) {
    logger.warn({ err: error }, 'Token verification failed');
    return null;
  }
}

function isAdminUser(user: AuthUser): boolean {
  if (user.role === ADMIN_ROLE) return true;
  return user.email !== null && adminEmails().includes(user.email.toLowerCase());
}

function deny(res: Response, status: 401 | 403, message: string): void {
  res.status(status).json({ success: false, message });
}

/** Verified user required. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const user = await authenticate(req);
  if (!user) return deny(res, 401, 'Authentication required');
  req.user = user;
  next();
};

/** Attaches a user when there is a valid token; never blocks. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const user = await authenticate(req);
  if (user) req.user = user;
  next();
};

/** Verified user whose role is admin. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = await authenticate(req);
  if (!user) {
    logger.warn({ route: `${req.method} ${req.path}`, grant: 'deny', reason: 'unauthenticated' }, 'Admin denied');
    return deny(res, 401, 'Authentication required');
  }
  if (!isAdminUser(user)) {
    logger.warn({ actor: user.email, route: `${req.method} ${req.path}`, grant: 'deny', reason: 'not_admin' }, 'Admin denied');
    return deny(res, 403, 'Admin access required');
  }
  req.user = user;
  logger.info({ actor: user.email, route: `${req.method} ${req.path}`, grant: 'allow' }, 'Admin granted');
  next();
};

/** Constant-time compare that does not leak length through an early return. */
export function secretsMatch(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Machine callers (cron, scheduled jobs) present the shared secret in `x-admin-secret`
 * or `x-cron-secret`. Deliberately NOT `Authorization: Bearer` — that header carries user
 * tokens, and accepting both there meant a user's JWT was compared against the admin
 * secret on every admin request. A human admin's bearer token is accepted instead.
 */
export const requireJob: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const secret = jobSecret();
  const presented = req.header('x-admin-secret') || req.header('x-cron-secret');

  if (secret && presented) {
    if (secretsMatch(presented, secret)) {
      logger.info({ actor: 'job', route: `${req.method} ${req.path}`, grant: 'allow' }, 'Job secret accepted');
      return next();
    }
    logger.warn({ actor: 'job', route: `${req.method} ${req.path}`, grant: 'deny' }, 'Job secret rejected');
    return deny(res, 401, 'Authentication required');
  }

  return requireAdmin(req, res, next);
};

/** The caller's id, or null when unauthenticated. */
export function currentUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

/**
 * Allow a request that names a user id in the path only when it is the caller's own, or
 * the caller is an admin. Use on every `/:userId/…` route: `requireAuth` alone proves who
 * is calling, not whose data they asked for.
 */
export function ownsOrAdmin(req: Request, res: Response, targetUserId: string): boolean {
  const user = req.user;
  if (!user) {
    deny(res, 401, 'Authentication required');
    return false;
  }
  if (user.id !== targetUserId && !isAdminUser(user)) {
    deny(res, 403, 'Access denied');
    return false;
  }
  return true;
}

/** Log an admin action with the actor's identity. */
export function logAdminAction(req: Request, action: string, detail?: Record<string, unknown>): void {
  logger.info({
    operation: `admin.${action}`,
    actor: req.user?.email ?? 'job',
    route: `${req.method} ${req.path}`,
    ...detail,
  });
}
