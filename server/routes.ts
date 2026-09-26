import { optionalAuth, requireAuth, requireJob } from './auth';
import { aiRateLimit } from "./middleware/rateLimit";
import { apiNotFound } from "./middleware/apiNotFound";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { regionMiddleware } from "./middleware/regionMiddleware";
import { registerAuthRoutes } from "./routes/auth";
import aiAnalysisRoutes from "./routes/ai/analysis";
import profileRoutes from "./routes/profileRoutes";
import activityRoutes from "./routes/activityRoutes";
import quizRoutes from "./routes/quiz";
import ideologyRoutes from "./routes/ideology";
import newsRoutes from "./routes/news";
import cacheRoutes from "./routes/cacheRoutes";
import accountRoutes from "./routes/accountRoutes";
import newsAdminRoutes from "./routes/admin/news";
import baselineAdminRoutes from "./routes/admin/baselineRoutes";
import scoresRoutes from "./routes/scores";
import { dailySessionRouter, votesRouter } from "./voting/routes";
import { pledgesRouter } from "./pledges/routes";
import parliamentRoutes from "./routes/parliament";
import regionRoutes from "./routes/regionRoutes";

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
  app.use("/api/shadow", shadowRoutes); // The Shadow Cabinet
  
  // The signed-in user's own profile. Accounts themselves live in Supabase Auth.
  app.use("/api/profile", profileRoutes);
  app.use("/api/activity", activityRoutes);
  
  // Quiz analysis. LLM-backed and public by design; the limiter caps per-IP cost.
  app.use("/api/enhanced-profile", aiRateLimit, aiAnalysisRoutes);
  
  // Party pledges and the evidence that decides their status
  app.use("/api/pledges", pledgesRouter);
  
  // TD, party and constituency scores
  app.use("/api/scores", scoresRoutes);

  // Dáil divisions, debates and each TD's parliament record
  app.use("/api/parliament", parliamentRoutes);
  
  // Register news feed routes for homepage articles
  app.use("/api/news-feed", newsRoutes);
  

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
  app.use("/api/admin/baselines", requireJob, baselineAdminRoutes);
  app.use("/api/admin/td-scoring", requireJob, tdScoringAdminRoutes);


  // The quiz and ideology profiles (server/quiz, server/ideology)
  app.use("/api/quiz", quizRoutes);
  app.use("/api/ideology", ideologyRoutes);

  // Last: an unknown /api path is a JSON 404, never the SPA's index.html.
  app.use("/api", apiNotFound);

  const httpServer = createServer(app);
  return httpServer;
}
