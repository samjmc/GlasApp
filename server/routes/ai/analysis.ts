/**
 * Consolidated AI Analysis Routes
 * Handles AI-powered political analysis:
 * - Complete profile analysis
 * - Historical context analysis
 * - Text sentiment analysis
 * - Political profile explanations
 * - Party matching suggestions
 * - Answer explanations
 * 
 * Consolidated from:
 * - enhanced-profile.ts
 * - enhancedPoliticalProfileRoutes.ts
 * - aiAnalysis.ts
 */

import { Router, Request, Response } from "express";
import { 
  generatePoliticalProfileExplanation, 
  generatePoliticalMatches, 
  generatePolicyPredictions,
  generateHistoricalContext,
  generateAnswerExplanation,
  generateCompleteProfileAnalysis,
  generateContextAwareAnalysis,
  analyzePoliticalSentiment,
  analyzeBulkResponses
} from "../../services/openaiService";
import { z } from "zod";
import { IdeologicalDimensions } from "@shared/quizTypes";
import { db } from "../../db";
import OpenAI from "openai";

const router = Router();

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;
const MODEL = "gpt-4o";

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. AI analysis features are disabled.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ============================================
// Validation Schemas
// ============================================

const dimensionsSchema = z.object({
  economic: z.number().min(-10).max(10),
  social: z.number().min(-10).max(10),
  cultural: z.number().min(-10).max(10),
  globalism: z.number().min(-10).max(10),
  environmental: z.number().min(-10).max(10),
  authority: z.number().min(-10).max(10),
  welfare: z.number().min(-10).max(10),
  technocratic: z.number().min(-10).max(10)
});

const singleAnalysisSchema = z.object({
  text: z.string().min(1),
  questionContext: z.string()
});

const bulkAnalysisSchema = z.object({
  responses: z.array(
    z.object({
      text: z.string(),
      question: z.string()
    })
  ).min(1)
});

// ============================================
// Profile Analysis Routes
// ============================================

/**
 * POST /api/ai/complete-analysis - Complete profile analysis with optional weighting
 */
router.post("/complete-analysis", async (req, res, next) => {
  try {
    const { dimensions, weights }: { 
      dimensions: IdeologicalDimensions, 
      weights?: Record<string, number> 
    } = req.body;
    
    console.log("Complete analysis request body:", req.body);
    console.log("Using dimensions for analysis:", dimensions);
    
    if (weights) {
      console.log("Applying custom weights to analysis:", weights);
    }

    const response = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a political analyst specializing in Irish and international politics. 
          You will analyze a person's multidimensional political profile and provide detailed insights.
          Respond with a JSON object containing:
          - description: A detailed paragraph describing their political orientation
          - beliefs: An array of 4-6 core beliefs this person likely holds
          - tensions: An array of 2-3 potential political tensions or contradictions in their views
          - issue_positions: An object with positions on key issues like housing, healthcare, economy, environment, immigration`
        },
        {
          role: "user",
          content: `Analyze this multidimensional political profile and provide a detailed analysis:
          Economic (left/right): ${dimensions.economic} (-10 to +10, negative is left)
          Social (progressive/traditional): ${dimensions.social} (-10 to +10, negative is progressive)
          Cultural (cosmopolitan/nationalist): ${dimensions.cultural} (-10 to +10, negative is cosmopolitan)
          Globalism (internationalist/nationalist): ${dimensions.globalism} (-10 to +10, negative is internationalist)
          Environmental (green/industrial): ${dimensions.environmental} (-10 to +10, negative is green)
          Authority (libertarian/authoritarian): ${dimensions.authority} (-10 to +10, negative is libertarian)
          Welfare (communitarian/individualist): ${dimensions.welfare} (-10 to +10, negative is communitarian)
          Technocratic (populist/technocratic): ${dimensions.technocratic} (-10 to +10, negative is populist)
          
          ${weights ? `
          The user has customized dimension weights to emphasize certain aspects of their political profile:
          - Economic: ${weights.economic || 1}× importance
          - Social: ${weights.social || 1}× importance
          - Cultural: ${weights.cultural || 1}× importance
          - Globalism: ${weights.globalism || 1}× importance
          - Environmental: ${weights.environmental || 1}× importance
          - Authority: ${weights.authority || 1}× importance
          - Welfare: ${weights.welfare || 1}× importance
          - Technocratic: ${weights.technocratic || 1}× importance
          
          In your analysis, give more attention to dimensions with higher weights (2.0× or higher), as the user considers these aspects more important to their political identity. For dimensions with very low weights (0.5× or lower), mention them only briefly.
          ` : ''}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysisContent = JSON.parse(response.choices[0].message.content || '{}');
    
    return res.json({
      success: true,
      data: analysisContent
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/context-analysis - Historical and regional context analysis
 */
router.post("/context-analysis", async (req, res, next) => {
  try {
    const { dimensions, weights }: { 
      dimensions: IdeologicalDimensions,
      weights?: Record<string, number>
    } = req.body;
    
    const response = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a political historian specializing in comparative politics.
          You will analyze a person's multidimensional political profile and provide historical and global context.
          Respond with a JSON object containing:
          - historical_alignments: An array of historical political movements or eras
          - regional_analysis: An array of regions with alignment to their views
          - issue_analysis: An array containing issue-specific analysis
          - trending_issues: An array of strings representing current trending political issues`
        },
        {
          role: "user",
          content: `Analyze this multidimensional political profile and provide historical and global context:
          Economic: ${dimensions.economic}, Social: ${dimensions.social}, Cultural: ${dimensions.cultural}
          Globalism: ${dimensions.globalism}, Environmental: ${dimensions.environmental}
          Authority: ${dimensions.authority}, Welfare: ${dimensions.welfare}, Technocratic: ${dimensions.technocratic}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const contextAnalysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return res.json({
      success: true,
      data: contextAnalysis
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ai/explanation - Generate political profile explanation
 */
router.post("/explanation", async (req: Request, res: Response, next) => {
  try {
    const validatedDimensions = dimensionsSchema.parse(req.body);
    const explanation = await generatePoliticalProfileExplanation(validatedDimensions as IdeologicalDimensions);
    
    return res.status(200).json({
      success: true,
      data: explanation
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Text Analysis Routes
// ============================================

/**
 * POST /api/ai/analyze-text - Analyze single text response
 */
router.post("/analyze-text", async (req: Request, res: Response, next) => {
  try {
    const { text, questionContext } = singleAnalysisSchema.parse(req.body);
    
    console.log(`Analyzing political sentiment for text: "${text.substring(0, 30)}..."`);
    
    const analysis = await analyzePoliticalSentiment(text, questionContext);
    
    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        details: error.errors
      });
    }
    next(error);
  }
});

/**
 * POST /api/ai/analyze-bulk - Analyze multiple responses together
 */
router.post("/analyze-bulk", async (req: Request, res: Response, next) => {
  try {
    const { responses } = bulkAnalysisSchema.parse(req.body);
    
    console.log(`Analyzing bulk responses: ${responses.length} items`);
    
    const analysis = await analyzeBulkResponses(responses);
    
    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        details: error.errors
      });
    }
    next(error);
  }
});

export default router;

