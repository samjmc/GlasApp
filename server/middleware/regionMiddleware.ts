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

function normalizeRegion(value?: string | null): RegionCode | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  return isRegionCode(trimmed) ? trimmed : undefined;
}

/** Express middleware resolving the request region from header, query, or session. */
export function regionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const headerRegion = normalizeRegion(req.headers[REGION_HEADER] as string | undefined);
  const queryRegion = normalizeRegion(typeof req.query.region === "string" ? req.query.region : undefined);
  const sessionRegion = normalizeRegion(req.session?.regionCode || undefined);

  let resolvedRegion = headerRegion || queryRegion || sessionRegion;

  const userMetadata = (req.user as { user_metadata?: { region_code?: string } } | undefined)?.user_metadata;
  if (!resolvedRegion && userMetadata?.region_code) {
    resolvedRegion = normalizeRegion(userMetadata.region_code);
  }

  if (!resolvedRegion) {
    resolvedRegion = DEFAULT_REGION_CODE;
  }

  // Persist the normalized region in the session for subsequent requests
  if (req.session && req.session.regionCode !== resolvedRegion) {
    req.session.regionCode = resolvedRegion;
  }

  req.regionCode = resolvedRegion;

  // Expose region metadata for downstream handlers if needed
  req.regionConfig = REGION_CONFIGS[resolvedRegion];

  next();
}




















