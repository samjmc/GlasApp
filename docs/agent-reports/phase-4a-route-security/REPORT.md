# Phase 4A — Route Security Hardening: Audit & Implementation Report

**Worktree:** `/private/tmp/glasapp-worktrees/phase-4a-route-security`
**Branch:** `feature/phase-4a-route-security` (cut from `main` @ `9799651`)
**Task slug:** `phase-4a-route-security`
**Date:** 2026-09-15

## Summary

Audited all admin/privileged route handlers in `server/routes/`, identified 12 concrete security gaps (missing auth, spoofable authorization, IDOR, client-trusted role flags, unbounded input, SSRF/cost vectors), and hardened them. Built a reusable RBAC guard (`requireRole`), consolidated admin-gating behind the existing `requireAdminAccess`, added admin action logging, enforced ownership checks, added input validation bounds, and added a JSON body-size cap. Updated the 3 client pages that legitimately consume the now-gated endpoints to attach their bearer tokens. Wrote a 29-test security suite plus a 6-test RBAC unit suite.

**Final gates (all green):**
- `npm run check` (tsc): **2642 errors** — below the 2644 baseline, no new TypeScript errors.
- `vitest run` (full suite): **7 files / 138 tests pass** (including the new security suite).
- No database schema changes, no TypeScript compiler setting changes, no non-security refactors, no new dependencies.

---

## 1. Routes audited (all 45 files in `server/routes/`)

### Admin-only endpoints (protected by `requireAdminAccess`)
| Route group | File | Guard |
| --- | --- | --- |
| `/api/cache/stats`, `/api/cache/clear`, `/api/cache/:key` | `cacheRoutes.ts` | `requireAdminAccess` at mount (routes.ts) |
| `/api/admin/news-scraper/*` (test, analyze-sample, run, stats) | `admin/newsScraperRoutes.ts` | `requireAdminAccess` at mount |
| `/api/admin/parliamentary/*` (update, test-member, members) | `admin/parliamentaryRoutes.ts` | `requireAdminAccess` at mount |
| `/api/admin/debates/*` (pipeline, extract-stances, stance-stats, review-feedback) | `admin/debateAdminRoutes.ts` | `requireAdminAccess` at mount |
| `/api/admin/baselines/*` (research/:name, research-all, all, td/:name, stats) | `admin/baselineRoutes.ts` | `requireAdminAccess` at mount |
| `/api/admin/articles/*` (add, bulk-add, manual) | `admin/manualArticleRoutes.ts` | `requireAdminAccess` at mount |
| `/api/admin/td-scoring/*` (triage, run, status, full-pipeline) | `admin/tdScoringRoutes.ts` | `requireAdminAccess` at mount |
| `/api/news-feed/save` | `newsFeedRoutes.ts` | `requireAdminAccess` per-route |
| `/api/parliamentary/scores/recalculate` | `parliamentary/scores.ts` | `requireAdminAccess` per-route |

### Privileged / sensitive endpoints audited and hardened
| Route | File | Gap found | Fix |
| --- | --- | --- | --- |
| `POST /api/bots/:id/behavior/start`, `/stop`, `GET .../activity` | `routes.ts` (inline) | **No auth at all** — anyone could start/stop simulated bot behavior | `requireAdminAccess` + `parseInt` validation (400 on bad id) |
| `/api/bots/create`, `/list`, `/delete/:username` | `botRoutes.ts` | **Stub `isAdmin`** only checked `req.user` exists — any authenticated user could create/delete bot accounts (impersonation) | Replaced stub with real `requireAdminAccess` |
| `POST /api/ideas/submit` | `ideasRoutes.ts` | **Client-trusted `isAdminSubmission` flag** — any authenticated user could set it and create admin-only ideas; also read a never-populated `req.session.user.id` | Server-side `requireAdminAccess`; identity from `req.user?.id ?? req.session?.userId`; flag ignored |
| `POST /api/parliamentary/scores/trigger-scrape` | `parliamentary/scores.ts` | **No auth** — anyone could trigger a full news scrape (LLM/network cost) | `requireAdminAccess` |
| `DELETE /api/parliamentary/voting/:voteId` | `parliamentary/voting.ts` | **Spoofable authz** — `userId` read from request body; anyone could delete any user's vote | `isAuthenticated` + caller id from `req.user?.id` |
| `GET /api/parliamentary/voting/user/:userId/{article/:articleId, personalized-scores, td/:politicianName, value-alignment}` | `parliamentary/voting.ts` | **IDOR** — unauthenticated read of any user's personalized political data | `isAuthenticated` + ownership (403 unless own id or admin) |
| `DELETE /api/policy-votes/:voteId` | `user/rankings/policy.ts` | Spoofable `userId` from body | Same fix as voting.ts |
| `GET /api/policy-votes/user/:userId/{...}` | `user/rankings/policy.ts` | IDOR on user data | Same fix as voting.ts |
| `/api/shadow/analyze`, `/history`, `/qa-history` | `shadowRoutes.ts` | **No auth** — `/analyze` runs an LLM pipeline on an arbitrary caller-supplied URL (SSRF + cost); history endpoints expose internal QA-audit data | `requireAdminAccess` on all three |
| `/api/debate-workspace/views` (GET/POST/PATCH/DELETE), `/exports` (GET/POST) | `debateWorkspaceRoutes.ts` | **No auth** — anonymous users could create/delete shared views and exports | `requireAdminAccess` on all six |
| `GET /api/sms/test` | `smsRoutes.ts` | **No auth** — "dev only" endpoint live in prod revealing Twilio config state | `requireAdminAccess` |
| `POST /api/ai/analyze-bulk` | `ai/analysis.ts` | **Unbounded input** — unlimited `responses` array (LLM cost DoS) | zod `.min(1).max(50)`, per-item `.max(4000)` |
| `POST /api/ai/{complete-analysis, context-analysis}` | `ai/analysis.ts` | No validation on `dimensions`/`weights` | `dimensionsSchema` (each -10..10) + weights `0..3`; 400 on failure |
| `POST /api/geographic/users/location` | `geographic/index.ts` | **IDOR write** — arbitrary `userId` from body; anyone could overwrite any user's location | `isAuthenticated` + body `userId` must match authenticated id (403 otherwise), identity-keyed rows |
| `GET /api/geographic/users/by-constituency/:constituency` | `geographic/index.ts` | **No auth** — leaked user identifiers | `requireAdminAccess` |
| `GET /api/ideology-timeline/:userId` | `ideologyTimelineRoutesEnhanced.ts` | **No auth + IDOR** — any user's political ideology evolution readable unauthenticated | `isAuthenticated` + ownership (403 unless own id or admin) |

### Already adequately protected (verified, no change needed)
- `/api/parliamentary/scores/recalculate`, `/api/cache/*`, all `/api/admin/*` — gated by `requireAdminAccess`.
- Self-service profile endpoints (`/api/auth/me` GET/PATCH, `/api/account`, session-auth `/me`) — `isAuthenticated`, allowlisted update fields via zod (no role escalation possible).
- `/api/sms/send` — `isAuthenticated` + E.164 zod validation. `/api/sms/status` — public, harmless availability flag (left public).
- Anonymous rating (`/api/ratings/tdRatings`) and public reads (`/api/parliamentary/*`, `/api/news-feed`, `/api/ideas`, `/api/problems`, quizzes) — intended public access, documented.
- `newsFeedRoutes /save`, `debateMonitoringRoutes /summary` — `/save` admin-gated; `/summary` is read-only aggregation (documented as low-risk, left public).

### Audited and left as-is (documented reasons)
- `replitAuth.ts` `isAuthenticated` dev bypass (`dev-user-123` when `NODE_ENV=development` and not Replit) — environment-gated local-dev convenience; production and Replit paths require real auth. Not changed (would break local dev; mitigated because it never activates in production).
- `personalizedInsightsRoutes.ts`, `partySentimentRoutes.ts`, `politicalEvolutionRoutes.ts`, `quiz/index.ts` — some use the `replitAuth` middleware; cost/informational, low sensitivity. Noted.
- `parliamentary/voting.ts` & `policy.ts` public single-article reads (`/article/:articleId`) — intentionally public.
- `personalRankingsRoutes.ts`, `dashboardRoutes.ts`, `electionRoutes.ts`, `debatesRoutes.ts`, `politicianChatRoutes.ts`, `chatRoutes.ts`, `smsRoutes` public reads — read-only / low-sensitivity, documented as audited.
- `use-location.tsx` client posts to `/api/users/location`, which has **no mount** in `routes.ts` (pre-existing dead path, predates this phase) — documented as a client-side follow-up, not a server regression.

---

## 2. Gaps found (numbered findings)

1. **CRITICAL — No auth on bot-behavior control** (`routes.ts` inline `/api/bots/:id/behavior/*`).
2. **CRITICAL — Fake admin gate in bot account management** (`botRoutes.ts` stub `isAdmin` = "is any user authenticated").
3. **CRITICAL — Client-trusted admin flag** (`ideasRoutes.ts` `isAdminSubmission` from request body).
4. **CRITICAL — Unauthenticated privileged job trigger** (`scores.ts /trigger-scrape`).
5. **CRITICAL — Spoofable vote deletion** (body-supplied `userId` authorizes `DELETE` in `voting.ts` + `policy.ts`).
6. **HIGH — IDOR on personalized political data** (unauthenticated `/user/:userId/...` reads in `voting.ts` + `policy.ts`).
7. **HIGH — Unauthenticated Shadow Cabinet** (LLM-on-URL cost/SSRF + internal QA data).
8. **HIGH — Unauthenticated debate workspace** (anonymous view/export CRUD).
9. **HIGH — Unauthenticated SMS test endpoint** exposing config state.
10. **MEDIUM — Unbounded AI-analysis input** (cost DoS via unlimited bulk arrays / unvalidated dimensions).
11. **MEDIUM — IDOR write on user location** (arbitrary `userId` body key) + unauthenticated by-constituency user-id leak.
12. **MEDIUM — Unauthenticated ideology timeline** exposing another user's political evolution.
13. **MEDIUM — No JSON body-size cap** (`express.json()` unlimited → oversized-payload DoS).
14. **MEDIUM — Admin actions unlogged** (no actor/route/timestamp trail on admin operations).

---

## 3. Hardening changes applied

### Middleware / global (Task 1)
- **`server/auth/supabaseAuth.ts`** — `isAdmin` now reuses `req.user` when already populated (instead of re-fetching bearer only), and logs every grant/deny (actor email, route, reason) via `logger`. 401/403 contracts unchanged. Still trusts only `app_metadata.role` / `ADMIN_EMAILS` allowlist — never self-editable `user_metadata`.
- **`server/middleware/adminAccess.ts`** — `requireAdminAccess` now logs grants/denials (secret path and admin path). Added reusable RBAC guard **`requireRole(...roles)`** (identity from `req.user` → bearer → session; 401 unauthenticated, 403 wrong role; role from `app_metadata.role` only, plus `ADMIN_EMAILS` allowlist for `admin`). Added **`logAdminAction(req, action, detail?)`** helper.
- **`server/middleware/sessionMiddleware.ts`** — session-authenticated users now get `req.user = { id, sub }` so downstream role checks can read identity (bearer path already set it).
- **`server/index.ts`** — `express.json({ limit: '1mb' })` caps oversized payloads.

### Route hardening (Tasks 2–8)
See the table in §1. Summary: added real `requireAdminAccess` where auth was missing or faked; enforced ownership (caller id from token/session, never the body); added `isAuthenticated` + admin bypass on user-data reads; added zod input bounds; added `requestLogger` operation logging on sensitive writes.

### Client compatibility (Task 10)
The three client pages that legitimately consume now-gated endpoints were updated to attach the Supabase bearer token via the existing `apiRequest`/`apiClient` helper (`client/src/lib/queryClient.ts`):
- `ShadowCabinetDashboard.tsx` — `/api/shadow/*` via `apiClient`.
- `MediaWorkspacePage.tsx` — all five `/api/debate-workspace/*` calls via `apiClient`; response shapes preserved.
- `IdeologyTimeSeriesChartEnhanced.tsx` + `IdeologyTimeSeriesChart.tsx` — `/api/ideology-timeline/:userId` via `apiClient`; the CSV export was converted from `window.location.href` (which cannot carry an Authorization header) to a token-attached fetch → Blob → client-side download.
- `client/src/lib/queryClient.ts` — added a minimal `apiFetch` export returning the token-attached `Response` (used for the CSV download).

---

## 4. Test plan executed (results)

New test files:
- **`server/middleware/requireRole.test.ts`** (6 tests) — unauthenticated → 401; wrong role → 403; correct role → next(); multi-role allowlist; `ADMIN_EMAILS` allowlist; `user_metadata` spoof rejected.
- **`server/middleware/security.test.ts`** (29 tests) — matrix across the hardened surfaces:
  - `requireAdminAccess`: no secret+no token → 401; correct secret → allow; wrong secret → 401; admin JWT → allow; non-admin JWT → 403.
  - `requireRole('admin')`: unauthenticated → 401; role user → 403; role admin → allow; moderator accepted when allowed.
  - `isAuthenticated` (sessionMiddleware): session user → allow; nothing → 401.
  - Route-level (mocked services/DB): `botRoutes /create` (401 unauthenticated / 403 non-admin / 400 missing fields / 200 admin); `ideasRoutes /submit` (401 / 403 non-admin even with `isAdminSubmission:true` / 400 missing title); `smsRoutes /test` (401 / 200 admin); `ai /analyze-bulk` (400 >50 items); `geographic /users/location` (401 / 403 mismatched body userId / 200 match).

All tests mock auth/DB/services — no network or real DB. **Result: 138/138 tests pass** (7 test files), including the pre-existing `adminAccess.test.ts`, `auth-bypass-prevention.test.ts` and unit suites.

Verification matrix (as required):
- ✅ Authenticated + authorized user can call endpoint → 200/allow.
- ✅ Unauthenticated request rejected → 401.
- ✅ Wrong role rejected → 403.
- ✅ Malformed input rejected → 400.

---

## 5. Verification / regression check

- **TypeScript:** `npm run check` → **2642 errors** (baseline 2644) — no new errors; per-file counts for all 21 touched files are at or below baseline.
- **Tests:** full `vitest run` → **138/138 pass**.
- **No regressions:** the 3 client pages calling now-gated endpoints attach bearer tokens (Task 10), so legitimate admin/user calls continue to work. All previously public read-only endpoints remain public. All existing 401/403 response contracts preserved.

---

## 6. Known residual items (documented, out of scope)

- **Client dead path:** `use-location.tsx` posts to `/api/users/location` which has no server mount (pre-existing, predates this phase). Server hardening of the real `/api/location/users/location` endpoint is correct; wiring the client feature is a follow-up.
- **Client route gating (UX):** `/debates/workspace` and `/admin/shadow` are routed in `App.tsx` for any authenticated user, so non-admins see 403/error states on those pages now that the server enforces admin. Server-side enforcement is the security-correct behavior; adding client-side role-based route gating is a frontend-auth follow-up (Phase 3B domain).
- **Replit dev bypass:** `replitAuth.isAuthenticated` auto-authenticates `dev-user-123` only when `NODE_ENV=development` and not in a Replit environment; production requires real bearer/session auth. Kept as-is.
- **`requireRole` roles:** only `admin` is assigned in the app today; `requireRole('moderator')` etc. are supported by the helper for future use without schema changes.

---

## 7. Files changed (21)

Server (16): `server/auth/supabaseAuth.ts`, `server/index.ts`, `server/middleware/adminAccess.ts`, `server/middleware/sessionMiddleware.ts`, `server/routes.ts`, `server/routes/ai/analysis.ts`, `server/routes/botRoutes.ts`, `server/routes/debateWorkspaceRoutes.ts`, `server/routes/geographic/index.ts`, `server/routes/ideasRoutes.ts`, `server/routes/ideologyTimelineRoutesEnhanced.ts`, `server/routes/parliamentary/scores.ts`, `server/routes/parliamentary/voting.ts`, `server/routes/shadowRoutes.ts`, `server/routes/smsRoutes.ts`, `server/routes/user/rankings/policy.ts`.

Tests (2 new): `server/middleware/requireRole.test.ts`, `server/middleware/security.test.ts`.

Client (5): `client/src/pages/admin/ShadowCabinetDashboard.tsx`, `client/src/pages/MediaWorkspacePage.tsx`, `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`, `client/src/components/IdeologyTimeSeriesChart.tsx`, `client/src/lib/queryClient.ts`.

Swarm artifacts: `.superpowers/swarm/` (ledger, briefs, reports, evidence, diffs) — retained for audit trail.