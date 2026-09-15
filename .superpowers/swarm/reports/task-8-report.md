# Task 8 Report — Geographic location + ideology timeline: auth, ownership, admin data access

**Status: DONE**

## Summary

Implemented exactly the brief's changes in the two assigned files. No other files touched. No dependencies added, no commit made.

## Changes

### `server/routes/geographic/index.ts`

1. **`POST /users/location`** (IDOR write fix):
   - Added `isAuthenticated` (from `../../middleware/sessionMiddleware`, session-first then bearer) as route middleware.
   - Authorizing id derived from `req.user?.id ?? req.session?.userId` (cast pattern `(req.user as { id?: string | number } | null | undefined)?.id`, required because the merged `req.user` type resolves to `{}`).
   - If no identity after the guard → 401 `{ success:false, message:'Authentication required' }`.
   - If a body `userId` is provided AND does not match the authenticated id → 403 `{ success:false, message:'Access denied' }`.
   - Record key is now the authenticated id (`String(authenticatedId)`), not the client-supplied `userId`.
   - Kept lat/lng validation: `latitude`/`longitude` still required → 400. Dropped `userId` from the required-fields check (it is no longer required; the authenticated id is the key). `constituency`/`county`/`accuracy` still optional and passed through.

2. **`GET /users/by-constituency/:constituency`** (privileged data exposure fix):
   - Added `requireAdminAccess` (from `../../middleware/adminAccess`) as route middleware.
   - Logs with the existing `requestLogger(req)` pattern from `../../utils/logger` (`operation: 'admin.geographic.byConstituency'`, actor from `req.user.email ?? req.session.userId`).
   - Does not rely on new Task 1 exports.

### `server/routes/ideologyTimelineRoutesEnhanced.ts`

- **`GET /:userId`** (sensitive personal data fix):
  - Added `isAuthenticated` (bearer, from `../auth/supabaseAuth.js`). NOTE: the brief/plan write `../../auth/supabaseAuth.js`, but this file lives in `server/routes/` so the correct relative path is `../auth/supabaseAuth.js` (consistent with the file's existing `../db.js`, `../services/*.js` imports). Used the correct path.
  - After the guard: if `String(req.user?.id) !== req.params.userId` and the caller is not `app_metadata.role === 'admin'` → 403 `{ success:false, message:'Access denied' }`.
  - All CSV/JSON export and query-param behavior preserved unchanged.

## Boundaries respected

- `GET /constituency` (reverse geocode), `/heatmap`, `/stats/constituencies`, `/constituencies`, `/ireland`, `/states` untouched.
- Plain (unmounted) `ideologyTimelineRoutes.ts` untouched.
- No middleware files, no `server/index.ts`, no tsconfig/compiler config, no DB schema changes.

## Gates

| Gate | Result |
| --- | --- |
| tsc total ≤ 2644 | **2646** (see concern below) |
| `geographic/index.ts` ≤ 15 | **15** ✓ |
| `ideologyTimelineRoutesEnhanced.ts` ≤ 46 | **46** ✓ |
| `vitest run server/middleware/adminAccess.test.ts` (4 tests) | **4 passed** ✓ |

## Concerns

1. **Total count 2646 (not ≤ 2644).** This drift is entirely from parallel Wave-1 tasks, not this one: a full per-file diff shows only `server/routes/botRoutes.ts` (5 vs baseline 3, Task 2) gained errors between baseline and this run; my two files are exactly at their baselines (15/46) and their before/after error sets are identical except the intended additions (verified line-by-line: same 15 errors in geographic, same 46 in ideology). The total will be back at/under 2644 once Task 2 lands. Flagging so the coordinator isn't surprised.
2. **Body `userId` vs session id type mismatch**: for session-authenticated callers (legacy Replit), `req.session.userId` is a numeric DB id while the client sends a string Supabase `user.id`. Under the brief's rule, a session caller sending a body `userId` that doesn't string-equal their numeric session id would get 403. This matches the brief's prescription exactly (`req.user?.id ?? req.session?.userId`, reject mismatched body id) and bearer/Supabase callers (the primary path) work correctly; noted for awareness only.
3. **Brief path typo** `../../auth/supabaseAuth.js` → used `../auth/supabaseAuth.js` as the only path that resolves from `server/routes/`. Using the literal brief path would have failed to resolve (module-not-found TS error), violating the per-file gate.

## Verification performed

- `node_modules/.bin/tsc` run before and after; full output captured; per-file counts extracted (15 / 46, unchanged from baseline).
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` → 4/4 passed.
- `git diff` confirmed the change set is limited to the two assigned route files.