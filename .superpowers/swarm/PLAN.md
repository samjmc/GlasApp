# Phase 4A — Route Security Hardening: Implementation Plan

## Global Constraints (binding on ALL tasks)

1. **No database schema changes** — that is Phase 4B (RLS). You may write to tables via existing services but must not alter schema.
2. **No TypeScript compiler config changes** — that is Phase 4C. Do not touch `tsconfig.json`, `vite.config.ts`, or `tsconfig.*`.
3. **No non-security refactors** — stay focused on auth/RBAC/input-validation. Do not reformat large blocks, rename unrelated symbols, or "clean up" code.
4. **Typecheck gate** — run from repo root:
   `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` must be **≤ 2644** (baseline). Additionally, per-file error counts for every file you touch must **not increase** above the baselines listed in your task brief. If your change would raise a per-file count, fix your code — do not suppress errors.
5. **Existing tests must stay green**: `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` must pass (4 tests).
6. **Repo conventions**: use zod for input validation, `formatSuccess`/`formatError` or plain `{ success, message }` as the existing file does, `requestLogger`/`logger` from `server/utils/logger` for logs, no comments unless they explain security intent (brief comments OK). Do NOT add new dependencies.
7. **Node modules**: `node_modules` is a symlink to the phase-4c worktree. Use `node_modules/.bin/tsc` and `node_modules/.bin/vitest`. Do not modify node_modules.
8. **Do not commit** — the coordinator handles git. Leave changes uncommitted (staged or not).
9. **Never log secrets.** Admin action logs log actor identity + route + timestamp, never tokens/keys.

## Auth model summary (context for all tasks)

- Bearer auth: `server/auth/supabaseAuth.ts` `isAuthenticated`/`getUserFromRequest` verify the Supabase JWT; `req.user` is the Supabase user object (`{ id, email, app_metadata: { role }, ... }`).
- Session auth (legacy Replit): `server/middleware/sessionMiddleware.ts` `isAuthenticated` accepts `req.session.userId` (a numeric DB id) OR bearer. It currently does NOT set `req.user` for session users.
- Admin check: `server/middleware/adminAccess.ts` `requireAdminAccess` = (shared job secret in `x-admin-secret`/`x-cron-secret`/`Authorization: Bearer <secret>` matched with `timingSafeEqual`) OR `isAdmin` (from supabaseAuth). `isAdmin` trusts only `app_metadata.role === 'admin'` or the `ADMIN_EMAILS` env allowlist — NOT self-editable `user_metadata`.
- New RBAC helper `requireRole(...roles)` is added by Task 1; all later tasks may use it.
- **Trust rule**: never trust client-supplied role flags or client-supplied user IDs for authorization. Identity must come from `req.user` / `req.session`.

## Task Graph

- Wave 1 (parallel, disjoint files): Tasks 1–8.
- Wave 2: Task 9 (security test suite) — after all of Wave 1.
- Wave 3: coordinator writes REPORT.md.

Per-file baseline error counts (total baseline 2644):

| File | Baseline |
| --- | --- |
| server/auth/supabaseAuth.ts | 2 |
| server/middleware/sessionMiddleware.ts | 0 |
| server/middleware/adminAccess.ts | 0 |
| server/index.ts | 1 |
| server/routes/botRoutes.ts | 3 |
| server/routes.ts | 16 |
| server/routes/ideasRoutes.ts | 12 |
| server/routes/parliamentary/scores.ts | 58 |
| server/routes/parliamentary/voting.ts | 17 |
| server/routes/user/rankings/policy.ts | 13 |
| server/routes/shadowRoutes.ts | 2 |
| server/routes/debateWorkspaceRoutes.ts | 40 |
| server/routes/smsRoutes.ts | 0 |
| server/routes/ai/analysis.ts | 0 |
| server/routes/geographic/index.ts | 15 |
| server/routes/ideologyTimelineRoutesEnhanced.ts | 46 |

---

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

### Task 3 — Ideas submission: server-side admin enforcement

**File**: `server/routes/ideasRoutes.ts`

**Background**: `POST /ideas/submit` currently trusts the client-supplied `isAdminSubmission` boolean — any authenticated user can set it `true` and create admin-only ideas. It also reads `req.session.user?.id`, which is never populated (session stores `userId`, not `user`) — so the endpoint is broken for legit admins too.

**Changes**:
- Replace the client-trusted gate with server-side enforcement: protect the route with `requireAdminAccess` imported from `../middleware/adminAccess` (admin JWT, admin email allowlist, or job secret).
- Derive the author userId robustly: `req.user?.id ?? req.session?.userId ?? null`. If null after the guard, respond 401 `{ success:false, message:'Authentication required' }`.
- Delete the `isAdminSubmission` trust: ignore that field entirely (still accept it in destructuring or drop it — but do NOT branch on it).
- Keep the existing field validation (title, description, category required → 400), the user lookup, and the insert logic.
- After insert, log with `requestLogger(req)` pattern: `log.info({ operation: 'admin.ideas.submit', actor: req.user?.email ?? req.session?.userId, title }, 'Idea submitted')`. Do NOT rely on new Task 1 exports.
- Remove now-dead code (`const userId = (req.session as unknown)?.user?.id;`).

**Do NOT**: change the `/ideas/:category` GET, `/ideas/vote`, or `/ideas/categories/stats` handlers.

**Gates**:
- tsc total ≤ 2644; per-file count: ideasRoutes.ts ≤ 12.
- Code review confirms no client-controlled role/flag is trusted.

---

### Task 4 — Parliamentary scores: protect trigger-scrape

**File**: `server/routes/parliamentary/scores.ts`

**Background**: `POST /api/parliamentary/scores/trigger-scrape` triggers a full news scrape job (LLM + network + DB cost) with NO auth. `/recalculate` already uses `requireAdminAccess` — keep it.

**Changes**:
- Add `requireAdminAccess` middleware to `POST /trigger-scrape` (import already exists at line 31).
- Inside the handler, log with `requestLogger(req)` pattern (import from `../../utils/logger`) — do NOT rely on new Task 1 exports.
- Leave `/recalculate` as-is.

**Do NOT**: touch any other endpoint in the file (58 baseline errors there — keep your change minimal).

**Gates**:
- tsc total ≤ 2644; per-file count: parliamentary/scores.ts ≤ 58.

---

### Task 5 — Policy voting: auth on deletes + IDOR protection on user-data reads

**Files**: `server/routes/parliamentary/voting.ts`, `server/routes/user/rankings/policy.ts`

**Background**: In BOTH files:
- `DELETE /:voteId` is unauthenticated and takes `userId` from the request BODY — a spoofable authorization check. Any caller can delete any vote by passing the victim's userId.
- `GET /user/:userId/article/:articleId`, `GET /user/:userId/personalized-scores`, `GET /user/:userId/td/:politicianName`, `GET /user/:userId/value-alignment` expose one user's personalized political data with NO auth (IDOR).

**Changes** (apply identically in both files):
1. `DELETE /:voteId`: require `isAuthenticated` (import from `../../auth/supabaseAuth.js` — bearer, consistent with how these files already derive `req.user?.id`). Determine the caller id via `req.user?.id`. Do NOT trust the body `userId`; if a body userId is present and differs from the caller id, ignore it (or 400). Compare `vote.user_id === callerId` as today; on mismatch 403.
2. The four `GET /user/:userId/...` endpoints: add `isAuthenticated` and enforce **ownership** — if `req.params.userId !== String(req.user?.id)` → 403 `{ success:false, message:'Access denied' }`. (Admins may read any user: allow if `req.user?.app_metadata?.role === 'admin'`.)
3. Keep every other handler unchanged.

**Note**: `user/rankings/policy.ts` may derive userId differently (check its existing POST at line ~244); make the ownership comparison consistent with how the file already reads the caller's id.

**Do NOT**: change vote-creation (`POST /`), the `/article/:articleId` public reads, or the shared services.

**Gates**:
- tsc total ≤ 2644; per-file counts: parliamentary/voting.ts ≤ 17, user/rankings/policy.ts ≤ 13.

---

### Task 6 — Shadow cabinet + debate workspace: admin-only

**Files**: `server/routes/shadowRoutes.ts`, `server/routes/debateWorkspaceRoutes.ts`

**Background**: Shadow Cabinet routes (`/api/shadow/analyze|history|qa-history`) have NO auth: `/analyze` runs an LLM pipeline on an arbitrary caller-supplied URL (cost + SSRF risk) and the history endpoints expose internal QA-audit data. The client surfaces these only on the `/admin/shadow` dashboard. Debate workspace (`/api/debate-workspace/views` GET/POST/PATCH/DELETE, `/exports` GET/POST) have NO auth — anonymous users can create/delete shared views and exports.

**Changes**:
- `shadowRoutes.ts`: protect ALL three routes (`/analyze`, `/history`, `/qa-history`) with `requireAdminAccess` (import from `../middleware/adminAccess`). Log each operation with the existing `requestLogger(req)` pattern (import from `../utils/logger`) — `log.info({ operation: 'admin.bots', actor: req.user?.email ?? req.session?.userId }, 'Bot admin action')`. Do NOT rely on new Task 1 exports.
- `debateWorkspaceRoutes.ts`: protect `/views` (GET/POST/PATCH/DELETE) and `/exports` (GET/POST) with `requireAdminAccess`. Log write operations (views POST/PATCH/DELETE, exports POST) with the existing `requestLogger(req)` pattern from `../../utils/logger`. Do NOT rely on new Task 1 exports.
- Keep existing response shapes and validation.

**Do NOT**: change the workspace query helpers (`normalizeFilters`, `createExportEntry`) or any debate data services.

**Gates**:
- tsc total ≤ 2644; per-file counts: shadowRoutes.ts ≤ 2, debateWorkspaceRoutes.ts ≤ 40.

---

### Task 7 — SMS test endpoint admin-gating + AI analysis input bounds

**Files**: `server/routes/smsRoutes.ts`, `server/routes/ai/analysis.ts`

**Background**: `GET /api/sms/test` is marked "FOR DEVELOPMENT ONLY" but ships in production and reveals Twilio config state with NO auth. `POST /api/sms/send` is already authenticated + zod-validated (leave it). The AI analysis routes hit paid LLM endpoints with unbounded input: `POST /api/ai/analyze-bulk` accepts an unbounded `responses` array; `complete-analysis`/`context-analysis` accept unvalidated `dimensions`/`weights`.

**Changes**:
1. `smsRoutes.ts`: gate `GET /test` with `requireAdminAccess` (import from `../middleware/adminAccess`). Log the test call with the existing `requestLogger(req)` pattern from `../utils/logger`. Do NOT rely on new Task 1 exports. Leave `/send` and `/status` as-is.
2. `ai/analysis.ts`:
   - `bulkAnalysisSchema`: add `.max(50)` to the `responses` array, and `.max(4000)` to each `text` and `question` string.
   - `singleAnalysisSchema`: `.max(4000)` on `text`, `.max(2000)` on `questionContext`.
   - `complete-analysis` and `context-analysis`: add zod validation using `dimensionsSchema` (already defined — `z.number().min(-10).max(10)` per dimension) for `req.body.dimensions`, and a `weights` schema of `z.record(z.string(), z.number().min(0).max(3)).optional()`.
   - On zod failure respond 400 `{ success:false, message:'Invalid request data', details: error.errors }` (mirror the existing pattern in `analyze-text`/`analyze-bulk`).
   - Do NOT add authentication to these user-facing AI routes (frontend quiz flow calls them unauthenticated) — input bounds only.

**Do NOT**: change `callChatCompletion`/openaiService, or the `/send` route.

**Gates**:
- tsc total ≤ 2644; per-file counts: smsRoutes.ts ≤ 0, ai/analysis.ts ≤ 0 (these are currently error-free — keep them error-free).

---

### Task 8 — Geographic location + ideology timeline: auth, ownership, admin data access

**Files**: `server/routes/geographic/index.ts`, `server/routes/ideologyTimelineRoutesEnhanced.ts`

**Background**:
- `POST /api/location/users/location` (mounted also as `/api/users/location` and `/api/location/...`) accepts an arbitrary `userId` in the body — anyone can write/overwrite ANY user's location (IDOR write). The client (`use-location.tsx`) sends the authenticated user's own `user.id`.
- `GET /api/location/users/by-constituency/:constituency` returns a list of user identifiers (`firebaseUid`) with no auth — privileged data exposure.
- `GET /api/ideology-timeline/:userId` (mounted, enhanced) returns a user's political ideology evolution (sensitive personal data) with no auth. The client calls it only with the current user's own `user.id` (`MyPoliticsPage`).

**Changes**:
1. `geographic/index.ts`:
   - `POST /users/location`: require `isAuthenticated` (import from `../middleware/sessionMiddleware`). Derive the authorizing id from `req.user?.id ?? req.session?.userId`; if a body `userId` is provided AND does not match the authenticated id → 403 `{ success:false, message:'Access denied' }`. If no identity after the guard → 401. Use the authenticated id as the record key. Keep lat/lng/constituency/county/accuracy validation (all required lat/lng → 400).
   - `GET /users/by-constituency/:constituency`: require `requireAdminAccess` (import from `../middleware/adminAccess`). Log with the existing `requestLogger(req)` pattern from `../utils/logger`. Do NOT rely on new Task 1 exports.
2. `ideologyTimelineRoutesEnhanced.ts`:
   - `GET /:userId`: require `isAuthenticated` (bearer, from `../../auth/supabaseAuth.js`). If `req.params.userId !== String(req.user?.id)` and caller is not `app_metadata.role === 'admin'` → 403 `{ success:false, message:'Access denied' }`.
   - Keep the CSV/JSON export and all query-param behavior.

**Do NOT**: touch `GET /constituency` (reverse geocode), heatmap, stats/constituencies, or the plain (unmounted) `ideologyTimelineRoutes.ts`.

**Gates**:
- tsc total ≤ 2644; per-file counts: geographic/index.ts ≤ 15, ideologyTimelineRoutesEnhanced.ts ≤ 46.

---

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

### Task 10 — Client compatibility: attach bearer tokens to privileged pages (wave 2)

**Files**: `client/src/pages/admin/ShadowCabinetDashboard.tsx`, `client/src/pages/MediaWorkspacePage.tsx`, `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`, `client/src/components/IdeologyTimeSeriesChart.tsx`, `client/src/lib/queryClient.ts` (only if a tiny export is needed)

**Background**: Wave 1 hardened these endpoints to require admin/auth, but the client pages that legitimately call them use raw `fetch` with NO Authorization header — so legit admin/user calls would now 401/403. This task attaches the Supabase bearer token to those calls using the EXISTING `apiRequest`/`apiClient` helper from `@/lib/queryClient` (which auto-attaches the token via `supabase.auth.getSession()`). Do NOT invent a new fetch helper; do NOT add a global fetch override.

**Changes**:
1. `client/src/pages/admin/ShadowCabinetDashboard.tsx`: replace the raw `fetch("/api/shadow/history")`, `fetch("/api/shadow/qa-history")`, and `fetch("/api/shadow/analyze", { method:"POST", ... })` with `apiClient.get(...)` / `apiClient.post('/api/shadow/analyze', { url })`. Preserve the existing response handling (arrays for history/qa-history; `.ok`-based checks can be relaxed since `apiRequest` throws on !ok — wrap in try/catch exactly as today).
2. `client/src/pages/MediaWorkspacePage.tsx`: replace all five raw fetches (GET /api/debate-workspace/views, GET /api/debate-workspace/exports?limit=20, POST /views, DELETE /views/:id, POST /exports) with `apiClient.get/post/delete`. Keep the response shapes (`payload.views`, `payload.exports`, `data.export.csvBase64`). `apiRequest` throws on non-ok — adjust the `if (!response.ok)` blocks accordingly (they can be removed; the mutationFn throws are already handled by react-query).
3. `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`: the `fetch(\`/api/ideology-timeline/${userId}?...\`)` and `window.location.href = /api/ideology-timeline/:userId?format=csv` calls must attach the token. For the JSON timeline: use `apiClient.get(...)`. For CSV export: `window.location.href` cannot carry headers — fetch the CSV with `apiClient.get(...)` (or a fetch with the token) into a Blob and trigger a client-side download (the file already has a blob-download pattern for JSON at ~line 154). Preserve query params (weeks, fromDate, toDate, compareParty, compareAverage).
4. `client/src/components/IdeologyTimeSeriesChart.tsx` (plain): same treatment for its `fetch(\`/api/ideology-timeline/${userId}?weeks=${weeks}\`)` — use `apiClient.get(...)`. (It is still mounted/imported by some page; keep it working.)
5. `client/src/lib/queryClient.ts`: only if you need a token-fetching variant that returns raw text (for CSV). If you can express CSV download purely with `apiClient.get` (parsing JSON→not possible for CSV), then add a minimal exported helper `apiFetch(path: string): Promise<Response>` that attaches the token and returns the Response, OR perform the CSV fetch inside the component using `supabase.auth.getSession()` directly. Prefer the smallest change; do not restructure the module.

**Do NOT**: change any server routes, add dependencies, change UI layout/behavior beyond the fetch calls, add a global `window.fetch` override, or touch other client pages.

**Gates**:
- `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` ≤ 2644; per-file counts must not increase: ShadowCabinetDashboard.tsx ≤ 2, MediaWorkspacePage.tsx ≤ 17, IdeologyTimeSeriesChartEnhanced.tsx ≤ 7, IdeologyTimeSeriesChart.tsx ≤ 5, queryClient.ts ≤ 0.
- Code review: every hardened endpoint's client caller now attaches the bearer token; no UI regression.

---

## Adversary focus areas (cross-task)

- Task 1's `requireRole`/`isAdmin` must be importable exactly as Tasks 2–8 reference them (names, signatures).
- `req.user` shape consistency across supabaseAuth vs sessionMiddleware (Task 1) vs route handlers reading `req.user?.id`.
- Ideas submit userId derivation (Task 3) must match how session/bearer identity is attached (Task 1).
- Geographic/ideology ownership comparisons (Task 8) must use the same caller-id source as policy-voting (Task 5).
- No task may introduce a NEW file-level TS error in a shared file another task edits.