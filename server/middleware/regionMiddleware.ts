import type { Request, Response, NextFunction } from "express";
import {
  DEFAULT_REGION_CODE,
  isRegionCode,
  type RegionCode,
  REGION_CONFIGS,
} from "@shared/region-config";

declare global {
  namespace Express {
    interface Request {
      regionCode?: RegionCode;
      regionConfig?: unknown;
    }
  }
}

const REGION_HEADER = "x-region-code";
/** Region is a display preference, not identity, so a plain cookie is the right home. */
export const REGION_COOKIE = "glas_region";
const REGION_COOKIE_MAX_AGE_DAYS = 365;

function normalizeRegion(value?: string | null): RegionCode | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  return isRegionCode(trimmed) ? trimmed : undefined;
}

/** Read one cookie without pulling in a parser: values here are short codes. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    // Not decoded: region codes are plain ASCII, and decodeURIComponent throws on a stray "%",
    // which would turn every page into a 500 for as long as the cookie lives.
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/**
 * Resolve the request's region: explicit header, then query, then the cookie we set,
 * then the signed-in user's saved preference, then the default.
 */
export function regionMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerRegion = normalizeRegion(req.headers[REGION_HEADER] as string | undefined);
  const queryRegion = normalizeRegion(typeof req.query.region === "string" ? req.query.region : undefined);
  const cookieRegion = normalizeRegion(readCookie(req, REGION_COOKIE));

  let resolvedRegion = headerRegion || queryRegion || cookieRegion;

  const savedRegion = req.user?.userMetadata?.region_code;
  if (!resolvedRegion && typeof savedRegion === "string") {
    resolvedRegion = normalizeRegion(savedRegion);
  }

  if (!resolvedRegion) {
    resolvedRegion = DEFAULT_REGION_CODE;
  }

  if (cookieRegion !== resolvedRegion) {
    res.cookie(REGION_COOKIE, resolvedRegion, {
      maxAge: REGION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      httpOnly: false, // the client reads it to render the region switcher
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  req.regionCode = resolvedRegion;

  // Expose region metadata for downstream handlers if needed
  req.regionConfig = REGION_CONFIGS[resolvedRegion];

  next();
}




















