# Task 9 Report — Security test suite (wave 2)

**Status: DONE**

## What was written

New file `server/middleware/security.test.ts` (untracked; the ONLY change made by this task). No route, middleware, service, config, or package files were touched.

Test matrix implemented (29 tests, all against REAL middleware/handlers):

- **requireAdminAccess** (direct fake req/res, real `adminAccess.ts`):
  - correct `x-admin-secret` → `next()` + no status written
  - no secret + no token → 401 `{success:false,message:'Authentication required'}`
  - wrong secret → 401 (falls through to auth check)
  - bearer JWT for admin user → `next()`
  - bearer JWT for non-admin → 403 `{success:false,message:'Admin access required'}`
- **requireRole** (direct fake req/res; Task-1 cases re-run + extras):
  - unauthenticated → 401
  - `role:'user'` calling `requireRole('admin')` → 403
  - `role:'admin'` → `next()`
  - moderator variant `requireRole('admin','moderator')` → `next()`
  - `ADMIN_EMAILS` allowlist grants admin without app_metadata role
  - bearer identity resolution (no `req.user` set) → `next()`
- **isAuthenticated** (`sessionMiddleware.ts`):
  - session `userId` set → `next()` and `req.user = { id:42, sub:'42' }` populated
  - neither session nor bearer → 401
  - valid bearer → `next()`, `req.user` set
- **Route-level** (mounted minimal express app `express()` + `express.json()`, exercised via node `fetch` to an ephemeral-loopback server; services/db mocked with `vi.mock`):
  - `botRoutes /create`: admin secret → 201; no auth → 401; non-admin token → 403; missing username → 400
  - `ideasRoutes /submit`: admin bearer → 200 (asserts `insertValues.userId === 'admin-id'`); no auth → 401; `isAdminSubmission:true` with non-admin token → 403; missing title → 400
  - `smsRoutes /test`: no auth → 401; admin secret → 200
  - `ai/analysis /analyze-bulk`: 51 responses → 400 (zod max 50); 1 response → 200 (mocked `analyzeBulkResponses`)
  - `geographic /users/location`: body userId differs from token id → 403; missing auth → 401; matching → 200 (mocked `db`, asserts `firebaseUid === 'user-42'`)

## Mocks (`vi.mock`)

- `../db` → `{ pool:null, supabaseDb:null, db: chainable fake (select/insert/update/delete) with configurable results }`
- `../services/botService` → `BotService.createBotAccount` etc.
- `../services/twilioService` → `isTwilioConfigured()=true`, `sendSMS` stub
- `../services/aiService` → `callChatCompletion` stub
- `../services/openaiService` → full mock, `analyzeBulkResponses` stubbed
- `../services/cacheService` → full mock (also avoids the module's 5-min `setInterval` and redis import)
- `@shared/schema`, `@shared/quizTypes` → mocks so route modules load (see deviations)

No real network/DB: bearer identity is controlled by stubbing `supabase.auth.getUser` (the single chokepoint of the real `getUserFromRequest`); DB calls are chainable fakes; AI/Twilio services are stubs. Loopback HTTP on `127.0.0.1` only.

## Verification gates (run from repo root)

1. `node_modules/.bin/vitest run --root . server/middleware/security.test.ts`
   → **PASS**, 1 file, 29 tests, 57ms.
2. `node_modules/.bin/vitest run --root . server/middleware/requireRole.test.ts server/middleware/adminAccess.test.ts`
   → **PASS**, 2 files, 10 tests.
3. `node_modules/.bin/vitest run --root .`
   → **PASS**, 7 files, 138 tests (all existing + new).
4. `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` → **2642** (≤ 2644 baseline; test file excluded — 0 occurrences of `security.test` in tsc output).

## Deviations / notes

- **`getUserFromRequest` mock boundary:** the brief listed `../auth/supabaseAuth` (`getUserFromRequest`) in the mock boundary, but `isAdmin`/`requireRole` in the real modules call the *module-internal* `getUserFromRequest`, not the re-exported one — mocking only the export would NOT take effect. Instead I stub `supabase.auth.getUser` (as `adminAccess.test.ts` already does), which is what the real `getUserFromRequest` calls. This lets the REAL `isAdmin`/`requireAdminAccess`/`sessionMiddleware` logic run against a controllable identity, which matches the brief's "exercise the REAL middleware" requirement.
- **`@shared/*` aliases:** vitest.config.ts has no alias config (only vite.config.ts does), so importing `geographic/index.ts`/`ideasRoutes.ts`/`ai/analysis.ts` fails on `@shared/schema`/`@shared/quizTypes`. Rather than touching any config file (out of bounds), I added `vi.mock` entries for those two specifiers, which vitest resolves even without the alias configured.
- **`ADMIN_API_SECRET`:** `adminJobSecret` is captured at `adminAccess.ts` module load, so it is set at the top of the test file (before dynamic imports) and held constant for the file; the per-test "set/restore" applies to `ADMIN_EMAILS` (read at call time) and to the request-side secret header, as required.
- **`shadowCabinet` not mocked:** no route exercised by these tests imports it (checked transitive imports of the tested modules); mocked only what the tested routes actually load.
- Route-level requests use node `fetch` with `connection: close` plus `server.closeAllConnections()` in teardown to avoid keep-alive hangs on `server.close()`.