# Task 2B Handoff — Phase 2 Schema Cleanup

**Branch:** `feature/phase-2b-schema-cleanup` (based on `main`)
**Scope touched:** `shared/schema.ts`, `migrations/` only (per instructions — no changes to `client/src/`, `server/services/`, or `server/routes/`)
**Commits:**
1. `9a8874d` — `refactor(schema): archive unused quiz_results_history table`
2. `5d8a0de` — `perf(schema): add indices for quizResults, userActivity, tdScoreHistory`

## Summary

Of the 4 tables flagged as candidate "legacy/possibly-unused," only **1 of 4** (`quiz_results_history`) had zero live usage and was archived. The other 3 (`ideas`, `ideaVotes`, `performanceScores`) are actively used by mounted, reachable routes — the original plan was wrong about them and they were **not** touched.

## Verification findings (per table)

| Table | Drizzle export | Verdict | Evidence |
|---|---|---|---|
| `ideas` | `ideas` | **LIVE — not archived** | `server/routes/ideasRoutes.ts` does real `db.select/insert/update` on this table; mounted via `app.use("/api/ideas", ideasRoutes)` in `server/routes.ts:122`; client has a live `/ideas` route (`IdeasPage`) in `client/src/App.tsx`. |
| `ideaVotes` | `ideaVotes` | **LIVE — not archived** | Same `ideasRoutes.ts` file, used for vote upsert/lookup alongside `ideas`. Same mount as above. |
| `quizResultsHistory` | `quizResultsHistory` | **DEAD — archived** | Only reader/writer is `server/services/quizResultsService.ts`, which is only imported by `server/routes/profileHistoryRoutes.ts`. That route file is **never imported/mounted anywhere** in `server/routes.ts` or elsewhere in the codebase, and no client code calls its would-be endpoints. The live quiz-history feature (`/api/quiz-history` and `/api/ai`, backed by `server/routes/quiz/index.ts` → `server/services/quizHistoryService.ts`) uses a completely separate, raw-SQL `quiz_history` table (not a Drizzle table at all), so this Drizzle table is a genuine orphan. |
| `performanceScores` | `performanceScores` | **LIVE — not archived** | `server/routes/parliamentary/scores.ts` does `db.select().from(performanceScores)` with real `.where`/`.orderBy` usage; that router is mounted at `/api/performance-scores` (`server/routes.ts:117`) via `server/routes/parliamentary/index.ts`. (Note: `client/src/pages/EducationPage.tsx` also has a same-named local `useState` variable — that's an unrelated coincidence, not evidence either way; the server-side finding is what matters.) |

## Changes made

### 1. Archived `quiz_results_history` → `archived_quiz_results_history`
- `shared/schema.ts`: `pgTable("quiz_results_history", ...)` → `pgTable("archived_quiz_results_history", ...)`. The **exported TS symbol name `quizResultsHistory` is unchanged**, so `quizResultsService.ts` (which is off-limits to edit and is dead code anyway) still compiles and would still work against the renamed physical table if it were ever invoked.
- `migrations/0002_archive_quiz_results_history.sql`: `ALTER TABLE IF EXISTS quiz_results_history RENAME TO archived_quiz_results_history;` — reversible (rollback SQL included in a comment), zero-downtime (rename only, no drop).

### 2. Added indices
- `quizResults.userId` → `idx_quiz_results_user_id`
- `userActivity.userId` → `idx_user_activity_user_id`
- `tdScoreHistory(politicianName, createdAt)` composite → `idx_td_score_history_politician_created_at` (this table already had separate single-column indices on each of `politicianName` and `createdAt`; the requested composite did not exist, so it was added alongside them, not as a replacement).
- `migrations/0003_add_query_performance_indices.sql`: three idempotent `CREATE INDEX IF NOT EXISTS` statements matching the table/column names above.

## Verification performed

- **Column/table names**: verified directly against `shared/schema.ts` (read in full, ~1252 lines) before writing any code — no guessing.
- **Usage grep**: ran targeted greps for `ideas`, `ideaVotes`, `quizResultsHistory`, `performanceScores` across `server/` and `client/src/`, then traced each hit up to whether the owning route file is actually mounted in `server/routes.ts`.
- **`npx tsc --noEmit`**: 3030 pre-existing errors on `main` (unrelated files — `shadowCabinet.ts`, `storage.ts`, `vite.ts`, `data.ts`, etc., mostly pre-existing `--downlevelIteration`/nullability issues). Same count (3030) on this branch after all changes — **zero new type errors introduced**.
- **`npm test`**: no `test` script exists in `package.json` on `main` (pre-existing gap — confirmed via `npm run` and grep; there's no vitest/jest/mocha dependency installed either, despite test files existing under `test/`). This is a pre-existing condition unrelated to this task's changes, not something introduced here.
- **Diff scope**: `git diff main..feature/phase-2b-schema-cleanup --stat` shows only `shared/schema.ts` and the two new migration files — confirms no accidental edits leaked into `client/src/`, `server/services/`, or `server/routes/`.

## Important operational note

This repo does **not** use isolated git worktrees per concurrent team — all three teams (2A/2B/2C) share one working directory. During this task the checked-out branch was switched away from `feature/phase-2b-schema-cleanup` to `feature/phase-2c-service-consolidation` twice by what appears to be a concurrent process, which once caused an in-progress edit to be silently lost (the `quizResultsHistory` archive edit had to be redone). Work was committed to `feature/phase-2b-schema-cleanup` as soon as it was stable to minimize the window for this. Recommend the orchestrator use `git worktree add` per team for future concurrent phases to avoid this class of race condition entirely.

## Recommendation (not actioned, out of scope)

`server/routes/profileHistoryRoutes.ts` and `server/services/quizResultsService.ts` are dead code (unmounted route + its sole consumer). Cleaning those up is a `server/routes/`/`server/services/` change and therefore out of scope for this task, but flagging it here for whichever team owns that surface next.
