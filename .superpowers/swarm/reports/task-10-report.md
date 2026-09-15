# Task 10 Report — Client compatibility: attach bearer tokens to privileged pages

**Status**: DONE

## Summary

Updated 5 client files so every Wave-1-hardened endpoint's legit client caller attaches the Supabase bearer token via the existing `apiRequest`/`apiClient` helpers in `client/src/lib/queryClient.ts` (which auto-attach via `supabase.auth.getSession()`). No server files touched, no dependencies added, no UI/layout changes, no global `fetch` override, no commits.

## Changes

1. **`client/src/pages/admin/ShadowCabinetDashboard.tsx`**
   - `fetchHistory`: raw `fetch("/api/shadow/history")` → `apiClient.get("/api/shadow/history")`; array handling + try/catch preserved.
   - `fetchQaHistory`: raw `fetch("/api/shadow/qa-history")` → `apiClient.get("/api/shadow/qa-history")`; same preservation.
   - `handleAnalyze`: raw `fetch("/api/shadow/analyze", { method:"POST", ... })` → `await apiClient.post("/api/shadow/analyze", { url })`. Removed `if (!res.ok) throw` (apiRequest throws on !ok); try/catch/finally preserved.

2. **`client/src/pages/MediaWorkspacePage.tsx`**
   - `fetchViews` (GET /views) and `fetchExports` (GET /exports?limit=20): → `apiClient.get`; `payload?.views ?? []` / `payload?.exports ?? []` shapes preserved.
   - `createViewMutation`, `deleteViewMutation`, `exportMutation`: → `apiClient.post("/api/debate-workspace/views", payload)`, `apiClient.delete(...)`, `apiClient.post("/api/debate-workspace/exports", payload)`. Removed `if (!response.ok)` blocks (apiRequest throws; react-query already handles mutationFn throws). `onSuccess` `data?.export?.csvBase64` / `data?.export?.period` download logic untouched.

3. **`client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`**
   - JSON timeline: raw `fetch` → `apiClient.get`; dropped the now-redundant `!response.ok` from the success check, kept `data.success` check and all state setters.
   - CSV export: `window.location.href` (cannot carry headers) → `apiFetch(...)` (token-attached fetch) → `response.text()` → `Blob` → client-side download, following the existing JSON blob-download pattern in the file. Preserves query params `weeks`, `fromDate`, `toDate`, `compareParty`, `compareAverage`, plus `format=csv`. Added try/catch for fetch rejection.

4. **`client/src/components/IdeologyTimeSeriesChart.tsx`** (plain)
   - Timeline `fetch(\`/api/ideology-timeline/${userId}?weeks=${weeks}\`)` → `apiClient.get`; same success-check treatment.

5. **`client/src/lib/queryClient.ts`**
   - Added minimal export `apiFetch(path: string): Promise<Response>` that attaches the bearer token (reusing `getAccessToken`), calls `fetch` with `credentials: "include"`, runs `throwIfResNotOk`, and returns the raw Response for non-JSON payloads (CSV). Module not restructured.

## Gates

- `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` → **2642** (≤ 2644) ✓
- Per-file counts (unchanged vs baseline, no new errors introduced):
  - `ShadowCabinetDashboard.tsx` → 2 (baseline 2) ✓
  - `MediaWorkspacePage.tsx` → 17 (baseline 17) ✓
  - `IdeologyTimeSeriesChartEnhanced.tsx` → 7 (baseline 7) ✓
  - `IdeologyTimeSeriesChart.tsx` → 5 (baseline 5) ✓
  - `queryClient.ts` → 0 (baseline 0) ✓
- `node_modules/.bin/vitest run --root . server/middleware/adminAccess.test.ts` → **4/4 pass** ✓
- Code review: every hardened endpoint's client caller now attaches the bearer token (`/api/shadow/*` via admin auth, `/api/debate-workspace/*` via admin auth, `/api/ideology-timeline/:userId` JSON + CSV via user auth); response shapes preserved; no UI regression beyond fetch plumbing.

## Concerns

None.