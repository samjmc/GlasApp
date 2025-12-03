import cron from "node-cron";
import { runShadowCabinet, fetchTopPoliticalNews } from "./shadowCabinet";
import { runInternalAudit } from "./qaAgent";

export function initScheduler() {
  console.log("⏰ Scheduler initialized.");

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
