/**
 * AI narrative for a quiz result: the two analyses the results page shows.
 * Mounted at /api/ai and /api/enhanced-profile. Positions follow shared/ideology.ts.
 */

import { Router } from "express";
import { z } from "zod";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT, type IdeologyVector } from "@shared/ideology";
import { callChatCompletion } from "../../services/aiService";

const router = Router();

const MODEL = "gpt-4o";

const axis = z.number().min(-IDEOLOGY_LIMIT).max(IDEOLOGY_LIMIT);

const analysisInputSchema = z.object({
  dimensions: z.object(
    Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, axis])) as Record<(typeof IDEOLOGY_DIMENSIONS)[number], typeof axis>,
  ),
  weights: z.record(z.string(), z.number().min(0).max(3)).optional(),
});

/** One line per dimension, each naming its poles, so the model reads the signs right. */
function describePosition(v: IdeologyVector): string {
  return IDEOLOGY_DIMENSIONS.map((d) => {
    const { label, negative, positive } = DIMENSION_POLES[d];
    return `${label}: ${v[d]} (-10 = ${negative}, +10 = ${positive})`;
  }).join("\n");
}

function describeWeights(weights: Record<string, number> | undefined): string {
  if (!weights) return "";
  const lines = IDEOLOGY_DIMENSIONS.map((d) => `- ${DIMENSION_POLES[d].label}: ${weights[d] ?? 1}x importance`).join("\n");
  return `\nThe user weighted how much each dimension matters to them:\n${lines}\nGive more attention to dimensions weighted 2x or more; mention those at 0.5x or less only briefly.`;
}

async function jsonAnalysis(system: string, user: string, operation: string): Promise<unknown> {
  const response = await callChatCompletion(
    {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    },
    { operation },
  );
  return JSON.parse(response.choices[0]?.message.content || "{}");
}

/** POST /complete-analysis — description, beliefs, tensions and issue positions. */
router.post("/complete-analysis", async (req, res, next) => {
  try {
    const input = analysisInputSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: "Invalid request data", details: input.error.errors });
    const data = await jsonAnalysis(
      `You are a political analyst specialising in Irish and international politics.
Analyse a person's multidimensional political profile. Respond with a JSON object containing:
- description: a detailed paragraph describing their political orientation
- beliefs: an array of 4-6 core beliefs this person likely holds
- tensions: an array of 2-3 potential tensions or contradictions in their views
- issue_positions: an object with positions on housing, healthcare, economy, environment, immigration`,
      `Analyse this profile:\n${describePosition(input.data.dimensions)}${describeWeights(input.data.weights)}`,
      "completeAnalysis",
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** POST /context-analysis — historical and regional context. */
router.post("/context-analysis", async (req, res, next) => {
  try {
    const input = analysisInputSchema.safeParse(req.body);
    if (!input.success) return res.status(400).json({ success: false, message: "Invalid request data", details: input.error.errors });
    const data = await jsonAnalysis(
      `You are a political historian specialising in comparative politics.
Give historical and global context for a person's multidimensional political profile. Respond with a JSON object containing:
- historical_alignments: an array of historical political movements or eras
- regional_analysis: an array of regions whose politics align with their views
- issue_analysis: an array of issue-specific analyses
- trending_issues: an array of strings naming current political issues`,
      `Analyse this profile:\n${describePosition(input.data.dimensions)}`,
      "contextAnalysis",
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
