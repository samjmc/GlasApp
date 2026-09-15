# Task 5 Evidence — Policy voting: auth on deletes + IDOR protection on user-data reads

Verifier: independent (no files modified). Run from worktree root on 2026-09-15.

## Gate results (measured, not claimed)

### Gate 1: tsc total ≤ 2644
Command: `node_modules/.bin/tsc 2>&1 | grep -c "error TS"`
- Result: **2642** (≤ 2644) — **PASS**, even 2 below baseline.

### Gate 2: per-file counts (baselines must not increase)
Command: `node_modules/.bin/tsc 2>&1 | grep "<file>" | wc -l`
- `server/routes/parliamentary/voting.ts` = **17** (baseline 17) — **PASS**
- `server/routes/user/rankings/policy.ts` = **13** (baseline 13) — **PASS**

### Gate 3: vitest adminAccess.test.ts
Command: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts`
- Result: **Test Files 1 passed (1); Tests 4 passed (4)** — **PASS**

## Diff conformance (inspected current working tree + task-5.diff)

`git diff server/routes/parliamentary/voting.ts server/routes/user/rankings/policy.ts` reproduces `.superpowers/swarm/diffs/task-5.diff` exactly (172 lines, byte-identical via `diff`).

Confirmed in BOTH files:
1. `DELETE /:voteId` — now `isAuthenticated`; caller id from `(req as any).user?.id`; body `userId` no longer read (only other `req.body` uses are `selectedOption` in opportunity respond and `articleId/politicianName/supportRating/comment` in POST /). Ownership check `vote.user_id !== callerId` → 403. (voting.ts:369-385, policy.ts:387-403)
2. Four `GET /user/:userId/...` endpoints (`article/:articleId`, `personalized-scores`, `td/:politicianName`, `value-alignment`) — all now `isAuthenticated` with guard: `if (String(callerId) !== userId && (req as any).user?.app_metadata?.role !== 'admin') → 403 { success:false, message:'Access denied' }`. (voting.ts:137,306,328,353; policy.ts:149,321,344,370)
3. Vote creation `POST /` UNCHANGED (still `isAuthenticated`, derives userId from `req.user?.id`; voting.ts:234, policy.ts:249). Public `/article/:articleId` reads UNCHANGED — still NO auth (voting.ts:32, policy.ts:35).
4. No changes to tsconfig, shared services, DB schema, or other route files (diff is confined to the two target files).

## Environment note (worktree instability)

During verification the two target files transiently appeared reverted (working tree matched HEAD with the old unsecured code, DELETE without `isAuthenticated`, body `userId` present) then returned to the secured state within ~1s. This is attributed to concurrent auto-land / "reconcile working tree (167 files) to staging" (commit 94731fa) activity in this shared worktree running other phase tasks in parallel. Final state (multiple md5-stable snapshots, current `git status` = ` M` on both files) contains the task-5 changes; the live `git diff` matches task-5.diff byte-for-byte and all gates pass on that state. Not introduced by this task; flag for the orchestrator that the worktree may be subject to concurrent writeback races.

## Verdict

PASS — all three gates pass and diff conformance confirmed in the current working tree.