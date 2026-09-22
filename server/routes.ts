import { optionalAuth, requireAuth, requireJob } from './auth';
import { aiRateLimit } from "./middleware/rateLimit";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertQuizResultSchema } from "@shared/schema";
import { ActivityTracker } from "./services/activityTracker";
import { regionMiddleware } from "./middleware/regionMiddleware";
import { registerAuthRoutes } from "./routes/auth";
import aiAnalysisRoutes from "./routes/ai/analysis";
import geographicRoutes from "./routes/geographic";
import profileRoutes from "./routes/profileRoutes";
import botRoutes from "./routes/botRoutes";
import activityRoutes from "./routes/activityRoutes";
import politicalEvolutionRoutes from "./routes/politicalEvolutionRoutes";
import quizRoutes from "./routes/quiz";
import conflictDataRoutes from "./routes/conflictData";
import smsRoutes from "./routes/smsRoutes";
import storytellingRoutes from "./routes/storytellingRoutes";
import chatRoutes from "./routes/chatRoutes";
import electionRoutes from "./routes/electionRoutes";
import politicalRoutes from "./routes/political";
import ideasRoutes from "./routes/ideasRoutes";
import problemsRoutes from "./routes/problemsRoutes";
import parliamentaryRoutes from "./routes/parliamentary";
import newsRoutes from "./routes/news";
import cacheRoutes from "./routes/cacheRoutes";
import accountRoutes from "./routes/accountRoutes";
import newsAdminRoutes from "./routes/admin/news";
import parliamentaryAdminRoutes from "./routes/admin/parliamentaryRoutes";
import baselineAdminRoutes from "./routes/admin/baselineRoutes";
import { PersonalRankingsService } from "./services/personalRankingsService.js";
import scoresRoutes from "./routes/scores";
import userRankingsRoutes from "./routes/user/rankings/index.js";
import ideologyTimelineRoutes from "./routes/ideologyTimelineRoutesEnhanced";
import { dailySessionRouter, votesRouter } from "./voting/routes";
import debateWorkspaceRoutes from "./routes/debateWorkspaceRoutes";
import debatesRoutes from "./routes/debatesRoutes";
import debateMonitoringRoutes from "./routes/debateMonitoringRoutes";
import regionRoutes from "./routes/regionRoutes";
import politicianChatRoutes from "./routes/politicianChatRoutes";

import debateAdminRoutes from "./routes/admin/debateAdminRoutes";
import tdScoringAdminRoutes from "./routes/admin/tdScoringRoutes";
import shadowRoutes from "./routes/shadowRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Identity comes from the Supabase bearer token on each request; there is no
  // server-side session. optionalAuth runs first so regionMiddleware can read the
  // user's saved region, and so handlers can offer a signed-in view without a guard.
  app.use(optionalAuth);
  app.use(regionMiddleware);
  app.use("/api/region", regionRoutes);

  
  // Setup Supabase auth routes
  await registerAuthRoutes(app);
  
  // Register API routes
  // LLM-backed endpoints are public by design; the limiter caps per-IP cost.
  app.use("/api/ai", aiRateLimit, aiAnalysisRoutes);
  app.use("/api/ai", aiRateLimit, quizRoutes); // Quiz assistant
  app.use("/api/chat", aiRateLimit, chatRoutes);
  app.use("/api/chat", aiRateLimit, politicianChatRoutes); // Digital Twin politician chat
  app.use("/api/shadow", shadowRoutes); // The Shadow Cabinet
  
  // Register geographic routes (consolidated - includes constituencies, location, heatmap)
  app.use("/api/geographic", geographicRoutes);
  app.use("/api/geographic", conflictDataRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/heatmap", geographicRoutes);
  app.use("/api/constituencies", geographicRoutes);
  app.use("/api/location", geographicRoutes);
  // The signed-in user's own profile. Accounts themselves live in Supabase Auth.
  app.use("/api/profile", profileRoutes);
  app.use("/api/bots", botRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/political-evolution", politicalEvolutionRoutes);
  app.use("/api/sms", smsRoutes);
  
  // Register storytelling routes with server-side caching
  app.use("/api/constituency/story", aiRateLimit, storytellingRoutes);
  
  // Register the 2024 Irish Election Results routes
  app.use("/api/elections", electionRoutes);
  
  // Enhanced profile now in AI analysis module
  app.use("/api/enhanced-profile", aiRateLimit, aiAnalysisRoutes);
  
  // Register consolidated political routes (includes parties, pledges, sentiment)
  app.use("/api/political", politicalRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/parties", politicalRoutes);
  app.use("/api/party-match", politicalRoutes);
  app.use("/api/party-dimensions", politicalRoutes);
  app.use("/api/dimension-explanations", politicalRoutes);
  app.use("/api/pledges", politicalRoutes);
  app.use("/api/party-sentiment", politicalRoutes);
  
  // TD, party and constituency scores
  app.use("/api/scores", scoresRoutes);

  // Parliamentary activity (static Oireachtas data)
  app.use("/api/parliamentary", parliamentaryRoutes);
  
  // Register ideas routes for community solutions
  app.use("/api/ideas", ideasRoutes);
  
  // Register problems routes for two-tier voting system
  app.use("/api/problems", problemsRoutes);
  
  // Register news feed routes for homepage articles
  app.use("/api/news-feed", newsRoutes);
  app.use("/api/debate-monitoring", debateMonitoringRoutes);
  app.use("/api/debate-workspace", debateWorkspaceRoutes);
  app.use("/api/debates", debatesRoutes);
  
  // Register user rankings routes (consolidated - personal rankings, policy voting, category rankings)
  app.use("/api/user/rankings", userRankingsRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/personal", userRankingsRoutes);
  app.use("/api/category-ranking", userRankingsRoutes);

  // Voting: the daily session and the policy question on each article
  app.use("/api/daily-session", dailySessionRouter);
  app.use("/api/votes", votesRouter);

  // Register cache management routes for monitoring and clearing cache
  app.use("/api/cache", requireJob, cacheRoutes);
  // Account deletion endpoint is now consolidated into auth routes
  // Account deletion (GDPR erasure). Was imported but never mounted, so DELETE
  // /api/account — which the client calls — returned 404.
  app.use("/api/account", accountRoutes);

  // Register admin routes for news scraping and system management
  app.use("/api/admin/news", requireJob, newsAdminRoutes);
  app.use("/api/admin/parliamentary", requireJob, parliamentaryAdminRoutes);
  app.use("/api/admin/debates", requireJob, debateAdminRoutes);
  app.use("/api/admin/baselines", requireJob, baselineAdminRoutes);
  app.use("/api/admin/td-scoring", requireJob, tdScoringAdminRoutes);


  // Register ideology timeline routes (weekly ideology evolution data)
  app.use("/api/ideology-timeline", ideologyTimelineRoutes);

  // Register quiz routes (consolidated - includes history and AI assistant)
  app.use("/api/quiz-history", quizRoutes);

  // API route to save quiz results
  app.post("/api/quiz-results", async (req: Request, res: Response) => {
    try {
      // Use the Zod schema from shared/schema.ts
      const resultsSchema = z.object({
        economicScore: z.number(),
        socialScore: z.number(),
        ideology: z.string(),
        description: z.string(),
        answers: z.array(z.object({
          questionId: z.number(),
          answerId: z.number().optional(),
          customAnswer: z.string().optional(),
        })),
        similarFigures: z.array(z.object({
          id: z.string(),
          name: z.string(),
          economic: z.number(),
          social: z.number(),
          description: z.string(),
          imageUrl: z.string(),
          distance: z.number().optional(),
        })),
        uniqueCombinations: z.array(z.object({
          title: z.string(),
          description: z.string(),
        })),
        shareCode: z.string(),
        keyInsights: z.array(z.string()).optional(),
      });

      const validatedData = resultsSchema.parse(req.body);
      // Anonymous visitors may take the quiz, so the result is saved either way — but a
      // result is attributed to whoever's token presented it, never to a body field.
      const userId = req.user?.id ?? null;

      // Save the results
      const result = await storage.saveQuizResult({
        economicScore: validatedData.economicScore.toString(),
        socialScore: validatedData.socialScore.toString(),
        ideology: validatedData.ideology,
        description: validatedData.description,
        answers: validatedData.answers,
        similarFigures: validatedData.similarFigures,
        uniqueCombinations: validatedData.uniqueCombinations,
        shareCode: validatedData.shareCode,
        userId,
        keyInsights: validatedData.keyInsights || [],
      });

      // Track quiz completion activity
      if (userId) {
        try {
          await ActivityTracker.logQuizCompletion(
            userId,
            {
              economicScore: validatedData.economicScore,
              socialScore: validatedData.socialScore,
              ideology: validatedData.ideology
            },
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent')
          );
        } catch (activityError) {
          console.error('Failed to log quiz completion activity:', activityError);
          // Continue with the response even if activity logging fails
        }
      }
      
      res.status(201).json({ 
        success: true, 
        result: {
          id: result.id,
          shareCode: result.shareCode
        }
      });
    } catch (error) {
      console.error("Error saving quiz results:", error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Invalid input" 
      });
    }
  });

  // API route to get shared results
  app.get("/api/quiz-results/:shareCode", async (req: Request, res: Response) => {
    try {
      const { shareCode } = req.params;
      
      if (!shareCode || typeof shareCode !== "string") {
        return res.status(400).json({ 
          success: false, 
          message: "Share code is required" 
        });
      }
      
      const result = await storage.getQuizResultByShareCode(shareCode);
      
      if (!result) {
        return res.status(404).json({ 
          success: false, 
          message: "Results not found" 
        });
      }
      
      // Return the full result
      res.json(result);
    } catch (error) {
      console.error("Error retrieving quiz results:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to retrieve results" 
      });
    }
  });

  // API route to save multidimensional quiz results with political evolution tracking
  app.post("/api/multidimensional-quiz-results", async (req: Request, res: Response) => {
    try {
      const resultsSchema = z.object({
        economic: z.number(),
        social: z.number(),
        cultural: z.number(),
        globalism: z.number(),
        environmental: z.number(),
        authority: z.number(),
        welfare: z.number(),
        technocratic: z.number(),
        shareCode: z.string(),
        answers: z.array(z.object({
          questionId: z.number(),
          answerId: z.number().optional(),
          customAnswer: z.string().optional(),
        })).optional()
      });

      const validatedData = resultsSchema.parse(req.body);
      
      // If user is authenticated, save to political evolution tracking (primary storage)
      let evolutionResult = null;
      const userId = req.user?.id ?? null;
      if (userId) {
        try {
          evolutionResult = await storage.savePoliticalEvolution({
            userId: userId,
            economicScore: validatedData.economic.toString(),
            socialScore: validatedData.social.toString(),
            culturalScore: validatedData.cultural.toString(),
            globalismScore: validatedData.globalism.toString(),
            environmentalScore: validatedData.environmental.toString(),
            authorityScore: validatedData.authority.toString(),
            welfareScore: validatedData.welfare.toString(),
            technocraticScore: validatedData.technocratic.toString(),
            ideology: "Multidimensional Profile",
            quizVersion: "enhanced",
            notes: "Enhanced quiz completion"
          });
          console.log("Successfully saved political evolution data for user:", userId);
        } catch (evolutionError) {
          console.error("Failed to save political evolution data:", evolutionError);
          throw evolutionError; // Fail if we can't save the main data
        }

        if (typeof userId === "string") {
          try {
            const legacyAnswers = PersonalRankingsService.convertEnhancedDimensionsToLegacyAnswers({
              economic: validatedData.economic,
              social: validatedData.social,
              cultural: validatedData.cultural,
              globalism: validatedData.globalism,
              environmental: validatedData.environmental,
              authority: validatedData.authority,
              welfare: validatedData.welfare,
              technocratic: validatedData.technocratic,
            });

            await PersonalRankingsService.saveQuizResults(userId, legacyAnswers, {
              asyncRecalculation: true,
            });
          } catch (syncError) {
            console.error("Failed to sync enhanced quiz with personal rankings:", syncError);
          }
        }
      }

      // Also save basic quiz result for sharing purposes
      let result;
      try {
        result = await storage.saveQuizResult({
          economicScore: validatedData.economic.toString(),
          socialScore: validatedData.social.toString(),
          ideology: "Multidimensional Profile",
          description: "Enhanced political compass results",
          answers: validatedData.answers || [],
          similarFigures: [],
          uniqueCombinations: [],
          shareCode: validatedData.shareCode,
          userId: userId || null,
          keyInsights: [],
        });
      } catch (quizError) {
        console.log("Quiz results save failed, but political evolution saved successfully");
        // Use evolution result if quiz save fails
        result = { id: evolutionResult?.id || 1, shareCode: validatedData.shareCode };
      }
      
      res.status(201).json({ 
        success: true, 
        result: {
          id: result.id,
          shareCode: result.shareCode
        }
      });
    } catch (error) {
      console.error("Error saving multidimensional quiz results:", error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Invalid input" 
      });
    }
  });

  // Bot behavior management routes
  app.post('/api/bots/:id/behavior/start', requireJob, async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
      if (!Number.isInteger(botId) || botId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bot id' });
      }
      const { botBehaviorService } = await import('./services/botBehaviorService');
      
      const config = {
        botId,
        activityTypes: req.body.activityTypes || [],
        frequency: req.body.frequency || 'medium',
        interactionPatterns: req.body.interactionPatterns || {}
      };

      await botBehaviorService.startBotBehavior(config);
      res.json({ success: true, message: 'Bot behavior started' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to start bot behavior' });
    }
  });

  app.post('/api/bots/:id/behavior/stop', requireJob, async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
      if (!Number.isInteger(botId) || botId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bot id' });
      }
      const { botBehaviorService } = await import('./services/botBehaviorService');
      
      botBehaviorService.stopBotBehavior(botId);
      res.json({ success: true, message: 'Bot behavior stopped' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to stop bot behavior' });
    }
  });

  app.get('/api/bots/:id/activity', requireJob, async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
      if (!Number.isInteger(botId) || botId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid bot id' });
      }
      const days = parseInt(req.query.days as string) || 7;
      const { botBehaviorService } = await import('./services/botBehaviorService');
      
      const activity = await botBehaviorService.getBotActivity(botId, days);
      res.json({ success: true, activity });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to get bot activity' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
