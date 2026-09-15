# Task 6 Report — Shadow cabinet + debate workspace: admin-only

**Status: DONE_WITH_CONCERNS**

## Summary

Protected all three shadow-cabinet routes (`/api/shadow/analyze|history|qa-history`) and all six debate-workspace routes (`/views` GET/POST/PATCH/DELETE, `/exports` GET/POST) with `requireAdminAccess`, and added `requestLogger(req)` action logging on every protected handler (all shadow ops + debate write ops).

## Changes

### `server/routes/shadowRoutes.ts`
- Imported `requireAdminAccess` from `../middleware/adminAccess` and `requestLogger` from `../utils/logger`.
- Added `requireAdminAccess` middleware to:
  - `POST /analyze`
  - `GET /history`
  - `GET /qa-history`
- Each handler logs: `log.info({ operation: 'admin.bots', actor: ... }, 'Bot admin action')` (exact brief message).
- Response shapes, `{ error: ... }` contracts, validation, and the `db` query logic unchanged.

### `server/routes/debateWorkspaceRoutes.ts`
- Imported `requireAdminAccess` from `../middleware/adminAccess` and `requestLogger` from `../utils/logger`.
- Added `requireAdminAccess` middleware to:
  - `GET /views`
  - `POST /views` (+ log `admin.views.create`)
  - `PATCH /views/:id` (+ log `admin.views.update`)
  - `DELETE /views/:id` (+ log `admin.views.delete`)
  - `GET /exports`
  - `POST /exports` (+ log `admin.exports.create`)
- Write operations log via `requestLogger(req)` with actor `(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId`.
- `normalizeFilters`, `createExportEntry`, `buildCsv`, `resolvePeriod`, `fetchMetricsForExport`, and all response shapes/validation untouched.

## Notes / deviations from brief text

- Actor expression uses `(req.user as { email?: string } | null | undefined)?.email` instead of the literal `req.user?.email`. This is the established repo pattern for reading `req.user` (see `server/routes/smsRoutes.ts:87`, `server/routes/parliamentary/scores.ts:318`, `server/middleware/adminAccess.ts`). The literal form produces `TS2339: Property 'email' does not exist on type '{}'` (3 new errors in shadowRoutes, 4 in debateWorkspaceRoutes); the cast keeps both files at their per-file baselines. Semantics identical.
- Logging import uses the `requestLogger`/`logger` from `server/utils/logger`; did NOT use Task 1's `logAdminAction`/`requireRole` per brief.
- Used only the pre-existing `requireAdminAccess` middleware (no `requireRole`).

## Gates

- **tsc total**: 2646 (`grep -c "error TS"` = 2646). Baseline 2644. The +2 delta is entirely `server/routes/botRoutes.ts` (Task 2's parallel change merged into this worktree mid-session — botRoutes baseline was 3, now 5: three new `email` errors from its own `req.user?.email`). Not caused by this task's files.
- **Per-file**:
  - `shadowRoutes.ts`: **2** (baseline 2 — the two pre-existing `'db' is possibly 'null'` at lines 40/53; no new errors). PASS.
  - `debateWorkspaceRoutes.ts`: **40** (baseline 40 — all pre-existing helper/CSS/`message` errors; no new errors). PASS.
- **Tests**: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` → **4/4 passed**.

## Boundaries respected

- No tsconfig/compiler config, no DB schema.
- No changes to workspace query helpers (`normalizeFilters`, `createExportEntry`) or debate data services.
- No changes to middleware files or any other route files.
- No dependencies added, nothing committed.

## Concerns

1. **Total exceeds 2644 by 2** — caused by `botRoutes.ts` (Task 2) introducing `req.user?.email` errors in its own parallel work (same `{}` typing issue I avoided with the cast). Outside my file scope to fix; flagged for coordinator/Task 2.
2. **Actor for secret-authenticated callers** — `req.session?.userId`/`req.user?.email` are both unset when a request passes via the shared job secret, so the log `actor` field is `undefined` for secret-authorized calls. Harmless for logging (no secrets logged) but the actor won't be attributed. Consistent with the brief's exact actor expression.