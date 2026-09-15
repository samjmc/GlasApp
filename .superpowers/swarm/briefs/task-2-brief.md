### Task 2 — Bot routes: real admin gating + protect bot behavior control

**Files**: `server/routes/botRoutes.ts`, `server/routes.ts`

**Background**: `botRoutes.ts` has a stub `isAdmin` that only checks `req.user` exists — ANY authenticated user can create/list/delete bot accounts (creating fake accounts, impersonation). Additionally, the inline routes in `server/routes.ts` (`POST /api/bots/:id/behavior/start`, `POST /api/bots/:id/behavior/stop`, `GET /api/bots/:id/activity`) have NO auth at all — anyone can start/stop simulated bot behavior.

**Changes**:

1. `server/routes/botRoutes.ts`:
   - Delete the local `const isAdmin = (req, res, next: unknown) => ...` stub (it also has a TS error: `next` typed `unknown`).
   - Import `requireAdminAccess` from `../middleware/adminAccess`.
   - Replace `isAuthenticated, isAdmin` on `/create`, `/list`, `/delete/:username` with `requireAdminAccess` (single guard; it handles authentication + admin + job secret). Keep the existing handlers/validation logic untouched.
   - Log each handler's operation with the existing `requestLogger(req)` pattern (import `requestLogger` from `../utils/logger`): `log.info({ operation: 'admin.bots.create', actor: req.user?.email ?? req.session?.userId }, 'Bot admin action')`. Do NOT rely on new Task 1 exports (`logAdminAction`).

2. `server/routes.ts`:
   - Add `requireAdminAccess` middleware to the three inline routes: `POST /api/bots/:id/behavior/start`, `POST /api/bots/:id/behavior/stop`, `GET /api/bots/:id/activity`.
   - Add basic input validation: `parseInt(req.params.id)` must be a finite positive integer, else 400 `{ success:false, message:'Invalid bot id' }`. Keep behavior otherwise identical.

**Do NOT**: touch BotService or botBehaviorService internals, or the `/api/bots` mount path.

**Gates**:
- tsc total ≤ 2644; per-file counts: botRoutes.ts ≤ 3, routes.ts ≤ 16.
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` still passes.
- Existing bot behavior unchanged for authorized callers (code review).

---

