import { Router } from "express";
import { runShadowCabinet } from "../services/shadowCabinet";
import { db } from "../db";
import { shadowCabinetAnalyses, qaAudits } from "@shared/schema";
import { desc } from "drizzle-orm";

const router = Router();

router.post("/analyze", async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        console.log(`Received request to analyze: ${url}`);
        const analysis = await runShadowCabinet(url);

        if (!analysis) {
            return res.status(500).json({ error: "Failed to analyze article" });
        }

        res.json(analysis);
    } catch (error) {
        console.error("Error in shadow cabinet route:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/history", async (req, res) => {
    try {
        const history = await db.select().from(shadowCabinetAnalyses).orderBy(desc(shadowCabinetAnalyses.createdAt)).limit(50);
        res.json(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/qa-history", async (req, res) => {
    try {
        const history = await db.select().from(qaAudits).orderBy(desc(qaAudits.createdAt)).limit(20);
        res.json(history);
    } catch (error) {
        console.error("Error fetching QA history:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;