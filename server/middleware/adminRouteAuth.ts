import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const ADMIN_SECRET_ENV_KEYS = ['ADMIN_API_SECRET', 'ADMIN_JOB_SECRET', 'CRON_SECRET'] as const;
const ADMIN_SECRET_HEADERS = ['x-admin-secret', 'x-admin-job-secret', 'x-cron-secret'] as const;

function normalizeSecret(secret: unknown): string | null {
  if (typeof secret !== 'string') {
    return null;
  }

  const trimmed = secret.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getConfiguredAdminSecrets(): string[] {
  return ADMIN_SECRET_ENV_KEYS
    .map((key) => normalizeSecret(process.env[key]))
    .filter((secret): secret is string => Boolean(secret));
}

function getHeaderSecret(req: Request): string | null {
  for (const header of ADMIN_SECRET_HEADERS) {
    const value = req.headers[header];
    const secret = Array.isArray(value) ? normalizeSecret(value[0]) : normalizeSecret(value);

    if (secret) {
      return secret;
    }
  }

  return null;
}

function getBearerSecret(req: Request): string | null {
  const authorization = req.headers.authorization;
  const value = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!value) {
    return null;
  }

  const [scheme, ...tokenParts] = value.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer') {
    return null;
  }

  return normalizeSecret(tokenParts.join(' '));
}

function secretsMatch(candidate: string, configuredSecret: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (candidateBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, configuredBuffer);
}

export function isAdminRouteRequestAuthorized(req: Request): boolean {
  const configuredSecrets = getConfiguredAdminSecrets();
  const suppliedSecret = getHeaderSecret(req) ?? getBearerSecret(req);

  if (!suppliedSecret || configuredSecrets.length === 0) {
    return false;
  }

  return configuredSecrets.some((secret) => secretsMatch(suppliedSecret, secret));
}

export function requireAdminRouteAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredSecrets = getConfiguredAdminSecrets();

  if (configuredSecrets.length === 0) {
    console.error(
      `Admin route blocked because none of ${ADMIN_SECRET_ENV_KEYS.join(', ')} is configured.`,
    );
    res.status(503).json({
      success: false,
      message: 'Admin route authentication is not configured',
    });
    return;
  }

  if (!isAdminRouteRequestAuthorized(req)) {
    res.status(401).json({
      success: false,
      message: 'Admin route authentication required',
    });
    return;
  }

  next();
}
