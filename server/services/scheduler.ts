import cron from "node-cron";
import { runShadowCabinet, fetchTopPoliticalNews } from "./shadowCabinet";
import { runPipeline } from "../scoring";
import { runSync as runParliamentSync } from "../parliament";

// Lazy imports for news services (avoids circular dependency issues)
let ArticleTriageJob: unknown = null;
let NewsScraperService: unknown = null;

async function loadScoringServices() {
  if (!ArticleTriageJob) {
    const triageModule = await import("../jobs/articleTriageJob.js");
    ArticleTriageJob = triageModule.ArticleTriageJob;
  }
  if (!NewsScraperService) {
    const scraperModule = await import("./newsScraperService.js");
    NewsScraperService = scraperModule.NewsScraperService;
  }
}

/** Initialize and start the scheduled jobs. */
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
    } catch (error: unknown) {
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
      const stats = await runPipeline({
        batchSize: 50,
        topPercentile: 25,
        minImportanceScore: 40
      });
      console.log(`✅ [Scheduler] TD Scoring complete:`);
      console.log(`   • Articles processed: ${stats.articlesProcessed}`);
      console.log(`   • TDs updated: ${stats.tdsUpdated}`);
      if (stats.errors > 0) {
        console.warn(`   ⚠️ Errors: ${stats.errors}`);
      }
    } catch (error: unknown) {
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
      await loadScoringServices();
      const articles = await NewsScraperService.fetchAllIrishNews({ lookbackHours: 6 });
      console.log(`✅ [Scheduler] News Scraper found ${articles.length} articles`);
    } catch (error: unknown) {
      console.error("❌ [Scheduler] News Scraper failed:", error.message);
    }
  }, {
    scheduled: true,
    timezone: "Europe/Dublin"
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXISTING JOBS
  // ═══════════════════════════════════════════════════════════════════

  // Parliament sync - daily at 04:00: divisions, debates, questions, then TD scores.
  cron.schedule('0 4 * * *', async () => {
    try {
      const s = await runParliamentSync();
      console.log(`[Scheduler] Parliament sync: ${s.divisions.ingested} divisions, ${s.debates.days} sitting days${s.debates.failedDays.length ? `, ${s.debates.failedDays.length} day(s) failed` : ''}.`);
    } catch (error) {
      console.error("[Scheduler] Parliament sync failed:", error instanceof Error ? error.message : error);
    }
  }, { timezone: "Europe/Dublin" });

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
}
