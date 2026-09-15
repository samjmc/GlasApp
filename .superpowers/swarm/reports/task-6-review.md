# Task 6 Review — Shadow cabinet + debate workspace: admin-only

**Reviewer scope**: spec compliance + code quality + security (gates independently re-verified).
**Date**: 2026-09-15

## Verdict

- **SPEC: PASS**
- **QUALITY: APPROVED**

## Independent gate verification

| Gate | Required | Actual (re-run) | Result |
|---|---|---|---|
| tsc total | ≤ 2644 | 2642 (`grep -c "error TS"` over `npx tsc --noEmit`) | PASS |
| shadowRoutes.ts | ≤ 2 | 2 (both pre-existing `TS18047 'db' is possibly 'null'` at :40, :53) | PASS |
| debateWorkspaceRoutes.ts | ≤ 40 | 40 (all pre-existing helper/CSS/`message` errors, lines 20–437) | PASS |
| adminAccess tests | green | `vitest run server/middleware/adminAccess.test.ts` → 4/4 passed | PASS |

The implementer report claimed tsc total 2646 (+2 from `botRoutes.ts` Task-2 interference). The current tree actually measures **2642** — botRoutes is now at 2, so the reported concern is moot; the budget passes comfortably and neither task file gained any new errors. The actor cast introduced zero new TS errors in either file.

## Findings

### Critical — none

### Important — none

### Minor

1. **Actor is `undefined` for job-secret-authorized calls** (log attribution gap; informational).
   In `requireAdminAccess` (adminAccess.ts:46-53), a matching `x-admin-secret`/bearer secret short-circuits to `next()` without populating `req.user` or `req.session`. On those requests the handler-level log emits `actor: undefined`. Harmless (no secrets logged) and the middleware itself logs `actor: 'secret'` at the gate (adminAccess.ts:48-51), so attribution exists upstream. The fallback literals used by `logAdminAction` (`'secret'`) / `requireRole` (`'anonymous'`) would be slightly more informative, but the brief prescribed this exact actor expression (brief:8) and the implementer followed it.

2. **Actor cast differs textually from brief literal** (informational).
   Brief:8,9 write `req.user?.email ?? req.session?.userId`; code uses `(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId`. Verified this cast is the established repo pattern (adminAccess.ts:91-92,113-114,131-132; also smsRoutes, scores) and the literal form produces `TS2339` on the `{}`-typed `req.user` (verified pattern — would add errors). Semantics identical; per-file counts confirm it kept both files at baseline. Justified deviation, no action needed.

3. **Report accuracy**: implementer report tsc-total claim (2646) is stale relative to the current tree (2642) — the coordinating concern (#1 in report) no longer applies. This is a report-accuracy note, not a code defect.

## Spec compliance (all confirmed against working tree, not just the diff)

- **shadowRoutes.ts**: all three routes gated — `POST /analyze` (shadowRoutes.ts:11), `GET /history` (:35), `GET /qa-history` (:48) — via `requireAdminAccess` imported from `../middleware/adminAccess` (brief:8). All three log with the exact brief pattern `log.info({ operation: 'admin.bots', actor: ... }, 'Bot admin action')` using `requestLogger(req)` from `../utils/logger`. Did NOT use Task 1's `logAdminAction`/`requireRole` (brief:8). PASS.
- **debateWorkspaceRoutes.ts**: all six routes gated — `GET /views` (:205), `POST /views` (:225), `PATCH /views/:id` (:262), `DELETE /views/:id` (:299), `GET /exports` (:324), `POST /exports` (:379) — via `requireAdminAccess` (brief:9). Write ops (views POST/PATCH/DELETE, exports POST) log via `requestLogger(req)` with operations `admin.views.create|update|delete` and `admin.exports.create`; read ops (views GET, exports GET) correctly unlogged (brief requires write ops only). PASS.
- **No route left open**: all 9 handlers across both routers carry the guard. `/exports GET` (the explicitly flagged risk) is protected at debateWorkspaceRoutes.ts:324. No shadow or debate-workspace handler remains anonymously reachable. PASS.
- **Helpers untouched**: `normalizeFilters` (:16) and `createExportEntry` (:347) byte-identical to baseline; `buildCsv`, `resolvePeriod`, `fetchMetricsForExport`, all response shapes (`{ error }`, `{ success, views }`, `{ success, view }`, `{ success, exports }`, `{ success, export }`) and validation unchanged (brief:10,12). PASS.
- **Global constraints**: diff touches only the two task files. No DB schema, no tsconfig/compiler changes, no non-security refactors, no new deps, no secrets, nothing committed (task changes are working-tree mods on `feature/phase-4a-route-security`). PASS.

## Code quality

- Imports all used; no dead code introduced. Logging placed immediately inside the handler after the gate — sane placement, no redaction risk (only operation + actor logged, not bodies/URLs).
- Guard application is at route level on every handler; ordering (`requireAdminAccess` before handler) correct so gates run before any DB/LLM work.

## Counts

- Critical: 0
- Important: 0
- Minor: 3 (2 code/behavior notes — both informational — 1 report-accuracy note)

## Result

SPEC: PASS · QUALITY: APPROVED