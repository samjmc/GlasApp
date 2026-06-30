import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { getUserFromRequest } from "../auth/supabaseAuth";

const DEFAULT_ADMIN_EMAILS = ["samjmc3@hotmail.com"];

function parseAdminEmails(): Set<string> {
  const configuredEmails = process.env.ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configuredEmails?.length ? configuredEmails : DEFAULT_ADMIN_EMAILS);
}

function getConfiguredSecrets(): string[] {
  return [
    process.env.ADMIN_API_SECRET,
    process.env.ADMIN_JOB_SECRET,
    process.env.CRON_SECRET,
  ].filter((secret): secret is string => Boolean(secret));
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const value = req.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getBearerToken(req: Request): string | undefined {
  const authorization = getHeaderValue(req, "authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  return authorization.slice("Bearer ".length).trim();
}

function secretMatches(candidate: string | undefined, secret: string): boolean {
  if (!candidate) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate);
  const secretBuffer = Buffer.from(secret);
  if (candidateBuffer.length !== secretBuffer.length) {
    return false;
  }

  return timingSafeEqual(candidateBuffer, secretBuffer);
}

function hasValidJobSecret(req: Request): boolean {
  const candidates = [
    getHeaderValue(req, "x-admin-secret"),
    getHeaderValue(req, "x-admin-job-secret"),
    getHeaderValue(req, "x-cron-secret"),
    getBearerToken(req),
  ];

  return getConfiguredSecrets().some((secret) =>
    candidates.some((candidate) => secretMatches(candidate, secret))
  );
}

function isAdminUser(user: any): boolean {
  if (!user) {
    return false;
  }

  const role = user.user_metadata?.role || user.app_metadata?.role;
  if (role === "admin") {
    return true;
  }

  const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
  return parseAdminEmails().has(email);
}

export async function requireAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (hasValidJobSecret(req)) {
      next();
      return;
    }

    const user = await getUserFromRequest(req);
    if (isAdminUser(user)) {
      req.user = user;
      next();
      return;
    }

    const hasCredentials =
      Boolean(getBearerToken(req)) ||
      Boolean(getHeaderValue(req, "x-admin-secret")) ||
      Boolean(getHeaderValue(req, "x-admin-job-secret")) ||
      Boolean(getHeaderValue(req, "x-cron-secret"));

    res.status(hasCredentials ? 403 : 401).json({
      success: false,
      message: "Admin access required",
    });
  } catch (error) {
    console.error("Admin access check failed:", error);
    res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }
}
