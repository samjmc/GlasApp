# Voting rebuild: daily session, policy votes, pledges

Status (2026-09-22): Sam approved the plan. **Part 1, voting, is built** (branch
`rebuild/voting`). Part 2, pledges, is next. The "As built" section at the end records
where the build departs from the plan below; read it first.

## Why this is next

The daily session is the signed-in home screen. `client/src/App.tsx` sends every signed-in
user to `/daily-session`. It runs on a 3,130-line service and **nine tables that no schema
or migration in this repo creates**:

`daily_sessions`, `daily_session_items`, `daily_session_votes`, `policy_vote_opportunities`,
`policy_vote_option_vectors`, `user_policy_votes`, `user_policy_vote_responses`,
`article_vote_stats`, `policy_vote_option_stats`

All of them lived only in the deleted Supabase project, and every read goes through raw
`supabaseDb.from('<name>')`. On the new GlasCore database the home screen fails for every
signed-in user. (`user_ideology_profiles` is in the same state; the quiz session owns it.)

## What exists today (measured on main 6ee8746, line counts include blank lines)

| Concern | Implementations | Notes |
|---|---|---|
| Policy-vote API | `server/routes/parliamentary/voting.ts` (398) and `server/routes/user/rankings/policy.ts` (416) | Same 11 routes, both mounted at `/api/policy-votes`; only the first ever answers |
| Question generation | `policyOpportunityService.ts` (772) + `policyStanceHarvester.ts` (381) | Called from `dailyNewsScraper.ts` and `server/scoring/pipeline.ts`. The news session removes the scraper call, so the pipeline stays the one call site |
| Question backfill | `backfillPolicyOpportunities.ts` (117), `regeneratePolicyQuestions.ts` (248) | Two CLIs for one job |
| Daily session | `dailySessionService.ts` (3,130), `dailySessionRoutes.ts` (199), `DailySessionPage.tsx` (1,811) | Three public methods of 400 to 620 lines each; a `fetchLegacyPolicyCandidates` path; its own vote-to-ideology mapping by keyword (`detectDimensionFromText`, `normalizePolicyDimension`) |
| Vote widgets | `PolicyVotePrompt.tsx` (486, used in the news card), `PolicyVoting.tsx` (553, **imported nowhere**) | |
| User-to-TD match | `personalizedScoringService.ts` (335) | Duplicates the quiz session's `personalRankingsService`; agreed that it moves to them |
| Pledges | `pledgeScoring.ts` (390), `political/pledges.ts` (570), 15 routes | The political router is mounted at **7** prefixes |
| Pledge UI | `PledgeVotingInterface` (in EducationPage), `AontuEfficiencyPage` + `EfficiencyMetrics` (395) | A page for one party, hard-coded to party id 8 |
| Pledge data | 13 scripts under `scripts/` (2,924) | Hard-coded pledges with hard-coded party ids (2, 8) that a clean DB will not have. Some import `server/db.ts` through CommonJS `require`, which cannot load it |
| Promises | `policy_promises` table | **No writer anywhere.** Read only by one chat tool |
| Party scores | `party_performance_scores`, plus 3 of the 13 scripts | Superseded by `politics.party_scores` in the scoring rebuild |

## Target shape

Same pattern as `server/scoring`: pure logic with unit tests, one repository, one router.

```
shared/schema/voting.ts      politics.policy_questions, policy_question_options,
                             policy_votes, daily_sessions, daily_session_items
shared/schema/pledges.ts     politics.pledges, pledge_evidence, pledge_category_weights
server/voting/
  questions.ts               article -> question + options; the LLM returns a typed
                             ideology vector per option (no keyword matching)
  selection.ts               pure: pick today's items for a user
  votes.ts                   the ONE write path for a vote, from any surface
  repository.ts              Drizzle, politics schema
  routes.ts                  /api/votes and /api/daily-session
server/pledges/
  score.ts                   pure fulfilment score, unit-tested
  repository.ts, routes.ts   /api/pledges, mounted once
```

Decisions inside the design:

- **One vote table.** `user_policy_votes` and `user_policy_vote_responses` both record a user's
  answer. They merge unless the build finds they record different facts. A vote carries a
  `source` enum (`daily_session`, `article`) rather than living in two tables.
- **Stats are queries, not tables.** `article_vote_stats` and `policy_vote_option_stats` become
  SQL aggregates (or a view) over `policy_votes`.
- **The ideology effect of a vote belongs to the quiz session, and it PULLS votes.** Its
  profile is computed from `listUserVoteVectors(userId)`; voting only asks it to
  `recomputeProfile(userId)` after a vote. (Superseded an earlier push design,
  `applyVoteToProfile`, before either side built it.)
- **Identity is always `req.user.id`.** Any `/:userId/` route uses `ownsOrAdmin`.

## Delete (about 10,800 lines)

| What | Lines |
|---|---|
| `dailySessionService.ts`, `dailySessionRoutes.ts` (rebuilt in `server/voting/`) | 3,329 |
| `parliamentary/voting.ts`, `user/rankings/policy.ts` | 814 |
| `policyOpportunityService.ts`, `policyStanceHarvester.ts` (folded into `questions.ts`) | 1,153 |
| `backfillPolicyOpportunities.ts`, `regeneratePolicyQuestions.ts` (replaced by one CLI) | 365 |
| `personalizedScoringService.ts`, once the quiz session's engine lands | 335 |
| `PolicyVoting.tsx` (dead) | 553 |
| `pledgeScoring.ts`, `political/pledges.ts` (rebuilt in `server/pledges/`) | 960 |
| `AontuEfficiencyPage.tsx`, `EfficiencyMetrics.tsx` (one generic party pledge view) | 395 |
| 13 pledge and party-score scripts | 2,924 |
| Tables: `policy_promises`, `party_performance_scores`, `user_pledge_votes`, `user_category_votes`, and the old `pledges` / `pledge_actions` / `pledge_category_weights` definitions in `shared/schema.ts` | |

`DailySessionPage.tsx` (1,811) is rewritten against the new API, not deleted.

## Boundaries (agreed with the other sessions, 2026-09-22)

- **News** keeps `pipeline.ts` as the one place that creates questions; it now calls
  `generateQuestionForArticle(article)`. The feed shows questions through
  `getQuestionsForArticles(ids)`, never a join on the vote tables. The question row keeps
  a copy of the headline, summary, link and image, so voting never reads news tables.
- **Quiz/ideology** reads votes only through `listUserVoteVectors`, never the tables; owns
  user-to-TD matching; and exports `recomputeProfile` and `getIdeologyProfile` from
  `server/ideology/index.ts`.
- **Parliament** does not edit `parliamentary/voting.ts` (it is user voting, despite the
  folder). It will expose a "TD voted X on division Y" query that pledge evidence may use.

## Open for Sam

1. **Pledge data.** The scripts hold hand-entered pledges for FG, FF, Aontú and the Social
   Democrats. Keep only the entries with a source URL, as one seed file? Or start with no
   pledges and enter them through the admin page?
2. **The deletion list above.**

## Verification

No live database here. Unit tests for `selection.ts`, `questions.ts` validation, `votes.ts`
and `pledges/score.ts`; a real-Postgres integration test for the repository, skipped
without `TEST_DATABASE_URL`, as in the scoring rebuild; `route-coverage.test.ts` must stay
green. The first real proof is Sam signing in on GlasCore and completing one daily session.

## As built: part 1, voting

**Where it departs from the plan above:**

- **No `votes.ts`.** The one write path is `castVote()` in `server/voting/service.ts`.
  Every surface calls it: daily session, article card.
- **The ideology link is a pull, not a push.** The quiz/ideology session reads votes with
  `listUserVoteVectors(userId, since?)` from `server/voting/index.ts`, and never reads the
  vote tables. Voting calls that domain's `recomputeProfile(userId)` after each vote, and
  `getIdeologyProfile(userId)` when a session opens and when it finishes. Both calls go
  through `server/voting/ideology.ts`. Until `server/ideology` merges, that seam is a stub:
  votes are still recorded, and the summary says which way the answers leaned, with no
  before/after.
- **The slider is gone.** Every question is multiple choice, and every option carries a
  position on the 8 axes. A 1–5 rating only ever got an ideology meaning through keyword
  guessing (a 450-line keyword table, deleted).
- **No backfill command.** The scoring pipeline makes questions as it scores articles.
  `policy-votes:backfill` and `regeneratePolicyQuestions.ts` are deleted without a replacement.
- **The stance harvester is deleted, not folded in.** The scoring pipeline already writes
  `politics.td_policy_stances`, so the harvester wrote the same data a second time.
- **Sign rule:** + is the right-coded pole on all 8 axes. It is agreed with the quiz
  session and pending Sam's confirmation.

**Found while building, and fixed:**

- The streak was always 1. It was computed before today was marked complete, so the loop
  stopped at once.
- **The article vote widget never worked.** `/api/policy-votes` mounted routers whose
  paths were one folder deeper, so every address the widget called returned a 404. The
  same mistake breaks `/api/personal/*`, `/api/category-ranking/*` and `/api/pledges/*`.
  The quiz session owns personal. Pledges are part 2.
- The session date was a UTC date, so an Irish user just after midnight got yesterday's
  session. It is now the Europe/Dublin date.
- In development, every page load **deleted and rebuilt** today's session
  (`DAILY_SESSION_ALWAYS_RESET` defaulted to on outside production). That is removed.

**Verified:** 51 voting tests pass, 15 of them against a real Postgres 16 (Docker).
Planted defects turn them red: the old streak bug, and an unweighted regional sum.
`route-coverage.test.ts` now also scans `server/<domain>/routes.ts`. It proves all 7
voting routes are guarded, and it catches one that is not.

**Not verified:** nothing has run against GlasCore, and no model call has run. The
question generator is tested with scripted model output only.