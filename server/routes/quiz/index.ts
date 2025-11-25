/**
 * Consolidated Quiz Routes
 * Handles all quiz-related operations:
 * - Quiz history tracking
 * - Quiz result saving
 * - Political opinion change analysis
 * - AI quiz assistant
 * 
 * Consolidated from:
 * - quizHistoryRoutes.ts
 * - quizAssistant.ts
 */

import express, { Request, Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { quizHistoryService } from "../../services/quizHistoryService";
import { generatePoliticalProfileExplanation } from "../../services/openaiService";
import { IdeologicalDimensions } from "@shared/quizTypes";
import { isAuthenticated } from "../../replitAuth";

const router = express.Router();

// Initialize the OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required but not set. Quiz AI assistant features are disabled.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024
const MODEL = "gpt-4o";

// ============================================
// Validation Schemas
// ============================================

// Input validation schema for dimensions
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

// Schema for quiz assistant requests
const assistantRequestSchema = z.object({
  questionText: z.string(),
  questionContext: z.string(),
  userQuestion: z.string(),
  conversationHistory: z.array(z.object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    content: z.string()
  }))
});

// ============================================
// Quiz History Routes
// ============================================

/**
 * Save quiz results and make previous ones historical
 * POST /api/quiz-history/save
 */
router.post("/save", async (req: Request, res: Response, next) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to save quiz results"
      });
    }
    
    // Validate the dimensions
    const validatedDimensions = dimensionsSchema.parse(req.body.dimensions);
    
    // Generate ideology and description using OpenAI
    let ideology = req.body.ideology;
    let description = req.body.description;
    
    // If not provided, generate them
    if (!ideology || !description) {
      try {
        const analysis = await generatePoliticalProfileExplanation(validatedDimensions as IdeologicalDimensions);
        ideology = analysis.ideology || "";
        description = analysis.description || "";
      } catch (aiError) {
        console.error("Error generating analysis:", aiError);
        // Continue without AI-generated content
      }
    }
    
    // Save the quiz result
    const result = await quizHistoryService.saveQuizResult(
      req.session.userId,
      validatedDimensions as IdeologicalDimensions,
      ideology,
      description
    );
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all quiz history for the authenticated user
 * GET /api/quiz-history/all
 */
router.get("/all", isAuthenticated, async (req: Request, res: Response, next) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found"
      });
    }
    
    // Return empty array for now - will implement full functionality later
    return res.status(200).json({
      success: true,
      data: []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get the current quiz result for the authenticated user
 * GET /api/quiz-history/current
 */
router.get("/current", async (req: Request, res: Response, next) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your current quiz result"
      });
    }
    
    // Get the user's current quiz result
    const result = await quizHistoryService.getCurrentQuizResult(req.session.userId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "No current quiz result found"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get the changes between current and previous quiz results
 * GET /api/quiz-history/changes
 */
router.get("/changes", async (req: Request, res: Response, next) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: "You must be logged in to view your quiz result changes"
      });
    }
    
    // Calculate the changes
    const changes = await quizHistoryService.calculateChanges(req.session.userId);
    
    if (!changes) {
      return res.status(404).json({
        success: false,
        message: "Not enough quiz results to calculate changes"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: changes
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// AI Quiz Assistant
// ============================================

/**
 * AI Quiz Assistant - Get help understanding quiz questions
 * POST /api/ai/quiz-assistant
 */
router.post("/assistant", async (req: Request, res: Response, next) => {
  try {
    const { questionText, questionContext, userQuestion, conversationHistory } = 
      assistantRequestSchema.parse(req.body);
    
    console.log(`Quiz assistant handling question about: "${questionText.substring(0, 30)}..."`);
    
    // Format the conversation history for OpenAI
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }));
    
    // Add system message with instructions
    const messages = [
      {
        role: "system",
        content: `You are a helpful political compass AI assistant providing educational context about political questions.
        
        Current question from the political compass quiz: "${questionText}"
        
        Your role:
        - Provide educational context and explanations about political concepts mentioned in the question
        - Present multiple perspectives from different political viewpoints in a balanced way
        - Explain relevant terminology in an accessible way
        - Help users think through the implications of different positions
        - NEVER tell the user which answer they should choose
        - Do NOT attempt to influence their political views in any particular direction
        - Keep responses concise and educational (max 150 words)
        - Maintain a helpful, neutral tone
        
        Be focused on education rather than persuasion. Your goal is to help users understand the question better, not to influence their political views.`
      },
      ...formattedHistory.slice(-10), // Include last 10 messages for context
      {
        role: "user",
        content: userQuestion
      }
    ];
    
    const response = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: messages as any, // Type assertion needed due to OpenAI types
      max_tokens: 500, // Limit response length
      temperature: 0.7 // Some creativity but not too random
    });
    
    const answer = response.choices[0].message.content || 
      "I'm sorry, I couldn't generate a helpful response.";
    
    return res.json({
      success: true,
      answer
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

