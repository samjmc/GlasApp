import { timingSafeEqual } from 'crypto';
import type { Request, RequestHandler } from 'express';

const ADMIN_SECRET_ENV_VARS = ['ADMIN_API_SECRET', 'CRON_SECRET'] as const;

function configuredAdminSecrets(): string[] {
  return ADMIN_SECRET_ENV_VARS
    .map((name) => process.env[name]?.trim())
    .filter((secret): secret is string => Boolean(secret));
}

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function bearerToken(req: Request): string | null {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function headerSecret(req: Request): string | null {
  return req.get('x-admin-secret')?.trim()
    || req.get('x-cron-secret')?.trim()
    || null;
}

export function hasAdminCredentials(req: Request): boolean {
  return Boolean(bearerToken(req) || headerSecret(req));
}

export function hasValidAdminSecret(req: Request): boolean {
  const providedSecrets = [bearerToken(req), headerSecret(req)].filter(
    (secret): secret is string => Boolean(secret),
  );

  if (providedSecrets.length === 0) {
    return false;
  }

  return configuredAdminSecrets().some((configuredSecret) =>
    providedSecrets.some((providedSecret) => safeEquals(providedSecret, configuredSecret)),
  );
}

async function hasSupabaseAdminRole(req: Request): Promise<boolean> {
  const token = bearerToken(req);
  if (!token) {
    return false;
  }

  const { getUserFromRequest } = await import('../auth/supabaseAuth');
  const user = await getUserFromRequest(req);

  if (!user) {
    return false;
  }

  const appRole = user.app_metadata?.role;
  const appRoles = user.app_metadata?.roles;
  if (appRole === 'admin' || (Array.isArray(appRoles) && appRoles.includes('admin'))) {
    return true;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user.email && adminEmails.includes(user.email.toLowerCase()));
}

export const requireAdminAccess: RequestHandler = async (req, res, next) => {
  try {
    if (hasValidAdminSecret(req) || await hasSupabaseAdminRole(req)) {
      return next();
    }

    const status = hasAdminCredentials(req) ? 403 : 401;
    res.status(status).json({
      success: false,
      message: 'Admin access required',
    });
  } catch (error) {
    console.error('Admin access check failed:', error);
    res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
};
