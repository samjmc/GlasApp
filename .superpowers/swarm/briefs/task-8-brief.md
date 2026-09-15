### Task 8 — Geographic location + ideology timeline: auth, ownership, admin data access

**Files**: `server/routes/geographic/index.ts`, `server/routes/ideologyTimelineRoutesEnhanced.ts`

**Background**:
- `POST /api/location/users/location` (mounted also as `/api/users/location` and `/api/location/...`) accepts an arbitrary `userId` in the body — anyone can write/overwrite ANY user's location (IDOR write). The client (`use-location.tsx`) sends the authenticated user's own `user.id`.
- `GET /api/location/users/by-constituency/:constituency` returns a list of user identifiers (`firebaseUid`) with no auth — privileged data exposure.
- `GET /api/ideology-timeline/:userId` (mounted, enhanced) returns a user's political ideology evolution (sensitive personal data) with no auth. The client calls it only with the current user's own `user.id` (`MyPoliticsPage`).

**Changes**:
1. `geographic/index.ts`:
   - `POST /users/location`: require `isAuthenticated` (import from `../middleware/sessionMiddleware`). Derive the authorizing id from `req.user?.id ?? req.session?.userId`; if a body `userId` is provided AND does not match the authenticated id → 403 `{ success:false, message:'Access denied' }`. If no identity after the guard → 401. Use the authenticated id as the record key. Keep lat/lng/constituency/county/accuracy validation (all required lat/lng → 400).
   - `GET /users/by-constituency/:constituency`: require `requireAdminAccess` (import from `../middleware/adminAccess`). Log with the existing `requestLogger(req)` pattern from `../utils/logger`. Do NOT rely on new Task 1 exports.
2. `ideologyTimelineRoutesEnhanced.ts`:
   - `GET /:userId`: require `isAuthenticated` (bearer, from `../../auth/supabaseAuth.js`). If `req.params.userId !== String(req.user?.id)` and caller is not `app_metadata.role === 'admin'` → 403 `{ success:false, message:'Access denied' }`.
   - Keep the CSV/JSON export and all query-param behavior.

**Do NOT**: touch `GET /constituency` (reverse geocode), heatmap, stats/constituencies, or the plain (unmounted) `ideologyTimelineRoutes.ts`.

**Gates**:
- tsc total ≤ 2644; per-file counts: geographic/index.ts ≤ 15, ideologyTimelineRoutesEnhanced.ts ≤ 46.

---

