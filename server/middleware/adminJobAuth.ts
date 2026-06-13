import { timingSafeEqual } from 'crypto';
import type { Request, RequestHandler } from 'express';

const ADMIN_JOB_SECRET_NAMES = ['ADMIN_JOB_SECRET', 'CRON_SECRET'] as const;
const DEV_BYPASS_ENV = 'ALLOW_UNAUTHENTICATED_ADMIN_JOBS';

type AdminJobEnv = NodeJS.ProcessEnv;

export function getAdminJobSecret(env: AdminJobEnv = process.env): string | null {
  for (const secretName of ADMIN_JOB_SECRET_NAMES) {
    const secret = env[secretName]?.trim();

    if (secret) {
      return secret;
    }
  }

  return null;
}

export function getProvidedAdminJobSecret(req: Pick<Request, 'get'>): string | null {
  const headerSecret = req.get('x-admin-job-secret')?.trim();

  if (headerSecret) {
    return headerSecret;
  }

  const authHeader = req.get('authorization')?.trim();

  if (!authHeader) {
    return null;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  return null;
}

export function adminJobSecretMatches(providedSecret: string, configuredSecret: string): boolean {
  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}

function shouldAllowDevelopmentBypass(env: AdminJobEnv): boolean {
  return env.NODE_ENV !== 'production' && env[DEV_BYPASS_ENV] === 'true';
}

export const requireAdminJobAuth: RequestHandler = (req, res, next) => {
  const configuredSecret = getAdminJobSecret();

  if (!configuredSecret) {
    if (shouldAllowDevelopmentBypass(process.env)) {
      console.warn(
        `Admin job auth bypassed because ${DEV_BYPASS_ENV}=true outside production.`
      );
      return next();
    }

    return res.status(503).json({
      success: false,
      message: 'Admin job authentication is not configured'
    });
  }

  const providedSecret = getProvidedAdminJobSecret(req);

  if (!providedSecret || !adminJobSecretMatches(providedSecret, configuredSecret)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return next();
};
