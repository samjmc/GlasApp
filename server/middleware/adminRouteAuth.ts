import { timingSafeEqual } from 'crypto';
import type { Request, RequestHandler } from 'express';

const ADMIN_ROUTE_SECRET_NAMES = ['ADMIN_API_SECRET', 'ADMIN_JOB_SECRET', 'CRON_SECRET'] as const;
const ADMIN_ROUTE_SECRET_HEADERS = ['x-admin-secret', 'x-admin-job-secret'] as const;
const DEV_BYPASS_ENV = 'ALLOW_UNAUTHENTICATED_ADMIN_ROUTES';

type AdminRouteEnv = NodeJS.ProcessEnv;

export function getConfiguredAdminRouteSecret(env: AdminRouteEnv = process.env): string | null {
  for (const secretName of ADMIN_ROUTE_SECRET_NAMES) {
    const secret = env[secretName]?.trim();

    if (secret) {
      return secret;
    }
  }

  return null;
}

export function getProvidedAdminRouteSecret(req: Pick<Request, 'get'>): string | null {
  for (const headerName of ADMIN_ROUTE_SECRET_HEADERS) {
    const headerSecret = req.get(headerName)?.trim();

    if (headerSecret) {
      return headerSecret;
    }
  }

  const authHeader = req.get('authorization')?.trim();
  if (!authHeader) {
    return null;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || null;
}

export function adminRouteSecretMatches(providedSecret: string, configuredSecret: string): boolean {
  const providedBuffer = Buffer.from(providedSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (providedBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, configuredBuffer);
}

function shouldAllowDevelopmentBypass(env: AdminRouteEnv): boolean {
  return env.NODE_ENV !== 'production' && env[DEV_BYPASS_ENV] === 'true';
}

export const requireAdminRouteAuth: RequestHandler = (req, res, next) => {
  const configuredSecret = getConfiguredAdminRouteSecret();

  if (!configuredSecret) {
    if (shouldAllowDevelopmentBypass(process.env)) {
      console.warn(
        `Admin route auth bypassed because ${DEV_BYPASS_ENV}=true outside production.`
      );
      return next();
    }

    return res.status(503).json({
      success: false,
      message: 'Admin route authentication is not configured'
    });
  }

  const providedSecret = getProvidedAdminRouteSecret(req);

  if (!providedSecret || !adminRouteSecretMatches(providedSecret, configuredSecret)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return next();
};
