# Task 4 Review — Parliamentary scores: protect trigger-scrape

**Reviewer**: task reviewer (deepseek-v4-flash)
**Scope**: spec compliance + code quality (verifier confirmed gates; gates independently re-verified here).
**Review date**: 2026-09-15

## Verdict

- **SPEC: PASS**
- **QUALITY: APPROVED**
- **Findings**: 0 Critical / 0 Important / 2 Minor

---

## 1. Spec compliance — PASS

Brief (`task-4-brief.md`) requirements vs. actual:

| Requirement | Brief ref | Status |
|---|---|---|
| `requireAdminAccess` added to `POST /trigger-scrape` | lines 5, 8 | ✅ `scores.ts:315` — `router.post('/trigger-scrape', requireAdminAccess, asyncHandler(...))`. Import already existed at line 31 (brief line 8 said "import already exists"); no duplicate import added. |
| `/recalculate` left as-is (kept `requireAdminAccess`) | lines 5, 10 | ✅ `scores.ts:840` — untouched, still `requireAdminAccess`-gated. |
| Logging via `requestLogger` from `../../utils/logger` | line 9 | ✅ New import `scores.ts:32` (`requestLogger` from `../../utils/logger`); `logger.ts:48` exports it. Used in handler (`log.info({ operation: 'admin.scores.triggerScrape', actor: ... })`). Does not rely on Task 1's `logAdminAction`/`requireRole` exports. |
| No other endpoint touched (58 baseline errors preserved) | line 12 | ✅ `git diff` is exactly 2 hunks (import + `trigger-scrape` handler only). |

**Global constraints**: no DB schema changes, no tsconfig/compiler config changes, no non-security refactors, no new deps, no secrets logged (actor = email or session userId only), nothing committed (working-tree diff only). ✅

## 2. Code quality — APPROVED

- **Diff minimal**: 2 hunks, +6/−1 lines, matching the task diff file verbatim (verified `git diff server/routes/parliamentary/scores.ts` == `task-4.diff`).
- **Imports**: both imports resolve and are used (`requestLogger` at line 32 used at 316; `requireAdminAccess` used at 315). No unused imports introduced.
- **tsc gates (independently re-run from repo root)**:
  - Total errors: **2642 ≤ 2644** ✅
  - `parliamentary/scores.ts`: **58 == 58** ✅ (no errors on new lines 315–329; pre-existing errors merely shifted +5 lines, as the report noted).
  - The report's observed 2646 total was transient parallel-task drift (botRoutes in-flight, Task 2); current measurement 2642 confirms no Task 4 overage. Report's concern #1 validated but not a defect of this task.
- **Pattern consistency**: the `actor` cast `(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId` mirrors the existing pattern in `server/middleware/adminAccess.ts:91-93,112-115`. Report's concern #2 is sound and correct — the cast is needed because Express types `req.user` as `{}` here, and it keeps the error count at baseline.

## 3. Security — confirmed

- `requireAdminAccess` is the **second positional argument** to the route, so it executes **before** the handler (`scores.ts:315`). Unauthorized requests terminate in the middleware (`adminAccess.ts` — either via secret mismatch falling through to `isAdmin`, or `isAdmin` denying) without calling `next()`, so the handler body never runs.
- The background job (`job.execute().catch(...)`, `scores.ts:322-327`) lives **inside** the handler body and is unreachable without passing the guard. It is a fire-and-forget `job.execute()`, not a `setTimeout`, but is equally contained.
- Route registered exactly once (`grep trigger-scrape` across `server/` returns only `scores.ts:313,315`); mounted under `/api/parliamentary` (and legacy aliases) via `routes.ts:112-120`. No alternate unguarded mount path.

## Findings

**Critical** (0): none.

**Important** (0): none.

**Minor** (2):
1. **`actor` may be `undefined` for secret-granted requests** (`scores.ts:318`). `requireAdminAccess` grants access via `x-admin-secret`/bearer secret without setting `req.user` or a session userId (see `adminAccess.ts:46-52`); for those requests the operation log records `actor: undefined`. The middleware's own logs use `actor: 'secret'` as the fallback; the handler could use `?? 'secret'` for symmetry. Cosmetic — no security impact, no secret leakage.
2. **Emoji in prior log line dropped** (`console.log('🔄 ...')` → structured `log.info`). Intended per brief line 9; flagged only for awareness that the emoji string is no longer searchable in logs. Not an issue.

## Verification performed

- Read brief, task diff, implementer report.
- Read `scores.ts` import block (lines 18–34) and `trigger-scrape` handler (312–330); confirmed `recalculate` at line 840 untouched.
- Read `adminAccess.ts` and `logger.ts:48` to confirm middleware/`requestLogger` semantics.
- `git diff` vs task diff file — identical.
- `node_modules/.bin/tsc` from repo root: total 2642, scores.ts 58, no errors on lines 315–329.
- `grep trigger-scrape server/` — single registration, guarded.