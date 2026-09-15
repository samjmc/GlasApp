### Task 5 — Policy voting: auth on deletes + IDOR protection on user-data reads

**Files**: `server/routes/parliamentary/voting.ts`, `server/routes/user/rankings/policy.ts`

**Background**: In BOTH files:
- `DELETE /:voteId` is unauthenticated and takes `userId` from the request BODY — a spoofable authorization check. Any caller can delete any vote by passing the victim's userId.
- `GET /user/:userId/article/:articleId`, `GET /user/:userId/personalized-scores`, `GET /user/:userId/td/:politicianName`, `GET /user/:userId/value-alignment` expose one user's personalized political data with NO auth (IDOR).

**Changes** (apply identically in both files):
1. `DELETE /:voteId`: require `isAuthenticated` (import from `../../auth/supabaseAuth.js` — bearer, consistent with how these files already derive `req.user?.id`). Determine the caller id via `req.user?.id`. Do NOT trust the body `userId`; if a body userId is present and differs from the caller id, ignore it (or 400). Compare `vote.user_id === callerId` as today; on mismatch 403.
2. The four `GET /user/:userId/...` endpoints: add `isAuthenticated` and enforce **ownership** — if `req.params.userId !== String(req.user?.id)` → 403 `{ success:false, message:'Access denied' }`. (Admins may read any user: allow if `req.user?.app_metadata?.role === 'admin'`.)
3. Keep every other handler unchanged.

**Note**: `user/rankings/policy.ts` may derive userId differently (check its existing POST at line ~244); make the ownership comparison consistent with how the file already reads the caller's id.

**Do NOT**: change vote-creation (`POST /`), the `/article/:articleId` public reads, or the shared services.

**Gates**:
- tsc total ≤ 2644; per-file counts: parliamentary/voting.ts ≤ 17, user/rankings/policy.ts ≤ 13.

---

