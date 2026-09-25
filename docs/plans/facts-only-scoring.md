# TD score from checkable facts only

Status: approved by Sam 2026-09-25. Part 2 of 3 (after `news-event-dedupe.md`, before
`td-stances.md`). Vetted against main 668cee7; revised with every vet finding.

## Why

Scoring a TD from news means an LLM judges whether a statement was good or bad. Many
statements (a position on Israel, on immigration) are good for some people and bad for others:
there is no neutral verdict. News was 45% of the overall score, so the most value-laden input
had the biggest weight. From now on the score everyone sees is built only from facts anyone can
check in the Oireachtas record. What a TD SAYS becomes stance records with verbatim quotes that
each user compares against their own answers (part 3), never a good/bad number.

## Sam's decisions (2026-09-25)

1. News carries **0%** of the score (Option A). The statement-vs-record "consistency" pillar
   (Option B) is not built.
2. Keep the #77 structure Sam chose: parliamentary = questions 0.5 / Dáil votes 0.3 /
   committees 0.2 (committees full marks at 85%), next to debate. With news gone the pillar
   weights become **parliamentary 0.55 / debate 0.45** (today's 0.30 / 0.25, renormalised).
3. Vote attendance is scored as the Official Report records it, with the raw count shown and a
   note that pairing is not published. No special case for Cabinet (a Cabinet-only exemption
   would lift government leaders and not the opposition leader, who is also low).

## The score

| Component | Input | Rule |
|---|---|---|
| questions | oral + written questions this term | ÷ `QUESTIONS_BENCHMARK` (200), capped |
| attendance | votes cast ÷ divisions held while a member | ÷ 95, capped |
| committees | `tds.committee_attendance_pct` (#77) | ÷ 85, capped |
| debate | sections spoken per sitting day vs the 75th percentile (existing) | chair speeches already excluded |

- `parliamentaryScore` keeps its current weights, benchmarks and renormalisation (#77).
- `overallFromPillars` over `{ parliamentary: 0.55, debate: 0.45 }`.
- **Minimum evidence:** a TD with fewer than `MIN_COMPONENTS_FOR_RANK` (2) non-NULL components
  gets overall NULL and no rank (vet finding: a minister with no committee could otherwise be
  ranked on attendance alone).
- **Fair inputs belong to the parliament module, not to scoring** (split agreed 2026-09-25 with
  the parliament session, which Sam asked directly to make the measures fair). It makes an input
  NULL when the TD was not expected to produce it: questions for periods in government office,
  documented absences out of attendance denominators, every input for the Ceann Comhairle, and
  too little eligible time (by-election TDs). Scoring's contract: `rollupInputs` reads questions,
  attendancePct, committeeAttendancePct, debateScore and isPresiding; **NULL means "not expected /
  not measurable", never 0**. As a backstop, `rollup` treats `isPresiding` as all-NULL. Scoring
  adds no office-holder rule of its own.
- Ministers' debate participation is not adjusted; `docs/scoring.md` says so (they move bills,
  which raises it — stated, not hidden).
- Ranks are shared on ties (1, 2, 2, 4), ordered by score then name for display.
- Party score = mean of members' `overallScore` over ranked members, computed on read (the table
  `party_scores` goes). Pledge delivery stays on the party page as its own counts, never blended.

## Delete / keep / change

Delete (the LLM-as-judge and everything that only exists for it):
- `server/scoring/elo.ts` + test; `eloToPercent`, `ELO_*` in `weights.ts`.
- `server/scoring/panel.ts` entirely (manager, perspective agents, arbitrator, output format,
  escalation, the ideology analyst, `applyIdeologyToProfile`) + `panel-format.test.ts`.
  The ideology analyst is DELETED, not moved: part 3 replaces it with verified stances.
- `server/services/tdIdeologyProfileService.ts` (adapter used only by the analyst).
- `td_score_history`, `writeTrends`, `movers`, `Mover`; `party_scores`, `replacePartyScores`,
  `listPartyScores`, the `avgElo` path in `party.ts`.
- `td_scores` columns: the 5 ELOs, `news_score`, `elo_change_7d/30d`, `total_stories`,
  `last_scored_at`, index `td_scores_overall_elo_idx`. Keep `parliamentary_score`,
  `debate_score`, `overall_score`, ranks; add `computed_at`.
- `news_sources.credibility` (only use was ELO weighting; hand-typed outlet weights are a value
  judgement) and every reader.
- `td_policy_stances` is left for part 3 to drop (part 3 owns stances).
- Legacy scripts that read `td_scores` ELO columns (`scripts/calculate-overall-scores.ts`,
  `generate-td-historical-summaries.ts` + its npm script, `generate-td-summaries-template.ts`,
  `server/scripts/populate-td-gender-comprehensive.ts` if it reads them): delete, or fix if still
  needed for something else.

Repurpose:
- `article_td_scores` → **`article_tds (article_id, td_id, created_at)`**: the link "this TD is
  named in this article" is a fact that `feedForTd` / `affectedTds` need. Drop every verdict
  column (impact, dimension_scores, sentiment, needs_review, reasoning, analyzed_by, story_type,
  is_ideological_policy, policy_direction). `td_policy_stances` has an FK to it? — check, and keep
  part 3 able to drop it.
- `pipeline.ts` stays in `server/scoring/` only if it still scores; it no longer does, so move it
  to **`server/news/tdPipeline.ts`** (+ `articleSource`): importance triage → TD extraction →
  `article_tds` link → daily-vote question generation. Question gate until part 3: article passed
  importance and names ≥ 1 TD. It no longer calls the panel or `recalculateAll`.
- Jobs: `npm run news:tds` runs the pipeline; `npm run td-scoring -- --recalculate` becomes
  `scores:recalculate` (keep the old script name as an alias for one release). The scheduler's
  2-hourly job is relabelled. `/api/admin/td-scoring/*` URLs stay (external cron).

Change:
- `weights.ts`, `rollup.ts` (inputs: questions, attendance, committees, debate, isPresiding),
  `repository.ts` (`rollupInputs`, `writeRollup`, `listActive`
  order), `recalculate.ts`, `server/scoring/index.ts`, `debateInputs.ts` → `parliamentInputs.ts`.
- `server/routes/scores.ts`: `tdCard` = identity + components + pillars + overall + ranks +
  `computedAt`; `/widget` drops movers/storiesAnalysed; `/td/:name` drops dimensions and
  recentArticles and returns the raw facts (votes cast / eligible, questions oral/written,
  committee sittings, sections spoken) with their sources; `/parties` keeps `{party,
  memberCount}` (used by `GlobalSearch.tsx:91`) plus the mean.
- New **`shared/scoresApi.ts`** with the response types, imported by server AND client (vet
  finding: client types are hand-written, so dropped fields fail silently).
- `server/services/chatTools.ts`: return components/pillars, not transparency/integrity; drop
  sentiment/impact reads (`:194`).
- `server/news/repository.ts`: `feedSelect` drops impact / story type / sentiment; `affected` =
  names; `BY_IMPACT` → `BY_IMPORTANCE` (`a.importance_score`, newsworthiness, not a verdict).
  `server/news/feed.ts`: sort key `top` with `score`/`highest` kept as aliases.
  `server/routes/news.ts:32-33` stop reading sentiment/impact.
- Client: `TDProfilePage` (4 fact tiles with raw counts and sources; a NULL component reads
  "Not applicable" rather than 0; delete the news pillar tile, the score-trend card,
  `TrendRow`, the "stories scored" block, `ScoreDimension`; keep "In the news" as a plain sourced
  list), `NewsArticleCard` (no impact chips), `TodaysBiggestImpact` → "Today's top story",
  `HomePageTabs` "Top impact" → "Top stories", `lib/news.ts` (drop impactScore, sentiment),
  `ResearchedTDsPage` (no movers/ELO; sort by overall and components), `PartyProfilePage` (no news
  tile/avgElo; `parliamentary_score` readers updated), `TDScoresWidget`, `HomePage`. All via
  `shared/scoresApi.ts`.
- Docs: rewrite `docs/scoring.md`; superseding note at the top of
  `docs/plans/td-scoring-rebuild.md` §2a; delete `docs/SCORING_SYSTEM.md`.

## Migration (0010, generated after part 1's 0009 is on main)

Drops and adds on `td_scores`; DROP `td_score_history`, `party_scores`; RENAME
`article_td_scores` → `article_tds` + column drops + index renames; DROP
`news_sources.credibility`. Code ships in the same PR. Before applying to GlasCore: dump the
dropped tables/columns to a local JSON backup (the ELO state cannot be rebuilt). After: run
`npm run scores:recalculate` and check the counts.

## Tests

Fail on current code:
- A TD whose questions input is NULL (exempt) is scored on the rest, not given 0.
- Ceann Comhairle (`isPresiding`, questions 0, committees 90) → overall NULL, no rank.
- One-component TD (attendance only) → overall NULL, no rank.
- `weights.test.ts`: `PILLAR_WEIGHTS` keys are exactly parliamentary, debate.
- `routes/scores.test.ts`: `tdCard` keys equal the `shared/scoresApi.ts` fact list.
- Shared ranks on ties.
Rewrite/delete: `routes/scores.test.ts` (full rewrite), `weights.test.ts` ELO blocks,
`rollup.test.ts` news cases, `party.test.ts`, `repository.integration.test.ts` (drop
applyElo/writeTrends/movers; add `article_tds` link idempotency),
`news/repository.integration.test.ts:47,101-104,132`, `news/feed.test.ts` (aliases),
`parliament/sync.integration.test.ts:340`, `ideology.integration.test.ts:148-159` (analyst path;
keep the CHECK test at 161-170), `elo.test.ts`, `panel-format.test.ts`.
Gate before merge: `npx tsc --noEmit` (no new errors, 0 TS2307), full vitest with
TEST_DATABASE_URL (0 skipped), vite build, and a grep outside `drizzle/` for
`eloToPercent|overall_elo|overallElo|td_score_history|impactScore|newsScore|eloChange|totalStories|storiesAnalysed|avgElo|movers|credibility|article_td_scores|articleTdScores`
returning nothing.
