# TD scoring rebuild — plan

**Status:** DRAFT, awaiting owner sign-off on the two decisions in §5.
**Date:** 2026-09-21. **Branch for the work:** `rebuild/td-scoring`.
**Rule:** one engine, one table set, one router, one response envelope. Everything else is deleted
in the same PR, not deprecated.

Evidence for every claim below is in the survey the plan was built from; file:line references are
to `main` at `e5af558`.

---

## 1. What exists today

Five scoring engines, two score "universes", seven weight tables in code, and a UI that mostly
cannot read any of it.

| Engine | Lines | Writes | Alive? |
|---|---|---|---|
| `newsToTDScoringService` → `multiAgentTDScoring` → `eloScoringService` → `tdScoreCalculator` | 708 + 1201 + 199 + 140 | `td_scores`, `td_score_history`, `article_td_scores`, `td_policy_stances`, `party_performance_scores` | **Yes.** The only chain the scheduler runs (`scheduler.ts:63`, every 2 h). The only one that calls an LLM. |
| `comprehensiveTDScoringService` + `unifiedScoreCalculationJob` | 684 + 199 | `unified_td_scores`, `unified_score_history` | Half. Job is never scheduled (`start()` never called). Half the file is behind the null Drizzle `db`. **No UI route reads its tables.** |
| `unifiedTDScoringService` | 558 | `td_scores` (upsert) | Read half only. Write path references fields that do not exist (`:434-435`). |
| `pledgeScoring` | 352 | `pledges`, `party_performance_scores` | **No.** Imports the null `db`; throws on every call. |
| `personalizedScoringService`, `adaptiveScoringEngine` | 302 + 178 | nothing | Yes, but they are per-user matching, not TD scoring. Out of scope here. |

Facts that drive the design:

- The scheduler runs one thing. Everything not on that path is either dead or writes tables nothing reads.
- `party_performance_scores` is written by two files with identical code (`newsToTDScoringService.ts:653`, `partyPerformanceService.ts:127`).
- Pillar weights live in five places with three different values (`tdScoreCalculator.ts:73`, `comprehensiveTDScoringService.ts:26`, `unifiedTDScoringService.ts:27`, `scores.ts:609`, and the seeded-but-never-read `score_component_weights` table).
- ELO→percent uses 1000–2000 in `utils/scoreConverter.ts:22` and 1200–1800 in `personalizedScoringService.ts:162`. The same stored ELO renders as two different numbers.
- Three tables the routes query have **no definition anywhere in the repo**: `article_td_scores`, `td_debate_metrics`, `td_debate_running_scores` (RLS references only). One, `politician_trust_scores`, has no definition and no writer; four routes read it.
- `shared/schema.ts` for `td_scores` is stale: the live table (per the routes) has ~15 columns the schema does not.
- The parliamentary router is mounted under seven prefixes (`routes.ts:114-122`), but its own sub-mount means every legacy alias 404s on every score path. Four client pages call those aliases.
- Nearly every client unwrap ignores the `{success, data}` envelope: `TDProfilePage.tsx:151`, `TDScoresWidget.tsx:161`, `PartyRankingsWidget.tsx:151`, `PartyProfilePage.tsx:67,526`, `AskTDPage.tsx:233`, `TDQuickInfoModal.tsx:38`, `GlobalSearch.tsx:90`. The homepage score widgets and the TD profile page render empty today. `GlobalSearch` (in the header, every page) throws on load because one of its three fetches 404s.

---

## 2. Target: one module, one router, one schema

```
server/scoring/
  elo.ts          pure math: K-factor, decay, delta, bands. (= eloScoringService, kept)
  weights.ts      THE pillar weights + ELO→percent conversion. One constant, one function.
  pipeline.ts     article → TD score updates. Orchestration only (= newsToTDScoringService, trimmed)
  panel.ts        the multi-agent LLM scorer (= multiAgentTDScoring, moved, unchanged in v1)
  rollup.ts       td_scores ELO → overall 0–100, ranks, weekly/monthly deltas. Replaces
                  tdScoreCalculator + the read half of unifiedTDScoringService + the maths
                  duplicated inside routes/parliamentary/scores.ts:351-800
  party.ts        party aggregation. One copy.
  repository.ts   every td_scores / party_performance_scores read the routes need.
  index.ts        public surface: runPipeline(), recalculateAll(), repository
server/routes/scores.ts     ONE router at /api/scores, 7 endpoints (§3), formatSuccess envelope
server/jobs/td-scoring.ts   ONE CLI entry (npm run td-scoring) calling scoring.runPipeline()
```

Scheduler keeps its single 2-hourly call, pointed at `scoring.runPipeline()`.

**Tables kept (6):** `td_scores`, `td_score_history`, `article_td_scores`, `party_performance_scores`,
`td_historical_baselines`, `td_policy_stances`. Each gets a real `CREATE TABLE` in one new migration
`supabase/migrations/<date>_td_scoring.sql`, and `shared/schema.ts` is regenerated to match.

**Debate scoring** (`td_debate_metrics`, `td_debate_running_scores`, `debatesRoutes.ts`) is a
separate subsystem with its own jobs. Left alone in this pass; gets its own pass later.

---

## 3. Endpoints: 7 kept, everything else deleted

| Keep | Serves |
|---|---|
| `GET /api/scores/td/:name` | TD profile page |
| `GET /api/scores/widget` | homepage rankings tab, global search |
| `GET /api/scores/parties` | party page, homepage party widget |
| `GET /api/scores/researched` | researched-TDs page (today `/api/researched-tds`) |
| `GET /api/scores/constituency/:name`, `/constituencies`, `/constituencies/summary` | constituency pages, map |
| `GET /api/scores/td/:id/summary`, `/party/:name/summary` | quick-info modals |
| `POST /api/scores/recalculate` (admin) | manual trigger |

Every client call site is repointed to these paths and unwraps `{success, data}`. The seven
legacy mount prefixes go.

---

## 4. Deletion list

**Server files (delete):** `services/comprehensiveTDScoringService.ts`, `services/unifiedTDScoringService.ts`,
`services/tdScoreCalculator.ts`, `services/partyPerformanceService.ts`, `services/pledgeScoring.ts`,
`jobs/unifiedScoreCalculationJob.ts`, `jobs/hourlyTDScoring.ts`, `jobs/recalculateAllScores.ts`,
`jobs/testAdaptiveScoring.ts`, `routes/parliamentary/scores.ts` (1,200 lines, replaced),
`routes/parliamentary/enhanced-profiles.ts` (never imported), `routes/parliamentary/votingRoutes.ts`
(never mounted), `routes/dashboardRoutes.ts` (hard-coded party score tables, no caller),
`routes/ratings/tdRatings.ts` (see decision B), `api/researched-tds.ts` (folded into the router),
`utils/scoreConverter.ts` (into `weights.ts`).

**Server files (moved into `server/scoring/`):** `newsToTDScoringService.ts`, `multiAgentTDScoring.ts`,
`eloScoringService.ts`.

**Tables (drop, with a migration):** `unified_td_scores`, `unified_score_history`, `performance_scores`,
`politician_trust_scores`, `score_component_weights`, `td_data_sources`, `score_calculation_log`,
`user_td_ratings` (decision B).

**Client (delete):** `pages/TDProfilePageEnhanced.tsx`, `pages/TDScoresPage.tsx`, `pages/TDLeaderboardPage.tsx`
(both 404 on every load; leaderboard content moves into the widget/researched page),
`components/ParliamentaryDashboard.tsx`, `components/QuickStatsBar.tsx`, `components/TDRatingCard.tsx`,
`components/PerformanceScoreBreakdown.tsx`, and the six dead score fetches inside `EducationPage.tsx:2367-3004`.

**Client (fix):** the eight unwrap sites in §1, plus repoint `TDQuickInfoModal`, `PartyQuickInfoModal`,
`GlobalSearch`, `LocalRepresentativesPage`, `AskTDPage`.

Rough size: about **6,500 lines deleted, ~1,200 written**.

---

## 5. Decisions needed from the owner

**A. Is there any data to preserve?** The production Supabase project is gone. If a dump exists
(`td_scores`, `td_score_history`, `news_articles`, `article_td_scores`), the migration must import
it and the new schema must stay column-compatible for those four tables. If not, the rebuild starts
from an empty schema and the pipeline repopulates from news. **Recommendation:** if no dump is at
hand within a day, build for empty. Compatibility constraints are the main thing that would keep
the old columns alive.

**B. User ratings of TDs: keep or delete?** `user_td_ratings` + `/api/ratings/*` + `TDRatingCard`.
The card is not mounted anywhere, the schema and the code disagree on the columns, and the only
engine that blended ratings into a score was the dead `comprehensiveTDScoringService`.
**Recommendation:** delete. It can be rebuilt on purpose later if wanted.

**C (not blocking, noted):** the multi-agent LLM panel is kept as-is in v1. It is the most
capable scorer and the only one that runs, but it is also expensive (several OpenAI calls per
article) and it hard-wires two of its dimensions to constants. Redesigning the scoring *model* is a
separate, later decision. This plan only makes it the sole model.

---

## 6. Order of work (one PR per step, each leaves tests green)

1. **Schema.** New migration with real `CREATE TABLE` for the six kept tables; drop the seven dead
   ones; regenerate `shared/schema.ts`. Marker test: every table the code queries has a definition.
2. **`server/scoring/`.** Move the live chain in; write `weights.ts` and `rollup.ts`; delete the four
   dead engines and the duplicate party aggregation; one ELO→percent function. Characterisation
   tests on `elo.ts`, `weights.ts`, `rollup.ts` from array literals.
3. **Router.** `server/routes/scores.ts` with the 7 endpoints on the repository; delete the old
   router, the aliases, dead route files. Route tests: each endpoint returns the envelope and the
   documented keys against a mocked repository.
4. **Client.** Repoint and fix unwraps; delete dead pages/components. Verify each routed page in the
   browser against a local Supabase with seeded rows.
5. **Jobs.** One CLI, scheduler repointed, `package.json` scripts pruned to the ones that exist.

Steps 1–2 can start as soon as A and B are answered. Steps 3–5 follow mechanically.
