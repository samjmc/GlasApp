# Task 5 Report — Policy voting: auth on deletes + IDOR protection on user-data reads

**Status**: DONE

## Changes made

### `server/routes/parliamentary/voting.ts`
- `DELETE /:voteId`: added `isAuthenticated` middleware (imported from `../../auth/supabaseAuth.js`, already present in the file). Caller id is now derived from the bearer token via `(req as any).user?.id`; the spoofable body `userId` is no longer read. Ownership check `vote.user_id !== callerId` → 403 as before.
- `GET /user/:userId/article/:articleId`, `GET /user/:userId/personalized-scores`, `GET /user/:userId/td/:politicianName`, `GET /user/:userId/value-alignment`: added `isAuthenticated` + ownership enforcement. If `String(callerId) !== req.params.userId` AND caller is not admin (`req.user?.app_metadata?.role === 'admin'`) → 403 `{ success:false, message:'Access denied' }`. Admins may read any user.
- All other handlers (POST `/`, `/opportunity/*`, `/user/me/*`, `/article/:articleId`) unchanged.

### `server/routes/user/rankings/policy.ts`
- Same four GET ownership guards added (`isAuthenticated` already imported; caller id read via the file's existing `(req as any).user?.id` pattern, consistent with its POST at former line 244).
- `DELETE /:voteId`: same auth + caller-id-from-token change; body `userId` no longer trusted.

## Design notes
- Used `(req as any).user?.id` (matching policy.ts's existing convention) instead of `req.user?.id` in new code. `req.user` is typed `unknown`/`{}`; `req.user?.id` produces `TS2339 Property 'id' does not exist on type '{}'` (4 such errors already exist in voting.ts and are counted in its baseline). Using the existing cast pattern adds zero new errors.
- The brief's "ignore (or 400)" for a mismatched body `userId`: body `userId` is now simply ignored (not read), so it cannot be used to bypass ownership.
- Admin bypass uses `app_metadata.role === 'admin'` per the brief / plan trust rule (never `user_metadata`).

## Gates
- `node_modules/.bin/tsc` per-file counts: `parliamentary/voting.ts` = **17** (baseline 17, unchanged), `user/rankings/policy.ts` = **13** (baseline 13, unchanged). No new file-level errors introduced.
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts`: **4/4 passed**.
- **Total tsc note**: repo total measured **2653** vs baseline 2644. My two files are exactly at baseline (30 combined). The +9 over baseline is attributable to other tasks running in parallel in this worktree (their files show concurrent modifications — botRoutes.ts, routes.ts, ai/analysis.ts, shadowRoutes.ts, debateWorkspaceRoutes.ts, etc., per `git diff --name-only`), not to this task. My files were flat across pre/post measurements while those other files' error sets shifted.

## Scope confirmation
- No changes to tsconfig/compiler config, database schema, POST `/` vote creation, `/article/:articleId` public reads, or shared services.
- No middleware or other route files touched; no dependencies added; nothing committed.