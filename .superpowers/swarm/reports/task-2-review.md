# Task 2 Review — Bot routes: real admin gating + protect bot behavior control

**Reviewer**: task reviewer
**Scope**: spec compliance + code quality (gates verified separately by verifier; not re-run here)
**Sources**: `briefs/task-2-brief.md`, `diffs/task-2.diff`, current working-tree files (`server/routes/botRoutes.ts`, `server/routes.ts`), `server/middleware/adminAccess.ts`, `server/utils/logger.ts`, `server/auth/supabaseAuth.ts`.

## Verdict

- **SPEC: PASS** — all required changes present, nothing extra.
- **QUALITY: APPROVED** — 0 Critical, 0 Important, 3 Minor.

---

## Spec compliance

| Requirement | Status | Evidence |
| --- | --- | --- |
| Delete local `isAdmin` stub in `botRoutes.ts` | PASS | Diff hunk removes `const isAdmin = (req, res, next: unknown) => ...` (brief lines 10-11, diff lines 60-68). Working tree confirms no stub remains. |
| Replace `isAuthenticated, isAdmin` with `requireAdminAccess` on `/create`, `/list`, `/delete/:username` | PASS | `botRoutes.ts:9,55,76`; `isAuthenticated` import removed (diff line 54). Single guard per brief line 12. |
| Keep existing handlers/validation untouched | PASS | Handler bodies, response shapes, and error handling unchanged; only guard swaps + added logging lines. |
| Log each handler with `requestLogger(req)` pattern; do NOT use Task 1 `logAdminAction` | PASS | `botRoutes.ts:20-23,58-61,81-84` use `requestLogger(req).info({ operation: 'admin.bots.create/list/delete', actor, ... }, 'Bot admin action')` per brief line 13. No `logAdminAction` import. |
| Gate the three inline routes in `routes.ts` | PASS | `routes.ts:391,413,428` — `start`, `stop`, `activity` all receive `requireAdminAccess`. |
| `parseInt` validation → 400 on non-finite id | PASS | `routes.ts:393-396,415-418,430-433` — `!Number.isInteger(botId) || botId <= 0` returns 400 `{ success: false, message: 'Invalid bot id' }` (brief line 17). Behavior otherwise identical (config shape, dynamic `botBehaviorService` import, `days` parse, response shapes). |
| Do NOT touch BotService/botBehaviorService internals or `/api/bots` mount path | PASS | No changes to those files; `app.use("/api/bots", botRoutes)` untouched (routes.ts:148 area). |
| Nothing extra | PASS | Working-tree `git diff` of both files matches `task-2.diff` exactly — no additional hunks, no stray changes. |

**No other route in `routes.ts` was altered**: the full working-tree diff of `server/routes.ts` (12 insertions, 3 deletions) contains exactly the three bot-behavior hunks and nothing else.

## Code quality

- **No dead code / unused imports**: stub removed; `isAuthenticated` import removed with its last use; `Router, Request, Response`, `BotService`, `requireAdminAccess`, `requestLogger` all still used. Clean.
- **Logging sanity**: uses the request-scoped pino logger (falls back to shared logger, `logger.ts:48-49`); operation names match the brief; actor resolution matches repo-wide established pattern. No secret material logged.
- **Security — no regression or bypass**: `requireAdminAccess` (adminAccess.ts:39-62) enforces real admin (app_metadata.role OR `ADMIN_EMAILS` allowlist, supabaseAuth.ts:202-237) OR the configured job secret, then falls through to `isAdmin`. Strictly more restrictive than the previous stub (any authenticated user) and the previously-unauthenticated inline routes. The `req.session?.userId` fallback appears only in the *actor log field*, never in the auth decision. No auth removed from any other route (no other route hunks exist).

## Findings

### Minor

1. **`actor` expression deviates from the brief's literal text** (brief line 13 vs diff `botRoutes.ts` lines 21/59/82).
   The brief's literal `req.user?.email` does not compile in this tree: `Express.Request.user` is declared `user?: unknown` (supabaseAuth.ts:392), so property access on `unknown` is a TS error. The implementer used the exact cast `(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId`, which is the established repo-wide pattern (shadowRoutes.ts:14, smsRoutes.ts:87, debateWorkspaceRoutes.ts:228, parliamentary/scores.ts:318, geographic/index.ts:218). Runtime value is identical to the brief's intent; this is a necessary, consistent deviation, not a spec failure.

2. **Create handler logs before the operation succeeds** (diff `botRoutes.ts` hunk at line 17-23).
   The log for `admin.bots.create` is emitted before `BotService.createBotAccount` runs; if creation throws (handler returns 400 with the error), an audit record for a bot-creation action that never happened is persisted. `list`/`delete` log after success. This matches the shadowRoutes precedent (which also logs pre-call) but is worth noting for audit-trail integrity. No change required for this task.

3. **`parseInt` accepts trailing non-numeric characters** (`routes.ts:393-396` et al.).
   `parseInt('12abc')` returns `12` and passes the `Number.isInteger && > 0` check instead of 400. This is the exact mechanism the brief specifies (brief line 17) and preserves pre-existing behavior (the original handlers also parsed and passed the value), so it is within spec — flagged only as an observation; a stricter `^\d+$` regex would be more defensive but is out of scope.

---

## Global constraints

- No DB schema changes, no tsconfig/compiler config changes, no non-security refactors — PASS (only the two `.ts` route files changed; working tree diff confirms).
- tsc per-file counts not increased — PASS per verifier/implementer (botRoutes 2, routes.ts 16 pre-existing; total 2643 ≤ 2644).
- Existing tests green — adminAccess.test.ts 4/4 per implementer; verified by verifier.
- No new dependencies, no secrets committed — PASS.
- No commit created — PASS (changes are uncommitted working-tree modifications; repo HEAD unchanged by this task).