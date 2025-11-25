import express, { Request, Response } from "express";
import { z } from "zod";
import { quizResultsService } from "../services/quizResultsService";
import { generateCompleteProfileAnalysis, generatePoliticalProfileExplanation } from "../services/openaiService";
import { IdeologicalDimensions } from "../../shared/quizTypes";

const router = express.Router();

// Define the dimensions schema for validation
const dimensionsSchema = z.object({
  economic: z.number().min(-10).max(10),
  social: z.number().min(-10).max(10),
  cultural: z.number().min(-10).max(10),
  globalism: z.number().min(-10).max(10),
  environmental: z.number().min(-10).max(10),
  authority: z.number().min(-10).max(10),
  welfare: z.number().min(-10).max(10),
  technocratic: z.number().min(-10).max(10),
});

/**
 * Save a user's quiz results
 * POST /api/profile-history/save
 */
router.post("/save", async (req: Request, res: Response) => {
  try {
    // Check if the user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to save quiz results"
      });
    }

    // Validate dimensions from the request body
    const validatedDimensions = dimensionsSchema.parse(req.body.dimensions);
    
    // Call OpenAI to generate analysis
    const analysis = await generatePoliticalProfileExplanation(validatedDimensions as IdeologicalDimensions);
    
    // Save the quiz result
    const result = await quizResultsService.saveQuizResults(
      req.session.userId, 
      validatedDimensions as IdeologicalDimensions, 
      {
        ideology: analysis.ideology,
        description: analysis.description,
        detailedAnalysis: JSON.stringify(analysis),
        politicalValues: analysis.beliefs || [],
        irishContextInsights: analysis.issue_positions || {},
      },
      req.body.shareCode
    );
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error saving quiz results:", error);
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    });
  }
});

/**
 * Get the user's active quiz result
 * GET /api/profile-history/active
 */
router.get("/active", async (req: Request, res: Response) => {
  try {
    // Check if the user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your quiz results"
      });
    }
    
    // Get the user's active quiz result
    const result = await quizResultsService.getUserActiveResult(req.session.userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No quiz results found"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error getting active quiz result:", error);
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    });
  }
});

/**
 * Get the user's quiz result history
 * GET /api/profile-history/history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    // Check if the user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your quiz history"
      });
    }
    
    // Get the user's quiz result history
    const history = await quizResultsService.getUserResultHistory(req.session.userId);
    
    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error("Error getting quiz history:", error);
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    });
  }
});

/**
 * Get changes between current and previous quiz results
 * GET /api/profile-history/changes
 */
router.get("/changes", async (req: Request, res: Response) => {
  try {
    // Check if the user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your profile changes"
      });
    }
    
    // Calculate the changes
    const changes = await quizResultsService.calculateProfileChanges(req.session.userId);
    
    if (!changes) {
      return res.status(404).json({
        success: false,
        message: "No previous quiz results found to compare"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: changes
    });
  } catch (error) {
    console.error("Error calculating profile changes:", error);
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    });
  }
});

/**
 * Get a quiz result by share code (public route)
 * GET /api/profile-history/shared/:shareCode
 */
router.get("/shared/:shareCode", async (req: Request, res: Response) => {
  try {
    const { shareCode } = req.params;
    
    // Get the quiz result by share code
    const result = await quizResultsService.getResultByShareCode(shareCode);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No quiz result found with that share code"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error getting shared quiz result:", error);
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred"
    });
  }
});

export default router;