import { Router } from "express";
import { updateUserMetadata } from '../auth/supabase';
import { REGION_COOKIE } from "../middleware/regionMiddleware";
import { REGION_CONFIGS, isRegionCode } from "@shared/region-config";

const router = Router();

// optionalAuth already ran app-wide, so req.user is set when a token was supplied.
router.post("/select", async (req, res) => {
  const { regionCode } = req.body || {};

  if (!isRegionCode(regionCode)) {
    return res.status(400).json({
      success: false,
      message: "Invalid region code",
    });
  }

  // Anonymous visitors keep their choice in a cookie.
  res.cookie(REGION_COOKIE, regionCode, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  req.regionCode = regionCode;

  // A signed-in user's choice follows them to any device.
  if (req.user) {
    try {
      await updateUserMetadata(req.user.id, { ...req.user.userMetadata, region_code: regionCode });
    } catch (error) {
      console.error("Failed to persist user region metadata", error);
      // The cookie already holds the choice; do not fail the request.
    }
  }

  res.json({
    success: true,
    regionCode,
    region: REGION_CONFIGS[regionCode],
  });
});

export default router;
