# Team Delivery Report

## [Task 2C]: Server Services Consolidation (multiAgentTDScoring.ts hypothesis)

**Team:** DeepSeek Implementation Team
**Status:** COMPLETE — hypothesis disproven, no consolidation performed (evidence-based)
**Branch:** `feature/phase-2c-service-consolidation` (created off `main`, zero commits — see "Why zero commits" below)
**Time Spent:** ~1 hour

---

## Summary

The task's working hypothesis was that `multiAgentTDScoring.ts` is the canonical scoring implementation and the other 8 services in `server/services/` (`tdScoreCalculator.ts`, `newsToTDScoringService.ts`, `personalizedScoringService.ts`, `eloScoringService.ts`, `comprehensiveTDScoringService.ts`, `unifiedTDScoringService.ts`, `adaptiveScoringEngine.ts`, `pledgeScoring.ts`) are deprecated/redundant attempts at the same thing and should be merged in and deleted.

**This hypothesis is false.** After reading all 9 files in full and grepping every exported symbol against `server/routes/*.ts` and the rest of `server/`, I found:

1. **All 9 services have live callers.** None are dead code at the file level.
2. **None of the other 8 duplicate what `multiAgentTDScoring.ts` does.** `multiAgentTDScoring.ts` is specifically the *per-article LLM scoring team* (Manager → Perspective Agents → Arbitrator, producing a `MultiAgentAnalysis` for one article/politician pair). The other 8 services operate at different layers of the pipeline: one is even a **hard dependency of `multiAgentTDScoring.ts` itself** (imported directly inside it), several are **aggregation/rollup calculators** that consume the *output* of multi-agent scoring rather than re-implementing it, and the rest are **genuinely distinct signals** (user personalization, pledge tracking, voter-compatibility decay) that were never scoring-team candidates in the first place.

No files were deleted, no imports were changed, and no commits were made, because doing so per the task's own acceptance criteria ("don't delete a service that has live callers without repointing callers," "don't invent abstractions beyond what's needed") would have meant either breaking production call sites for no functional gain, or fabricating a "consolidation" that wasn't real. Per the task's explicit instruction ("VERIFY this, don't assume it" / "For services confirmed... do NOT delete or forcibly merge"), the correct action when the hypothesis fails is to report the evidence, not force a merge to satisfy the premise.

---

## Evidence Per Service

### 1. `eloScoringService.ts` — KEEP, hard dependency (not a candidate at all)
- **What it computes:** Generic ELO delta math (`calculateELOChange`, `updateTDScores`, `calculateRankings`, `getScoreRating`, `getArticleAge`). No LLM calls, no scoring judgment — pure arithmetic utility.
- **Live callers:** `multiAgentTDScoring.ts` itself (`applyProcessScoresToELO` does `const { ELOScoringService } = await import('./eloScoringService.js')` and calls `ELOScoringService.updateTDScores(...)` and `ELOScoringService.getArticleAge(...)`), plus `unifiedTDScoringService.ts` and `server/jobs/dailyNewsScraper.ts`.
- **Verdict:** This is a **dependency of** `multiAgentTDScoring.ts`, not a duplicate of it. Deleting it would break the file the hypothesis says is canonical.

### 2. `tdScoreCalculator.ts` — KEEP, distinct layer (aggregation, not scoring)
- **What it computes:** Rolls up already-scored articles (from the `article_td_scores` table, populated by the multi-agent pipeline) into a 3-month sliding-window "News Impact Score" and a weighted `overall_score` (News 30% / Parliamentary 25% / Consistency 20% / Effectiveness 15% / Constituency 10%). Writes to `td_scores.news_impact_score` / `td_scores.overall_score`.
- **Live callers:** `server/services/newsToTDScoringService.ts` (Step 6 of its pipeline: `TDScoreCalculator.recalculateAllScores()` after multi-agent scoring completes), `server/jobs/recalculateAllScores.ts`.
- **Verdict:** Consumes multi-agent output, doesn't re-implement it. Deleting/merging into `multiAgentTDScoring.ts` would require that file to start reading from `article_td_scores` and writing `overall_score`, i.e. re-architecting it — out of scope and not what "consolidation" means here.

### 3. `newsToTDScoringService.ts` — KEEP, this is the orchestration pipeline, not a competitor
- **What it computes:** Nothing scoring-wise itself — it's the pipeline that: fetches unprocessed articles → scores importance → deduplicates events → extracts TD mentions → **calls `NewsArticleScoringTeam` (the exported alias from `multiAgentTDScoring.ts`) to actually run the multi-agent scoring** → applies results to ELO and ideology profile → calls `TDScoreCalculator.recalculateAllScores()`.
- **Live callers:** `server/jobs/masterNewsUpdate.ts`, `server/jobs/hourlyTDScoring.ts`, `server/jobs/dailyNewsScraper.ts`, `server/routes/admin/tdScoringRoutes.ts`, `server/services/scheduler.ts`.
- **Verdict:** This file *is* `multiAgentTDScoring.ts`'s primary caller. It cannot be merged into the thing it calls.

### 4. `personalizedScoringService.ts` — KEEP, genuinely distinct signal
- **What it computes:** Per-user personalized TD scores — combines each TD's objective ELO-derived scores (60% weight) with that specific user's own policy votes (40% weight), plus platform-average comparison and progressive/conservative alignment. This is a **user-specific re-weighting layer**, not an alternative way of scoring an article.
- **Live callers:** `server/routes/parliamentary/voting.ts`, `server/routes/policyVotingRoutes.ts`, `server/routes/user/rankings/policy.ts` (all three call `getPersonalizedRankings`, `getTDPersonalizedScore`, `getUserValueAlignment`).
- **Verdict:** Distinct, not consolidated — this is per-user personalization math with zero overlap with multi-agent article scoring.

### 5. `comprehensiveTDScoringService.ts` — KEEP, distinct layer (writes a different table)
- **What it computes:** A weighted "authoritative unified score" combining News (50%), Parliamentary activity (30%), Constituency service (15%), Public trust (5%) into `unified_td_scores` / `unified_score_history` (Drizzle tables, separate from `td_scores`). Reads raw `news_articles` impact scores directly (not multi-agent output specifically) plus a static `parliamentary-activity.json` file and `user_td_ratings`.
- **Live callers:** `server/jobs/masterNewsUpdate.ts` (Step 3: `recalculateAllScores()`), `server/jobs/unifiedScoreCalculationJob.ts` (daily 7am cron).
- **Verdict:** Distinct aggregation destination (a different DB table) and distinct weighting formula from both `tdScoreCalculator.ts` and `multiAgentTDScoring.ts`. Not a duplicate of the LLM scoring team.

### 6. `unifiedTDScoringService.ts` — KEEP overall (live callers), but contains dead sub-functions worth flagging separately
- **What it computes:** A second, older "unified score" calculator (News 40% / Parliamentary 30% / Legislative 10% / Constituency 15% / Public trust 5%) with its own from-scratch ELO math (`calculateNewsELO`, `calculateParliamentaryELO`), writing to `td_scores` directly.
- **Live callers — but only 2 of ~9 exported functions:** `server/routes/parliamentary/scores.ts` imports `UnifiedTDScoringService` and calls **only** `getTopTDs(...)` and `getTDScore(...)` (four call sites, lines 230/336/1062/1087) — both are simple passthrough reads of the `td_scores` table with no dependency on this file's own scoring math.
- **Dead code found (not deleted per task scope):** `calculateUnifiedTDScore`, `calculateNewsELO`, `calculateParliamentaryELO`, `recalculateAllTDScores`, `saveUnifiedScore`, `updateRankings` have **zero callers anywhere else in `server/`** — I grepped every one of these symbol names repo-wide. This computation logic appears to be a superseded predecessor to the current `multiAgentTDScoring.ts` → `eloScoringService.ts` → `tdScoreCalculator.ts` pipeline, left in place after `getTopTDs`/`getTDScore` were kept as simple read helpers.
- **Verdict:** The *file* has a live caller (`routes/parliamentary/scores.ts`), so per the task's explicit "do not delete a service with live callers" rule it was left in place. I did **not** perform function-level surgery (stripping the 6 dead functions out of an otherwise-live file) because that's a different, narrower cleanup than "consolidate into multiAgentTDScoring.ts" and risked scope creep beyond what was asked. **Flagging this as a good candidate for a small, separate follow-up task**: trim `unifiedTDScoringService.ts` down to just `getTopTDs`/`getTDScore` (or repoint those two call sites at a lighter-weight read-only module) and delete the dead computation functions — that cleanup is real and low-risk, unlike merging this file into `multiAgentTDScoring.ts`.

### 7. `adaptiveScoringEngine.ts` — KEEP, genuinely distinct signal
- **What it computes:** Voter/TD **compatibility score** decay math (diminishing returns at score extremes, asymmetric penalties — "harder to lose trust than gain it"). This is about a *user's* running compatibility score with a politician based on their voting agreement/disagreement history — it has nothing to do with scoring news articles.
- **Live callers:** `server/services/personalRankingsService.ts` (`AdaptiveScoringEngine.calculateAdaptiveDelta`, `AdaptiveScoringEngine.explainDelta`), `server/jobs/testAdaptiveScoring.ts`.
- **Verdict:** Distinct, not consolidated — different domain entirely (user-compatibility trust decay vs. article impact scoring).

### 8. `pledgeScoring.ts` — KEEP, genuinely distinct signal
- **What it computes:** Party-level pledge fulfillment (government parties) / advocacy (opposition parties) scoring from `pledgeActions`, plus a separate party performance/trustworthiness rollup. This is about tracking whether a **party** delivered on **specific named pledges**, an entirely different data model (`pledges`/`pledgeActions`/`partyPerformanceScores` tables) from per-article TD impact scoring.
- **Live callers:** `server/routes/political/pledges.ts` (`calculatePledgeScore`, `calculatePartyPerformanceScores`, both called from live route handlers).
- **Verdict:** Distinct, not consolidated — pledge-fulfillment tracking is a legitimately separate signal, exactly the kind of "feeds INTO a combined score, not redundant with it" case the task anticipated.

---

## Why Zero Commits

The task's acceptance criteria are all about the *outcome* of a real consolidation (no dangling imports, tsc/test gates, one commit per deleted service). Since verification showed there is nothing to delete or repoint — every file is live, and none duplicate `multiAgentTDScoring.ts`'s actual job — making a commit would mean either:
- Deleting live-called files and breaking `server/routes/parliamentary/scores.ts`, `server/routes/political/pledges.ts`, `server/routes/policyVotingRoutes.ts`, `server/routes/user/rankings/policy.ts`, `server/routes/parliamentary/voting.ts`, `server/jobs/masterNewsUpdate.ts`, `server/jobs/unifiedScoreCalculationJob.ts`, `server/jobs/recalculateAllScores.ts`, `server/services/scheduler.ts`, and `server/services/personalRankingsService.ts` — explicitly forbidden by the task's own "DO NOT delete a service that has live callers without repointing callers" rule, with no functional replacement possible since `multiAgentTDScoring.ts` doesn't do what any of these 8 files do, or
- Making cosmetic/no-op changes purely to produce a commit, which isn't real consolidation.

Both were rejected as worse than reporting the disproven hypothesis. `feature/phase-2c-service-consolidation` exists (branched off `main`) but has no commits on it, so it can be safely discarded or kept as a marker that this investigation happened.

---

## Quality Checks

- `git status` on the branch: clean relative to `main` for anything under `server/services/` or `server/routes/` — **zero files touched**.
- `npx tsc --noEmit` baseline (unmodified repo state, run before and confirmed unaffected by this task): **2,699 pre-existing errors**, none in the 9 files under investigation caused by this task (the 6 pre-existing errors inside `unifiedTDScoringService.ts` itself — e.g. `TS2559`, `TS2339` on `elo_7d_change`/`elo_30d_change`, `TS2802` — are **pre-existing bugs in that file, not introduced by me**, and were not touched since no code in it was modified).
- `npm test`: this repo has **no `test` script defined in `package.json`** (confirmed via `npm run` script list and by running `npm test`, which errors with `Missing script: "test"`) — this is a pre-existing repo-wide condition unrelated to this task, not something this task's scope could fix (the task only authorized touching `server/services/` and its route call sites).
- Zero dangling imports: N/A, nothing was deleted.
- `client/src/`, `shared/schema.ts`, `migrations/`: not touched, per constraint. (Note: at the time of this report, `shared/schema.ts` shows as locally modified in the working tree — that is the concurrent Phase 2B team's in-progress work, not this task's, and was left untouched.)

---

## Recommendation

Close Task 2C as "investigated, hypothesis disproven, no action needed" rather than force a merge. If further cleanup of the `server/services/` scoring surface is wanted, the one real, low-risk opportunity found during this investigation is the **dead code inside `unifiedTDScoringService.ts`** (see item 6 above) — trimming `calculateUnifiedTDScore`, `calculateNewsELO`, `calculateParliamentaryELO`, `recalculateAllTDScores`, `saveUnifiedScore`, `updateRankings` while keeping `getTopTDs`/`getTDScore` alive for `server/routes/parliamentary/scores.ts`. That is a distinct, smaller task from "merge 8 services into multiAgentTDScoring.ts" and would need its own scoped ticket.
