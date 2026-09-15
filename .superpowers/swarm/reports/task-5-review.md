# Task 5 Review — Policy voting: auth on deletes + IDOR protection on user-data reads

**Reviewer**: task reviewer (independent of implementer)
**Scope**: `server/routes/parliamentary/voting.ts`, `server/routes/user/rankings/policy.ts`
**Verdict**: SPEC PASS · QUALITY APPROVED · Critical 0 · Important 0 · Minor 4

---

## Summary

The change set is a faithful, minimal application of the brief. All five handlers were
modified identically in both files, exactly per the task diff (verified: `git diff` of the
two files is byte-identical to `.superpowers/swarm/diffs/task-5.diff` — no stray changes).
All gates independently re-verified. No Critical or Important findings.

---

## Spec compliance — PASS

### 1. DELETE /:voteId — auth + caller id from token (brief lines 10, 18)
- `isAuthenticated` added in **both** files: voting.ts diff hunk `@@ -345,9 +366,9 @@` (router.delete gains `isAuthenticated`), policy.ts diff hunk `@@ -363,9 +384,9 @@`. ✓
- Caller id derived from `(req as any).user?.id` (the token), body `userId` is no longer read — the `const { userId } = req.body;` line was removed (both hunks) and is **ignored**, which the brief explicitly permits ("ignore it (or 400)", line 10). ✓
- Ownership compare retained as today: `vote.user_id !== callerId` → 403 with each file's existing `formatError('FORBIDDEN', ...)` envelope. ✓

### 2. Four GET /user/:userId/... endpoints — isAuthenticated + ownership (brief line 11)
- All four guards added in **both** files (8 guard blocks): voting.ts hunks `@@ -134,8 +134,13 @@`, `@@ -298,8 +303,14 @@`, `@@ -314,8 +325,13 @@`, `@@ -334,8 +350,13 @@`; policy.ts hunks `@@ -146,8 +146,13 @@`, `@@ -313,8 +318,14 @@`, `@@ -330,8 +341,13 @@`, `@@ -351,8 +367,13 @@`. ✓
- Ownership check is `String(callerId) !== userId` → 403 `{ success:false, message:'Access denied' }` — exactly the message/status/shape the brief mandates (line 11), and consistent with the `isAuthenticated` 401 envelope (`{ success:false, message:'Authentication required' }`). ✓
- Admin bypass via `(req as any).user?.app_metadata?.role !== 'admin'` — reads `app_metadata` (server-trusted, not self-editable `user_metadata`), per brief line 11 and the plan's trust rule. ✓

### 3. Everything else unchanged (brief lines 12, 16)
- `POST /` vote creation, `/article/:articleId` public reads, `/opportunity/*`, `/user/me/*` — untouched (diff touches only the 5 handlers). ✓

### 4. policy.ts caller-id convention (brief line 14)
- New code uses `(req as any).user?.id`, consistent with policy.ts's existing POST (policy.ts:250) and `/opportunity/:policyVoteId/user` (policy.ts:94). ✓

### 5. Gates — independently re-verified
- `tsc --noEmit` total: **2642** ≤ 2644 ✓ (the implementer's reported 2653 has since settled below baseline as parallel tasks landed).
- `parliamentary/voting.ts`: **17** ≤ 17 ✓ (all 17 are pre-existing: 13× `TS18047 'supabase' is possibly 'null'` + 4× `TS2339 Property 'id' does not exist on type '{}'` at lines 84/114/161/235 — the baseline sites).
- `user/rankings/policy.ts`: **13** ≤ 13 ✓ (all 13 pre-existing `TS18047`).
- `vitest run server/middleware/adminAccess.test.ts`: **4/4 passed** ✓.

---

## Code quality

### Ownership comparison is sound — no type-mismatch bypass
- `req.params.userId` is always a `string` in Express; `String(callerId)` coerces the JWT `sub` (a UUID string). Both sides are strings; strict `!==` with no coercion on either operand. An attacker controls only the URL param, and it must equal `String` of their **own** verified JWT sub to pass — they cannot fabricate a victim UUID.
- If `callerId` were `undefined`, `String(undefined)` = `"undefined"` cannot collide with any real UUID; even in the pathological case, the downstream DB query is filtered by the same attacker-supplied param, so no cross-user data can be returned.
- DELETE comparison `vote.user_id !== callerId`: strict, no coercion. `user_id` is written at insert time from `req.user?.id` (the same string UUID) in POST `/` (voting.ts:281, policy.ts:295), so stored value and JWT sub are the same type/domain. Even if the column type ever returned a number, strict `!==` would fail **closed** (owner locked out) — not a bypass. Matches the brief's "compare as today" directive.

### No dead code
- `callerId` is consumed in every added block; the old body `userId` extraction in DELETE was removed (not orphaned). No unused imports/consts introduced.

### Error formatting
- GET 403s use the brief-mandated inline `{ success:false, message:'Access denied' }` (consistent with the auth middleware's envelope). DELETE 403s keep each file's existing `formatError('FORBIDDEN', ...)` — voting.ts uses `ErrorCodes.FORBIDDEN`, policy.ts its literal `'Not authorized to delete this vote'`. Both are the files' established conventions. ✓

### Cast usage
- `(req as any).user?.id` in the new code is the right call: `req.user` is typed `unknown`, and the 4 direct `req.user?.id` sites in voting.ts are already counted in its 17-error baseline. Using the cast keeps voting.ts at 17 and adds zero new errors.

### Global constraints
- No DB schema changes, no tsconfig/compiler changes, no non-security refactors, no new deps, no secrets, nothing committed. ✓

---

## Findings

### Critical — none

### Important — none

### Minor
1. **Admin allowlist not honored on these routes** — the guard reads only `app_metadata.role === 'admin'` while `getCallerRole`/`isAdmin` in `supabaseAuth.ts` (lines 174–197) also grant admin to `ADMIN_EMAILS`-allowlisted emails. An allowlisted admin without `app_metadata.role` is denied on these GET routes but granted elsewhere. Errs toward **deny** (safe) and matches the brief's exact wording (line 11), so this is a consistency note, not a defect. Suggested future improvement: use `getCallerRole(req)`.
2. **Style inconsistency within voting.ts** — new code uses `(req as any).user?.id` while 4 pre-existing sites use `req.user?.id` (the baseline TS2339s). Pre-existing debt, not introduced here; the cast was necessary to hold the 17-error gate. Cosmetic.
3. **No audit logging on 403 denials** — the new guards log nothing, consistent with `isAuthenticated` (only `isAdmin` logs grants/denials). Not required by the brief; optional hardening if denied-IDOR visibility is desired.
4. **Guard block duplicated ×8** — same 4-line check repeated across both files. Acceptable given the brief's "apply identically in both files" instruction and the tsc gate (a shared helper would be a non-security refactor touching more files). Maintainability note only.

---

## Security depth

No realistic bypass identified:
- **Delete**: caller id is the server-verified JWT sub (`getUserFromRequest` → `supabase.auth.getUser`); the spoofable body `userId` path is gone. `vote.user_id` must strictly equal the attacker's own UUID, so another user's vote can never be deleted. Fail-closed on `null`/`undefined`/type anomalies.
- **Reads**: ownership string-compare prevents cross-user data access; admin bypass is gated on server-trusted `app_metadata.role` (not self-editable `user_metadata`), so no self-promotion.
- The four legacy endpoints no longer expose one user's personalized political data to anonymous callers.

---

## Verdict
- **SPEC**: PASS
- **QUALITY**: APPROVED
- **Findings**: Critical 0, Important 0, Minor 4