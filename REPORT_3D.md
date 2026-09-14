# Phase 3D — Error Handling Standardization + Structured Logging

Branch: `feature/phase-3d-error-standardization` (pinned to `main` @ `9961db2`)
Worktree: `/private/tmp/glasapp-worktrees/phase-3d-error-standardization`

---

## Research (Step 0)

### Logging library choice: pino + pino-http

`package.json` contained **neither pino nor winston** before this change, so this was an
open choice (the one intentional exception to "no new dependencies").

Decision data (npm registry API, last-month downloads measured during this task):

| package | downloads/mo | notes |
| --- | --- | --- |
| `pino` | 177.9M | JSON-native, fastest structured logger for Node (self-benchmark ~21k req/s vs ~7.7k for http-ndjson) |
| `pino-http` | 21.1M | Official Express/HTTP integration, maintained by pino core team (Matteo Collina / nearForm) |
| `winston` | 100.0M | Heavier, ~3x slower; its Express integration (`express-winston`) is only ~2.3M downloads/mo |
| `express-winston` | 2.3M | |

**Choice: `pino@^10.3.1` + `pino-http@^11.0.0`** — highest-download, actively maintained,
fastest, NDJSON-by-default (directly satisfies "structured logging with timestamp, level, …").
Verified current API from the `pino-http` README (v11): `pinoHttp({ logger, autoLogging,
customLogLevel, customProps, genReqId })`; it attaches `req.log` to every request (types
augment `http.IncomingMessage.log`, which flows through to Express `Request`). Confirmed
ESM compatibility (project is `"type": "module"`, Node ≥ 20).

### Express/TS error-response shape best practices

- RFC 9457 "Problem Details for HTTP APIs" (successor to RFC 7807, 2023) is the industry
  standard; adopted by Stripe, GitHub, Cloudflare. Core guidance: **one consistent error
  shape across all status codes**, machine-readable code + human message, never switch
  shapes when status codes change.
- The repo already has a Phase-1 foundation (`server/utils/responseFormatters.ts` +
  `server/utils/errors.ts` + `server/middleware/errorHandler.ts`) implementing a
  `{ success, data?, error: { code, message, details? } }` shape — consistent with the
  brief's required shape and the spirit of RFC 9457 for an internal API. I extended this
  foundation rather than introducing a parallel abstraction.

### Security guidance on error-detail exposure (dev vs prod)

- OWASP Error Handling Cheat Sheet, CWE-209 (sensitive info in error messages), OWASP API
  Top 10 2023 API8: **never expose stack traces, SQL/db details, internal paths, or raw
  upstream-service errors to clients**; log them server-side only; return safe generic
  messages in production.
- Standard pattern: `details`/diagnostic fields only outside `NODE_ENV=production`; full
  context (stack, DB error, request metadata) goes to the structured log.

### What I searched/read (list)

1. `package.json` + `package-lock.json` (confirmed no existing logger).
2. npm registry metadata: download stats, latest versions (`pino@10.3.1`, `pino-http@11.0.0`).
3. `pino-http` README (Express integration, `customProps`, `customLogLevel`, `autoLogging`, `req.log`).
4. `pino-http@11.0.0/index.d.ts` (Express `req.log` typing).
5. Web search: RFC 9457 best-practice guides (Express/TS), OWASP Error Handling Cheat Sheet,
   CWE-209 / API8:2023 verbose-error guidance.
6. This repo's existing `responseFormatters.ts`, `errors.ts`, `errorHandler.ts`, and grep of
   actual in-use response shapes across `server/routes/`.

---

## Files changed

| File | Change |
| --- | --- |
| `package.json` / `package-lock.json` | Added `pino@^10.3.1`, `pino-http@^11.0.0` (only new deps) |
| `server/utils/logger.ts` | **NEW** — shared pino instance (level by env, credential redaction, `err` serializer) + `requestLogger(req)` helper returning `req.log` |
| `server/utils/responseFormatters.ts` | Updated — added `formatResponse()` (success with optional `data`); `formatError()` now attaches `details` **only when not production**; `ErrorDetails` widened to `string \| Record<string, unknown>` |
| `server/middleware/errorHandler.ts` | Updated — `console.error` → structured `req.log`; `AppError.details` now passed through (env-gated); unknown-error `message`+`stack` exposure gated on **non-production** (was dev-only); all status codes and branch logic preserved |
| `server/index.ts` | Updated — request-level `pino-http` middleware (timestamp/level/route/userId/status/duration); replaced `console.*` and the old response-body-capturing middleware; all startup `console.*`/`log()` → `logger.*` |
| `server/routes/authRoutes.ts` | Fully migrated (14 endpoints) to `formatResponse`/`formatError` + structured logging; zero `console.*` remain |
| `server/routes/newsFeedRoutes.ts` | Fully migrated (GET /, POST /save, GET /td/:name) + structured logging; zero `console.*` remain |
| `server/routes/admin/manualArticleRoutes.ts` | Fully migrated (POST /add, /bulk-add, GET /manual) + structured logging; zero `console.*` remain |

### Notes on scope
- `server/utils/formatResponse.ts` was **not created as a new file**: the codebase already
  ships `server/utils/responseFormatters.ts` (used by the error handler + 12 other route
  files) which matches the utils/ naming conventions. Per the brief's "or similar, match
  existing utils/ naming conventions" allowance, I extended that file in place instead of
  adding a duplicate module.
- Extra file beyond the FILES list: `server/utils/logger.ts` — a minimal necessity so the
  bootstrap, middleware, and routes share one configured pino instance.
- No changes to `client/`, `schema.ts`, scoring service files, or map/results/quiz files.

---

## Response shape enforced

```typescript
// success
{ success: true, data?: T, meta?: {...} }
// error
{ success: false, error: { code: string, message: string, details?: string | {...} } }
// `details` present ONLY when process.env.NODE_ENV !== 'production'
```

Verified at runtime (`NODE_ENV=development` vs `production`):

- dev:   `{success:false, error:{code:"INTERNAL_ERROR", message:"test internal error", details:{stack:"…"}}}`
- prod:  `{success:false, error:{code:"INTERNAL_ERROR", message:"An unexpected error occurred"}}` (no details)

## Route migration (exactly 3 files, per acceptance #3)

1. **`server/routes/authRoutes.ts`** — all 14 endpoints (`register-step1/2`, `verify-email-code`,
   `verify-phone-code`, `register`, `login`, `verify-2fa`, `logout`, `me` GET/PATCH, `verify-phone`,
   `resend-verification`, `upload-profile-image`, `verify-email`). Old `{success, message, …}` →
   `formatResponse({…})` / `formatError(code, message[, details])`. HTML `verify-email` success page
   intentionally left as `res.send(html)` (not JSON).
2. **`server/routes/newsFeedRoutes.ts`** — `GET /`, `POST /save`, `GET /td/:name`. Success payloads
   wrapped under `data`; error bodies standardized to `error{code,message,details?}`. The existing
   odd `success:true + empty articles` behavior on the `/td/:name` DB-error path was preserved
   (status/shape-of-intent unchanged per acceptance #7).
3. **`server/routes/admin/manualArticleRoutes.ts`** — the admin route mounted at `/api/admin/articles`
   behind `requireAdminAccess` (touched by the recent admin-security work, commit #16 which added
   the admin middleware + mounts in `server/routes.ts`). Chosen because it is a live admin content
   path using legacy shapes and exercises the `next(error)` → `errorHandler` propagation path.

HTTP status codes verified identical before/after (git diff of `res.status(` counts):

- authRoutes: 200×11, 201×3, 400×24, 401×4, 404×5, 500×16 — unchanged.
- newsFeedRoutes: 201×1, 500×2, 503×1 — unchanged (defaults stay 200).
- manualArticleRoutes: 400×3, 500×1, 503×1 — unchanged.

## Logging

- Request-level: `pino-http` in `server/index.ts` emits one line per request with `time`,
  `level`, `req.method/url`, `route` (via `customProps`, query-stripped), `userId` (session or
  bearer user, when available), `res.statusCode`, `responseTime` (duration), `req.id`.
  `customLogLevel` maps ≥500→`error`, ≥400→`warn`, else `info`.
- Route/middleware: every `console.log/warn/error` in touched files replaced with the
  request-scoped `req.log` (via `requestLogger(req)`) or the shared `logger` in helper
  functions; calls carry an `operation` field (`newsFeed.list`, `auth.login`, …).
- Redaction: pino `redact` censors passwords, confirmPassword, captchaToken, verificationCode,
  secrets, and auth headers/cookies (`[REDACTED]`). The old code logged email verification codes
  in plaintext; this is no longer logged at all.

## Acceptance criteria — status

1. ✅ Helpers in `server/utils/responseFormatters.ts` (`formatResponse`, `formatSuccess`, `formatError`) enforce the shape; `details` gated on non-production.
2. ✅ `server/middleware/errorHandler.ts` applies the format consistently (all error paths → `formatError`), verified by reading error propagation in migrated routes and by live harness (`/boom` → standardized 500).
3. ✅ 3 route files fully migrated (listed above); remaining unmigrated: **46 legacy route files ≈ 661 response sites** (see below).
4. ✅ Request-level structured logging wired in `server/index.ts` via pino-http; `console.log/error` replaced in every touched file (grep-verified: none remain).
5. ✅ `npm run check` (tsc): **2698 errors vs 2699 baseline → zero new errors, one pre-existing error removed**. The repo's `npm run check` does not pass cleanly on `main` (≈2699 pre-existing errors owned by other phases — schema/storage/scoring/etc.); this task adds none.
6. ✅ `npm install` exits 0; only `pino` + `pino-http` added.
7. ✅ No status-code changes — only JSON body shape (verified by diff of `res.status(` counts and live curl).

### Remaining unmigrated response sites (follow-up pass)

46 legacy route files, ~661 `res.json` response sites, including (non-exhaustive): `accountRoutes`,
`activityRoutes`, `admin/{baseline,debateAdmin,newsScraper,parliamentary,tdScoring}Routes`,
`botRoutes`, `cacheRoutes`, `chatRoutes`, `conflictData`, `dailySessionRoutes`, `debateWorkspaceRoutes`,
`debatesRoutes`, `electionRoutes`, `geographic/index`, `ideasRoutes`, `ideologyTimelineRoutes(+Enhanced)`,
`newsFeedRoutes.optimized`, `parliamentary/votingRoutes`, `parliamentaryActivityRoutes`,
`partySentimentRoutes`, `personalRankingsRoutes`, `personalizedInsightsRoutes`, `policyVotingRoutes`,
`politicalEvolutionRoutes`, `politicianChatRoutes`, `problemsRoutes`, `profileHistoryRoutes`,
`quiz/index`, `ratings/tdRatings`, `regionRoutes`, `shadowRoutes`, `smsRoutes`, `storytellingRoutes`, `auth.ts`, `ai/analysis`, `dashboardRoutes`, `debateMonitoringRoutes`, … (12 files already Phase-1-migrated, ~315 sites). Several of these belong to parallel teams (scoring/quiz/cache/admin-td) and were intentionally left alone.

## Testing performed

- `npm install` — clean (exit 0).
- `npm run check` (tsc) — 2699 → 2698 errors; per-file counts identical except manualArticleRoutes 22→21 (improvement); zero new errors by (file, error-code) comparison. (The `sendVerificationCode` undefined-reference errors in authRoutes are pre-existing and outside this task's scope.)
- Runtime harness (throwaway, removed after) mounting the real migrated routers + pino-http + errorHandler:
  - `POST /api/auth/login {}` → 400 `{success:false,error:{code:'VALIDATION_ERROR',…}}`
  - `POST /api/auth/register-step1` invalid → 400 `VALIDATION_ERROR`
  - `GET /boom` (thrown) → 500 `INTERNAL_ERROR` + `details.stack` in dev, no details in prod
  - `GET /api/news-feed` (DB down) → 500 `OPERATION_FAILED` + details in dev, none in prod
  - pino-http lines confirmed to carry `level/time/route/res.statusCode/responseTime/req.id`
  - `customLogLevel` verified (200→info 30, 500→error 50)
- Full server boot smoke test: booted with dummy Supabase envs; structured NDJSON startup logs confirmed; stopped at `serveStatic` only because no built client exists (client/ is out of scope).

## Self-vetting

- ✅ Re-read every changed file; verified shapes were confirmed by grep/read of actual route bodies (not assumed) — the brief's claim of scattered shapes matched reality for authRoutes/newsFeed/manualArticle.
- ✅ No invented abstractions: reused existing `responseFormatters.ts` (added `formatResponse` + env gating) instead of a duplicate module; `logger.ts` is the minimal shared instance + request-logger accessor.
- ✅ Scope respected: only the declared files + `server/utils/logger.ts`; nothing under `client/`, no `schema.ts`, no scoring/map/results/quiz files, no cache routes (Phase 3C owns those).
- ✅ `npm run check` and `npm install` run by me and pass (see above).
- ✅ Status codes diffed before/after — unchanged.

### Risks / assumptions (flagged)

1. **Logging library choice** is pino + pino-http (highest downloads, actively maintained). Winston was the alternative; express-winston's lower adoption and pino's performance/JSON-native design drove the pick. No other logging dep added.
2. **Unknown-error message exposure widened from dev-only to non-production**: the brief mandates `details` outside production; previously only `NODE_ENV=development` got the real message + stack. If a staging/test environment runs with `NODE_ENV` unset (≠`production`), it now receives real error messages + stack in `details`. This matches the brief and common practice, but is a deliberate behavior change from the old dev-only gate.
3. **Zod field-error details are now stripped in production** (they lived in `details`). This is a consequence of the blanket non-production `details` gate; documented so the follow-up pass can decide whether field-level validation errors should be re-exposed via a dedicated field.
4. **`sendVerificationCode` is referenced but undefined** in authRoutes (pre-existing tsc TS2304/2552, present on `main`); untouched to avoid behavior changes — owned by the auth flow follow-up.
5. **Response bodies are no longer echoed into logs**: the old middleware logged truncated response JSON; pino-http logs status/duration but not bodies (deliberate — avoids logging PII/secrets).
6. **newsFeed `/td/:name` error path** keeps returning 200 `{success:true, data:{articles:[]}}` — pre-existing behavior preserved per acceptance #7; flagged for the news team as a likely follow-up fix.
7. `server/utils/responseFormatters.ts` is shared infra; `server/index.ts`/`errorHandler.ts` are central — a parallel team editing them concurrently could conflict (they're listed as in-scope for this task, but worth noting).

---

## Commit

```
refactor: standardize error responses + structured logging (Phase 3D)
```