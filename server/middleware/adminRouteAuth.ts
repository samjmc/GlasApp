import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { getUserFromRequest } from "../auth/supabaseAuth";

const ADMIN_SECRET_ENV_VARS = [
  "ADMIN_API_SECRET",
  "ADMIN_JOB_SECRET",
  "CRON_SECRET",
] as const;

function getConfiguredSecrets(): string[] {
  return ADMIN_SECRET_ENV_VARS
    .map((name) => process.env[name])
    .filter((secret): secret is string => Boolean(secret));
}

function safeSecretEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function extractBearerToken(req: Request): string | undefined {
  const authorization = req.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim();
}

function requestHasAdminSecret(req: Request): boolean {
  const candidates = [
    req.get("x-admin-secret"),
    req.get("x-admin-job-secret"),
    req.get("x-cron-secret"),
    extractBearerToken(req),
  ].filter((secret): secret is string => Boolean(secret));

  if (candidates.length === 0) {
    return false;
  }

  return getConfiguredSecrets().some((expected) =>
    candidates.some((candidate) => safeSecretEquals(candidate, expected)),
  );
}

function userHasAdminRole(user: any): boolean {
  const role = user?.user_metadata?.role || user?.app_metadata?.role;
  return role === "admin";
}

export async function adminRouteAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (requestHasAdminSecret(req)) {
    next();
    return;
  }

  const user = await getUserFromRequest(req);

  if (userHasAdminRole(user)) {
    req.user = user;
    next();
    return;
  }

  res.status(user ? 403 : 401).json({
    success: false,
    message: user ? "Admin access required" : "Authentication required",
  });
}
