# Task 2 Report — Bot routes: real admin gating + protect bot behavior control

**Status**: DONE

## Files changed

1. `server/routes/botRoutes.ts`
2. `server/routes.ts`

## Changes implemented

### `server/routes/botRoutes.ts`
- Deleted the local `const isAdmin = (req, res, next: unknown) => ...` stub (which carried the `next: unknown` TS error).
- Imported `requireAdminAccess` from `../middleware/adminAccess` and `requestLogger` from `../utils/logger`; removed the now-unused `isAuthenticated` import from `../middleware/sessionMiddleware`.
- Replaced `isAuthenticated, isAdmin` with the single `requireAdminAccess` guard on:
  - `POST /create`
  - `GET /list`
  - `DELETE /:username`
- Added `requestLogger(req).info({ operation: 'admin.bots.*', actor: (req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId }, 'Bot admin action')` to each handler (`admin.bots.create` / `admin.bots.list` / `admin.bots.delete`).
- Handler bodies and validation logic left untouched.

Note on the `actor` expression: the brief's literal `req.user?.email` does not typecheck in this tree because `req.user` resolves to `{}` (passport's empty `Express.User` merge over the `unknown` declared in `supabaseAuth.ts`). I used the exact cast pattern already established repo-wide by parallel tasks (`(req.user as { email?: string } | null | undefined)?.email ?? req.session?.userId` — see shadowRoutes, smsRoutes, geographic, debateWorkspace, parliamentary/scores). Same runtime value, same intent.

### `server/routes.ts`
- Added `requireAdminAccess` middleware to the three inline behavior-control routes:
  - `POST /api/bots/:id/behavior/start`
  - `POST /api/bots/:id/behavior/stop`
  - `GET /api/bots/:id/activity`
- Added input validation to each: `const botId = parseInt(req.params.id); if (!Number.isInteger(botId) || botId <= 0) return res.status(400).json({ success: false, message: 'Invalid bot id' });`
- All other behavior (config shape, dynamic `botBehaviorService` import, response shapes, `days` parsing) unchanged.

`requireAdminAccess` was already imported in `routes.ts` (line 9, used by `/api/cache` and admin mounts) — no import change needed.

## Out of scope respected
- No BotService / botBehaviorService internals touched.
- `/api/bots` mount path (`app.use("/api/bots", botRoutes)`) untouched.
- No tsconfig/compiler config, no DB schema, no middleware files touched.
- No new dependencies; no commits.

## Gate results

| Gate | Result |
| --- | --- |
| tsc total ≤ 2644 | **2643** PASS |
| botRoutes.ts ≤ 3 | **2** PASS (both are pre-existing `error is unknown` in catch blocks) |
| routes.ts ≤ 16 | **16** PASS (all pre-existing; none introduced by this change) |
| `vitest run --root . server/middleware/adminAccess.test.ts` | **4/4 pass** |
| Behavior unchanged for authorized callers | PASS (code review): for an authorized caller the guard passes and the original service calls / response shapes run identically; only additions are admin-gating and a 400 on non-positive/non-integer ids. |

## Environment notes
- The measured pre-change total was 2646 (not 2644) because the parallel Task 1 edits to `server/auth/supabaseAuth.ts` added 2 errors in that file (out of this task's scope). With Task 2's changes the total is 2643.
- tsc runs were slow (several minutes) due to concurrent swarm-agent activity on this machine; results verified on a clean single run.