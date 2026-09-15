# Task 4 Report — Parliamentary scores: protect trigger-scrape

**Status**: DONE_WITH_CONCERNS

## Changes (`server/routes/parliamentary/scores.ts`)

1. **`POST /trigger-scrape` now gated with `requireAdminAccess`** — added the middleware as the second argument to the route (`router.post('/trigger-scrape', requireAdminAccess, asyncHandler(...))`). Import was already present at line 31 (`import { requireAdminAccess } from '../../middleware/adminAccess';`); no new import needed.
2. **Operation logging inside the handler** — added `import { requestLogger } from '../../utils/logger';` and logged:
   `log.info({ operation: 'admin.scores.triggerScrape', actor: (req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId }, 'Manual news scrape triggered')`.
   - Uses the existing `requestLogger(req)` pattern from `server/utils/logger`. Does NOT rely on Task 1's new `logAdminAction`/`requireRole` exports (which the brief forbade for this task).
   - The explicit cast on `req.user` was required: Express types `req.user` as `{}` in this file, and a bare `req.user?.email` introduced a new TS2339 error (`Property 'email' does not exist on type '{}'`). The cast mirrors the pattern already used in `server/middleware/adminAccess.ts` and keeps the per-file count at baseline. No tokens/keys logged (actor = email or session userId only).
3. **`/recalculate` left as-is** — unchanged (still uses `requireAdminAccess` from Task 1's state of the middleware).

## Boundaries respected

- No other endpoint in `scores.ts` touched (only the import line + the `trigger-scrape` handler).
- No tsconfig/compiler config, no database schema, no middleware/other route files touched.
- No dependencies added; nothing committed.

## Gates

- **tsc total**: observed **2646** (baseline 2644). The +2 overage is **NOT from this task** — it is produced by parallel tasks editing this shared worktree concurrently (botRoutes.ts at 5 vs its baseline 3 [Task 2 in-flight]; smsRoutes.ts transiently showed 1 vs baseline 0 [Task 7 in-flight] in an earlier run). These numbers shift between runs as the other tasks land their edits. My file's per-file count is exactly at baseline, so my change adds **0** net errors.
- **Per-file count `parliamentary/scores.ts`**: **58** (baseline 58, unchanged). The two errors now reported at lines 322/325 (`TS2351: new DailyNewsScraperJob() is not constructable`, `TS7006: error implicitly any` in the `.catch`) are pre-existing baseline errors that only shifted +5 lines due to the added import + log lines — the count is identical to baseline.
- **adminAccess tests**: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` → **4 passed / 4**.

## Concerns

1. **Shared-worktree tsc total drift**: the observed total (2646) exceeds the plan's 2644 global baseline, but only due to in-flight edits from Tasks 2 and 7 in this same worktree (botRoutes +2, smsRoutes transient +1). The coordinator should re-run `tsc` once all Wave 1 tasks land to confirm the aggregate; Task 4 contributes no overage.
2. The `actor` field uses a local cast instead of `req.user?.email` because `req.user` is typed `{}` in this file; behaviorally identical and consistent with the middleware's existing pattern.

## Verification performed

- `node_modules/.bin/tsc` (full): `grep -c "error TS"` = 2646 (baseline 2644, +2 from parallel tasks), `grep ... parliamentary/scores.ts | wc -l` = 58.
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts`: 4/4 pass.
- `git diff server/routes/parliamentary/scores.ts`: minimal 2-hunk diff (import + trigger-scrape handler only).