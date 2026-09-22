# TD scoring

One engine, one weight table, one router. Everything about how a TD gets a number lives in
`server/scoring/`.

## The model

A TD has five ELO ratings, all starting at 1500: **overall** and four dimensions,
**transparency, effectiveness, integrity, consistency**. Every scored news article moves them.

```
delta = impact/10 × K(32) × credibility            impact −10..+10
credibility = source credibility × panel confidence
weight halves every 30 days once the article is older than 90 days
```

Display scores are 0–100 and come from one conversion: `(elo − 1000) / 10`, clamped.

The **overall 0–100** is a weighted mean of three pillars, computed by the rollup and stored:

| Pillar | Weight | Source |
|---|---|---|
| news | 0.45 | `eloToPercent(overall_elo)` |
| parliamentary | 0.30 | questions vs 200 benchmark (60%) + attendance vs 95% (40%) |
| debate | 0.25 | debate subsystem's running performance score |

A pillar with no data is left out and the others renormalise; a TD with no debate record is
scored on the other two, not dragged toward 50. National, party and constituency ranks and
7/30-day ELO trends are computed at the same time.

## The pipeline

```
runPipeline()
  fetch unprocessed articles            articleSource.ts   (news domain adapter)
  importance triage, keep the top 25%   services/articleImportanceService
  cluster same-event articles           services/eventDeduplicationService
  find the TDs each article is about    services/tdExtractionService → repository.findByName
  per (article, TD):
    run the multi-agent panel           panel.ts           (LLM, ~6–8 calls)
    apply consensus to the ELOs         panel.applyPanelResult → elo.ts → repository.applyElo
    record the verdict + policy stance  repository.upsertArticleScore / upsertPolicyStance
    feed the ideology profile           services/tdIdeologyProfileService
  recalculateAll()                      recalculate.ts
    pillars, overall, ranks             rollup.ts
    7/30-day trends                     repository.writeTrends
    party aggregates                    party.ts
```

Runs every 2 hours from `server/services/scheduler.ts`, on demand with `npm run td-scoring`
(`-- --recalculate` skips the LLM and only rebuilds derived scores; `-- --article <id>` scores
one article), and from `POST /api/admin/td-scoring/run`.

## Tables (`politics` schema, `shared/schema/politics.ts`)

| Table | Holds |
|---|---|
| `tds` | who a TD is: name, party, constituency, image, member code, offices, committees, question counts, attendance |
| `td_scores` | one row per TD: the five ELOs, the stored pillars and overall, ranks, trends, story count |
| `td_score_history` | one row per ELO change per dimension; feeds trends and the homepage movers |
| `article_td_scores` | the panel's verdict on one TD in one article |
| `td_policy_stances` | policy stances the panel extracted |
| `party_scores` | party aggregate, replaced on every recalculation |
| `td_historical_baselines` | AI-researched history per TD; shown, not scored |

Everything is keyed by `td_id`. `npm run db:generate` turns schema changes into a migration in
`drizzle/`; `npm run db:migrate` applies it.

## API — `/api/scores`

| Route | Serves |
|---|---|
| `GET /tds` | every active TD, best first (+ `hasResearch`) |
| `GET /widget` | homepage: top 5, bottom 5, 30-day movers, totals |
| `GET /td/:name` | full profile and score breakdown |
| `GET /td/:id/summary` | quick-info modal |
| `GET /parties` · `GET /party/:name` | party rankings and one party's members |
| `GET /constituencies` · `GET /constituencies/summary` · `GET /constituency/:name` | constituency pages and the map |
| `POST /recalculate` (admin) | rebuild derived scores without the LLM |

Every response is `{ success, data, meta? }`.

## What this replaced (2026-09-21)

Five engines (`comprehensiveTDScoringService`, `unifiedTDScoringService`, `tdScoreCalculator`,
`partyPerformanceService`, and the scraper's own single-model path), four weight tables that
disagreed, two ELO→percent conversions, a news score that was an unbounded sum, seven mount
prefixes for one router, six score tables no page read, and user star ratings. All deleted, not
deprecated.

## Not in this module

- **Debate scoring** (`td_debate_metrics`, `td_debate_running_scores`, `/api/debates`) is its own
  subsystem; the rollup reads its running score through `debateInputs.ts`.
- **News ingestion** (`news_articles`, the scraper, triage) is its own subsystem; the pipeline
  reads it through `articleSource.ts`. Both adapters still use the legacy REST client and are the
  seams those rebuilds replace.
