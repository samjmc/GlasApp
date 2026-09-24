# Quiz + ideology rebuild — plan

Branch `rebuild/quiz-ideology`. Same standard as `server/scoring/`: one engine, one schema file,
one router per concern, pure tested maths, a recalculate CLI, everything older deleted in the same PR.

## What exists today (mapped 2026-09-22)

- **Three question banks**: `shared/enhanced-quiz-data.ts` (8 dims, the live one), `shared/data.ts`
  `questions` (2 dims, used only by the dead `QuizContext`), `shared/data-complete.ts` (0 importers).
- **Three client score formulas** (two contexts + a share-code hash). The server trusts the client's numbers.
- **Five places a quiz result is stored**: raw-SQL `quiz_history` (no CREATE TABLE anywhere),
  `quiz_results` (stub writer, never persisted), `archived_quiz_results_history` (orphan),
  `political_evolution`, and Supabase-only `user_quiz_results` (read by `WelcomeBanner` straight from the client).
- **Two TD write paths per article** (`scoring/panel.ts` Ideology Analyst and `policyStanceHarvester`),
  plus debates, all through `TDIdeologyProfileService.applyAdjustments` — an order-dependent running
  nudge that can never be recomputed.
- **Three user↔TD/party match formulas**: `personalRankingsService.calculateIdeologyMatch`, and two in
  `political/parties.ts` that disagree with each other (one divides party scores by 2, one does not).
- **Two party-baseline scales** writing the same `parties.*_score` columns (−10..10 vs −2..2).
- No ideology table (`td_ideology_profiles`, `user_ideology_profiles`, `party_ideology_profiles`,
  `*_ideology_events`, `user_ideology_snapshots`, `debate_ideology_*`) has a schema or migration.
  They lived only in the deleted Supabase project. Nothing needs preserving.
- Zero automated tests on any of it.

## The one model

`shared/ideology.ts` — the only dimension list (8 dims, −10..10, labels, poles). Replaces
`server/constants/ideology.ts`, `IdeologicalDimensions` in `quizTypes.ts` **and** `types.ts`.

`server/ideology/` (new):

| File | Job |
|---|---|
| `model.ts` | Pure. `computeProfile(prior, evidence[], now)` → per-dimension weighted mean, prior counts as `PRIOR_WEIGHT`, 180-day half-life, a dimension with no signal in a piece of evidence is skipped (never pulled to 0). Order-independent, so any profile can be rebuilt from its evidence. |
| `alignment.ts` | Pure. `alignment(a, b)` → 0..100 plus confidence. The ONE user↔TD, user↔party, TD↔party formula. |
| `sources.ts` | One table saying how each source maps onto the −10..10 scale and its base weight: `quiz`, `policy_vote`, `article`, `debate`. |
| `repository.ts` | Drizzle. Insert evidence (idempotent on source ref), read, upsert profiles. |
| `service.ts` | `recordEvidence(...)`, `recomputeProfile(subject)`, `getProfile(subject)`, `getTimeline(subject, from, to)` (computed from evidence as of each week — no snapshot table). Party profile = weighted mean of its TDs, computed on recompute. |
| `recalculate.ts` | `npm run ideology -- --recalculate` rebuilds every profile from evidence. |
| `debateSource.ts` | The debate LLM analysis, cut down to: read speech → LLM delta → `recordEvidence`. |

`server/quiz/` (new): `questions.ts` (the one bank, moved from `enhanced-quiz-data.ts`),
`score.ts` (pure: answers → vector; the server scores, never the client), `routes.ts`.

Tables in `shared/schema/quiz.ts`, schema `politics`:
- `quiz_results` — id, user_id, 8 dims, answers jsonb, ideology label, created_at. History = all rows.
- `ideology_evidence` — subject_kind (user|td), subject_id, source_kind, source_ref, 8 nullable dims, weight, observed_at. Unique (subject, source_kind, source_ref).
- `ideology_profiles` — subject_kind (user|td|party), subject_id, 8 dims, total_weight, evidence_count, computed_at.

Routes (replacing everything listed below):
- `POST /api/quiz` (anonymous allowed: scores and returns; saves only when signed in) · `GET /api/quiz/me` (history) · `POST /api/quiz/assistant` (kept, rate-limited)
- `GET /api/ideology/me` · `/me/timeline` · `/me/matches` (TDs + parties) · `GET /api/ideology/td/:id` · `/party/:name`

Client: one quiz page `/quiz`, one results page `/quiz/results`, no context (answers are page state,
the result comes from the server via react-query). Links in Header/BottomNavigation/onboarding repointed.

## Seams I keep working but do not own

- `server/scoring/panel.ts` dynamic-imports `TDIdeologyProfileService.applyAdjustments`. Scoring core is
  off-limits, so `server/services/tdIdeologyProfileService.ts` becomes a ~20-line adapter onto
  `recordEvidence`. Same for `policyStanceHarvester.ts` (news-driven). Delete the adapter when those move.
- GApp session (daily session, policy votes, pledges) calls `recomputeProfile` / `getIdeologyProfile` from
  me and stops using `personalizedScoringService` (theirs to delete). I do not edit `policy.ts`, `category.ts`,
  `voting.ts` or `dailySessionService.ts`; the adapters below keep them compiling.
- `aiNewsAnalysisService` still asks the LLM for an `ideology_delta` nobody reads — news pass.

## Deltas from the vet pass (2026-09-22)

**Scales.** Every non-quiz source is a stance *lean*, not a running nudge, so each becomes a position
observation on −10..10 with one factor per source in `sources.ts`: panel article ±0.5 ×20, harvester ±2 ×5,
debate ±0.5 ×20, vote option ±2 ×5, party baseline ±2 ×5. A dimension under 10% of its source max is
"no signal" and skipped. Debate multipliers (salience, rhetorical/substantive, rebellion, cross-party) move
into the evidence `weight`; the 180-day contradiction penalty is dropped (a weighted mean already averages
contradictions, and the penalty is order-dependent).

**Quiz scoring** keeps the live formula (sum of each question's primary-dimension value), moved server-side
and clamped to ±10. Q26 "Strategic Compass" has no dimension and scores nothing today: deleted. A custom
text answer scores nothing (as today); a submission with zero scored answers is rejected.

**TD prior** = party baseline, a code constant `server/ideology/partyBaselines.ts` (the only full 8-dim set,
`scripts/update_party_dimensions.ts`, ×5). Independents start at 0. Party profile = weighted mean of its TDs,
falling back to the baseline when a party has no TD evidence. TD subject id = `politics.tds.id`; the adapter
resolves the name panel/harvester pass via the existing `lower(name)` index.

**Users** follow GApp's pull model: user profile = f(latest quiz result, `listUserVoteVectors(userId)` from
`server/voting`). No user rows in `ideology_evidence`. Exports agreed with GApp:
`recomputeProfile(userId)`, `getIdeologyProfile(userId)`.

**Cross-session callers stay compiling** (merge order unknown): `server/constants/ideology.ts` becomes a
re-export of `shared/ideology.ts`; `PersonalRankingsService` and `UserIdeologyProfileService` become small
adapters exposing only the methods `policy.ts`, `parliamentary/voting.ts`, `dailySessionService.ts` and
`masterNewsUpdate.ts` call, delegating to the new engine; `formatters.ts` stays until `voting.ts` moves.
All four callers are GApp's or news's; the adapters go when they do. `user/rankings/index.ts` keeps mounting
`policy.ts` and `category.ts` only (`user_category_rankings` is GApp's, agreed).

**Also repointed / fixed**: `openaiService.ts:670` and `ai/analysis.ts:30` (import the new quiz bank and
types), `route-security.test.ts` mock, `route-coverage.test.ts` public allowlist (4 paths gone, `POST /api/quiz`
and `POST /api/ideology/matches` added), `package.json` `debate-ideology` scripts, drizzle config glob +
`db.ts` schema object (only my lines), `App.tsx` global provider, `EnhancedProfileExplanation` context use.

**Client**: `/api/personal/*` is mounted at `/api/personal/personal/*` today, so MyPoliticsPage and
PersonalRankingsTab already 404; `/api/party-match/party-matches` is served nowhere. Nothing live to
preserve there — they get repointed to `/api/ideology/*`. `POST /api/ideology/matches {vector, weights}` is
public and stateless so anonymous quiz takers get party/TD matches. The live weight sliders stay: weights are
an optional argument to `alignment()`. Anonymous result sits in sessionStorage and is saved once after sign-in.
Timeline keeps compare-with-party; CSV export moves client-side; compare-with-average-user is dropped.
ProfilePage "Political Evolution" tab reads `/api/quiz/me` history. WelcomeBanner reads `/api/quiz/me`.
Share codes are dropped (the server lookup has always returned 404).

**Dropped on purpose**: friends leaderboard (server returns a placeholder), per-TD policy agreement from
slider votes (GApp removed sliders, so it has no data source), `political_avatar` localStorage (no reader).

## Deltas from the second vet pass (2026-09-22)

**Polarity — the sources disagree on the sign of four dimensions.** Economic, social, cultural and
authority agree everywhere (+ = right, conservative, traditional, authoritarian). For globalism,
environmental, welfare and technocratic there are two conventions:

| + means | `quizTypes.ts` + quiz answers | every LLM prompt (panel, harvester, debates, option vectors, openaiService), dailySession labels, party baselines |
|---|---|---|
| globalism | internationalist | nationalist |
| environmental | ecological | pro-business / industrial |
| welfare | communitarian | individual / reduce welfare |
| technocratic | technocratic (but the quiz answers score it the other way) | populist |

Party baselines agree with the prompts on three of these and are row-by-row inconsistent on technocratic.
Averaging without a fix pulls these four dimensions toward zero or flips them.

Decision (pending Sam): **one rule, "+ is the right-coded pole" on all 8 dimensions** — the convention every
prompt already uses. Then no other session's prompt changes; only files I own flip: the quiz answer values
for globalism/environmental/welfare, the display labels, the label function (whose welfare branch is also
inverted today), and technocratic in party baselines re-derived per party from its rationale text.
`sources.ts` still carries an explicit sign per source per dimension, all +1 today, and a test that pins it.

**Routers live under `server/routes/`** (`server/routes/quiz.ts`, `server/routes/ideology.ts`, as
`scores.ts` does), engines in `server/quiz/` and `server/ideology/`. `route-coverage.test.ts` only scans
`server/routes/**` and `server/routes.ts`; a router elsewhere would get no guard check and its allowlist
entries would fail the stale-entry test. Allowlist edits: remove `/api/quiz-results`,
`/api/multidimensional-quiz-results`, `quiz/index.ts /assistant`, `political/parties.ts /matches`;
add `quiz.ts /` (POST), `quiz.ts /assistant`, `ideology.ts /matches`.

**Adapter surface, exactly** (nothing more): `PersonalRankingsService.getUserProfile`, `getPersonalRankings`,
`recalculatePersonalRankings` (no-op, rankings are computed on read), `updatePolicyAgreementFromVote` (no-op,
no data source), `recalculateAllUserRankings` (returns `{usersUpdated}`), `invalidateTDIdeologyCache` (goes
with the TD service rewrite); `UserIdeologyProfileService.recomputeUserProfile` → `recomputeProfile`.
Return shapes are the ones `formatters.ts` reads. `policy.ts` imports the formatters from `./personal.js`,
not `formatters.ts`; I change that one import line to `./formatters.js` (told GApp) so `personal.ts` can go.

**GApp contract.** GApp's message (newer than their branch's `docs/plans/voting-rebuild.md`, which still
says push via `applyVoteToProfile`) settled on pull: `listUserVoteVectors(userId, since?)` from
`server/voting`. That module does not exist yet (their branch is plan-only). Until it merges, the user vote
source is a local interface `VoteVectorSource` in `server/ideology/` with a default that returns `[]`,
swapped for the real import in whichever PR lands second.

**Names.** Panel and harvester pass TD names; evidence needs `tds.id`. The adapter resolves with
`lower(name)`; an unmatched name is logged, counted, and skipped (never creates a TD).

**Numbers the first draft left open.** Quiz evidence weight 10 (a full quiz outweighs about a dozen
average votes). Votes weigh `weight × (confidence ?? 1)`. Time decay applies to TD evidence only; a user's
latest quiz and votes count at full weight until they retake the quiz. Party prior weight 3 for a TD.

**Smaller corrections.** `openaiService.ts:670` is `generateCompleteProfileAnalysis` (needs question `id`,
`text`, `category`, `answers[].text` — the new bank keeps them); `generateAnswerExplanation` needs nothing.
`/api/enhanced-profile/explain-answer` does not exist server-side, so there is nothing to repoint.
`shared/schema.ts:7` re-exports `QuizQuestion`/`UserResponse` from `quizTypes` — removed.
`update-debates-and-ideology` in `package.json` calls `debate-ideology`; both retarget together.
`PoliticalOpinionChangeTracker`, `PartyMatchResults`, `MultidimensionalIdeologyProfile`, `ContextAnalysis`
import `quizTypes` — repointed to `shared/ideology.ts`.

## Deleted

Server: `quizHistoryService.ts`, `personalRankingsService.ts` (1,109), `userIdeologyProfileService.ts`,
`ideologySnapshotService.ts`, `debateIdeologyAnalysisService.ts` (→ `debateSource.ts`),
`articleIdeologyEnhancements.ts` (0 importers), `server/constants/ideology.ts`, `routes/quiz/index.ts`,
`ideologyTimelineRoutesEnhanced.ts`, `politicalEvolutionRoutes.ts`, `routes/user/rankings/personal.ts`
+ `formatters.ts` + `index.ts` (policy.ts stays for GApp), inline `/api/quiz-results*` and
`/api/multidimensional-quiz-results` in `routes.ts`, `storage` quiz/evolution stubs, the two match
functions in `political/parties.ts`, `ActivityTracker.logQuizCompletion` quiz shape.
Jobs/scripts: `dailyIdeologySnapshot.ts`, `dailyDebateUpdate.ts`, `debateIdeologyProcessor.ts`
(→ npm script on the new CLI), `processIPASVote.ts`, `triggerRankingsRecalc.ts`,
`updatePersonalRankingsFromExistingVotes.ts`, `server/scripts/testIdeologyIntegration.ts`,
`correctPartyBaselines.ts`, `testPartyBaselines.ts`, `testDebateProcessing.ts`, `scripts/update_party_dimensions.ts` +
`setup_party_dimensions.sh`, `scripts/fix-quiz-scores.cjs`, `flip-*.cjs` (2), `update-quiz-scores.{cjs,js}`,
`update_schema.{js,ts}`.
Legacy schema entries: `quizResults`, `quizResultsHistory`, `politicalEvolution` (+ their insert schemas/types).
Shared: `data-complete.ts`, quiz parts of `data.ts` (`questions`, `getIdeology`, `uniqueCombinations`),
`enhanced-quiz-data.ts`, `quizTypes.ts`, duplicate `IdeologicalDimensions` in `types.ts`.
Client: `QuizContext.tsx`, `MultidimensionalQuizContext.tsx`, `Results.tsx`, `DimensionWeightsPage.tsx`,
`TestAnswerExplainerPage.tsx`, `IdeologySummary.tsx`, `EnhancedPoliticalAnalysis.tsx`,
`PoliticalEmojiAvatar.tsx`, `QuizAnswerExplainer.tsx`, `ShareResults.tsx` (if nothing else uses it), `EmptyQuizState`, `EnhancedQuizPage`/`EnhancedResultsPage` (→ new pages),
`WelcomeBanner`'s direct Supabase read.
