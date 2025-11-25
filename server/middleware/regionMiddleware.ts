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
    }
  }
}

const REGION_HEADER = "x-region-code";

function normalizeRegion(value?: string | null): RegionCode | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toUpperCase();
  return isRegionCode(trimmed) ? trimmed : undefined;
}

export function regionMiddleware(req: Request, _res: Response, next: NextFunction) {
  const headerRegion = normalizeRegion(req.headers[REGION_HEADER] as string | undefined);
  const queryRegion = normalizeRegion(typeof req.query.region === "string" ? req.query.region : undefined);
  const sessionRegion = normalizeRegion(req.session?.regionCode || undefined);

  let resolvedRegion = headerRegion || queryRegion || sessionRegion;

  if (!resolvedRegion && req.user?.user_metadata?.region_code) {
    resolvedRegion = normalizeRegion(req.user.user_metadata.region_code);
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
  (req as any).regionConfig = REGION_CONFIGS[resolvedRegion];

  next();
}




















