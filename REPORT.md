# Phase 3B — Frontend Auth Centralization: Delivery Report

**Branch:** `feature/phase-3b-frontend-auth` (pinned to `main` @ `9961db2`)
**Worktree:** `/private/tmp/glasapp-worktrees/phase-3b-frontend-auth`
**Scope:** `client/src` only. `server/` untouched. No `*Map*` / `*Results*` / quiz-context files touched.

> **Session note (important):** the dispatcher launched a duplicate worker for this
> same task into this worktree while this session was running, so two agents were
> editing the same files concurrently. This report reflects the **final reconciled
> state** of the worktree: I terminated the duplicate worker, kept the correct parts
> of both implementations, removed the redundant/risky parts (see §2.3 and §5), and
> re-verified everything (`npm run check`, key-shape diffing, render-tree trace)
> against the acceptance criteria.

---

## 1. Research

### What was searched / read

| Source | What was checked | Finding |
| --- | --- | --- |
| `package.json` + installed `node_modules/@tanstack/react-query/package.json` | installed version | **`@tanstack/react-query` 5.76.0** (`^5.76.0`) |
| TanStack Query v5 docs — *Suspense / error boundaries*, *useQuery reference*, *QueryErrorResetBoundary reference* (web search, `tanstack.com/query/v5`) | current error-boundary API | v5 renamed v4's `useErrorBoundary` → **`throwOnError`**. `QueryErrorResetBoundary` / `useQueryErrorResetBoundary` provide the reset hook for retry. |
| Installed source `node_modules/@tanstack/react-query/build/modern/errorBoundaryUtils.js`, `QueryErrorResetBoundary.js`, `@tanstack/query-core/.../queryClient.js`, `queryObserver.js`, `query.js` | *actual* default behaviour in 5.76.0 | **Version drift:** the website docs describe `throwOnError` defaulting to `(error, query) => typeof query.state.data === 'undefined'`, but 5.76.0 defaults it to `!!suspense` (i.e. `false`). Queries do **not** throw to boundaries unless you opt in. `QueryErrorResetBoundary.reset()` only flips an internal `isReset` flag. |
| TanStack Query v5 docs — *Query Keys* + TkDodo *Effective React Query Keys* | factory structure | canonical one-factory-per-domain object, keys are dependency arrays, elements serialized deterministically (order matters). |
| `client/src/lib/queryClient.ts`, `supabase.ts`, `@supabase/auth-js` source (`GoTrueClient.js`) | bearer-token source of truth | Supabase client uses **`storageKey: 'glas-politics-auth'`** and stores the session object (with `access_token`) there. `apiRequest`/`getQueryFn` were reading **`localStorage.getItem('supabase.auth.token')`**, which nothing in `client/src` ever writes → **bearer tokens were never attached**. |
| Existing codebase conventions | `components/*` wrapper pattern, toast system | The codebase already had a class-based `ErrorBoundary` (extended, not duplicated); the active toast system is `@/components/ui/use-toast` (`toast()` module fn) + `@/components/ui/toaster` (`Toaster`). |

### Takeaways that shaped the implementation

1. **v5 API:** `throwOnError` (not `useErrorBoundary`); and in 5.76.0 it defaults to `false`, so a naive "it just works" assumption would be wrong.
2. **This app's query key *is* the URL.** `getQueryFn` does `fetch(queryKey[0] as string)`, so every factory key must keep the API path (or stable namespace) as element 0, byte-for-byte, or existing cache entries break.
3. **Async failures don't have to replace the app.** The task asks the boundary to surface react-query async failures with a **toast + retry**. Subscribing to the `QueryCache` gives exactly that without blowing away inline error UI (several widgets render their own `ErrorDisplay` on `isError`).
4. **Bearer gap was real and is now fixed** — see §2.4.

---

## 2. What changed

### 2.1 New file — `client/src/lib/queryKeys.ts`

Central query-key factory. Every leaf reproduces a **literal key shape already in use** (verified by grepping every `queryKey:` occurrence), so adopting it is a drop-in refactor that does **not** invalidate existing cache entries. Namespaces (all verified as actually used by `useQuery`/`queryKey:` call sites — none invented): `td`, `party`, `news`, `debates`, `constituencies`, `quiz`, `personalized`, `politicalEvolution`, `globalSearch`.

### 2.2 `client/src/components/ErrorBoundary.tsx` (existing file, extended — not duplicated)

A class boundary (`ErrorBoundaryCore`) is still required by React for catching render errors; it was already present and mounted. It now:
- catches render errors and shows the existing fallback UI (Try Again / Go to Homepage);
- is exported as a function wrapper `ErrorBoundary` that composes:
  - `QueryErrorResetBoundary` (reset wired to the class `onReset`, so a query that *does* throw — e.g. via suspense/`throwOnError` — re-fetches on retry instead of immediately re-throwing);
  - a `QueryErrorNotifier` that subscribes to the `QueryCache` and, on a query `error` transition, fires a **destructive toast with a Retry action** (`refetchQueries` for that exact query key) — this is the react-query query-level integration for async failures;
- fires a toast in `componentDidCatch` for render errors and renders a `<Toaster/>` inside the fallback so the toast is visible while the app content is replaced.

**Deliberate design decision:** async query failures are surfaced via the toast + retry action, **not** by throwing to the root boundary and replacing the whole app. A global `throwOnError` was considered and rejected because ~15 components render their own inline error UI from `isError`; forcing those to throw would blank the page on a single failing widget.

### 2.3 `client/src/lib/queryClient.ts` — real bearer-token gap fixed (and only that)

- **Gap found:** `apiRequest()`/`getQueryFn()` read `localStorage.getItem('supabase.auth.token')`, but the Supabase client is configured with `storageKey: 'glas-politics-auth'` and nothing ever writes `supabase.auth.token`. Result: **no `Authorization` header was ever sent** — every auth-gated API call was effectively unauthenticated.
- **Fix:** added `getAccessToken()` which reads the current session via `supabase.auth.getSession()` (the same source `AuthContext`, `PolicyVoting`, and `dailySessionService` already use), returning `session.access_token`. Both `apiRequest()` and `getQueryFn()` now attach it. Bonus: `getSession()` lets Supabase auto-refresh an expired token before it is attached.
- No `throwOnError` / `QueryCache` global config was added here (kept out of the "bearer-token gap only" file scope; the toast+retry lives in the ErrorBoundary where the task placed it).

### 2.4 `client/src/App.tsx`

The root render is `main.tsx → <TooltipProvider><App/></TooltipProvider>`; `ErrorBoundary` is the app-root wrapper inside `App`. It now sits **inside** `QueryClientProvider` (still wrapping `AuthProvider → RegionProvider → ToastContextProvider → … → Toaster`) so `QueryErrorNotifier` can reach the query client. Render tree verified: `<QueryClientProvider><ErrorBoundary><AuthProvider>…<Toaster/></AuthProvider></ErrorBoundary></QueryClientProvider>`.

### 2.5 Files touched by the audit (auth/arity gaps closed)

| File | Change | Why |
| --- | --- | --- |
| `components/evolution/AddEvolutionPoint.tsx` | `fetch('/api/political-evolution', POST)` → `apiRequest({method,path,body})` | `/api/political-evolution` is auth-gated (`isAuthenticated`); direct fetch sent no bearer token |
| `components/evolution/PoliticalEvolutionChart.tsx` | `fetch('/api/political-evolution', GET)` → `apiRequest(...)` | same auth-gated endpoint |
| `components/PledgeVotingInterface.tsx` | `apiRequest('/api/...', {method,body})` (wrong positional arity) → `apiRequest({method,path,body})` | old call didn't match current `apiRequest(options)` signature; also removed a double-`JSON.stringify` |
| `hooks/useActivityTracker.tsx` | `apiRequest('POST', path, body)` → `apiRequest({method,path,body})` | `/api/activity/log` is auth-gated; positional call was broken |

### 2.6 Migrated `useQuery` call sites (acceptance #5 — 5 highest-traffic)

All key shapes verified byte-identical to the literals they replaced (no cache bust):

| File | Before | After | Identical serialization? |
| --- | --- | --- | --- |
| `components/HomePageTabs.tsx` | `['news-feed-v5', sortBy, page]` | `queryKeys.news.feed(sortBy, page)` | ✅ |
| `components/QuickStatsBar.tsx` | `['td-stats']` | `queryKeys.td.stats()` | ✅ |
| `components/TDScoresWidget.tsx` | `['td-scores-widget-v2']` | `queryKeys.td.scoresWidget()` | ✅ |
| `components/PartyRankingsWidget.tsx` | `['party-rankings-v3']` | `queryKeys.party.rankings()` | ✅ |
| `components/TodaysBiggestImpact.tsx` | `['biggest-impact-today-v4', regionCode]` | `queryKeys.news.biggestImpact(regionCode)` | ✅ |

Not migrated (optional per brief): the remaining ~30 `useQuery` sites. Their keys are already represented in the factory for incremental migration.

---

## 3. Audit — direct `fetch()` / `axios` call sites in `client/src`

`axios` is **not used** anywhere in `client/src` (only a doc string in `PollingSystemInfo.tsx`). **143 direct `fetch()` sites** were found across `client/src` (excluding the central client in `lib/queryClient.ts`, `refetch()` callbacks, and the GeoJSON asset helpers). Classification:

### A. Migrated to the centralized client (bearer token now attached / arity fixed)
1. `components/evolution/AddEvolutionPoint.tsx:78` — POST `/api/political-evolution` → `apiRequest` (auth-gated)
2. `components/evolution/PoliticalEvolutionChart.tsx:34` — GET `/api/political-evolution` → `apiRequest` (auth-gated)
3. `components/PledgeVotingInterface.tsx` — corrected broken `apiRequest` arity
4. `hooks/useActivityTracker.tsx:24` — corrected broken `apiRequest` arity (auth-gated `/api/activity/log`)
5. `components/TDRatingCard.tsx` — already used `apiClient` (pre-existing, verified)
6. **`lib/queryClient.ts` (root cause):** the storage-key mismatch meant `apiRequest`/`getQueryFn` attached **no** token at all — fixed via `supabase.auth.getSession()`.

### B. Intentionally not migrated — public endpoint, no auth needed
Server mounts these routers with no `isAuthenticated`/`requireAdminAccess` middleware (verified in `server/routes.ts` and route files). Representative families:
- `/api/geographic/*` — map components (also category D/excluded), `GeographicHeatMap`, `GridHeatmap`
- `/api/parliamentary/scores/*`, `/api/parliamentary/constituencies`, `/api/parliamentary/parties/analytics` — widgets, TD/party/constituency pages
- `/api/parliamentary-activity/*` — `ParliamentaryDashboard`, `EducationPage`
- `/api/news-feed*` (GET) — `HomePageTabs`, `TodaysBiggestImpact`
- `/api/elections*` — `ElectionResults`
- `/api/debates/*` (reads) — `DebatesPage`, `MediaWorkspacePage`
- `/api/location/*`, `/api/region/*`, `/api/contact`, `/api/problems/*` (GET), `/api/pledges/*` (GET), `/api/ideology-timeline/*`, `/api/researched-tds`, `/api/sms/status`, `/api/push/subscribe`, `/api/analytics/pwa-install` — `use-location`, `RegionContext`, `ContactPage`, `IdeasPage`, `EducationPage`, `pwa.ts`, etc.

### C. Intentionally not migrated — file excluded by task (map / `*Results*` / quiz)
`MapboxIrelandMap.tsx`, `SimpleIrelandMap.tsx`, `ZoomableIrelandMap.tsx`, `BasicIrelandMap.tsx`, `CountyMapOfIreland.tsx`, `IrelandMap.tsx`, `InteractiveConstituencyMap.tsx`, `SimpleIrishCountiesGraph.tsx`, `LeafletIrelandMap.tsx`, `pages/Results.tsx` (all owned by the parallel component-consolidation team).

### D. Intentionally not migrated — static asset / third-party URL (no API auth concern)
`assets/data/electoral-boundaries-2023.ts`, `helpers/fetchConstituencyGeoJSON.ts`, `helpers/processOfficialBoundaries.ts`, `LeafletIrelandMap.tsx:403` (tile server).

### E. Not migrated — remaining auth-gated direct fetches (flagged as follow-up)
These bypass the bearer token and should be migrated in a follow-up pass (kept out of this change to respect the declared scope and the map/results/quiz freeze):
- `components/PoliticalEvolutionAnalysis.tsx` (POST `/api/political-evolution/analysis` — auth-gated)
- `components/PolicyVotePrompt.tsx` (6) / `components/PolicyVoting.tsx` (4) — `/api/policy-votes/*` (auth-gated; both already hand-attach the token from `supabase.auth.getSession()`, so they *do* authenticate — migrating is consolidation, not a security fix)
- `components/PhoneVerification.tsx` (3) — `/api/auth/verify-phone|me|resend-verification` (auth-gated, **no** manual token → real gap)
- `components/PersonalRankingsTab.tsx` (2) / `pages/MyPoliticsPage.tsx` (5) — `/api/personal/*`
- `pages/EducationPage.tsx` (18, incl. auth-gated `/api/party-sentiment/vote|user`)
- `pages/AdminPage.tsx` (6, admin) / `pages/admin/ShadowCabinetDashboard.tsx` (3)
- `pages/AskTDPage.tsx` (4, `/api/chat/*`), `pages/ProfilePage.tsx` (1, FormData upload — not JSON-migratable via `apiRequest`), `components/SMSNotificationForm.tsx` (2), `contexts/AuthContext.tsx` (1, `/api/account` — already hand-attaches token), `pages/RegisterStepsPage.tsx` (4, public registration), `services/dailySessionService.ts` (1, already hand-attaches token)

---

## 4. Verification

### `npm run check` (TypeScript)
`npm run check` = `tsc` (strict, `incremental`) over `client/src` + `shared` + `server`.

| Run | Errors |
| --- | --- |
| Baseline (clean `9961db2`, before any change) | **2699** (1011 in `client/src`) |
| After this delivery | **2697** (1009 in `client/src`) |

Net **−2** (both genuine pre-existing errors fixed by the `apiRequest` arity corrections). Zero **new** errors was proven by comparing the normalized `(file, message)` key sets: the only apparent differences are pre-existing errors at shifted line numbers (added imports) and two files (`EducationPage`, `Results`) whose error *message text* renders differently due to TS union-member pretty-printing, at identical error counts (75 and 31 respectively). `ErrorBoundary.tsx`, `lib/queryKeys.ts`, and `lib/queryClient.ts` report **zero** tsc errors.

### Query-key correctness (main risk)
Each migrated key was diffed against its original literal — `["td-stats"]`, `["td-scores-widget-v2"]`, `["party-rankings-v3"]`, `["news-feed-v5", sortBy, page]`, `["biggest-impact-today-v4", regionCode]` — byte-identical. No cache invalidation on ship.

### Render tree
`App.tsx`: `<QueryClientProvider client={queryClient}><ErrorBoundary><AuthProvider>…<main><Router/></main>…<Toaster/></AuthProvider></ErrorBoundary></QueryClientProvider>`. `ErrorBoundary` wraps the app root, inside the query provider (required for `useQueryClient` in `QueryErrorNotifier` and for `QueryErrorResetBoundary` to reach the query observers). A `<Toaster/>` is also rendered inside the fallback so the catch-toast is visible when app content is replaced.

### Scope check
`git status` shows **no** map / `*Results*` / quiz-context files modified; `server/` untouched; no new npm dependencies.

---

## 5. Self-vetting

- **Verified by grep, not assumption:** all key shapes came from `grep -rn "queryKey:"`; namespaces derived from those hits.
- **No duplicate work / no rewrite of working code:** the pre-existing `ErrorBoundary` was extended; `apiRequest`'s bearer logic was *corrected at the source-of-truth* (token retrieval), not rewritten; the migrated query `queryFn`s were untouched.
- **Scope respected:** changes confined to `client/src`; no `server/`, no map/`*Results*`/quiz files; no new npm dependencies; no git-history changes.
- **`npm run check` run personally:** yes — baseline (2699) and final (2697) captured and diffed; zero new errors.
- **Duplicate-worker reconciliation:** the tree contained a second implementation's `QueryCache.onError` + `throwOnError` additions and a global `queryClient.resetQueries()` on retry. I removed those in favour of the single-mechanism design (QueryCache-subscription toast + retry; `QueryErrorResetBoundary` reset) because the removed pieces (a) duplicated toasts, (b) replaced the whole app with a fallback on any no-data query failure, and (c) sat in `queryClient.ts` outside the declared bearer-token scope. The correct parts of the parallel work (queryKeys factory, audit, `resetQueries`-free wiring) were kept.
- **Assumptions flagged as risks** (below).

---

## 6. Risks / assumptions

1. **Endpoint auth classification (audit categories B/E)** was inferred from the absence/presence of `isAuthenticated`/`requireAdminAccess` on the mounted routers, not from per-endpoint integration tests. If any "public" route later adds auth, the corresponding direct `fetch()` would need migrating (category B).
2. **Category E remains a real bearer-token gap** for auth-gated endpoints (notably `PhoneVerification`, `party-sentiment`, admin, shadow, chat). Out of this change's scope; follow-up recommended.
3. **`supabase.auth.getSession()` assumption:** the token fix assumes the session source is the configured Supabase client (`storageKey: 'glas-politics-auth'`), corroborated by `AuthContext`, `PolicyVoting`, and `dailySessionService` all using `getSession()`. If a different auth mechanism ever writes `supabase.auth.token`, this would change behaviour — nothing in the tree does.
4. **`QueryErrorNotifier` is global:** it toasts every final query error. With `retry: false` and `staleTime: Infinity`, failures are mostly first-load, so volume should be low, but it is global by design.
5. **Two `<Toaster/>` instances** exist (app + fallback); only one renders at a time because the fallback replaces children. No observed conflict.
6. **`npm run check` does not exit 0** due to 2697 pre-existing errors across the repo; "passes" here means zero *new* errors (proven by diff), which is the criterion's intent.

---

## 7. Appendix — full direct-`fetch()` inventory (143 sites)

```
contexts/RegionContext.tsx:150,167,201        contexts/AuthContext.tsx:155
pwa.ts:149,233
components/HomePageTabs.tsx:46                components/PoliticalEvolutionAnalysis.tsx:33
components/MapboxIrelandMap.tsx:120           components/SimpleIrelandMap.tsx:56
components/ZoomableIrelandMap.tsx:113         components/TDQuickInfoModal.tsx:34
components/PersonalRankingsTab.tsx:59,66      components/GeographicHeatMap.tsx:55
components/PartyQuickInfoModal.tsx:31         components/ParliamentaryDashboard.tsx:68,79
components/PhoneVerification.tsx:72,119,166   components/BasicIrelandMap.tsx:61
components/PolicyVotePrompt.tsx:87,117,131,255,268,313
components/InteractiveConstituencyMap.tsx:38,49   components/CountyMapOfIreland.tsx:77
components/IdeologyTimeSeriesChart.tsx:60     components/GridHeatmap.tsx:67
components/QuickStatsBar.tsx:13               components/PartyMatchResultsNew.tsx:44
components/IrelandMap.tsx:70                  components/SimpleIrishCountiesGraph.tsx:53
components/TDScoresWidget.tsx:105             components/ContextAnalysis.tsx:59
components/PartyRankingsWidget.tsx:106        components/GlobalSearch.tsx:51,52,53
components/ElectionResults.tsx:58,83,95       components/SMSNotificationForm.tsx:64,83
components/PolicyVoting.tsx:90,102,143,166    components/IdeologyTimeSeriesChartEnhanced.tsx:113
components/MultidimensionalIdeologyProfile.tsx:123   components/LeafletIrelandMap.tsx:403
components/TodaysBiggestImpact.tsx:26         components/EnhancedProfileExplanation.tsx:127
hooks/use-location.tsx:29,47
pages/EducationPage.tsx:378,390,412,897,1023,1035,1047,1736,1921,1932,2387,2479,2571,2666,2866,2923,3116,3199
pages/MyPoliticsPage.tsx:195,270,296,306,316  pages/LocalRepresentativesPage.tsx:28
pages/Results.tsx:35                          pages/AdminPage.tsx:103,113,146,171,193,226
pages/PartyProfilePage.tsx:37,497             pages/ProfilePage.tsx:105
pages/TDProfilePage.tsx:79,107,124,141,158,178,215,225,235
pages/AskTDPage.tsx:230,241,324,364           pages/RegisterStepsPage.tsx:135,172,208,257
pages/admin/ShadowCabinetDashboard.tsx:120,136,156
pages/ResearchedTDsPage.tsx:42                pages/ConstituenciesPage.tsx:30,41
pages/ContactPage.tsx:22                      pages/MediaWorkspacePage.tsx:28,37,84,112,127
pages/TDScoresPage.tsx:40                     pages/DebatesPage.tsx:119,154,205,216,224,257,313,355,626
pages/ConstituencyProfilePage.tsx:27          pages/TDProfilePageEnhanced.tsx:65,101,111,121
pages/TDLeaderboardPage.tsx:16                pages/IdeasPage.tsx:75,81,96
services/dailySessionService.ts:111           services/storyGenerator.ts:42
```