# Task 1 Review — Middleware hardening: reusable RBAC guard + admin logging + payload limit

**Reviewer**: task reviewer
**Date**: 2026-09-15
**Verdict**: SPEC PASS, QUALITY APPROVED (5 Minor findings)

Reviewed against: `briefs/task-1-brief.md`, `diffs/task-1.diff`, `reports/task-1-report.md`, and the current working-tree files (`server/auth/supabaseAuth.ts`, `server/middleware/adminAccess.ts`, `server/middleware/sessionMiddleware.ts`, `server/index.ts`, `server/middleware/requireRole.test.ts`). Gates were confirmed by the verifier; this review focuses on spec compliance and code quality.

---

## SPEC COMPLIANCE

Every brief requirement is present and correct; nothing security-relevant is missing.

| Brief req | Status | Evidence |
|---|---|---|
| `isAdmin` uses `req.user` if set, else `getUserFromRequest` (line 10) | ✓ | supabaseAuth.ts:208-211 |
| Session callers treated non-admin unless ADMIN_EMAILS allowlist, with brief comment (line 11) | ✓ | supabaseAuth.ts:225-227 comment; allowlist check line 231 |
| Log every decision: `logger.info` grants / `logger.warn` denials, actor+route+grant+reason, no headers/tokens (line 12) | ✓ | supabaseAuth.ts:214-217, 232-235, 243-246 |
| Exact 401/403 contracts (line 13) | ✓ | `{success:false,message:'Authentication required'}` 401; `'Admin access required'` 403 |
| `requireAdminAccess` signature/behavior preserved, secret-path logging added (line 16) | ✓ | adminAccess.ts:46-59; `safeSecretEquals` + `isAdmin` fallback unchanged |
| `requireRole(...roles)` exported (lines 17-22): identity resolution, 401 no identity, role from `app_metadata.role` ONLY, admin allowlist via `getCallerRole`, 403 `'Access denied'`, `next()` | ✓ | adminAccess.ts:70-123; getCallerRole supabaseAuth.ts:174-197 |
| `logAdminAction(req, action, detail?)` with actor `req.user?.email ?? req.session?.userId ?? 'secret'` (line 23) | ✓ | adminAccess.ts:126-142 |
| `sessionMiddleware.isAuthenticated` sets `req.user = {id, sub}` on session path, bearer path untouched, 401 kept (line 25) | ✓ | sessionMiddleware.ts:47-49 |
| `express.json({ limit: '1mb' })` (line 27) | ✓ | index.ts:50 |
| Do-NOTs: safeSecretEquals, env resolution, cookie config unchanged (line 29) | ✓ | no changes to those |
| Interfaces produced: `requireRole`, `logAdminAction`, `getCallerRole`, enhanced `isAdmin`, session `req.user`, JSON limit (line 43) | ✓ | all exported |
| 5 required test cases in `requireRole.test.ts` (lines 34-39) | ✓ | 401 / 403 user / next admin / multi-role / ADMIN_EMAILS allowlist |

**Acceptable deviations (all within brief's permitted scope, all security-aligned):**
- `express.urlencoded` also got `limit: '1mb'` — explicitly permitted by brief line 27 ("may add the same limit").
- `adminEmails` module constant → `getAdminEmailAllowlist()` call-time function (supabaseAuth.ts:18-24). Semantics identical; required so tests can set/restore `process.env.ADMIN_EMAILS` per brief line 40.
- 6th test: `user_metadata.role` not trusted (requireRole.test.ts:130-143) — reinforces the app_metadata-only rule.
- `requireRole` logs grants/denies (adminAccess.ts:94-104, 116-119) — brief only mandated logging for `requireAdminAccess`/`isAdmin`, but this is audit-consistent and adds no behavior change.

**Security review of grant paths (no false grants found):**
- `getCallerRole` returns `'admin'` only when `app_metadata.role === 'admin'` (server-managed, not self-editable) OR email ∈ ADMIN_EMAILS; any other value comes from `app_metadata.role` only, never `user_metadata` (supabaseAuth.ts:184-196). Test at requireRole.test.ts:130 verifies the user_metadata rejection.
- Session-derived `req.user = {id, sub}` carries no email/app_metadata → session callers always fail closed (403) for admin routes. Documented pragmatic decision per brief line 11; later tasks gated on session admin must rely on bearer + allowlist (Phase 4B concern, not a Task-1 defect).
- Deny-then-fallback ordering in `requireAdminAccess` preserves exact prior 401/403 contracts; invalid secret cannot grant.
- Logging never emits headers/tokens; `actor` is email/sessionId or the literal string `'secret'`, never the secret value. Logger redact config already covers `authorization`/`secret` paths.

---

## FINDINGS

### Critical
None.

### Important
None.

### Minor

1. **`getCallerRole` docstring overstates its scope** — supabaseAuth.ts:169-172 ("...or the bearer token") but the function only reads `req.user` (supabaseAuth.ts:175); bearer resolution happens only in `requireRole` (adminAccess.ts:72-77). Misleading for a public interface consumed by later tasks (brief line 43); a caller invoking `getCallerRole` directly on a bare request would get `null` regardless of a valid bearer. Fix is a one-line doc correction.

2. **Double-denial logging on wrong secret** — adminAccess.ts:55-58 logs `warn invalid_admin_job_secret`, then falls through to `isAdmin` which logs a second `warn` (supabaseAuth.ts:214-217) for the same request. Two entries per rejected attempt; not incorrect, but noisy. Consider a single combined entry or documenting the intentional two-stage audit trail.

3. **Test coverage gaps in the new file** (brief lines 34-39 all covered, so spec-compliant): no test exercises (a) the session-only identity path (`req.session.userId` present, no `req.user`, no role → expected 403 `'Access denied'`) and (b) the bearer-resolution branch (mocked `getUserFromRequest` returning a user when `req.user` absent, expecting `next()` for an admin). These are the two paths most likely to regress.

4. **Case-sensitive role comparison** — supabaseAuth.ts:187 (`role === 'admin'`) and adminAccess.ts:89 (`roles.includes(callerRole)`) would reject e.g. `'ADMIN'`. Acceptable since `app_metadata.role` is server-managed lowercase, and it matches pre-existing `isAdmin` behavior; flagging because `getCallerRole` is a shared interface.

5. **A few comments are explanatory rather than security-intent** — e.g. supabaseAuth.ts:18 ("...read at call time so tests can set/restore it") and sessionMiddleware.ts:47 ("Expose a minimal identity..."). Slightly outside the repo's "no comments unless security intent" convention (constraint 6). Non-blocking; the security-relevant comments (user_metadata self-editable, session non-admin) are appropriate and required by the brief.

---

## Informational (not a Task-1 finding)

Total tsc gate currently reads 2647→2653 vs. baseline 2644 (report lines 58-67), attributed by the implementer to concurrent Wave-1 task edits in this shared worktree (botRoutes/shadowRoutes/smsRoutes/scores). Task 1's four files are each at their per-file baselines (supabaseAuth 2, sessionMiddleware 0, adminAccess 0, index 1) and contribute no new `error TS`. Coordinator should re-verify the total after all Wave-1 tasks land. The verifier has confirmed gates pass.

---

**Verdict**: SPEC **PASS** — all brief requirements implemented, deviations within permitted scope, grant paths fail closed, no secret leakage. QUALITY **APPROVED** — 0 Critical, 0 Important, 5 Minor; Minor items are doc/cosmetic/coverage nits, none blocking merge.