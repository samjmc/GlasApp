import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { getUserFromRequest } from '../auth/supabaseAuth';

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function getPresentedServiceSecret(req: Request): string | null {
  const headerSecret =
    req.get('x-cron-secret') ||
    req.get('x-admin-secret') ||
    req.get('x-api-key');

  if (headerSecret) {
    return headerSecret;
  }

  const authHeader = req.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return null;
}

function hasValidServiceSecret(req: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET;
  const presentedSecret = getPresentedServiceSecret(req);

  return Boolean(
    expectedSecret &&
    presentedSecret &&
    safeEquals(presentedSecret, expectedSecret)
  );
}

function hasAdminRole(user: any): boolean {
  const appMetadata = user?.app_metadata;
  const role = appMetadata?.role;
  const roles = appMetadata?.roles;

  return role === 'admin' || (Array.isArray(roles) && roles.includes('admin'));
}

export async function requireAdminOrCron(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (hasValidServiceSecret(req)) {
    next();
    return;
  }

  const user = await getUserFromRequest(req);
  if (hasAdminRole(user)) {
    req.user = user;
    next();
    return;
  }

  res.status(user ? 403 : 401).json({
    success: false,
    message: user ? 'Admin access required' : 'Authentication required',
  });
}
