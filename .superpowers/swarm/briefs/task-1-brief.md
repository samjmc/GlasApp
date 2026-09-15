### Task 1 — Middleware hardening: reusable RBAC guard + admin logging + payload limit

**Files**: `server/middleware/adminAccess.ts`, `server/middleware/sessionMiddleware.ts`, `server/auth/supabaseAuth.ts`, `server/index.ts`

**Background**: `requireAdminAccess` exists but has no logging, `isAdmin` only works for bearer JWTs (a session-authenticated caller can never pass), and `express.json()` has no payload size cap (DoS vector). There is no reusable role guard.

**Changes**:

1. `server/auth/supabaseAuth.ts` — enhance `isAdmin(req, res, next)`:
   - Identity: if `req.user` is already set (e.g. by `isAuthenticated`), use it; otherwise call `getUserFromRequest(req)`.
   - Also accept a session-authenticated caller whose session user is known — keep this pragmatic: for session callers (no bearer), treat them as non-admin UNLESS their email is in the `ADMIN_EMAILS` allowlist (can't be determined from session, so non-admin). Document with a brief comment.
   - Log every decision via `logger` from `server/utils/logger` (or `console`): actor (email or "anonymous"), route `req.path`/`req.method`, grant/deny, and reason. Use `logger.info` for grants, `logger.warn` for denials. Do not log headers/tokens.
   - Keep the existing response contracts exactly: 401 `{ success:false, message:'Authentication required' }` when unauthenticated, 403 `{ success:false, message:'Admin access required' }` when authenticated-but-not-admin.

2. `server/middleware/adminAccess.ts`:
   - Keep `requireAdminAccess` exported with the same signature and behavior (secret check via `safeSecretEquals`, then `isAdmin` fallback). Add logging on the secret path too (grant/deny with route + reason).
   - Add new export `requireRole(...roles: string[]): RequestHandler` — Express middleware that:
     - Resolves identity: `req.user` if set, else bearer via `getUserFromRequest`, else `req.session.userId`.
     - No identity → 401 `{ success:false, message:'Authentication required' }`.
     - Determines the caller's role from `req.user?.app_metadata?.role` ONLY (never `user_metadata`). For the `'admin'` role in the allowed list, additionally accept the `ADMIN_EMAILS` allowlist email match (import the same allowlist logic — expose a helper `getCallerRole(req): string | null` from supabaseAuth or compute inline).
     - Role not in `roles` → 403 `{ success:false, message:'Access denied' }`.
     - Passes → `next()`.
   - Add export `logAdminAction(req, action: string, detail?: Record<string, unknown>): void` — logs `{ operation: 'admin.'+action, actor, route, ...detail }` via `logger.info`. Actor derived from `req.user?.email ?? req.session?.userId ?? 'secret'`.

3. `server/middleware/sessionMiddleware.ts` — in `isAuthenticated`, when the session path succeeds (`req.session.userId` present), set `req.user = { id: req.session.userId, sub: String(req.session.userId) }` before `next()` so downstream role checks can read identity. Keep the existing 401 contract.

4. `server/index.ts` — change `app.use(express.json())` to `app.use(express.json({ limit: '1mb' }))`. Keep `express.urlencoded({ extended: false })` unchanged (may add the same limit).

**Do NOT**: change `safeSecretEquals` semantics, the `adminJobSecret` env resolution, or the session cookie config.

**Gates**:
- tsc total ≤ 2644 and per-file counts unchanged-or-lower for the 4 touched files (baselines above).
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` still passes (4 tests).
- New file `server/middleware/requireRole.test.ts` (add it): direct fake req/res tests of `requireRole`:
  - unauthenticated (no user, no session, no token) → 401
  - authenticated caller with `app_metadata.role = 'user'` calling `requireRole('admin')` → 403
  - authenticated caller with `app_metadata.role = 'admin'` calling `requireRole('admin')` → next()
  - `requireRole('admin','moderator')` accepts either role
  - environment allowlist: caller email in `ADMIN_EMAILS` passes `requireRole('admin')` even without app_metadata role
  Mock `getUserFromRequest` from `../auth/supabaseAuth` with `vi.mock` where needed; set/restore `process.env.ADMIN_EMAILS`.
- `node_modules/.bin/vitest run --root . server/middleware/requireRole.test.ts` passes.

**Interfaces produced** (consumed by later tasks): `requireRole`, `logAdminAction`, `getCallerRole` (if added), enhanced `isAdmin`, session `req.user` population, JSON body limit.

---

