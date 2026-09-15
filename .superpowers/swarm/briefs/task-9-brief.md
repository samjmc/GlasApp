### Task 9 — Security test suite (wave 2)

**File**: `server/middleware/security.test.ts` (new)

**Background**: Wave 1 hardening must be verified behaviorally: unauthenticated → 401, wrong role → 403, malformed input → 400, authorized → success.

**Changes**: Write vitest tests (vitest 3, globals enabled, node environment; test files are excluded from tsc). Mount a minimal express app (`express()` + `express.json()`) per middleware and exercise the REAL middleware from `server/middleware/adminAccess.ts` and `server/middleware/sessionMiddleware.ts`, plus a few route-level tests with mocked services. Cover at minimum:
- `requireAdminAccess`:
  - no secret + no token → 401 (existing test covers; extend for 403 path)
  - correct `x-admin-secret` → next()
  - wrong secret → 401/403
  - valid bearer JWT for admin user (mock `getUserFromRequest` to return `{ email, app_metadata:{ role:'admin' } }`) → next()
  - valid bearer JWT for non-admin (`role:'user'`) → 403
- `requireRole('admin')` (re-run the Task 1 requireRole tests here too if not already) plus a moderator variant.
- `isAuthenticated` (sessionMiddleware): session userId set → next(); neither session nor valid token → 401.
- Route-level (mock the service modules with `vi.mock`):
  - `botRoutes` `/create`: admin secret → 200/201; no auth → 401; non-admin token → 403; missing username → 400.
  - `ideasRoutes` `/submit`: admin → success; no auth → 401; client `isAdminSubmission:true` with non-admin token → 403; missing title → 400.
  - `smsRoutes` `/test`: no auth → 401; admin secret → 200.
  - `ai/analysis.ts` `/analyze-bulk`: >50 responses → 400; 1 response → 200 (mock `analyzeBulkResponses`).
  - `geographic` `/users/location`: body userId different from token id → 403; missing auth → 401; matching → 200 (mock `db`).
- Mock boundary: mock `../auth/supabaseAuth` (`getUserFromRequest`), `../db` (`db`/`supabaseDb`), `../services/botService`, `../services/openaiService`, `../services/shadowCabinet`, and Twilio/`../services/twilioService` as needed. No real network/DB.

**Gates**:
- `node_modules/.bin/vitest run --root . server/middleware/security.test.ts` passes (and the Task 1 requireRole tests).
- `node_modules/.bin/vitest run --root .` passes for ALL test files (full suite, including existing adminAccess.test.ts and any added test files).
- tsc total stays ≤ 2644 (test files excluded, but confirm).

---

