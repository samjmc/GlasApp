# Adversary Report — Wave 1 (Phase 4A route security)

**Role**: cross-task adversary — interface mismatches, hidden coupling, sequencing/drift, claimed-vs-actual interfaces.
**Method**: read PLAN + briefs 1–8 + reports; then read the ACTUAL working tree (`git diff HEAD`) and the client, and re-ran `tsc` per-file counts and the two middleware vitest suites myself.
**Files NOT modified.**

---

## Verified-clean (no findings)

- **`requireAdminAccess` interface**: exists at `server/middleware/adminAccess.ts:46` with unchanged signature/behavior (secret via `safeSecretEquals`, then `isAdmin`). Tasks 2 (botRoutes.ts:5, routes.ts:9), 3 (ideasRoutes.ts:5), 4 (scores.ts:31), 6 (shadowRoutes.ts:6, debateWorkspaceRoutes.ts:4), 7 (smsRoutes.ts:5), 8 (geographic/index.ts:25) all import it from the correct relative path and use it as route middleware. No `requireRole`/`logAdminAction` consumption by any Wave-1 task (verified via grep — only Task 1 + its test reference them), so Task 1's new export signatures are not exercised yet but match the PLAN.
- **`isAuthenticated` duality**: exists in both `server/auth/supabaseAuth.ts:140` (bearer-only, sets `req.user` = Supabase user) and `server/middleware/sessionMiddleware.ts:44` (session-first then bearer; session path now sets `req.user = { id, sub }`). Consumers use the intended one: Task 5 voting.ts:13/policy.ts:12 and Task 8 ideologyTimelineRoutesEnhanced.ts:6 use bearer `supabaseAuth`; Task 8 geographic/index.ts:24 uses sessionMiddleware. All read only fields the middleware sets (`req.user.id`, `req.user.app_metadata.role`, `req.session.userId`).
- **Ownership comparisons string-safe**: Task 5 (voting.ts:310,332,357; policy.ts) and Task 8 ideology (ideologyTimelineRoutesEnhanced.ts:28) use `String(callerId) !== userId` over bearer-only paths (UUID strings — no numeric-session mixing). Task 8 geographic uses `String(userId) !== String(authenticatedId)` over a session-capable path, where the session id is numeric — the `String()` coercion makes it type-confusion-safe. `DELETE /:voteId` compares `vote.user_id !== callerId`; the vote is created with the same `req.user.id` source (voting.ts:235,281) so types match. No bypass found.
- **Per-file error budgets**: ran `node_modules/.bin/tsc 2>&1 | grep "error TS" | grep -oE "^server/[^(]+" | sort | uniq -c` — every touched file is AT or BELOW its PLAN baseline, and the total is **2642 ≤ 2644**:

  | File | Baseline | Actual |
  |---|---|---|
  | supabaseAuth.ts | 2 | 2 ✓ |
  | sessionMiddleware.ts | 0 | 0 ✓ |
  | adminAccess.ts | 0 | 0 ✓ |
  | index.ts | 1 | 1 ✓ |
  | botRoutes.ts | 3 | 2 ✓ |
  | routes.ts | 16 | 16 ✓ |
  | ideasRoutes.ts | 12 | 11 ✓ |
  | parliamentary/scores.ts | 58 | 58 ✓ |
  | parliamentary/voting.ts | 17 | 17 ✓ |
  | user/rankings/policy.ts | 13 | 13 ✓ |
  | shadowRoutes.ts | 2 | 2 ✓ |
  | debateWorkspaceRoutes.ts | 40 | 40 ✓ |
  | smsRoutes.ts | 0 | 0 ✓ |
  | ai/analysis.ts | 0 | 0 ✓ |
  | geographic/index.ts | 15 | 15 ✓ |
  | ideologyTimelineRoutesEnhanced.ts | 46 | 46 ✓ |

- **Response contracts**: all new 401s are `{success:false, message:'Authentication required'}` and 403s are `{success:false, message:'Admin access required'|'Access denied'}`. Task 5's DELETE keeps the file's pre-existing `formatError('FORBIDDEN', …)` 403. Task 7's zod 400 is `{success:false, message:'Invalid request data', details}` (matches existing pattern; zod 3.24.2 supports the `z.record` two-arg form; client `IdeologicalDimensions` has exactly the 8 schema keys).
- **Vitest**: `adminAccess.test.ts` (4) + `requireRole.test.ts` (6) pass in a single run.
- Task 9's future consumers: `requireRole(...roles): RequestHandler`, `logAdminAction(req, action, detail?)`, `getCallerRole(req): string|null` all exported with the PLAN-documented signatures.

---

## Findings

### CRITICAL-1 — Shadow Cabinet dashboard now 401s for every caller, including legit admins (client sends no auth)

- **Claimed**: Task 6 brief — shadow endpoints "have NO auth … protect ALL three routes with `requireAdminAccess`". The plan's auth model assumes bearer JWT is how the client authenticates.
- **Actual (server)**: `server/routes/shadowRoutes.ts:11,35,48` gate `/analyze`, `/history`, `/qa-history` with `requireAdminAccess`.
- **Actual (client)**: `client/src/pages/admin/ShadowCabinetDashboard.tsx:120,136,156` call these with **raw `fetch()` and no `Authorization` header** (the client's only auth is a Supabase JWT held in localStorage, attached only via `apiRequest`/`getQueryFn`/explicit headers — see `client/src/lib/queryClient.ts:55-84` and `RegionContext.tsx:88-136` which only adds `x-region-code`). No session cookie is set for Supabase-logged-in users (`req.session.userId` is set only by the legacy flow, `server/routes/authRoutes.ts:617-618`).
- **Consequence**: `requireAdminAccess` → no secret, no bearer (`getUserFromRequest` returns null), no cookie session → `isAdmin` 401s (`supabaseAuth.ts:213-220`). **Every** caller — including an admin with a valid token — gets 401. The `/admin/shadow` dashboard (which worked before, when these routes were unauthenticated) is completely broken. Cross-layer interface drift: server hardening + client that never sends the credential.

### CRITICAL-2 — Debate workspace (`/debates/workspace`) now 401s for every caller, and the page is still served to anonymous users

- **Claimed**: Task 6 brief — debate-workspace `views`/`exports` have "NO auth — anonymous users can create/delete shared views and exports"; plan decided admin-only.
- **Actual (server)**: `server/routes/debateWorkspaceRoutes.ts:205,225,262,299,324,379` gate GET/POST/PATCH/DELETE `/views` and GET/POST `/exports` with `requireAdminAccess`.
- **Actual (client)**: `client/src/pages/MediaWorkspacePage.tsx:28,37,84,112,127` call these with **raw `fetch()`, no bearer**. The page is routed for BOTH anonymous and authenticated users (`client/src/App.tsx:180` and `:250`).
- **Consequence**: same as CRITICAL-1 — 401 for everyone, admin included; previously-working public page now fully broken. The client was never updated to (a) attach the bearer token or (b) gate the route/UI, so the hardening closes anonymous access but also eliminates the authorized admin path.

### CRITICAL-3 — Ideology timeline (`/api/ideology-timeline/:userId`) now 401s for the logged-in owner viewing their own page

- **Claimed**: Task 8 brief — "`GET /api/ideology-timeline/:userId` … The client calls it only with the current user's own `user.id` (`MyPoliticsPage`)." (i.e., the plan believes the legit caller is authenticated).
- **Actual (server)**: `server/routes/ideologyTimelineRoutesEnhanced.ts:21` gates `GET /:userId` with bearer-only `isAuthenticated` (from `supabaseAuth.js`), then ownership check at :28.
- **Actual (client)**: `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx:113` calls it with **raw `fetch()`, no bearer**; the CSV export at `:145` is a bare `window.location.href` navigation (also no auth). The component is used by the auth-gated `MyPoliticsPage` (`client/src/pages/MyPoliticsPage.tsx:770`).
- **Consequence**: bearer-only guard + client that never sends a bearer → **401 for every user, including the owner viewing their own timeline**, and for the CSV/JSON export. Previously (no auth) this worked. Live regression plus the intended authorized caller is locked out. The owner must have `req.user.id` from the token, which the client never provides.

### IMPORTANT-1 — Plan/brief falsely claim `/users/location` is "mounted also as `/api/users/location`"; the client's live call targets a dead path

- **Claimed**: Task 8 brief line 6 and PLAN line 233 — "`POST /api/location/users/location` (mounted also as `/api/users/location` …)". Implies the hardened route is what the client uses.
- **Actual**: the geographic router is mounted only at `/api/geographic`, `/api/heatmap`, `/api/constituencies`, `/api/location` (`server/routes.ts:72-77`). **There is no `/api/users` mount anywhere** in the server (grep of all `app.use`).
- **Actual (client)**: `client/src/hooks/use-location.tsx:48` POSTs to **`/api/users/location`** — a path no handler serves; it has always 404'd (the response is never checked at line 61). Task 8's IDOR-write fix correctly hardens the real live endpoint `/api/location/users/location` (which an attacker could indeed hit), but the brief's claimed interface does not exist and the client's location-save feature remains pointed at a dead path. This is documentation-vs-reality drift, and the pre-existing client dead call was not caught by any task.

### MINOR-1 — Legacy Replit session users lose access to Task 5/Task 8 bearer-only endpoints

`voting.ts:13`, `policy.ts:12`, `ideologyTimelineRoutesEnhanced.ts:6` all use bearer-only `supabaseAuth.isAuthenticated`. A legacy session-authenticated user (`req.session.userId`, no bearer) previously reached these routes unauthenticated and now gets 401. Acknowledged in the plan ("legacy Replit … bearer, consistent with how these files already derive `req.user?.id`"), so this is by-design — but it is a behavior break for the session flow worth confirming with the coordinator.

### MINOR-2 — `parseInt` accepts trailing-garbage ids in the bot behavior routes

`server/routes.ts:392,411,428`: `parseInt("12abc")` → `12`, `Number.isInteger(12)` → true, so the "finite positive integer" gate passes for `12abc`. Admin-gated, so not a security hole; deviates from the brief's stated intent.

### MINOR-3 — Mixed error shapes in geographic route

`server/routes/geographic/index.ts:143` keeps the 400 as `{ error: "Latitude and longitude are required" }` while the new 401/403 use `{ success:false, message }`. Pre-existing file pattern; the client doesn't inspect it (`use-location.tsx` ignores the response). Cosmetic inconsistency only.

### MINOR-4 — Shadow-cabinet logs labeled `admin.bots`

`server/routes/shadowRoutes.ts:14,38,51` log `operation: 'admin.bots'` / "Bot admin action" on shadow-cabinet routes — a copy-paste from the Task 2 brief. No behavioral impact; audit-trail naming noise.

---

## Bottom line

All 8 tasks meet their own file-level gates (tsc per-file and total 2642 ≤ 2644; both middleware test suites green; response contracts and import paths consistent). The three CRITICAL findings are a single cross-layer defect: **Tasks 6 and 8 hardened routes that the client calls with raw `fetch()` that never sends the Supabase bearer token** (and for shadow/debate-workspace, the pages are even served to non-admin/anonymous users). The result is complete loss of function for authorized users — not a security hole, but a live regression that Wave 2 (Task 9) should not be built on until the client call sites are switched to the bearer-attaching `apiRequest`/`getQueryFn` helpers (and the pages gated by role).