# Self-Review — Task 3D (Error Handling Standardization)

Review of commit `4e18e75` against `DISPATCH_BRIEF.md` acceptance criteria.
Performed line-by-line on the actual code, not the prior `REPORT.md` claims.

## What I checked

1. **Every changed file** in `git show --stat HEAD` (package.json, package-lock.json,
   server/index.ts, server/middleware/errorHandler.ts, server/routes/admin/manualArticleRoutes.ts,
   server/routes/authRoutes.ts, server/routes/newsFeedRoutes.ts, server/utils/logger.ts,
   server/utils/responseFormatters.ts, REPORT.md) re-read against the brief.

2. **Leftover TODOs / dead code** — grep of the diff for `TODO|FIXME|XXX|HACK` on added lines: none.
   `server/index.ts` no longer references the removed `log` import from `./vite` (verified).

3. **Migrated call sites actually changed** — scripted check that every `res(.status(...)).json(` in the
   3 migrated route files is followed by `formatResponse`/`formatSuccess`/`formatError`: 0 unwrapped sites.
   The single `res.send(html)` in `verify-email` was intentionally left as HTML (documented). Counts:
   authRoutes 63, newsFeedRoutes 11, manualArticleRoutes 10 — all wrapped.

4. **console.* leftover** — grep of all touched files for `console.`: none. (Only REPORT.md prose mentions it.)

5. **Status codes accidentally changed** — before/after `res.status(<code>)` frequency diff per file:
   authRoutes 200×11/201×3/400×24/401×4/404×5/500×16 (identical), newsFeedRoutes 201×1/500×2/503×1
   (identical), manualArticleRoutes 400×3/500×1/503×1 (identical), index.ts 200×2 (identical).

6. **Response-shape / behavior change beyond what was asked** — one real finding, see below.

7. **Secrets/credentials hardcoded** — diff scan for keys/tokens/secret-literal patterns: clean.
   Logging no longer emits `verificationCode` (previously logged in plaintext) and pino `redact`
   censors credentials.

8. **TypeScript errors introduced** — ran `npm run check` (tsc) on this worktree AND on baseline
   `9961db2` (via a throwaway worktree at HEAD^) and diffed normalized `(file, errorCode)` counts:

   - Baseline @ `9961db2`: **2699** errors.
   - HEAD `4e18e75`: **2698** errors.
   - Normalized per-(file, error-code) diff: the ONLY delta is
     `server/routes/admin/manualArticleRoutes.ts` 22 → 21 (one pre-existing error removed;
     the rest are identical errors with shifted line numbers from the added imports).
   - **Zero new TypeScript errors introduced.**

9. **Dependency install** — only `pino@10.3.1` + `pino-http@11.0.0` added (verified in package.json /
   package-lock.json and installed node_modules); `npm install` reported clean in the original pass.
   Scope: no client/, no schema.ts, no scoring/map/results/quiz files (diffed — clean).

## What I found

One genuine issue:

- **Unknown-error detail exposure widened beyond what was asked.** The migrated
  `errorHandler` unknown-error branch changed its gate from `NODE_ENV === 'development'`
  to `NODE_ENV !== 'production'`, so raw `err.message` + `{stack}` would now be returned to
  clients in any non-production environment (test/staging/CI, or `NODE_ENV` unset). The brief
  only mandated that `details` be stripped in production; it did not ask to widen the message
  gate. This was flagged as risk #2 in REPORT.md and is a real behavior change beyond scope.

Everything else on the checklist passed cleanly (no TODOs, no unmigrated call sites, no status-code
changes, no secrets, no leftover console.*, no new TS errors).

## What I fixed

- `server/middleware/errorHandler.ts`: restored the original **development-only** gate for the
  unknown-error branch (`message` and `stack` details only when `NODE_ENV === 'development'`).
  `formatError()` still independently strips `details` whenever `NODE_ENV === 'production'`, so the
  brief's invariant ("details only outside production") is preserved as a safety net while the
  original client-facing behavior is restored exactly.

## Final verification

- `npm run check` (tsc) after the fix: **2698 errors** (baseline 2699 → still ≤ baseline, zero
  new errors; the only per-file delta remains the manualArticleRoutes −1 improvement).
- `server/middleware/errorHandler.ts`: no TS errors.