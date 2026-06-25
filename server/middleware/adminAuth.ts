import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";

import { getUserFromRequest } from "../auth/supabaseAuth";

const ADMIN_SECRET_ENV_KEYS = ["ADMIN_API_SECRET", "ADMIN_JOB_SECRET", "CRON_SECRET"] as const;
const ADMIN_SECRET_HEADER_KEYS = ["x-admin-secret", "x-admin-job-secret", "x-cron-secret"] as const;

function getConfiguredAdminSecrets(): string[] {
  return ADMIN_SECRET_ENV_KEYS
    .map((key) => process.env[key]?.trim())
    .filter((secret): secret is string => Boolean(secret));
}

function safeSecretEquals(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function getHeaderValue(req: Request, headerName: string): string | null {
  const value = req.header(headerName);
  return value?.trim() || null;
}

function getBearerToken(req: Request): string | null {
  const authorization = getHeaderValue(req, "authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

function hasValidAdminSecret(req: Request): boolean {
  const configuredSecrets = getConfiguredAdminSecrets();

  if (configuredSecrets.length === 0) {
    return false;
  }

  const candidateSecrets = [
    ...ADMIN_SECRET_HEADER_KEYS.map((headerName) => getHeaderValue(req, headerName)),
    getBearerToken(req),
  ].filter((secret): secret is string => Boolean(secret));

  return candidateSecrets.some((candidate) =>
    configuredSecrets.some((expected) => safeSecretEquals(candidate, expected))
  );
}

function getSupabaseRole(user: any): string | undefined {
  return user?.app_metadata?.role || user?.user_metadata?.role;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (hasValidAdminSecret(req)) {
      next();
      return;
    }

    const user = await getUserFromRequest(req);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (getSupabaseRole(user) !== "admin") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Admin authorization failed:", error);
    res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }
}
