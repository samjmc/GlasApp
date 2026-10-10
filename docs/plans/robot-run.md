# Robot run: synthetic users through the real app

**Status:** built 2026-10-10 (`npm run robots`). The plan was vetted by three code-level checks and their findings are folded in below. Sam chose option 1: swap only the sign-in check, in-process, on a local test database.

**First run, 2026-10-10:** 400 robots, 67 s, every check PASS, 0 unexpected responses, 0 5xx.

- **Rate-limit cliff:** 10 robots behind one address saved 60 votes, and 20 more got 429.
- **Database pool:** the pool of 10 connections had up to 25 requests waiting (mean 12) at 20 robots at a time.
- **Daily sessions:** all 40 refusers got a `daily_sessions` row.
- **GlasCore:** it holds 0 TD evidence rows, so matches are party priors only.
- **Item analysis:** it ran on 330 stored quizzes, with no section short of data.

**Fixed the same day (Sam: "all three"), and re-run:**

- **Votes:** they now count per user (60), plus 600 per address. The 10 robots behind one address saved all 80 of their votes.
- **Pool:** `DB_POOL_MAX` is a setting. At 15, at most 14 requests were waiting (mean 4.6), and the run took 30 s instead of 67 s. The default went back to 10 the same day: GlasCore's session pooler holds only 15 connections, shared with GlasIntelligence. Raise that Pool Size in Supabase (an Owner or Admin can), then `DB_POOL_MAX`.
- **Daily sessions:** opening and completing a session now need consent. Refusers have 0 session rows.

## Goal

Prove that the whole app works for many users at once, and find bugs, slow routes and rate-limit cliffs before real users do.

It is **not** evidence about quiz quality. Robots answer from a model we wrote, so item quality needs real people.

## Done means

1. `npm run robots` runs end to end against a local disposable Postgres, and refuses anything else.
2. 400 robots by default (`--robots N`) go through the app over real HTTP to the real Express routes. 400, not 200, because the item analysis needs at least 100 base exposures per question (`server/quiz/analyse/thresholds.ts`). At 200 robots, only about 75 per question would store a quiz.
3. A Markdown report under `reports/robots/<stamp>/` (`reports/` is already gitignored) gives:
   - latency per route (p50, p95, max)
   - status counts per route
   - samples of the database pool waiting count
   - row counts per table
   - the pass/fail checks below
   - the quiz item analysis run on the stored results
4. Tests prove three things: the guards refuse a non-local or non-`_robots` database; the sign-in swap is reachable only from the runner; a robot's choices are deterministic for a seed.

## Process (`server/jobs/robots.ts`, run with `tsx`)

**Order matters.** `server/db` reads `DATABASE_URL` at import, and `server/services/aiService.ts` runs `dotenv.config()` at import, which fills any unset variable from `.env`. So the runner:

1. **Sets its own environment first,** before any `server/*` import:
   - every `BLANKED_ENV` key (`test/e2e/harness.ts`: model keys, Jev, Redis, Twilio) to `''`
   - `SUPABASE_URL=http://127.0.0.1:9`, with dummy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (an empty service key crashes `server/auth/supabase.ts`)
   - `NODE_ENV=production`, `LOG_LEVEL=warn`, `SCHEDULER=off`

   It checks the values it set; it never relies on the shell. On Windows, `$env:X = ''` deletes the variable.
2. **Guards.**
   - `DATABASE_URL` must equal `testDatabaseUrl('robots')` (needs `TEST_DATABASE_URL`), on host `localhost` or `127.0.0.1`, with a name ending in `_robots`.
   - After connecting, `select current_database()` must end in `_robots`, as `test/e2e/prepare-db.ts` checks.
   - The run refuses to start within 30 minutes of midnight Europe/Dublin, because a session that crosses midnight gets 409.
3. **Database.** `ensureDatabase`, then `applyAllMigrations`, which drops and recreates `politics` itself (`server/testing/migrations.ts:67`).
4. **Reference data.** It is copied read-only from GlasCore over a second `pg.Client`, which uses its own env var (`ROBOTS_SOURCE_DATABASE_URL`), TLS with `rejectUnauthorized: false`, and `BEGIN READ ONLY`. No user table is read. The copy refuses if the target database is not `_robots`.
   - **Copied:**
     - `politics.tds`
     - `td_ideology_evidence`, so the matches query has realistic cost
     - `policy_questions` and `policy_question_options`, with their ids, then `setval` on the sequences
   - **Not copied:** `news_articles`. Voting stores headline and URL on `policy_questions` and never joins the news tables (`shared/schema/voting.ts:33-40`). There is no foreign key between them.
   - **Question dates:** `created_at` is shifted to now minus a few minutes each. Otherwise the 14-day candidate window (`server/voting/service.ts:42`) leaves sessions empty.
   - Then `recalculateAll()` from `server/ideology`.
5. **App.** Copy `server/index.ts`'s setup, without importing it, because it starts at import and listens on 0.0.0.0:
   - `trust proxy` 1, helmet with the same options, and the 1 MB json and urlencoded parsers
   - `registerRoutes(app)`, then `errorHandler`
   - **no** `initScheduler`
   - listen on `127.0.0.1` on a random port
6. **Sign-in swap.** `installRobotSignIn(supabase)` from `server/jobs/robots/signIn.ts`. Importing it does nothing; calling it is the only effect.
   - It refuses unless `current_database()` ends in `_robots`.
   - It replaces `supabase.auth.getUser` on the object from `server/auth/supabase.ts` (called per request at `server/auth/index.ts:64`). The replacement maps `Bearer robot-<n>` to `{ id: 'robot-<n>', email: 'robot-<n>@robots.invalid', app_metadata: {}, user_metadata: { region_code: 'IE', county, constituency } }`.
   - It never sets `email_confirmed_at`, so no robot can become admin through `ADMIN_EMAILS`. Any other token gets `{ data: { user: null }, error }`.
7. **End.** Write the report, `shutdown()`, then `process.exit`. The interval in `server/services/cacheService.ts` would otherwise keep the process alive.

## Robots

- **Positions** come from `server/quiz/testing/respondents.ts` (`mulberry32`, `makeRespondents`, `itemOffsets`, `chooseAnswer`), all seeded (`--seed`).
- **The quiz** follows the same steps as `server/quiz/analyse/synthetic.ts:77-93` (copied, not imported; that function returns no latent positions), with the twin-answer handling. It uses `QUIZ_QUESTIONS` and `DEFAULT_PLAN_CONFIG`, so `verifyPlan` stores a non-null plan:
  1. pick a seed
  2. `planQuiz(seed, {})` and answer the base questions
  3. `planQuiz(seed, base)` and answer the follow-ups
  4. `POST /api/quiz` with `{ answers: responsesFor(plan, answers), seed }`
- **Daily and article votes** pick the option nearest the robot's position, comparing `latent` with `5 × option` (`server/ideology/sources.ts`). Only dimensions where some option of that question is non-zero count, so a flat option does not win by default. A little noise is added.
- **Pledge ranking** is a seeded shuffle of the 11 rankable categories. No mapping from category to dimension exists, and inventing one would add untested assumptions.
- **Mix:**

  | Share | Group | What it does |
  |---|---|---|
  | 5% | anonymous | posts a quiz with no sign-in; expects a score with `id: null` and nothing stored |
  | 10% | refusers | sign in but never grant consent |
  | 5% | withdrawers | do everything, then `DELETE /api/account/consent/political` |
  | 80% | finishers | do everything |

  "Stops the quiz halfway" is dropped, because the quiz is one POST and a robot quitting is invisible to the server.
- **Journey for a signed-in robot.** Each sends `Authorization: Bearer robot-<n>` and its own `X-Forwarded-For` (a synthetic address).
  1. `GET /api/profile/me` (runs `ensureProfile`)
  2. `PUT /api/account/consent/political` `{ version: POLITICAL_CONSENT_VERSION }`; refusers skip this
  3. the quiz (above); refusers still post it and expect `id: null`
  4. `GET /api/daily-session`, a vote on each item, then `POST /api/daily-session/complete`. Refusers expect 403 `CONSENT_REQUIRED` on the votes and 400 or 404 on complete.
  5. up to 5 article questions, taking `article_id` from the copied questions: `GET /api/votes/articles/:articleId`, then `POST /api/votes/questions/:questionId` with the `question.id` from that response
  6. `PUT /api/pledges/priorities` `{ ranking }`
  7. `GET /api/ideology/me`, `GET /api/ideology/me/matches`, `GET /api/quiz/me`
  8. withdrawers: `DELETE /api/account/consent/political`
- **Never called:** `POST /api/region/select` and `DELETE /api/account`. Both call the Supabase admin API, which the swap does not cover.
- **Concurrency:** 20 at a time (`--concurrency`). The database pool is 10 (`server/db.ts:28`), so queueing is expected and its waits are reported.

## Rate limits

`publicWriteRateLimit` allows 60 writes per IP per 15 minutes, shared across both vote routes (`server/middleware/rateLimit.ts:97-101`), and keys on `req.ip`.

- **Main pass:** each robot has its own address. This is realistic per user, and the server code is unchanged.
- **Separate probe:** 10 robots share one address. The report states how many votes they get before 429. That is the cliff users behind one office or campus network would hit.

## Pass/fail checks in the report

**Refusers:**
- 0 rows in `quiz_results`, `policy_votes`, `pledge_category_priorities` and `ideology_profiles` (kind `user`)
- every vote and ranking answered 403 `CONSENT_REQUIRED`
- the quiz scored with `id: null`

**Withdrawers:**
- 0 rows in those tables and in `daily_sessions`
- their `politics.users` row remains, with the consent columns null

**Finishers:**
- 1 quiz result with a non-null plan
- 3 daily votes and a completed session
- 1 user `ideology_profiles` row

**Anonymous robots:** no rows anywhere.

**Everyone:** no 5xx response anywhere.

**Reported, not passed or failed:** refusers get a `daily_sessions` row, because `GET /api/daily-session` creates one without consent (`server/voting/routes.ts:53`). The row holds no opinion, but `erasePoliticalData` treats that table as political data. It is a finding for Sam.

## What it cannot show

- **Real Supabase sign-in.** The sign-in check is replaced. In production, each signed-in request also calls Supabase two or three times (`optionalAuth` plus `requireAuth`); those round trips are missing from the latency figures.
- **More than one day.** The routes always use today's date.
- **The browser UI.** That is covered by the 13 Playwright tests.
- **Production speed.** One laptop and a local Postgres say how routes compare with each other, not how fast production is.
- **Meaningful matches.** With no stances copied, matches are evidence plus party priors. The report gives match latency, not match quality.

## Files

- `server/jobs/robots.ts`: the entry point. It follows the importable pattern of `server/jobs/stances.ts` (entry check, exported argument parser).
- `server/jobs/robots/`:
  - `guards.ts`
  - `seed.ts`
  - `signIn.ts`
  - `robot.ts`
  - `choose.ts` (nearest option, ranking)
  - `report.ts`
- **Tests:** these need only `TEST_DATABASE_URL` or nothing, because CI fails on any skipped test.
  - The guards refuse a remote host, a wrong database name or a missing `TEST_DATABASE_URL`.
  - `installRobotSignIn` throws on a non-`_robots` database.
  - A static check: only `server/jobs/robots.ts` imports `signIn.ts`; no file outside `server/jobs/` imports `server/jobs/**` (`server/index.ts` is the only build entry); and no file assigns `.auth.getUser` except `signIn.ts`.
  - `choose.ts` is deterministic, and the nearest-option rule ignores flat dimensions.
  - Robot code avoids `userId: z.string()` and the other patterns that `server/auth/route-coverage.test.ts` scans for.
- `package.json`: `"robots": "tsx server/jobs/robots.ts"`

## Cost

- **No model calls:** every model key is blanked.
- **One read-only copy from GlasCore per run:** a few hundred to a few thousand rows of public data (TDs, their evidence, and the questions).
