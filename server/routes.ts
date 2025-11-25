import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertQuizResultSchema } from "@shared/schema";
import { ActivityTracker } from "./services/activityTracker";
import { sessionMiddleware } from "./middleware/sessionMiddleware";
import { regionMiddleware } from "./middleware/regionMiddleware";
import { registerAuthRoutes } from "./routes/auth";
import { isAuthenticated, optionalAuth } from "./auth/supabaseAuth";
import aiAnalysisRoutes from "./routes/ai/analysis";
import geographicRoutes from "./routes/geographic";
import authRoutes from "./routes/authRoutes";
import botRoutes from "./routes/botRoutes";
import activityRoutes from "./routes/activityRoutes";
import politicalEvolutionRoutes from "./routes/politicalEvolutionRoutes";
import quizRoutes from "./routes/quiz";
import conflictDataRoutes from "./routes/conflictData";
import smsRoutes from "./routes/smsRoutes";
import storytellingRoutes from "./routes/storytellingRoutes";
import chatRoutes from "./routes/chatRoutes";
import electionRoutes from "./routes/electionRoutes";
import personalizedInsightsRoutes from "./routes/personalizedInsightsRoutes";
import partyRoutes from "./routes/political/parties";
import pledgeRoutes from "./routes/political/pledges";
import parliamentaryActivityRoutes from "./routes/parliamentaryActivityRoutes";
import categoryRankingRoutes from "./routes/categoryRankingRoutes";
import partySentimentRoutes from "./routes/partySentimentRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import ideasRoutes from "./routes/ideasRoutes";
import problemsRoutes from "./routes/problemsRoutes";
import parliamentaryScoresRoutes from "./routes/parliamentary/scores";
import enhancedProfilesRoutes from "./routes/parliamentary/enhanced-profiles";
import constituencyRoutes from "./routes/parliamentary/constituencies";
import newsFeedRoutes from "./routes/newsFeedRoutes";
import cacheRoutes from "./routes/cacheRoutes";
import accountRoutes from "./routes/accountRoutes";
import newsScraperRoutes from "./routes/admin/newsScraperRoutes";
import parliamentaryAdminRoutes from "./routes/admin/parliamentaryRoutes";
import baselineAdminRoutes from "./routes/admin/baselineRoutes";
import manualArticleRoutes from "./routes/admin/manualArticleRoutes";
import { PersonalRankingsService } from "./services/personalRankingsService.js";
import tdRatingsRoutes from "./routes/ratings/tdRatings";
import researchedTDsRoutes from "./api/researched-tds";
import policyVotingRoutes from "./routes/policyVotingRoutes";
import personalRankingsRoutes from "./routes/personalRankingsRoutes";
import ideologyTimelineRoutes from "./routes/ideologyTimelineRoutesEnhanced";
import dailySessionRoutes from "./routes/dailySessionRoutes";
import debateWorkspaceRoutes from "./routes/debateWorkspaceRoutes";
import debatesRoutes from "./routes/debatesRoutes";
import debateMonitoringRoutes from "./routes/debateMonitoringRoutes";
import regionRoutes from "./routes/regionRoutes";
import politicianChatRoutes from "./routes/politicianChatRoutes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware
  app.use(sessionMiddleware);
  app.use(regionMiddleware);
  app.use("/api/region", regionRoutes);

  
  // Setup Supabase auth routes
  await registerAuthRoutes(app);
  
  // Register API routes
  app.use("/api/ai", aiAnalysisRoutes);
  app.use("/api/ai", quizRoutes); // Quiz assistant
  app.use("/api/chat", chatRoutes);
  app.use("/api/chat", politicianChatRoutes); // Digital Twin politician chat
  
  // Register geographic routes (consolidated - includes constituencies, location, heatmap)
  app.use("/api/geographic", geographicRoutes);
  app.use("/api/geographic", conflictDataRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/heatmap", geographicRoutes);
  app.use("/api/constituencies", geographicRoutes);
  app.use("/api/location", geographicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/bots", botRoutes);
  app.use("/api/activity", activityRoutes);
  app.use("/api/political-evolution", politicalEvolutionRoutes);
  app.use("/api/sms", smsRoutes);
  
  // Register storytelling routes with server-side caching
  app.use("/api/constituency/story", storytellingRoutes);
  
  // Register the 2024 Irish Election Results routes
  app.use("/api/elections", electionRoutes);
  
  // Register the Personalized Constituency Insights routes
  app.use("/api/personalized-insights", personalizedInsightsRoutes);
  // Enhanced profile now in AI analysis module
  app.use("/api/enhanced-profile", aiAnalysisRoutes);
  
  // Register party routes (consolidated - includes matching, dimensions, info, explanations)
  app.use("/api/parties", partyRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/party-match", partyRoutes);
  app.use("/api/party-dimensions", partyRoutes);
  app.use("/api/dimension-explanations", partyRoutes);
  
  // Register pledge tracking routes (consolidated - includes voting and weighting)
  app.use("/api/pledges", pledgeRoutes);
  
  // Register category ranking routes for simplified importance voting
  app.use("/api/category-ranking", categoryRankingRoutes);
  
  // Register parliamentary activity routes for TD performance data
  app.use("/api/parliamentary-activity", parliamentaryActivityRoutes);
  
  // Register party sentiment routes for public trust voting
  app.use("/api/party-sentiment", partySentimentRoutes);
  
  // Register dashboard routes for consistent metrics across environments
  app.use("/api", dashboardRoutes);
  
  // Register parliamentary/TD scoring routes (consolidated - includes trust, performance, questions, unified, ELO)
  app.use("/api/parliamentary/scores", parliamentaryScoresRoutes);
  // Legacy routes for backward compatibility
  app.use("/api/td-scores", parliamentaryScoresRoutes);
  app.use("/api/unified-td-scores", parliamentaryScoresRoutes);
  app.use("/api/trust-scores", parliamentaryScoresRoutes);
  app.use("/api/performance-scores", parliamentaryScoresRoutes);
  
  // Register enhanced parliamentary profiles routes (detailed TD & party info)
  app.use("/api/parliamentary", enhancedProfilesRoutes);
  
  // Register constituency routes (constituency analytics and TD listings by area)
  app.use("/api/parliamentary", constituencyRoutes);
  
  // Register ideas routes for community solutions
  app.use("/api/ideas", ideasRoutes);
  
  // Register problems routes for two-tier voting system
  app.use("/api/problems", problemsRoutes);
  
  // Register news feed routes for homepage articles
  app.use("/api/news-feed", newsFeedRoutes);
  app.use("/api/debate-monitoring", debateMonitoringRoutes);
  app.use("/api/debate-workspace", debateWorkspaceRoutes);
  app.use("/api/debates", debatesRoutes);
  
  // Register policy voting routes for neutral facts + user voting system
  app.use("/api/policy-votes", policyVotingRoutes);
  app.use("/api/daily-session", dailySessionRoutes);
  
  // Register cache management routes for monitoring and clearing cache
  app.use("/api/cache", cacheRoutes);
  app.use("/api/account", accountRoutes);
  
  // Register admin routes for news scraping and system management
  app.use("/api/admin/news-scraper", newsScraperRoutes);
  app.use("/api/admin/parliamentary", parliamentaryAdminRoutes);
  app.use("/api/admin/baselines", baselineAdminRoutes);
  app.use("/api/admin/articles", manualArticleRoutes);
  
  // Register user rating routes for TDs
  app.use("/api/ratings", tdRatingsRoutes);
  
  // Register personal rankings routes (quiz, policy voting, personalized TD rankings)
  app.use("/api/personal", personalRankingsRoutes);
  
  // Register ideology timeline routes (weekly ideology evolution data)
  app.use("/api/ideology-timeline", ideologyTimelineRoutes);
  
  // Register researched TDs routes (TDs with historical baseline research completed)
  app.use("/api/researched-tds", researchedTDsRoutes);
  
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
        userId: z.number().optional(),
        keyInsights: z.array(z.string()).optional(),
      });

      const validatedData = resultsSchema.parse(req.body);
      
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
        userId: validatedData.userId || null,
        keyInsights: validatedData.keyInsights || [],
      });

      // Track quiz completion activity
      if (validatedData.userId) {
        try {
          await ActivityTracker.logQuizCompletion(
            validatedData.userId,
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
      const userId = req.user?.claims?.sub || req.session?.userId;
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
  app.post('/api/bots/:id/behavior/start', async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
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

  app.post('/api/bots/:id/behavior/stop', async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
      const { botBehaviorService } = await import('./services/botBehaviorService');
      
      botBehaviorService.stopBotBehavior(botId);
      res.json({ success: true, message: 'Bot behavior stopped' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to stop bot behavior' });
    }
  });

  app.get('/api/bots/:id/activity', async (req, res) => {
    try {
      const botId = parseInt(req.params.id);
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
