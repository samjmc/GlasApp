import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { isAdmin } from '../auth/supabaseAuth';

const ADMIN_SECRET_ENV_VARS = [
  'ADMIN_API_SECRET',
  'CRON_API_SECRET',
  'CRON_SECRET',
];

const ADMIN_SECRET_HEADERS = [
  'x-admin-secret',
  'x-cron-secret',
];

function getConfiguredSecrets(): string[] {
  return ADMIN_SECRET_ENV_VARS
    .map((name) => process.env[name]?.trim())
    .filter((secret): secret is string => Boolean(secret));
}

function getRequestSecret(req: Request): string | null {
  for (const header of ADMIN_SECRET_HEADERS) {
    const value = req.get(header)?.trim();
    if (value) {
      return value;
    }
  }

  const authorization = req.get('authorization')?.trim();
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return null;
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestSecret = getRequestSecret(req);
  const configuredSecrets = getConfiguredSecrets();

  if (
    requestSecret &&
    configuredSecrets.some((configuredSecret) => secretsMatch(requestSecret, configuredSecret))
  ) {
    next();
    return;
  }

  return isAdmin(req, res, next);
}
