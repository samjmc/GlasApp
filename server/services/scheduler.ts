import cron from "node-cron";
import { runShadowCabinet, fetchTopPoliticalNews } from "./shadowCabinet";
import { runInternalAudit } from "./qaAgent";
import { runDailyNewsScraper } from "../jobs/dailyNewsScraper";

// Lazy imports for scoring services (avoids circular dependency issues)
let ArticleTriageJob: any = null;
let NewsToTDScoringService: any = null;

async function loadScoringServices() {
  if (!ArticleTriageJob) {
    const triageModule = await import("../jobs/articleTriageJob.js");
    ArticleTriageJob = triageModule.ArticleTriageJob;
  }
  if (!NewsToTDScoringService) {
    const scoringModule = await import("./newsToTDScoringService.js");
    NewsToTDScoringService = scoringModule.NewsToTDScoringService;
  }
}

export function initScheduler() {
  console.log("⏰ Scheduler initialized.");
  console.log("   📋 Article Triage: Every 30 minutes");
  console.log("   🎯 TD Scoring: Every 2 hours");
  console.log("   📰 News Scraper: Every 4 hours");
  console.log("   🗞️ Daily Briefing: 7:00 AM Dublin");
  console.log("   🕵️ QA Audit: Sundays at midnight");

  // ═══════════════════════════════════════════════════════════════════
  // NEWS SCORING PIPELINE (Multi-Agent Team)
  // ═══════════════════════════════════════════════════════════════════

  // Article Triage - Every 30 minutes
  // Quick importance scoring, sets visibility, marks top 25% for full scoring
  // Cost: ~$0.0005 per article
  cron.schedule('*/30 * * * *', async () => {
    console.log("\n📋 [Scheduler] Running Article Triage...");
    try {
      await loadScoringServices();
      const stats = await ArticleTriageJob.run({
        batchSize: 30,
        topPercentile: 25,
        minImportanceForScoring: 40
      });
      console.log(`✅ [Scheduler] Triage complete: ${stats.articlesProcessed} articles processed, ${stats.articlesMarkedForScoring} marked for scoring`);
    } catch (error: any) {
      console.error("❌ [Scheduler] Article triage failed:", error.message);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });

  // TD Scoring - Every 2 hours
  // Full multi-agent scoring (6-8 LLM calls per article)
  // Updates TD ELO scores, ideology profiles, generates policy opportunities
  // Cost: ~$0.05-0.10 per unique event
  cron.schedule('0 */2 * * *', async () => {
    console.log("\n🎯 [Scheduler] Running TD Scoring (Multi-Agent Team)...");
    try {
      await loadScoringServices();
      const stats = await NewsToTDScoringService.processUnprocessedArticles({
        batchSize: 50,
        topPercentile: 25,
        minImportanceScore: 40
      });
      console.log(`✅ [Scheduler] TD Scoring complete:`);
      console.log(`   • Articles processed: ${stats.articlesProcessed}`);
      console.log(`   • TDs updated: ${stats.tdsUpdated}`);
      console.log(`   • Scores changed: ${stats.scoresChanged}`);
      if (stats.errors > 0) {
        console.warn(`   ⚠️ Errors: ${stats.errors}`);
      }
    } catch (error: any) {
      console.error("❌ [Scheduler] TD Scoring failed:", error.message);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });

  // News Scraper - Every 4 hours
  // Fetches new articles from Irish news sources
  cron.schedule('0 */4 * * *', async () => {
    console.log("\n📰 [Scheduler] Running News Scraper...");
    try {
      const stats = await runDailyNewsScraper({ lookbackHours: 6 });
      console.log(`✅ [Scheduler] News Scraper complete:`);
      console.log(`   • Articles found: ${stats.articlesFound}`);
      console.log(`   • Articles processed: ${stats.articlesProcessed}`);
      console.log(`   • Duplicates skipped: ${stats.articlesSkippedExisting}`);
      if (stats.errors.length > 0) {
        console.warn(`   ⚠️ Errors: ${stats.errors.length}`);
      }
    } catch (error: any) {
      console.error("❌ [Scheduler] News Scraper failed:", error.message);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXISTING JOBS
  // ═══════════════════════════════════════════════════════════════════

  // Run Daily Briefing at 7:00 AM Dublin time
  // Format: Minute Hour Day Month DayOfWeek
  cron.schedule('0 7 * * *', async () => {
    console.log("🚀 [Scheduler] Starting Daily Briefing...");
    
    try {
        const urls = await fetchTopPoliticalNews();
        console.log(`[Scheduler] Found ${urls.length} stories.`);
        
        for (const url of urls) {
            console.log(`[Scheduler] Analyzing: ${url}`);
            await runShadowCabinet(url); // This saves to DB automatically
        }
        console.log("✅ [Scheduler] Daily Briefing Complete.");
    } catch (error) {
        console.error("❌ [Scheduler] Failed to run Daily Briefing:", error);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });

  // Run Internal Audit every Sunday at 00:00
  cron.schedule('0 0 * * 0', async () => {
    console.log("🕵️ [Scheduler] Starting Weekly QA Audit...");
    const anomalies = await runInternalAudit();
    if (anomalies.length > 0) {
        console.warn("⚠️ QA Anomalies Found:", anomalies);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });
}
