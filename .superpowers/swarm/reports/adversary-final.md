# Adversary Report — Final (Phase 4A route security)

**Role**: cross-wave adversary — end-state drift, cross-task interface mismatches, client↔server contract.
**Method**: read PLAN + `adversary-wave1.md`; then read the ACTUAL working tree (`git diff HEAD` + untracked test files) and the live client/server call sites; re-ran `tsc` (total + per-file) and `vitest run --root .` myself.
**Files NOT modified.** (This report only.)

---

## Gates re-run (verified, not reported)

- `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` → **2642** ≤ 2644. ✓
- Per-file counts for all 16 server files + 5 client files: **every file AT or BELOW baseline**. ✓
  - supabaseAuth 2/2, sessionMiddleware 0/0, adminAccess 0/0, index 1/1, botRoutes 2/3, routes.ts 16/16, ideasRoutes 11/12, scores 58/58, voting 17/17, policy 13/13, shadowRoutes 2/2, debateWorkspace 40/40, sms 0/0, ai/analysis 0/0, geographic 15/15, ideologyEnhanced 46/46, ShadowCabinetDashboard 2/2, MediaWorkspacePage 17/17, IdeologyTimeSeriesChartEnhanced 7/7, IdeologyTimeSeriesChart 5/5, queryClient 0/0.
- `node_modules/.bin/vitest run --root .` → **7 files, 138 tests, all pass**. ✓
- Wave-1 Criticals (token attachment): **fixed** — see below.

---

## Verified-clean (no findings)

- **Client path ↔ mount table**: all calls in the five Task-10 files resolve to real mounts and real sub-paths — `/api/shadow/{history,qa-history,analyze}` → `shadowRoutes` (routes.ts:69), `/api/debate-workspace/{views,exports}` → `debateWorkspaceRoutes` (routes.ts:131), `/api/ideology-timeline/:userId` → `ideologyTimelineRoutesEnhanced` (routes.ts:161). All four endpoints now require auth (admin-only for shadow/debate-workspace; bearer+ownership for ideology), so attaching the token is necessary **and** sufficient.
- **Wave-1 Criticals resolved**: ShadowCabinetDashboard.tsx:121/136/155 use `apiClient`; MediaWorkspacePage.tsx:29/34/77/94/103 use `apiClient`; IdeologyTimeSeriesChartEnhanced.tsx:114 uses `apiClient.get`, :155 uses `apiFetch` (CSV now token-attached, blob download); IdeologyTimeSeriesChart.tsx:61 uses `apiClient.get`. All five go through `getAccessToken()` → `Authorization: Bearer` (queryClient.ts:22-105).
- **`requireRole`/`isAdmin`/`getCallerRole`**: `getCallerRole` reads **only** `app_metadata.role` + `ADMIN_EMAILS` (supabaseAuth.ts:174-197); `isAdmin` reuses `req.user` if present (supabaseAuth.ts:208-211); contracts exact — 401 `{success:false,message:'Authentication required'}`, 403 `{success:false,message:'Admin access required'}` (isAdmin) / `'Access denied'` (requireRole). `user_metadata` is never consulted.
- **No guard bypass**: every hardened route is on the correct method and registered after its guard; no shadowing legacy router is mounted (`policyVotingRoutes.ts`/`parliamentary/votingRoutes.ts` are imported nowhere — grep confirms). Inline bot routes in routes.ts:391/413/428 are reached (botRoutes has no `/:id/behavior/*`).
- **Ownership identity source** is `req.user?.id` (bearer) for voting/policy/ideology and `req.user?.id ?? req.session?.userId` for geographic — consistent with how each file's writes derive the id.
- **Client response-shape handling preserved**: shadow history/qa-history still `Array.isArray` (shadowRoutes returns raw arrays); MediaWorkspacePage still reads `payload.views` / `payload.exports` / `data.export.csvBase64`; ideology still reads `data.success/timeline`. No new throw-vs-tolerate regression (`apiRequest` throws on !ok, caught by the same try/catch or react-query error state as before).

---

## Findings

### Important

**IMPORTANT-1 — Location-save client still targets a dead path with no token; the hardened route has no working caller.**
`client/src/hooks/use-location.tsx:48` POSTs to `/api/users/location` with a raw `fetch` and no `Authorization`. The server has **no `/api/users` mount** (routes.ts:72-77 mount the geographic router at `/api/geographic|/api/heatmap|/api/constituencies|/api/location` only). The real, now-hardened endpoint is `/api/location/users/location` (geographic/index.ts:145, `isAuthenticated`). So (a) the location-save feature has always 404'd, and (b) even after Task 8's IDOR fix, the only legit client caller never reaches it. Wave-1 `IMPORTANT-1` remains unfixed; Task 10's file list excluded `use-location.tsx`. This is exactly the "wrong path vs actual mount" drift class called out in the focus areas.

**IMPORTANT-2 — MediaWorkspacePage is still routed to anonymous and non-admin users, but its endpoints are now admin-only (residual CRITICAL-2).**
`client/src/App.tsx:180` registers `/debates/workspace` inside the **unauthenticated** branch (and :250 in the auth branch). Task 10 attached the token, so an admin now works — but anonymous visitors and authenticated non-admins reach the page and get `apiRequest` throws → the page renders "Failed to load saved views/exports" and shows Create/Export/Delete controls that always 401/403. Pre-hardening this page worked unauthenticated; it is now functional only for admins. The plan deliberately deferred UI/route gating, but the end state is a broken page for every non-admin visitor.

**IMPORTANT-3 — `/admin/shadow` is gated by authentication only, not admin role (residual CRITICAL-1).**
`client/src/App.tsx:223` renders `ShadowCabinetDashboard` for any authenticated user. The three endpoints now require admin (`shadowRoutes.ts:11/35/48`), so a logged-in non-admin sees the dashboard shell with empty history/QA and an Analyze button that always 403s. `Header.tsx:70` even advertises the link to all authenticated users. Admin path works; non-admin path is a user-visible regression vs the pre-hardening (unauthenticated) behavior.

### Minor

**MINOR-1 — Shadow-cabinet audit logs mislabeled as bot actions.**
`server/routes/shadowRoutes.ts:14,38,51` log `operation: 'admin.bots'` / `'Bot admin action'` on shadow-cabinet routes (copy-paste from the Task 2 brief). No behavioral impact; audit-trail naming only. Wave-1 `MINOR-4`, still present.

**MINOR-2 — DELETE ownership comparison is not string-coerced.**
`server/routes/parliamentary/voting.ts:381` and `server/routes/user/rankings/policy.ts:399` compare `vote.user_id !== callerId` with no `String()` coercion, unlike the sibling reads (`String(callerId) !== userId`, voting.ts:141/310/332/357; policy.ts:153/325/348/374). Safe today (both are UUID strings and votes are written from the same `req.user.id` source), but it is the one comparison in the ownership family that could false-deny if `user_id` ever round-trips as a non-string. Not a bypass.

**MINOR-3 — Admin bypass in voting/policy/ideology ignores the `ADMIN_EMAILS` allowlist.**
`voting.ts:141/310/332/357`, `policy.ts:153/325/348/374`, and `ideologyTimelineRoutesEnhanced.ts:27` allow cross-user reads only when `app_metadata.role === 'admin'`, whereas `requireAdminAccess`/`getCallerRole` also grant admin via `ADMIN_EMAILS` (supabaseAuth.ts:192). Stricter than the central helper (not a security hole), but an allowlisted admin without `app_metadata.role` cannot read another user's data. Matches the PLAN's literal wording.

**MINOR-4 — Dead by-constituency query in an unrouted page.**
`client/src/pages/ConstituencyAnalyticsPage.tsx:33` uses the default `getQueryFn`, which fetches only `queryKey[0]` (`/api/location/users/by-constituency`, dropping `selectedConstituency`) → no route match → 404. The page is not registered in `App.tsx`, so no live impact; it also means the hardened `GET /users/by-constituency/:constituency` (geographic/index.ts:211) has no live client caller at all.

**MINOR-5 — Admin bearer is verified twice per `requireAdminAccess` call.**
`requireAdminAccess` → `isAdmin` calls `getUserFromRequest(req)` (supabaseAuth.ts:209) because the guard path never populated `req.user`, so an admin JWT is validated against Supabase on every admin request (and the JWT is also run through `safeSecretEquals` first, logging a `warn` whenever `adminJobSecret` is configured). Correctness unaffected; extra round-trip + log noise.

---

## Bottom line

All numeric gates pass (tsc 2642 ≤ 2644; every per-file budget met; 7 files / 138 tests green), and the three wave-1 Criticals — client never sending the bearer — are genuinely fixed: every hardened endpoint's legit caller in the five Task-10 files now attaches the token, and the ideology owner's `user.id` matches the server's `req.user.id`. The remaining issues are **end-state drift, not new security holes**: two admin-only features (`/debates/workspace`, `/admin/shadow`) are still routed to non-admin/anonymous users and therefore render broken for them, and the location-save client still points at a non-existent path. No Critical findings.
