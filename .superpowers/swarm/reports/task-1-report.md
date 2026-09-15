# Task 1 Report — Middleware hardening: reusable RBAC guard + admin logging + payload limit

**Status**: DONE_WITH_CONCERNS
**Date**: 2026-09-14
**Worktree**: /private/tmp/glasapp-worktrees/phase-4a-route-security

## What changed (per file)

### `server/auth/supabaseAuth.ts`
- Added `import { logger } from '../utils/logger'`.
- Replaced the module-load-time `adminEmails` constant with a call-time helper `getAdminEmailAllowlist()` (reads `process.env.ADMIN_EMAILS`, lowercases/trims/filters). Kept identical semantics; read at call time so the requireRole tests can set/restore the env var per test.
- Added new export `getCallerRole(req): string | null` — resolves the caller's role from `req.user.app_metadata.role` ONLY (never `user_metadata`); `'admin'` is additionally granted via the `ADMIN_EMAILS` allowlist email match. Returns `null` when no identity or no role.
- Enhanced `isAdmin(req, res, next)`:
  - Identity: uses `req.user` if already set, else falls back to `getUserFromRequest(req)`.
  - Session callers (no bearer, no email on the session-derived user) are treated as non-admin unless their email is in the `ADMIN_EMAILS` allowlist (documented with a brief comment — a session cannot be server-verified as admin).
  - Logs every decision via `logger`: `logger.info` on grant, `logger.warn` on denial, with `actor` (email or 'anonymous'/'unknown'), `route` (`method path`), `grant`, and `reason`. No headers/tokens logged.
  - Kept response contracts exactly: 401 `{ success:false, message:'Authentication required' }` (unauthenticated), 403 `{ success:false, message:'Admin access required' }` (not admin). Catch path unchanged (403 `'Access denied'`).

### `server/middleware/adminAccess.ts`
- Added `logger` import and `getCallerRole`, `getUserFromRequest` imports from `../auth/supabaseAuth`.
- `requireAdminAccess` unchanged in behavior/signature; added logging on the secret path: `logger.info` grant when `safeSecretEquals` matches, `logger.warn` deny with reason `'invalid_admin_job_secret'` when a secret was presented but didn't match (then still falls through to `isAdmin`, preserving the existing 401/403 contract).
- Added export `requireRole(...roles: string[]): RequestHandler`:
  - Resolves identity: `req.user` if set, else bearer via `getUserFromRequest`, else `req.session.userId`.
  - No identity → 401 `{ success:false, message:'Authentication required' }`.
  - Role via `getCallerRole(req)` (app_metadata only + admin allowlist). Role not in `roles` → 403 `{ success:false, message:'Access denied' }`; grant/deny logged with actor/route/reason/required/actual.
  - Passes → `next()`.
- Added export `logAdminAction(req, action, detail?): void` — `logger.info({ operation: 'admin.'+action, actor: req.user.email ?? req.session.userId ?? 'secret', route, ...detail })`.

### `server/middleware/sessionMiddleware.ts`
- In `isAuthenticated`, the session path now sets `req.user = { id: req.session.userId, sub: String(req.session.userId) }` before `next()`. 401 contract unchanged; bearer path untouched.

### `server/index.ts`
- `app.use(express.json())` → `app.use(express.json({ limit: '1mb' }))`.
- `app.use(express.urlencoded({ extended: false }))` → `app.use(express.urlencoded({ extended: false, limit: '1mb' }))` — the brief explicitly permits "may add the same limit"; applied for consistent DoS hardening.

### `server/middleware/requireRole.test.ts` (new)
- 6 tests using fake req/res (vitest globals, node env). Mocks `getUserFromRequest` from `../auth/supabaseAuth` via `vi.mock` with `importOriginal` spread (keeps real `getCallerRole`/`isAdmin`); sets/restores `process.env.ADMIN_EMAILS` per test:
  1. unauthenticated (no user, no session, no token) → 401
  2. `app_metadata.role='user'` calling `requireRole('admin')` → 403
  3. `app_metadata.role='admin'` calling `requireRole('admin')` → `next()`
  4. `requireRole('admin','moderator')` accepts `role='moderator'`
  5. caller email in `ADMIN_EMAILS` passes `requireRole('admin')` with no `app_metadata` role
  6. extra guard: `user_metadata.role='admin'` is NOT trusted → 403 (reinforces the app_metadata-only rule)

## Verification commands + output

### tsc — per-file (my 4 files, correct pattern `^<file>`)
Command: `node_modules/.bin/tsc 2>&1 | grep "error TS" | grep -E "^server/(auth/supabaseAuth|middleware/sessionMiddleware|middleware/adminAccess|index)\.ts"`
Output (only these 3 pre-existing errors — none introduced by Task 1):
- `server/auth/supabaseAuth.ts(287,7)` TS2322 + `(349,7)` TS2322 → **2 errors (baseline 2, unchanged)** — pre-existing `metadata: unknown` → `object` errors in `signUp`/`updateUserMetadata`, untouched regions.
- `server/index.ts(128,11)` TS18046 → **1 error (baseline 1, unchanged)** — pre-existing `error is of type 'unknown'` in `serverInstance.on('error', ...)`, untouched.
- `server/middleware/sessionMiddleware.ts`: **0 (baseline 0)**
- `server/middleware/adminAccess.ts`: **0 (baseline 0)**

All 4 touched files are at their exact per-file baselines. Task 1 introduces zero new `error TS`.

### tsc — total gate
Command: `node_modules/.bin/tsc 2>&1 | grep -c "error TS"`
Output: **2647 at first measurement; 2653 on re-run ~15 min later** (baseline 2644).

The total is NOT at baseline while this report was written. This is a **concurrent-workwork artifact**: other Wave-1 tasks (2–8) are editing this same worktree in parallel, and their files are currently above their own per-file baselines:
- `server/routes/botRoutes.ts`: 7 (baseline 3)
- `server/routes/shadowRoutes.ts`: 4 (baseline 2)
- `server/routes/smsRoutes.ts`: 1 (baseline 0)
- `server/routes/parliamentary/scores.ts`: 59 (baseline 58)

Task 1's four files contribute exactly their baseline sum (2+0+0+1 = 3) and do not move the total. The total gate can only read ≤ 2644 once all parallel tasks land their final states; Task 1 is not the cause of the overshoot.

### vitest — adminAccess.test.ts (existing, must stay green)
Command: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts`
Output: `✓ server/middleware/adminAccess.test.ts (4 tests)` — Test Files 1 passed (1), Tests 4 passed (4).

### vitest — requireRole.test.ts (new)
Command: `node_modules/.bin/vitest run --root . server/middleware/requireRole.test.ts`
Output: `✓ server/middleware/requireRole.test.ts (6 tests)` — Test Files 1 passed (1), Tests 6 passed (6).

### vitest — both files together
Command: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts server/middleware/requireRole.test.ts`
Output: Test Files 2 passed (2), Tests 10 passed (10). Both files green in a single run (no cross-file mock interference; `vi.mock` is per-file scoped).

## Deviations from the brief
- Added a 6th test in `requireRole.test.ts` (user_metadata not trusted). The brief lists 5 required tests; this extra case directly reinforces the "app_metadata ONLY" rule and adds no new product behavior.
- Applied `limit: '1mb'` to `express.urlencoded` as well as `express.json` — explicitly permitted ("may add the same limit").
- `adminEmails` was converted from a module constant to a call-time function. Semantics identical; this is what lets tests set/restore `process.env.ADMIN_EMAILS` per-test (the brief mandates that pattern).
- `requireRole` also logs grant/deny decisions (brief only mandated logging for `requireAdminAccess`/`isAdmin`); added for audit-consistency, no behavior change.

## Notes on worktree state
- The 4 file changes and `requireRole.test.ts` were **already present, uncommitted**, in the worktree at the start of this run (remnant of a prior partial execution). I verified every change line-by-line against the brief and re-ran all gates fresh; they conform.
- A prior task-1-report.md claiming total = 2644 was accurate at the time it was written (before other tasks' edits landed). This report supersedes it with fresh measurements.
- Nothing committed (coordinator handles git). My changes are uncommitted/staged-eligible in the working tree.

## Concerns
- **Total tsc gate is currently over 2644 (measured 2647 → 2653)** due to in-flight edits by other parallel Wave-1 tasks, not by Task 1. Task 1's files are all at their per-file baselines (2/0/0/1). The coordinator should re-verify the total after all tasks land before signing off.
- Session callers can never satisfy `requireRole('admin')` / `isAdmin` because the session-derived `req.user` carries no email (by design in this phase; RLS/identity binding is Phase 4B). Later tasks that gate session callers on admin must rely on `ADMIN_EMAILS` + bearer, which is the documented pragmatic decision in the brief.
- `getCallerRole` is now a new public export consumed by later tasks — signature is `getCallerRole(req: Request): string | null` as specified. `requireRole` and `logAdminAction` signatures match the brief exactly.
- While re-verifying, I temporarily `git stash`-ed my 4 files and confirmed the other tasks' elevated counts exist independently of my changes; the stash was popped cleanly and no changes were lost.