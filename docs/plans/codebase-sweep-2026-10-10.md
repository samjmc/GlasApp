# Codebase sweep plan (2026-10-10)

A full read of `main` at 8e311a7 by five parallel reviewers (API, pipelines and jobs, client,
database code, repo and CI), plus a read-only check of the live GlasCore database
(`pg_stat_statements`, table sizes, index use, grants). Nothing was changed while sweeping.

147 findings: 0 critical, 10 high, about 60 medium, about 76 low. The one regression found
(the streak chip, client F15, from #137) is fixed in #146.

IDs: A = API, P = pipelines and jobs, C = client, D = database code, R = repo and CI,
LIVE = live database. Effort: S under an hour, M under a day, L more.

Corrections applied to the raw reports:

- D14 (RLS and grants): checked live, the `anon` and `authenticated` roles have no `USAGE` on
  the `politics` schema, so nothing is exposed today. Kept as defence in depth only.
- D23 (migration 0024 not applied): resolved. The live ledger has 25 rows, the same as `main`.
- `DB_POOL_MAX` defaults to 10 (#141). The session pooler holds 15, shared with GlasIntelligence.

## Decisions for the owner

1. **Storage.** GlasCore uses about 225 MB of the free plan's 500 MB; `debate_speeches` alone
   is 122 MB (69.6k rows) and grows every sitting day. Move to Supabase Pro before launch, or
   keep debate text out of the database. Recommended: Pro.
2. **Git history.** About 836 MB, mostly two 54 MB GeoJSON files. Deleting the files (R1) stops
   growth; shrinking history needs a force-push to `main`. Recommended: delete now, rewrite only
   if clone time matters.
3. **App database role** (D15) needs a Supabase Owner. A DML-only `glasapp_app` role limits a
   bug to GlasApp's own tables; migrations keep the owner.
4. **Cookie banner** (C26): drop the optional switches, or make the app honour them.
   Recommended: drop them.
5. **Phone verification** (A8): no screen uses it, but the routes can send paid texts.
   Recommended: unmount the routes until a screen needs them.

## Phase 0: before launch (about 3 days)

Security, privacy, and data that cannot be taken back.

| ID | What | Sev | Effort |
|---|---|---|---|
| A1 | The job secret is logged in plain text. Redact `x-admin-secret` and `x-cron-secret`, add a test, rotate if logs were kept. | High | S |
| A8 A15 P31 | Unused phone verify/resend and SMS profile edit can text any number at our cost. Unmount. | Med | S |
| C24 | `ErrorBoundary key={location}` wraps every provider, so each navigation remounts the app, AuthProvider included. Move the boundary inside the providers. | High | S |
| C7 | Sign-out keeps the last user's cached data (pledge ranking, daily session). Clear the query cache; put the user id in those keys. | Med | S |
| A12 D18 | Consent withdrawal races an in-flight vote, which lands after the erase. Make the write conditional on consent in the same statement. | Med | S |
| A9 A10 | The GDPR export misses name, county and bio (kept in Supabase `user_metadata`). Add metadata to the export now; later, one home for profile fields (the users table). | Med | S + M |
| C26 | The cookie banner offers a choice the app ignores. See decision 4. | Med | S |
| D17 | No foreign keys from user ids, so a user deleted outside the app leaves political data. FKs to `politics.users` with cascade (NOT VALID, then VALIDATE), or a scheduled orphan sweep against `auth.users`. | Med | M |
| D14 | Defence in depth: explicit REVOKE, RLS on every table, a CI test. | Low | S |
| D15 | The app connects as the owner of a shared project. See decision 3. | Med | M |
| A16 | Account deletion half-completes without the service-role key. Require it at start-up in production. | Low | S |
| R5 R11 | `.env.example` has no `SCHEDULER=off`, so a new developer runs every cron against GlasCore. `.gitignore` misses `public/uploads/` (photos named by user id) in a public repo. | High | S |
| C5 P32 C23 A21 | Map tooltips built as HTML from database text; page fetches with no size cap that follow any host; leave-source links checked only client-side; no Content-Security-Policy. | Med | S each, CSP M |
| P12 | A TD background taken down after a complaint is re-created by the next bulk run. Keep a tombstone. | Med | S |

## Phase 1: background jobs (about 4 days)

Before the scheduler runs in production.

| ID | What | Sev | Effort |
|---|---|---|---|
| P1 | An LLM outage becomes permanent wrong state and logs as success: articles get a made-up score of 50 and are skipped forever, failed extractions are marked done with no quotes, unranked news is shown. Fail closed and retry; stop the run on out-of-credit. | High | M |
| P17 P16 P15 | Five failure policies; model names hard-coded per file (an OpenAI-only setup asks for `deepseek-flash`); ranking batches fire all at once. Put 429 back-off, an out-of-credit error and model choice in `aiService`; cap concurrency. | Med | M |
| P10 P11 P33 | A stance rebuild never removes stances the new rules reject; stances and evidence are written without a transaction; a failed article is never retried; the nightly rebuild can drop a stance written during it. | Med | M |
| P7 | The parliament sync lock is in-process; the CLI and the 04:45 cron can collide (a real deadlock happened). Use a Postgres advisory lock; same for the debate-items extractor. | Med | S |
| P8 | A short Oireachtas roster deactivates TDs (only an empty one is refused). Refuse plans that deactivate more than a handful unless forced. | Med | S |
| P19 P20 | One bad disclosure PDF blocks every newer file every night; rows for departed TDs are dropped for good. | Med | S + M |
| P22 P27 | A debate the model can never read is retried and paid for nightly ahead of new ones; `debates:items` with no flag reads the whole term. Cap attempts; require a limit or `--all --yes`. | Med | S |
| P23 P24 | No job run records. Add a `job_runs` table and admin view, structured logs, `noOverlap` on every cron. Document `QUESTION_ITEMS`. | Med | M |
| P2 | A second ranker makes up to 600 single-article model calls a day, duplicating the stored relevance score. Rank on the stored score. | Med | M |
| P4 P13 P26 P9 | Hard-coded Taoiseach/Tánaiste names; uncapped admin batch size; record rebuilds with nothing new; the roster fetched twice. | Low | S each |
| P28 | No tests for outage paths: model returns null, scoring throws, a rebuild removes a stance, one bad PDF. | Med | M |

## Phase 2: database (about 4 days, plus decision 1)

Measured live since 2026-09-24. Re-check `pg_stat_statements` after each change.

| ID | What | Sev | Effort |
|---|---|---|---|
| LIVE | An attendance query took about 250 s: a correlated EXISTS per TD per day scanned `td_absences` (3 rows) over a million times and `td_party_leaders` (10 rows) over 500,000. Rewrite as one join over date ranges. | High | M |
| LIVE D25 | Each sync re-links `td_id` on all ~70k speeches (~2 s, 0 rows changed, 16 calls) and on all division votes, and deletes and re-inserts each debate day (885 deletes; 6,800 dead rows in speeches). Restrict to changed rows; diff-upsert days, stances and evidence. | Med | M |
| LIVE | `distinct on (section_id)` over all speeches takes 3 s; `question_counts` did 99 sequential scans reading 2.5M rows. | Med | S |
| D8 D9 D10 | TD and party pages recompute party lines over every division vote, cohort figures over whole tables, and read the full text of every speech to keep 300 characters. Store at sync time. | Med | M |
| A13 D1 A2 | Anonymous matches aggregate the whole evidence table with no cache or rate limit; every signed-in request verifies the token with Supabase twice. Cache matches; reuse `req.user`; rate-limit public POSTs. | Med | S |
| D2 D3 D6 A14 | Exact `count(*)` on every feed page; no index for the top sort; the TD news tab scans every article twice; pledge pages load every user's ranking into Node. Use "has more", add the index, start from `article_tds`, aggregate in SQL. | Med | S each |
| A11 | Two concurrent votes can store a stale profile, which the daily summary can freeze. Advisory lock around the recompute. | Med | S |
| D4 D5 D11 D13 | Add indexes: `policy_votes(session_item_id)` (session delete scans every vote), FK columns, `divisions.debate_section_id`, `debate_sections.parent_id`; make `disclosure_files(kind, period)` unique. | Med | S |
| D12 | Drop `pledges_party_idx`, `question_askers_member_idx`, `td_scores_overall_score_idx` (covered or 0 scans live). | Low | S |
| D19 D21 D22 D20 | CHECKs the TypeScript already enforces (news status, policy domain, the consent pair, dates, 0–100 ranges); dead columns (`tds.member_uri`, unread mover fields); one id at three widths; question counts and offices stored twice. | Low | S–M |
| D24 | drizzle runs migrations in a transaction, so no `CREATE INDEX CONCURRENTLY`. For big tables build the index by hand first, then ship the migration with `IF NOT EXISTS`. | Low | Process |
| A19 A20 D7 P25 P30 | Small per-request waste: every quiz read when only the latest is used; whole baselines loaded for a set of ids; the full stats table per TD lookup; dedupe rebuilds title sets per comparison. | Low | S each |

## Phase 3: client (about 4 days)

| ID | What | Sev | Effort |
|---|---|---|---|
| C1 R28 | No route splitting: about 2 MB loads up front, map/charts/html2canvas/animation on the home page. Lazy-load routes; load html2canvas on demand. | High | S |
| C10 C16 C17 C25 | Five API call styles, three envelope parsers; raw `500: {...}` in toasts; error codes matched on English text; a global toast on top of each page's own error. One `apiCall` with a typed error. | Med | M |
| C9 C20 | Votes do not invalidate ideology queries, so My politics and matches stay stale; article votes live outside the query cache. | Med | S |
| C8 C30 | A token refresh wipes profile edits mid-typing and re-renders 23 components. React only to a real user change; memoise the context. | Med | S |
| C19 C21 | A TD page fires 10 requests for unopened tabs; the TD list downloads twice on the home page and search loads it on every page. | Med | M |
| C3 C4 C6 | Map: a click repaints other seats with stale colours; a fake one-polygon map hides load errors; dead helpers. | Med | S |
| C14 C11 C18 C22 | Two offline banners; two toast paths; quiz results stuck on "Saving…" after declined consent; names with `&` or `/` double-encoded. | Low | S each |
| C28 | Photo upload unreachable by keyboard; quiz answers lack arrow keys and announcements; unlinked labels. | Low | S |
| C12 C13 C27 C29 | Dead auth helpers (including a username to `@example.com` login), unused query keys, old compass utilities, Login/Register copy-paste, double guards. | Low | S |
| C31 R16 | No component tests. Add jsdom + Testing Library; start with auth, consent and sign-out. | Med | M |

## Phase 4: clean house (about 3 days)

| ID | What | Sev | Effort |
|---|---|---|---|
| R1 C2 | About 135 MB of unused GeoJSON tracked in git, served at `/assets` and copied into the image (some are HTML pages or "404" text). Delete all but the two used files. | High | S |
| R3 R6 | About 60 npm packages never imported, including firebase, react-icons and xlsx (known CVEs); client libraries in runtime `dependencies`. Remove; move to devDependencies; regenerate the lockfile with npm 10. | High | S–M |
| R2 | Node 20 is end-of-life. Move `.nvmrc`, Dockerfile and types to Node 22 together. | High | S–M |
| R4 | `npm run dev` needs nodemon, which is not declared. Use `tsx watch`. | High | S |
| A3 A4 P5 P6 P14 P18 P21 A5 A22 P3 | Dead server code: `supabaseDb` (0 callers); the cache layer (empty, and its Redis clear wipes the whole database); the last old scoring service; the td-scoring alias; unused Anthropic and embeddings paths; a gender script that writes wrong data; unused error classes; a no-op TD-extraction filter. | Med | S |
| R7 R20 | No dependency scanning. Dependabot for npm, actions and docker; pin actions and base images by digest. | Med | S |
| R12 R23 R24 | Tests and scripts are never type-checked; no linter. Add a `tsconfig.test.json` step; ESLint with react-hooks, warnings first. | Med | M |
| R8 R9 R10 R25 R26 | README and ARCHITECTURE contradict `docs/deploy.md`; 22 stale design docs; env vars documented in three places that disagree (`docs/launch-checklist.md` says `DB_POOL_MAX` defaults to 15; it is 10); broken links; no LICENSE although MIT is claimed. | Med | M |
| R14 R17 R30 R27 | `auto-land.sh` pushes straight to `main`; an unused pre-push hook; `dev:clean` kills every Node process; the package is named `rest-express`. | Med | S |
| A6 A7 A26 P29 A24 A23 | One error type and one async wrapper (four patterns now); Express 5, or a test that no async handler is unwrapped (one rejection exits the server); split the 451-line ideology service; one `normaliseQuote` instead of five; mount region middleware only where read; one name for the job secret. | Med | M |
| R19 R22 | CI: Docker layer cache, no double build, e2e waits on requests instead of sleeps. | Low | S |
| A25 | Untested: profile, region, news feed, the central error handler, log redaction, the recompute and consent races. The route-guard test counts `optionalAuth` as a guard. | Med | M |

## Order

1. Decisions 1–5 (scope, not code).
2. Phase 0, one PR per item, smallest first: A1, R5/R11, A8, C24, C7, A12.
3. Phase 4 deletions early (R1, R3, dead server code): they shrink every later diff and CI run.
4. Phase 1 before the scheduler runs in production.
5. Phase 2, re-checking live statistics after each change.
6. Phase 3.

About 18 working days in total; Phase 0 plus the deletions is about 4. Run `npm run robots`
after each phase (see `docs/plans/robot-run.md`).

## Checked and found sound

- No route lets one user read or write another's data; every user id comes from the verified token.
- Phone codes are random, hashed, capped and row-locked. Session creation and pledge saves are race-safe.
- Every timestamp has a time zone, money is in integer cents, every upsert has its unique index.
- CI guards migration order and fails if an integration suite skips. Live database = `main` (25 of 25 migrations).
- No secrets in the working tree (history not scanned).
