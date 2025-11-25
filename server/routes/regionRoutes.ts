import { Router } from "express";
import { optionalAuth, updateUserMetadata } from "../auth/supabaseAuth";
import {
  DEFAULT_REGION_CODE,
  REGION_CONFIGS,
  REGION_LIST,
  REGION_NEWS_MOCK,
  REGION_DAILY_SESSION_MOCK,
  isRegionCode,
  type RegionCode,
} from "@shared/region-config";

const router = Router();

router.get("/available", (_req, res) => {
  res.json({
    success: true,
    regions: REGION_LIST,
  });
});

router.get("/current", (req, res) => {
  const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;
  res.json({
    success: true,
    regionCode,
    region: REGION_CONFIGS[regionCode],
    hasMockNews: !!REGION_NEWS_MOCK[regionCode],
    hasMockDailySession: !!REGION_DAILY_SESSION_MOCK[regionCode],
  });
});

router.post("/select", optionalAuth, async (req, res) => {
  const { regionCode } = req.body || {};

  if (!isRegionCode(regionCode)) {
    return res.status(400).json({
      success: false,
      message: "Invalid region code",
    });
  }

  // Persist region in session for subsequent requests
  if (req.session) {
    req.session.regionCode = regionCode;
  }
  req.regionCode = regionCode;

  // If user is authenticated, update their metadata asynchronously
  if (req.user?.id) {
    try {
      const existingMetadata = req.user.user_metadata || {};
      await updateUserMetadata(req.user.id, {
        ...existingMetadata,
        region_code: regionCode,
      });
    } catch (error) {
      console.error("Failed to persist user region metadata", error);
      // Do not fail the request – continue with session-level persistence
    }
  }

  res.json({
    success: true,
    regionCode,
    region: REGION_CONFIGS[regionCode],
    hasMockNews: !!REGION_NEWS_MOCK[regionCode],
    hasMockDailySession: !!REGION_DAILY_SESSION_MOCK[regionCode],
  });
});

export default router;


