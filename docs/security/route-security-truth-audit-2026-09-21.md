# Route security truth audit — 2026-09-21

**Scope:** every Express route in `server/`, the four auth guards, the RLS migrations, and the
claims made by the Phase 4A (route security) and Phase 4B (RLS) agent reports.
**Method:** static inventory (`scripts/audit/route-inventory.mjs`, committed) plus a read of
every mutating handler it flagged. Numbers below are from running that script on `main` at
`e5af558`, then re-checked after the fixes on this branch.
**Branch:** `audit/route-security-truth`.

Regenerate the inventory at any time:

```bash
node scripts/audit/route-inventory.mjs --md /tmp/routes.md --json /tmp/routes.json
```

---

## 1. Headline

| Measure | On `main` (before) | On this branch |
|---|---|---|
| Routes (counting each legacy mount prefix separately) | 753 | 753 |
| Mutating routes (POST/PUT/PATCH/DELETE) | 215 | 215 |
| **Unique mutating handlers with no auth guard** | **38** | 30 (see §3 for why the rest are intentional or dead) |
| Handlers that wrote data with no guard and were reachable | 3 surfaces, 8 endpoints | **0** |
| LLM-backed endpoints reachable anonymously with no rate limit | 12 | 0 (limited, still public) |
| Tests | 138 | 163 |
| `tsc` errors | 774 | 771 |

The Phase 4A report said all admin and privileged handlers had been audited and left "read-only
/ low-sensitivity" routes public. Three of those "read-only" files contained unguarded writes,
and the report's own "already adequately protected" list included pledge CRUD that had no guard at
all. The Phase 4B RLS migration was never applied anywhere; the report says so, but the roadmap
tracking does not.

---

## 2. Findings

Severity is for the code as written. Whether any of it is *exploitable today* depends on §4.

### Fixed on this branch

| # | Sev | Finding | Where | Fix |
|---|---|---|---|---|
| F1 | HIGH | Pledge CRUD had no guard: anyone could create, edit, delete pledges and pledge actions, and trigger score recalculation. Reachable under 7 legacy prefixes (`/api/pledges`, `/api/parties`, `/api/party-dimensions`, …). Phase 4A listed these as protected. | `server/routes/political/pledges.ts` (6 routes) | `requireAdminAccess` on all six. `AdminPage.tsx` switched to token-attached `apiClient`. |
| F2 | HIGH | Party dimension explanations (public-facing content) writable by anyone via the service-role client. | `server/routes/political/parties.ts` `POST /explanations/:partyId` | `requireAdminAccess`. No client caller. |
| F3 | MEDIUM | Debate alert status writable by anyone. `debate_alerts` has no owner column, so one user "resolving" an alert hides it for everyone. Two user-facing pages exposed the button. | `server/routes/debatesRoutes.ts` `POST /alerts/:alertId/status` | `requireAdminAccess`. `DebatesPage.tsx` and `TDProfilePage.tsx` switched to `apiClient` so admins keep working; non-admins now get 403 where they previously silently mutated global state. |
| F4 | HIGH | Twelve LLM-calling endpoints accept anonymous requests with **no rate limiting anywhere in the codebase** (only `helmet` is present). Phase 4A capped input size but left the call volume open. Cost DoS against the OpenAI/Anthropic keys. | `/api/ai/*`, `/api/chat`, `/api/chat/politician`, `/api/enhanced-profile/*`, `/api/personalized-insights`, `/api/constituency/story/:name` | New `server/middleware/rateLimit.ts` (in-process, per-IP, 30 writes / 15 min). Mounted in `routes.ts`. Endpoints stay public. |
| F5 | MEDIUM | Anonymous TD ratings generate a fresh random `user_id` per request, so one client can stuff the public rating aggregates without limit. | `server/routes/ratings/tdRatings.ts` | Same limiter, 60 / 15 min. Anonymous rating itself is a product decision and is kept. |
| F6 | MEDIUM | `POST /api/quiz-results` trusted a `userId` from the request body and passed it to `ActivityTracker.logQuizCompletion`. Any caller could write activity attributed to any legacy account. | `server/routes.ts` | Identity now comes from `req.session.userId` only; body field dropped. (The underlying `storage.saveQuizResult` is a stub, see F13.) |
| F7 | MEDIUM | `SESSION_SECRET` falls back to a string literal in production. Roadmap item 4A "fix session secret validation" was never implemented. | `server/middleware/sessionMiddleware.ts` | Throws at startup when `NODE_ENV=production` and the variable is unset. (`replitAuth.getSession` has the same fallback but is never called; see F11.) |
| F8 | LOW | Dead consolidated auth router with a fake login: `bcrypt.compare(password, '')` then `session.userId = 1`. Never mounted, but Phase 2A reported it as the completed auth consolidation. | `server/routes/session-auth/index.ts` | Deleted. `authRoutes.ts` is the live one. |

### Open — structural, need a decision not a patch

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F9 | HIGH | **RLS protects nothing on the server path.** The Drizzle pool is hard-coded to `null` in `server/db.ts`; every query goes through `supabaseDb`, the service-role client, which bypasses RLS. All authorization is therefore code-level, per handler. The Phase 4B migration only matters for the 14 direct browser queries (§2.1). | `server/db.ts:24`, `git grep supabaseDb -- server` |
| F10 | HIGH | **Three different `isAuthenticated` functions with three identity shapes.** `auth/supabaseAuth.ts` (bearer → `req.user` = Supabase user, UUID id), `middleware/sessionMiddleware.ts` (session or bearer → `req.user = {id: number}`), `replitAuth.ts` (dev bypass / bearer / Replit OIDC → `req.user.claims.sub`). 104 routes use the first, 19 the second, 28 the third. Handlers then read `req.user.id`, `req.user.claims.sub` or `req.session.userId` inconsistently. | inventory "guard flavours" section |
| F11 | HIGH | **The frontend never uses session login.** Zero client calls to `/api/auth/login`; all auth is Supabase bearer via `queryClient.ts`. So `req.session.userId` is never set for a real user. Every handler that authorizes on it is either dead (always 401) or, when guarded by `sessionMiddleware.isAuthenticated`'s bearer fallback, runs with `userId = undefined`. Affected: quiz save (`quiz/index.ts:64`), category rankings (`user/rankings/category.ts:20`), profile PATCH and image upload (`authRoutes.ts:690, 884`), political evolution (`politicalEvolutionRoutes.ts:77,112`), user location (`geographic/index.ts:145`), ideas/problems votes (which read `req.session.user.id`, a key nothing ever sets). These are **broken features**, not leaks, but they are also where the next IDOR will come from when someone "fixes" them by reading the id from the body. | `git grep -n "/api/auth/login" -- client/src` returns nothing |
| F12 | MEDIUM | `replitAuth.isAuthenticated` grants `dev-user-123` to **every caller** when `NODE_ENV=development` and `REPLIT_DOMAINS` is unset. The Replit workspace runs `npm run dev` (development) and its `.replit.dev` URL is reachable while it is open. The deployment target runs `npm run start` (production), so production is safe; the workspace is not. Five route files use this guard. | `server/replitAuth.ts:220`, `.replit` |
| F13 | MEDIUM | **22 files import the null Drizzle `db`** and will throw on first use. `storage.saveQuizResult` and `getQuizResultByShareCode` are stubs that log and return. Quiz result sharing, ideas/problems voting, pledge CRUD (even for admins), election routes and more cannot work against a real database today. Some of the "unguarded writes" above were only harmless because they crash. | `git grep -l "from '../db'" -- server`, `server/storage.ts:98-108` |
| F14 | MEDIUM | `accountRoutes.ts` (GDPR account deletion) is imported but **never mounted**; `/api/account` is mounted to `authRoutes` instead. | `server/routes.ts:33,146` |
| F15 | LOW | `POST /api/ideas/vote`, `/api/problems/vote/*` and `ideasRoutes /submit` read `req.session.user.id`. Nothing sets `session.user`. Phase 4A noticed this for `/submit` and changed only that route. | `ideasRoutes.ts:62`, `problemsRoutes.ts:91,173` |

### 2.1 Direct browser → Supabase queries (the only place RLS applies)

14 call sites use the anon-key client from the browser. They read `latest_party_polls`,
`parties`, `polling_aggregates_cache`, `polling_time_series`, `user_quiz_results`, and
**`AdminPollingEntry.tsx` writes `polls` and `poll_party_results` from the browser**. With the
Phase 4B migration applied those two tables get a `public_read` policy only, so the admin polling
page would break. Without it (current state, see §4) anyone holding the anon key — which ships in
the bundle — can write polls if RLS is not enabled on those tables. This cannot be verified
without access to the live database.

---

## 3. The 30 remaining unguarded mutating handlers, classified

- **Auth flow, must be public (16):** login, logout, register, verify-* under `/api/auth` and `/api/account` (same router, two mounts).
- **Public by product design, now rate-limited (13):** the LLM endpoints in F4 and ratings in F5, plus `POST /api/region/select` (session preference, `optionalAuth`).
- **Dead for real users (F11), no leak (1):** `POST /api/multidimensional-quiz-results` reads identity from `req.user?.claims?.sub || req.session?.userId`; with no guard both are undefined so it stores nothing user-bound.

---

## 4. Is any of this live? Unknown — and that is the biggest open question

The Phase 4B report (2026-09-15) found the app's production Supabase project
`ospxqnxlotakujloltqy`, hard-coded as the fallback in `client/src/lib/supabase.ts`, **deleted**,
and the only reachable project in the account hosting a different product's schema. The repo has
no `.env`, no CI, and deploys from Replit. If no replacement project exists the app is not serving
users and every finding above is latent. If one exists, F1–F5 were exploitable until this branch
merges and §2.1 needs checking against it.

**Action needed from the owner:** confirm which Supabase project (if any) the Replit deployment
points at, and whether the deployment is running.

---

## 5. What the earlier reports got wrong, briefly

- **Phase 4A** audited admin routers by *mount* and trusted file names. It listed pledge CRUD
  under "already adequately protected" and called `debatesRoutes.ts` "public reads". It also
  described `POST /api/ratings/submit` as intended anonymous access without noting the missing
  rate limit.
- **Phase 4B** is a good migration that has never run. Its report is honest about that; the
  roadmap tracking (`PHASE_PROGRESS.md`) still says Phase 4 is "BLOCKED, not started", and the
  auto-land merge commit says it shipped.
- **Phase 2A** reported the auth-route consolidation complete. The consolidated file was never
  mounted and contained a stub login. It is now deleted.

---

## 6. Verification

```
npx vitest run --root .     # 8 files, 163 tests pass (was 7 / 138)
npx tsc --noEmit            # 771 errors (was 774); 0 in every touched file
node scripts/audit/route-inventory.mjs   # unguarded-write surfaces: 0
```

The new tests (`server/middleware/route-guards.test.ts`) prove each guarded endpoint returns
401 without credentials and passes the guard with the admin job secret, prove the limiter
returns 429 with `Retry-After` and ignores GET, prove the production `SESSION_SECRET` check
throws, and pin the guard insertions with structural assertions so a merge cannot silently drop
them.

---

## 7. Recommended next steps (not done here)

1. Answer §4. Everything else is prioritised by that answer.
2. Pick one identity model (F10, F11). Supabase bearer is the one the frontend uses; retire
   `sessionMiddleware.isAuthenticated` and `replitAuth.isAuthenticated` and make every handler read
   `req.user.id`. This is the single change that removes the whole class of F6/F15 bugs.
3. Either re-enable the Drizzle pool or delete the 22 Drizzle call sites (F13). Half the product
   is currently unreachable code.
4. Decide whether `AdminPollingEntry.tsx` should write through the server (then apply Phase 4B as
   written) or keep writing from the browser (then add admin INSERT policies to `polls` and
   `poll_party_results` before applying it).
5. Mount `accountRoutes` (F14) or fold deletion into `authRoutes` and delete the file.
