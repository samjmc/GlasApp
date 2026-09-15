# Task 9 Review — Security test suite (wave 2)

Reviewer: task reviewer (independent of author; gates already verified separately).
Artifact under review: `server/middleware/security.test.ts` (new, 646 lines, 29 tests).
Spec: `.superpowers/swarm/briefs/task-9-brief.md`. Report: `.superpowers/swarm/reports/task-9-report.md`.

## Verdict

- **SPEC: PASS** — the brief's full test matrix is present and behaviorally correct; no required case missing.
- **QUALITY: APPROVED** — no Critical/Important findings. Deterministic, no network/DB, assertions exercise the real guards.
- Counts: **Critical 0 / Important 0 / Minor 5**

---

## 1. Spec compliance

Test count = 29, matching the report. Matrix vs brief:

| Brief line | Required case | Test (line) | Status |
|---|---|---|---|
| 9 | `requireAdminAccess` no secret + no token → 401 | 234 | ✅ |
| 9 | `requireAdminAccess` 403 path | 275 | ✅ |
| 10 | correct `x-admin-secret` → next() | 221 | ✅ |
| 11 | wrong secret → 401/403 | 248 (401) | ✅ |
| 12 | valid bearer JWT admin → next() | 261 | ✅ |
| 13 | valid bearer JWT non-admin → 403 | 275 | ✅ |
| 14 | `requireRole('admin')` + moderator variant | 292–370 | ✅ |
| 15 | `isAuthenticated` session userId → next(); neither → 401 | 374, 388 | ✅ |
| 17 | bot `/create`: 201 / 401 / 403 / 400 | 426/439/450/462 | ✅ |
| 18 | ideas `/submit`: success / 401 / 403 (`isAdminSubmission:true`) / 400 | 484/502/513/525 | ✅ |
| 19 | sms `/test`: 401 / 200 | 545/552 | ✅ |
| 20 | ai `/analyze-bulk`: 51 → 400 / 1 → 200 | 572/584 | ✅ |
| 21 | geographic `/users/location`: mismatch → 403 / no auth → 401 / match → 200 | 608/620/631 | ✅ |
| 22 | mock boundary | see §3 | ✅ (documented deviation) |

Route mount prefixes match the real app (`server/routes.ts:79,82,123,65,77`: `/api/bots`, `/api/sms`, `/api/ideas`, `/api/ai`, `/api/location`), so the route-level tests are representative of production wiring. The brief's "nothing extra" is satisfied: the only additions beyond the literal bullet list are (a) `requireRole` ADMIN_EMAILS + bearer-identity cases (line 344/358) and (b) `isAuthenticated` valid-bearer (line 402). The brief opens with "Cover **at minimum**" (line 7), so these are in-scope and additive.

No DB-schema, tsconfig, dependency, or non-test-file changes are attributable to this task. `tsconfig.json:3` excludes `**/*.test.ts`, so the file is correctly outside `tsc`; `git status` shows `security.test.ts` as the only new untracked artifact for this task (route/middleware modifications belong to wave 1). No commit was made.

## 2. Code quality

**Determinism.** Env is set before the dynamic imports (lines 9–14) and `ADMIN_EMAILS` is restored in `afterEach` (216). `authState` and `dbState` are reset in `beforeEach` (206–212). No sleeps, no timers, no `Date`/random dependence in assertions. Vitest file-level isolation contains the module-top env writes. No flakiness risk observed.

**No real network/DB.** `../db` is a chainable fake (51–57); `botService`/`twilioService`/`aiService`/`openaiService`/`cacheService` are `vi.mock`ed (59–110). Identity is controlled by stubbing `supabase.auth.getUser` (179–186), the exact call inside the real `getUserFromRequest` (`server/auth/supabaseAuth.ts:124`), so the real middleware logic runs without an outbound Supabase call. Route-level tests bind an ephemeral loopback server on `127.0.0.1:0` and use `connection: close` + `closeAllConnections()` in teardown (188–204) — loopback only, explicitly permitted by the brief.

**Assertions exercise the guard (no tautologies).** Every negative test asserts a status that only occurs if the guard runs: removing the secret comparison, the role check, `isAdmin`, or `isAuthenticated` would flip 401/403/400 tests to `next()`/200 and fail them. Positive tests assert both `calledNext === true` **and** `statusCode === undefined` (no response written). Two tests assert server-derived identity rather than trusting the client: ideas `insertValues.userId === 'admin-id'` (498) and geographic `insertValues.firebaseUid === 'user-42'` (643). The ideas 403 case (513) is particularly good — it sends `isAdminSubmission:true` with a non-admin token and confirms the client cannot self-elevate, even though the handler never reads that field.

**`vi.mock` usage is correct.** `dbState`/`authState` are created via `vi.hoisted` (16–49) so the hoisted `vi.mock` factory can reference them. Top-level `await import` after env setup matches the existing repo style (`adminAccess.test.ts:11`, `requireRole.test.ts:19`).

### Minor findings

1. **[Minor] `requireRole` negative tests assert status only, not the error body** (lines 292–316). The sibling `requireRole.test.ts:65,81` asserts `{ success:false, message:'Authentication required' }` / `'Access denied'`. The security property (status) is covered, so this is a consistency/strength nit only.
2. **[Minor] Report rationale for the auth mock is imprecise** (report lines 59). It claims mocking the `../auth/supabaseAuth` export "would NOT take effect" for `isAdmin`/`requireRole`. In ESM `vi.mock` does replace the binding that `adminAccess.ts` imports (which is exactly why `requireRole.test.ts` works). The real reason the chosen approach is preferable is `sessionMiddleware.ts:57` dynamically imports `'../auth/supabaseAuth.js'` (note `.js`), a different specifier than the brief's `../auth/supabaseAuth`; stubbing `supabase.auth.getUser` robustly covers both static and dynamic importers. The implementation choice is sound and arguably stronger (it exercises the real `getUserFromRequest`); only the justification wording is off. Documentation-only.
3. **[Minor] Module-top env vars not restored** (`ADMIN_API_SECRET`, `LOG_LEVEL`, `SUPABASE_*`, lines 9–14). `ADMIN_API_SECRET` is captured at `adminAccess.ts` module load so restoring it would be meaningless; the report acknowledges this (line 61) and `ADMIN_EMAILS` (read at call time) is restored. Harmless given vitest file isolation.
4. **[Minor] `requireRole` block duplicates Task 1's `requireRole.test.ts`.** Brief line 14 says re-run "if not already"; the suite already runs `requireRole.test.ts`, so tests 292–370 are redundant coverage. Explicitly contemplated by the brief, so not a violation — belt-and-suspenders.
5. **[Minor] `botRoutes /create` 201 test asserts only `success:true`** (433–435), not the returned `bot` shape, and no test asserts the `requestLogger` actor path. Low value; the security property (secret → 201) is covered.

### Out-of-scope observation (not a Task 9 defect)

`server/routes/ai/analysis.ts` `/analyze-bulk` has no auth middleware at all; the brief deliberately scoped that route to input-validation only (line 20), and the tests match. If route-level auth for bulk analysis is intended, it belongs to a different task.

## 3. Deviations assessment

Both deviations are documented in the report and are reasonable:

- **Stubbing `supabase.auth.getUser` instead of mocking the `getUserFromRequest` export** (brief line 22): sound. It keeps the real `getUserFromRequest`/`isAdmin`/`getCallerRole`/`isAuthenticated` logic under test and works across the static import in `adminAccess.ts` and the `.js`-suffixed dynamic import in `sessionMiddleware.ts`. Rationale wording is imprecise (finding #2), implementation is correct.
- **`@shared/schema` / `@shared/quizTypes` mocks** (114–130): sound and config-free. `vitest.config.ts` does not merge `vite.config.ts`, so the `@shared` alias (`vite.config.ts:22`) is absent in the test runner; mocking the two specifiers lets the route modules load without touching any config (which the global constraints forbid). Verified no other `@shared/*` specifier is imported by the exercised route graph.

No undocumented deviations found.

## Summary

| Dimension | Result |
|---|---|
| Spec matrix completeness | PASS (24/24 required cases) |
| Guard actually exercised (no vacuous negatives) | PASS |
| Determinism / no network / no DB | PASS |
| Repo style consistency | PASS (minor body-assertion nit) |
| Scope constraints (tests-only, no config/deps/routes) | PASS |
| Critical / Important / Minor | 0 / 0 / 5 |
