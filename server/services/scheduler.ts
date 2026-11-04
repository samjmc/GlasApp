import cron from "node-cron";
import { runTdPipeline } from "../news/tdPipeline";
import { ingest } from "../news/ingest";
import { extractDebates, extractQuestions, leaveWatch, runSync as runParliamentSync, syncHadFailures } from "../parliament";
import type { ExtractSummary } from "../parliament/debateItems/run";
import { runDivisionStances } from "../stances";
import { logger } from "../utils/logger";
import { runJob, type JobOutcome } from "./jobRuns";

/** Debates read for items per night when DEBATE_ITEMS=on: about a sitting week's worth. */
const NIGHTLY_DEBATES = 30;
/** Question exchanges read per night when QUESTION_ITEMS=on: about a sitting week's worth (cents). */
const NIGHTLY_EXCHANGES = 100;

/** The flags that each add a model-calling step to the 04:45 run. Each is on only when exactly "on". */
const MODEL_FLAGS = ["DIVISION_STANCES", "DEBATE_ITEMS", "QUESTION_ITEMS"] as const;
const flagOn = (flag: (typeof MODEL_FLAGS)[number]) => process.env[flag] === "on";

/**
 * Every job: Dublin time, and never two runs of the same job at once in this process (a slow run
 * is not stacked on by the next tick). Across processes each job also holds its own database lock.
 */
const OPTIONS = { timezone: "Europe/Dublin", noOverlap: true };

const itemsOutcome = (s: ExtractSummary): JobOutcome => ({
  ok: s.failed === 0 && !s.stopped,
  summary: { chosen: s.debates, done: s.done, failed: s.failed, capped: s.capped, calls: s.calls, stopped: s.stopped },
});

/** Initialize and start the scheduled jobs. Each run is recorded in politics.job_runs (GET /api/admin/jobs). */
export function initScheduler() {
  logger.info(
    {
      jobs: {
        "news-ingest": "every 2 hours, at :30 on odd hours",
        "news-tds": "every 2 hours, on the hour",
        "parliament-sync": "daily 04:45, then the model steps below that are on",
        "leave-watch": "Mondays 06:15",
      },
      ...Object.fromEntries(MODEL_FLAGS.map((flag) => [flag, flagOn(flag) ? "on" : "off"])),
    },
    "Scheduler initialized (Europe/Dublin)",
  );

  // ═══════════════════════════════════════════════════════════════════
  // NEWS PIPELINE (news is not part of any TD's score)
  // ═══════════════════════════════════════════════════════════════════

  // News ingest - 30 minutes before each TD pipeline run, so it sees fresh articles.
  cron.schedule('30 1-23/2 * * *', () => runJob("news-ingest", async () => {
    const stats = await ingest();
    const failedFeeds = stats.feeds.filter((f) => f.error).map((f) => f.source);
    return {
      ok: failedFeeds.length === 0 && stats.heldBack === 0,
      summary: { fetched: stats.fetched, inserted: stats.inserted, withImage: stats.withImage, heldBack: stats.heldBack, outOfCredit: stats.outOfCredit, failedFeeds },
    };
  }), OPTIONS);

  // News → TD pipeline - every 2 hours: keep the most relevant quarter, link each article to
  // the TDs it names, and make daily-vote questions. It scores nobody.
  cron.schedule('0 */2 * * *', () => runJob("news-tds", async () => {
    const stats = await runTdPipeline({ batchSize: 50, topPercentile: 25 });
    return {
      ok: stats.errors === 0 && !stats.stopped,
      summary: { claimed: stats.totalArticles, processed: stats.articlesProcessed, tdsLinked: stats.tdsLinked, errors: stats.errors, released: stats.released, stopped: stats.stopped },
    };
  }), OPTIONS);

  // ═══════════════════════════════════════════════════════════════════
  // PARLIAMENT
  // ═══════════════════════════════════════════════════════════════════

  // Parliament sync - daily at 04:45: roster, divisions, debates, committees, bills,
  // questions, then TD scores. Not on the hour: the old news scoring ran at every even hour
  // and the two writing the same score rows at once deadlocked on 2026-09-24. Each later step
  // runs even when the sync failed, and is recorded as its own job.
  cron.schedule('45 4 * * *', async () => {
    await runJob("parliament-sync", async () => {
      const s = await runParliamentSync();
      return {
        ok: !syncHadFailures(s),
        summary: {
          divisions: s.divisions.ingested,
          sittingDays: s.debates.days,
          failedDays: s.debates.failedDays,
          failedCommitteeDays: s.committees.failedDays,
          failedQuestionMonths: s.questions.failedMonths,
          failedFeeds: s.failedFeeds,
          failedDisclosureFiles: [...s.interests.failedFiles, ...s.allowances.failedFiles].map((f) => f.url),
        },
      };
    });
    // Dáil divisions as TD stances, once the sync has brought in the day's divisions. Off
    // unless DIVISION_STANCES=on: it calls a model, and its matches become stances only after a
    // person audits them (docs/deploy.md section 6).
    if (flagOn("DIVISION_STANCES")) {
      await runJob("division-stances", async () => {
        const r = await runDivisionStances({ mode: "nightly" });
        return {
          ok: !r.classify?.stopped,
          summary: { read: r.classify?.read ?? 0, calls: r.classify?.calls ?? 0, stopped: r.classify?.stopped ?? null, stances: r.sync.rows, evidence: r.sync.evidence },
        };
      });
    }
    // Debate items for the debates the sync brought in (docs/plans/debate-analysis.md). Off
    // unless DEBATE_ITEMS=on, because it calls a model; at most NIGHTLY_DEBATES a night (cents).
    if (flagOn("DEBATE_ITEMS")) {
      await runJob("debate-items", async () => itemsOutcome(await extractDebates({ limit: NIGHTLY_DEBATES })));
    }
    // Question exchanges (docs/plans/question-sessions.md), behind their own flag for the same reason.
    if (flagOn("QUESTION_ITEMS")) {
      await runJob("question-items", async () => itemsOutcome(await extractQuestions({ limit: NIGHTLY_EXCHANGES })));
    }
  }, OPTIONS);

  // Leave watch - Mondays at 06:15, after the Dáil's sitting days (Tue-Thu) and the 04:45 sync:
  // list long silences no documented leave covers, for an admin to review at /admin/leave-watch.
  cron.schedule('15 6 * * 1', () => runJob("leave-watch", async () => {
    const s = await leaveWatch.runLeaveWatch();
    return { ok: true, summary: { opened: s.opened, reopened: s.reopened, closed: s.closed, open: s.open } };
  }), OPTIONS);
}
