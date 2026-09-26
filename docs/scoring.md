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
| parliamentary | 0.30 | questions vs 200 benchmark (50%) + Dáil vote attendance vs 95% (30%) + committee attendance vs 85% (20%), renormalised over the ones a TD has |
| debate | 0.25 | Dáil debate sections spoken in per sitting day, vs the 75th percentile of TDs |

A pillar with no data is left out and the others renormalise; a TD with no debate record is
scored on the other two, not dragged toward 50. National, party and constituency ranks and
7/30-day ELO trends are computed at the same time.

## Getting a TD table

The pipeline resolves TDs by name, so an empty `politics.tds` means every article scores
nobody. Populate it from the Oireachtas roster of the current Dáil:

```bash
npm run sync-tds
```

It upserts by member code (falling back to name), and **deactivates rather than deletes** —
scores, history and article verdicts cascade from `tds.id`, so removing a row when someone
leaves the Dáil would erase their record. An empty roster from the API changes nothing, so a
failed fetch cannot wipe the table. The diff itself is pure (`tdSync.ts`) and unit-tested.

Parliamentary and debate inputs are filled by `npm run parliament:sync` (`server/parliament/`,
daily at 04:45 from the scheduler, off the even hours TD scoring runs at), which also runs
the roster sync first. Attendance is Dáil divisions voted in / divisions held **inside the
TD's own membership window**; questions are the ones the TD asked, summed from
`politics.question_counts`; debate participation excludes speeches made from the chair.
Committee attendance is the share of the TD's own committees' sittings they are on the roll
call for, inside each membership; it is NULL below 10 sittings, so a TD on no committee (most
ministers) is scored on questions and votes alone. The Ceann Comhairle does not vote and gets
NULL, not 0. Anything that cannot be measured stays NULL and
its pillar drops out. See `docs/plans/parliament-rebuild.md` for the API facts behind this.

### Fair by construction: a TD is measured only on what they were expected to do

The same rules apply to every TD. Each one reads a reason from the record, or from a
documented public source, and never guesses one:

| Reason | Where it comes from | Effect |
|---|---|---|
| In the chair for a division | The division's debate section: the last presiding speech is theirs and they are not on the vote lists (the chair cannot vote) | That division is left out of their votes |
| Documented leave (parental, medical, bereavement, other) | `server/parliament/absences.ts`: each entry has dates and a public source | Those days are left out of votes, sitting days, speeches and committee sittings |
| Government office (cabinet, Minister of State) | The roster's office history (`politics.td_offices`) | Questions: not expected for that time. Votes: those divisions are measured against `GOVERNMENT_ATTENDANCE_BENCHMARK` instead of 95% |
| The chair (Ceann Comhairle) | The roster | Not expected to ask questions or vote (NULL) |

Questions expected = `QUESTIONS_BENCHMARK` × (days the TD was expected to ask) / (days in
the term so far), so a full-term backbencher is expected exactly what they were before, and a
by-election TD is not held to a whole-term number. Under 90 expected days it is NULL, and so
is the question input the rollup reads. Both expectations are stored per TD on
`td_parliament_stats` (`questions_expected`, `attendance_benchmark`).

There is no official record of why a TD missed a vote. `npm run parliament:silences` lists
long runs of sitting days with no vote and no speech that no documented absence covers. If the
TD or their party announced leave publicly, add it with its source; if not, the silence stays
counted. Ministerial foreign travel is published by only one department (3 of 38 office
holders), so it is not used: excusing those 3 alone would be unfair to the other 35.

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

## Tests

`elo`, `weights`, `rollup`, `party` and `tdSync` are pure and unit-tested from array
literals. `routes/scores.test.ts` covers the router against a mocked repository.

Everything else in the module talks to Postgres, and no unit test executes a query — a
broken `ON CONFLICT` target or a wrong transaction shape would ship silently. So
`repository.integration.test.ts` runs the real SQL. It skips unless you point it at a
throwaway database, and it drops and recreates the `politics` schema in whatever you give
it:

```bash
docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
$env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
npx vitest run server/scoring/repository.integration.test.ts
```

## What this replaced (2026-09-21)

Five engines (`comprehensiveTDScoringService`, `unifiedTDScoringService`, `tdScoreCalculator`,
`partyPerformanceService`, and the scraper's own single-model path), four weight tables that
disagreed, two ELO→percent conversions, a news score that was an unbounded sum, seven mount
prefixes for one router, six score tables no page read, and user star ratings. All deleted, not
deprecated.

## Not in this module

- **Parliament data** (divisions, debates, questions, attendance) is `server/parliament/`; the
  rollup reads its participation scores through `debateInputs.ts`.
- **News ingestion** (`news_articles`, the scraper, triage) is its own subsystem; the pipeline
  reads it through `articleSource.ts`, which still uses the legacy REST client and is the seam
  that rebuild replaces.
