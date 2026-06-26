import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';

const ADMIN_SECRET_ENV_VARS = [
  'ADMIN_API_SECRET',
  'ADMIN_JOB_SECRET',
  'CRON_SECRET',
] as const;

const ADMIN_SECRET_HEADERS = [
  'x-admin-secret',
  'x-admin-job-secret',
  'x-cron-secret',
] as const;

function configuredSecrets(): string[] {
  return ADMIN_SECRET_ENV_VARS
    .map((name) => process.env[name])
    .filter((secret): secret is string => Boolean(secret?.trim()));
}

function safeEquals(candidate: string, secret: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);

  return candidateBuffer.length === secretBuffer.length
    && timingSafeEqual(candidateBuffer, secretBuffer);
}

function extractAdminSecret(req: Parameters<RequestHandler>[0]): string | null {
  for (const headerName of ADMIN_SECRET_HEADERS) {
    const headerValue = req.get(headerName);
    if (headerValue) {
      return headerValue;
    }
  }

  const authorization = req.get('authorization');
  const bearerPrefix = 'Bearer ';
  if (authorization?.startsWith(bearerPrefix)) {
    return authorization.slice(bearerPrefix.length);
  }

  return null;
}

export const requireAdminSecret: RequestHandler = (req, res, next) => {
  const secrets = configuredSecrets();
  if (secrets.length === 0) {
    console.error(
      `Admin route blocked: configure one of ${ADMIN_SECRET_ENV_VARS.join(', ')} to enable admin access.`
    );
    return res.status(503).json({
      success: false,
      message: 'Admin access is not configured',
    });
  }

  const candidate = extractAdminSecret(req);
  if (!candidate || !secrets.some((secret) => safeEquals(candidate, secret))) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  next();
};
