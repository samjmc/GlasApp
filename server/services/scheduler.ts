import cron from "node-cron";
import { runTdPipeline } from "../news/tdPipeline";
import { ingest } from "../news/ingest";
import { leaveWatch, runSync as runParliamentSync } from "../parliament";
import { runDivisionStances } from "../stances";

/** Initialize and start the scheduled jobs. */
export function initScheduler() {
  console.log("⏰ Scheduler initialized.");
  console.log("   📰 News ingest: every 2 hours, at :30 on odd hours");
  console.log("   🔗 News → TD links and daily-vote questions: every 2 hours");
  console.log("   🩺 Leave watch: Mondays 6:15 AM Dublin");

  // ═══════════════════════════════════════════════════════════════════
  // NEWS PIPELINE (news is not part of any TD's score)
  // ═══════════════════════════════════════════════════════════════════

  // News ingest - 30 minutes before each TD pipeline run, so it sees fresh articles.
  cron.schedule('30 1-23/2 * * *', async () => {
    try {
      const stats = await ingest();
      const failed = stats.feeds.filter((f) => f.error).map((f) => f.source);
      console.log(`📰 [Scheduler] Ingest: ${stats.inserted} new of ${stats.fetched} fetched, ${stats.withImage} with a picture${failed.length ? `; feeds failed: ${failed.join(', ')}` : ''}`);
    } catch (error: unknown) {
      console.error("❌ [Scheduler] News ingest failed:", error instanceof Error ? error.message : error);
    }
  }, {
    timezone: "Europe/Dublin"
  });

  // News → TD pipeline - every 2 hours: importance triage, link each article to the TDs it
  // names, and make daily-vote questions. It scores nobody.
  cron.schedule('0 */2 * * *', async () => {
    console.log("\n🔗 [Scheduler] Running the news → TD pipeline...");
    try {
      const stats = await runTdPipeline({
        batchSize: 50,
        topPercentile: 25,
        minImportanceScore: 40
      });
      console.log(`✅ [Scheduler] News → TD pipeline complete:`);
      console.log(`   • Articles processed: ${stats.articlesProcessed}`);
      console.log(`   • TD links: ${stats.tdsLinked}`);
      if (stats.errors > 0) {
        console.warn(`   ⚠️ Errors: ${stats.errors}`);
      }
    } catch (error: unknown) {
      console.error("❌ [Scheduler] News → TD pipeline failed:", error instanceof Error ? error.message : error);
    }
  }, {
    timezone: "Europe/Dublin"
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXISTING JOBS
  // ═══════════════════════════════════════════════════════════════════

  // Parliament sync - daily at 04:45: roster, divisions, debates, committees, bills,
  // questions, then TD scores. Not on the hour: the old news scoring ran at every even hour
  // and the two writing the same score rows at once deadlocked on 2026-09-24.
  cron.schedule('45 4 * * *', async () => {
    try {
      const s = await runParliamentSync();
      console.log(`[Scheduler] Parliament sync: ${s.divisions.ingested} divisions, ${s.debates.days} sitting days${s.debates.failedDays.length ? `, ${s.debates.failedDays.length} day(s) failed` : ''}${s.failedFeeds.length ? `, failed feeds: ${s.failedFeeds.join(', ')}` : ''}.`);
    } catch (error) {
      console.error("[Scheduler] Parliament sync failed:", error instanceof Error ? error.message : error);
    }
    // Dáil divisions as TD stances, once the sync has brought in the day's divisions. Off
    // unless DIVISION_STANCES=on: it calls a model, and goes on only after the human gates in
    // docs/plans/quiz-improvements/01c-division-stances.md §9.
    if (process.env.DIVISION_STANCES === "on") {
      try {
        await runDivisionStances({ mode: "nightly" });
      } catch (error) {
        console.error("[Scheduler] Division stances failed:", error instanceof Error ? error.message : error);
      }
    }
  }, { timezone: "Europe/Dublin" });

  // Leave watch - Mondays at 06:15, after the Dáil's sitting days (Tue-Thu) and the 04:45 sync:
  // list long silences no documented leave covers, for an admin to review at /admin/leave-watch.
  cron.schedule('15 6 * * 1', async () => {
    try {
      const s = await leaveWatch.runLeaveWatch();
      console.log(`[Scheduler] Leave watch: ${s.opened} opened, ${s.reopened} reopened, ${s.closed} closed; ${s.open} open.`);
    } catch (error) {
      console.error("[Scheduler] Leave watch failed:", error instanceof Error ? error.message : error);
    }
  }, { timezone: "Europe/Dublin" });
}
