import { optionalAuth, requireAuth, requireJob } from './auth';
import { aiRateLimit } from "./middleware/rateLimit";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { regionMiddleware } from "./middleware/regionMiddleware";
import { registerAuthRoutes } from "./routes/auth";
import aiAnalysisRoutes from "./routes/ai/analysis";
import geographicRoutes from "./routes/geographic";
import profileRoutes from "./routes/profileRoutes";
import botRoutes from "./routes/botRoutes";
import activityRoutes from "./routes/activityRoutes";
import quizRoutes from "./routes/quiz";
import ideologyRoutes from "./routes/ideology";
import conflictDataRoutes from "./routes/conflictData";
import smsRoutes from "./routes/smsRoutes";
import storytellingRoutes from "./routes/storytellingRoutes";
import chatRoutes from "./routes/chatRoutes";
import electionRoutes from "./routes/electionRoutes";
import politicalRoutes from "./routes/political";
import ideasRoutes from "./routes/ideasRoutes";
import problemsRoutes from "./routes/problemsRoutes";
import parliamentaryRoutes from "./routes/parliamentary";
import newsFeedRoutes from "./routes/newsFeedRoutes";
import cacheRoutes from "./routes/cacheRoutes";
import accountRoutes from "./routes/accountRoutes";
import newsScraperRoutes from "./routes/admin/newsScraperRoutes";
import parliamentaryAdminRoutes from "./routes/admin/parliamentaryRoutes";
import baselineAdminRoutes from "./routes/admin/baselineRoutes";
import manualArticleRoutes from "./routes/admin/manualArticleRoutes";
import scoresRoutes from "./routes/scores";
import userRankingsRoutes from "./routes/user/rankings/index.js";
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
  app.use("/api/news-feed", newsFeedRoutes);
  app.use("/api/debate-monitoring", debateMonitoringRoutes);
  app.use("/api/debate-workspace", debateWorkspaceRoutes);
  app.use("/api/debates", debatesRoutes);
  
  // Category rankings (pledges). Personal rankings moved to /api/ideology.
  app.use("/api/user/rankings", userRankingsRoutes);
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
  app.use("/api/admin/news-scraper", requireJob, newsScraperRoutes);
  app.use("/api/admin/parliamentary", requireJob, parliamentaryAdminRoutes);
  app.use("/api/admin/debates", requireJob, debateAdminRoutes);
  app.use("/api/admin/baselines", requireJob, baselineAdminRoutes);
  app.use("/api/admin/articles", requireJob, manualArticleRoutes);
  app.use("/api/admin/td-scoring", requireJob, tdScoringAdminRoutes);


  // The quiz and ideology profiles (server/quiz, server/ideology)
  app.use("/api/quiz", quizRoutes);
  app.use("/api/ideology", ideologyRoutes);

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
