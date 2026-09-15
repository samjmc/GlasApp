# Task 8 Review — Geographic location + ideology timeline: auth, ownership, admin data access

**Reviewer verdict: SPEC PASS · QUALITY APPROVED**
**Findings: 0 Critical · 1 Important · 2 Minor**

Independently verified against the working tree (not just the diff), including a fresh `tsc` run, the middleware sources the routes now depend on, the client callers, and the route mount table.

---

## Spec compliance — PASS

All brief requirements (brief lines 10–18) are implemented exactly:

| Brief requirement | Implementation | Verification |
| --- | --- | --- |
| POST `/users/location` requires `isAuthenticated` from `../middleware/sessionMiddleware` (brief L12) | `router.post("/users/location", isAuthenticated, ...)` — `server/routes/geographic/index.ts:145`, import L24 | ✓ resolves to `server/middleware/sessionMiddleware.ts` |
| Identity from `req.user?.id ?? req.session?.userId` (brief L12) | `server/routes/geographic/index.ts:153-155` | ✓ exact match |
| Mismatched body `userId` → 403 `{success:false, message:'Access denied'}` (brief L12) | `server/routes/geographic/index.ts:163-165` | ✓ exact body/message |
| No identity after guard → 401 (brief L12) | `server/routes/geographic/index.ts:157-159` | ✓ |
| Authenticated id as record key (brief L12) | `recordId = String(authenticatedId)`, used in the eq/insert/update (L167, 173, 188, 192) | ✓ never a client-supplied value |
| lat/lng still required → 400 (brief L12) | L149-151; `userId` correctly dropped from the required-field set | ✓ |
| GET `/users/by-constituency/:constituency` requires `requireAdminAccess` from `../middleware/adminAccess` (brief L13) | `server/routes/geographic/index.ts:211`, import L25 | ✓ resolves to `server/middleware/adminAccess.ts` |
| Log with existing `requestLogger(req)` pattern; do NOT rely on new Task 1 exports (brief L13) | L215-222 with `operation: 'admin.geographic.byConstituency'`, actor `req.user?.email ?? req.session?.userId` | ✓ uses `requestLogger` directly from `../../utils/logger` |
| ideology GET `/:userId` requires bearer `isAuthenticated` (brief L15) | `server/routes/ideologyTimelineRoutesEnhanced.ts:6,21` from `../auth/supabaseAuth.js` | ✓ resolves to `server/auth/supabaseAuth.ts` (see Minor 1) |
| 403 unless `req.params.userId === String(req.user?.id)` or `app_metadata.role === 'admin'` (brief L15) | L24-29 | ✓ exact |
| CSV/JSON export + all query-param behavior kept (brief L16) | L30-37, 208-223 unchanged | ✓ |
| Do NOT touch `/constituency`, heatmap, `/stats/constituencies`, plain unmounted `ideologyTimelineRoutes.ts` (brief L18) | git diff limited to the two files; `ideologyTimelineRoutes.ts` byte-identical | ✓ |

**Global constraints:** no DB schema changes, no tsconfig changes, no non-security refactor, no new deps, no commit — all confirmed. `git diff` for Task 8 is confined to the two assigned route files.

**Gates (independently re-run):**
- `tsc` total = **2642** ≤ 2644 ✓ (the implementer's report of 2646 was transient drift from parallel Task 2; current tree is under the cap)
- `geographic/index.ts` = **15** ≤ 15 ✓ (all 15 are pre-existing `db possibly null` / missing-`features` / missing-`firebaseUid` typing errors; none on the new auth lines)
- `ideologyTimelineRoutesEnhanced.ts` = **46** ≤ 46 ✓ (all pre-existing `unknown`-spread noise; none on the new guard lines)
- `vitest run server/middleware/adminAccess.test.ts` = 4/4 passed ✓

## Security depth

- **IDOR write closed.** The record key is unconditionally `String(authenticatedId)`; a mismatched body `userId` is 403'd, and an *omitted* body `userId` still keys the row to the caller's own identity. There is no input path by which a caller writes another user's row. `String()` coercion makes numeric (session) vs string (Supabase UUID) identities compare consistently, so no type-confusion bypass.
- **by-constituency exposure closed.** Behind `requireAdminAccess` (shared job secret via `timingSafeEqual` **or** `isAdmin`). The `isAdmin` path trusts only `app_metadata.role` and the `ADMIN_EMAILS` allowlist — `app_metadata` is service-role-only, so no self-escalation.
- **Ideology timeline read closed.** `isAuthenticated` (bearer-only, `supabaseAuth`) + ownership `String(caller?.id) !== userId` with the sole bypass `app_metadata.role === 'admin'`. Since `app_metadata` cannot be self-edited, a non-admin cannot read another user's timeline. Safe default if `caller?.id` were ever absent (`String(undefined)` ≠ any real id → denied unless admin).
- **Identity derivation** (`req.user?.id ?? req.session?.userId`) is sound: both `isAuthenticated` implementations populate `req.user.id` before the fallback ever matters, and the fallback only reads the server-set session id. The session-first ordering in `sessionMiddleware` means a cookie can win over a bearer token, but both derive from the same server-verified identity — no cross-user write or read is reachable.

## Findings

### Important

1. **Client-compat risk for the location-save feature (coordination, not a Task 8 defect).** The guard is correct per the brief, but the client caller `client/src/hooks/use-location.tsx:48` does a bare `fetch('/api/users/location', ...)` with **no Authorization header**, and there is no global fetch wrapper (verified: no `window.fetch` override; `queryClient.ts` only attaches tokens in its own helpers). Under the new `isAuthenticated` guard, a Supabase-bearer-authenticated user (the app's primary path — `AuthContext` converts the Supabase user, `id` = UUID) will get **401** on location save, and a legacy-session user sending the Supabase UUID as body `userId` will get **403** (numeric session id vs UUID string). Additionally, `/api/users/location` is **not mounted** anywhere in `server/routes.ts` or `server/index.ts` (only `/api/location`, `/api/geographic`, `/api/heatmap`, `/api/constituencies`), so that client path is currently dead at the mount level. This is server-side spec compliance (brief L12 prescribes exactly this), but the plan's "no regressions — legitimate calls still work" criterion depends on a client update (send the bearer token via `apiRequest`/`getAccessToken`) and/or a mount decision for `/api/users`. Flagging for the coordinator so a client-side task covers it; no change requested to Task 8's diff.

### Minor

1. **Brief path typo, correctly handled.** Brief L15 says `../../auth/supabaseAuth.js`; from `server/routes/` that resolves to `<repo-root>/auth/supabaseAuth.js`, which doesn't exist. The implementer used `../auth/supabaseAuth.js` (the only resolving path, consistent with the file's existing `../db.js` imports) and documented the deviation. Correct call.

2. **Defensive 401 is unreachable.** `server/routes/geographic/index.ts:157-159` can't fire because `isAuthenticated` (sessionMiddleware) always sets an identity or already responded 401. It is brief-mandated defense-in-depth, harmless — noted, not flagged for change.

3. **Pre-existing schema drift (out of scope).** `userLocations.firebaseUid` is referenced by the route (`L173,188,192`) but is **not declared** in `shared/schema.ts` (verified: the table defines only id/latitude/longitude/constituency/county/accuracy/createdAt/updatedAt; the column exists only in the DB via `firebase_uid`). This is pre-existing (the old handler already used `userLocations.firebaseUid`) and fixing it would be a schema change, which the plan prohibits — flagged for awareness only. Task 8 merely changed *which* value is written, not the mechanism.

## Code quality

- No dead code introduced; comments are accurate and match the file's style; no bloat.
- Error responses are consistent with file conventions: the 400 uses the file's existing `{ error: ... }` shape (`/constituency` at L117), while 401/403 use the middleware-standard `{ success: false, message }` — matching `sessionMiddleware`, `adminAccess`, and the file's other route bodies.
- Logging is sane and mirrors the established `logAdminAction` actor pattern in `adminAccess.ts`.
- The `(req.user as {...})?.id` casts are necessary (merged `req.user` type resolves to `{}`) and safely typed; the ownership comparison string-coerces both sides.

## Conclusion

Task 8 implements the brief precisely, closes the three identified exposures (IDOR write, privileged constituency lookup, unauthenticated ideology-timeline read), passes all gates on an independent re-run, and respects every global constraint. The one Important finding is a client-side follow-up outside this task's file scope.