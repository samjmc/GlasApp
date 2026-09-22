import { requireAuth } from '../auth';
import { Router } from "express";
import DailySessionService from "../services/dailySessionService.js";
import {
  DEFAULT_REGION_CODE,
  type RegionCode,
} from "@shared/region-config";
import {
  generateQuickExplainer,
  type QuickExplainerResult,
} from "../services/openaiService.js";

const router = Router();

type QuickExplainerCacheEntry = {
  data: QuickExplainerResult;
  expiresAt: number;
};

const QUICK_EXPLAINER_TTL_MS = 24 * 60 * 60 * 1000;
const quickExplainerCache = new Map<string, QuickExplainerCacheEntry>();

router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const accessToken =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined;
    const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DailySessionRoute] GET access token present:", Boolean(accessToken));
    }

    // Location is a user-supplied preference, so it lives in user_metadata.
    const county = typeof user.userMetadata.county === "string" ? user.userMetadata.county : null;
    const constituency =
      typeof user.userMetadata.constituency === "string" ? user.userMetadata.constituency : null;
    const forceParam = req.query.force;
    const forceRefresh =
      typeof forceParam === "string"
        ? ["true", "1", "yes"].includes(forceParam.toLowerCase())
        : Array.isArray(forceParam)
        ? forceParam.some((value) =>
            ["true", "1", "yes"].includes((value || "").toLowerCase())
          )
        : false;

    const sessionState = await DailySessionService.getOrCreateSession(
      user.id,
      {
        county: county || undefined,
        constituency: constituency || undefined,
        forceRefresh,
      },
      accessToken
    );

    res.json({
      success: true,
      session: sessionState,
      regionCode,
    });
  } catch (error: unknown) {
    console.error("Daily session load failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to load daily session",
    });
  }
});

router.post(
  "/items/:itemId/vote",
  requireAuth,
  async (req, res) => {
    try {
      const user = req.user!;
      const accessToken =
        typeof req.headers.authorization === "string"
          ? req.headers.authorization.replace(/^Bearer\s+/i, "")
          : undefined;
      const sessionItemId = parseInt(req.params.itemId, 10);
      const { rating, optionKey } = req.body;
      const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;
      if (process.env.NODE_ENV !== "production") {
        console.debug("[DailySessionRoute] VOTE access token present:", Boolean(accessToken));
      }

      if (!rating && !optionKey) {
        return res.status(400).json({
          success: false,
          message: "Either rating or optionKey is required",
        });
      }

      const updatedSession = await DailySessionService.recordVote(
        user.id,
        sessionItemId,
        rating ? Number(rating) : undefined,
        optionKey ? String(optionKey) : undefined,
        accessToken
      );

      res.json({
        success: true,
        session: updatedSession,
        regionCode,
      });
    } catch (error: unknown) {
      console.error("Daily vote submission failed:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to record vote",
      });
    }
  }
);

router.post("/complete", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const accessToken =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined;
    const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DailySessionRoute] COMPLETE access token present:", Boolean(accessToken));
    }

    const summary = await DailySessionService.completeSession(user.id, accessToken);
    res.json({
      success: true,
      summary,
      regionCode,
    });
  } catch (error: unknown) {
    console.error("Daily session completion failed:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to complete session",
    });
  }
});

router.post("/explainer", requireAuth, async (req, res) => {
  try {
    const regionCode: RegionCode = req.regionCode || DEFAULT_REGION_CODE;
    const { headline, summary = "", issueCategory, todayIso, maxChars } =
      req.body || {};

    if (!headline || !issueCategory) {
      return res.status(400).json({
        success: false,
        message: "headline and issueCategory are required",
      });
    }

    const cacheKey = `${regionCode}::${headline.trim().toLowerCase()}`;
    const cached = quickExplainerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({
        success: true,
        explainer: cached.data,
        cached: true,
      });
    }

    const explainer = await generateQuickExplainer({
      headline,
      summary,
      issueCategory,
      region: regionCode,
      todayIso,
      maxChars,
    });

    quickExplainerCache.set(cacheKey, {
      data: explainer,
      expiresAt: Date.now() + QUICK_EXPLAINER_TTL_MS,
    });

    res.json({
      success: true,
      explainer,
    });
  } catch (error: unknown) {
    console.error("Daily session quick explainer failed:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate quick explainer",
    });
  }
});

export default router;

