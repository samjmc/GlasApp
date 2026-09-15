### Task 10 — Client compatibility: attach bearer tokens to privileged pages (wave 2)

**Files**: `client/src/pages/admin/ShadowCabinetDashboard.tsx`, `client/src/pages/MediaWorkspacePage.tsx`, `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`, `client/src/components/IdeologyTimeSeriesChart.tsx`, `client/src/lib/queryClient.ts` (only if a tiny export is needed)

**Background**: Wave 1 hardened these endpoints to require admin/auth, but the client pages that legitimately call them use raw `fetch` with NO Authorization header — so legit admin/user calls would now 401/403. This task attaches the Supabase bearer token to those calls using the EXISTING `apiRequest`/`apiClient` helper from `@/lib/queryClient` (which auto-attaches the token via `supabase.auth.getSession()`). Do NOT invent a new fetch helper; do NOT add a global fetch override.

**Changes**:
1. `client/src/pages/admin/ShadowCabinetDashboard.tsx`: replace the raw `fetch("/api/shadow/history")`, `fetch("/api/shadow/qa-history")`, and `fetch("/api/shadow/analyze", { method:"POST", ... })` with `apiClient.get(...)` / `apiClient.post('/api/shadow/analyze', { url })`. Preserve the existing response handling (arrays for history/qa-history; `.ok`-based checks can be relaxed since `apiRequest` throws on !ok — wrap in try/catch exactly as today).
2. `client/src/pages/MediaWorkspacePage.tsx`: replace all five raw fetches (GET /api/debate-workspace/views, GET /api/debate-workspace/exports?limit=20, POST /views, DELETE /views/:id, POST /exports) with `apiClient.get/post/delete`. Keep the response shapes (`payload.views`, `payload.exports`, `data.export.csvBase64`). `apiRequest` throws on non-ok — adjust the `if (!response.ok)` blocks accordingly (they can be removed; the mutationFn throws are already handled by react-query).
3. `client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`: the `fetch(\`/api/ideology-timeline/${userId}?...\`)` and `window.location.href = /api/ideology-timeline/:userId?format=csv` calls must attach the token. For the JSON timeline: use `apiClient.get(...)`. For CSV export: `window.location.href` cannot carry headers — fetch the CSV with `apiClient.get(...)` (or a fetch with the token) into a Blob and trigger a client-side download (the file already has a blob-download pattern for JSON at ~line 154). Preserve query params (weeks, fromDate, toDate, compareParty, compareAverage).
4. `client/src/components/IdeologyTimeSeriesChart.tsx` (plain): same treatment for its `fetch(\`/api/ideology-timeline/${userId}?weeks=${weeks}\`)` — use `apiClient.get(...)`. (It is still mounted/imported by some page; keep it working.)
5. `client/src/lib/queryClient.ts`: only if you need a token-fetching variant that returns raw text (for CSV). If you can express CSV download purely with `apiClient.get` (parsing JSON→not possible for CSV), then add a minimal exported helper `apiFetch(path: string): Promise<Response>` that attaches the token and returns the Response, OR perform the CSV fetch inside the component using `supabase.auth.getSession()` directly. Prefer the smallest change; do not restructure the module.

**Do NOT**: change any server routes, add dependencies, change UI layout/behavior beyond the fetch calls, add a global `window.fetch` override, or touch other client pages.

**Gates**:
- `node_modules/.bin/tsc 2>&1 | grep -c "error TS"` ≤ 2644; per-file counts must not increase: ShadowCabinetDashboard.tsx ≤ 2, MediaWorkspacePage.tsx ≤ 17, IdeologyTimeSeriesChartEnhanced.tsx ≤ 7, IdeologyTimeSeriesChart.tsx ≤ 5, queryClient.ts ≤ 0.
- Code review: every hardened endpoint's client caller now attaches the bearer token; no UI regression.

---

## Adversary focus areas (cross-task)

- Task 1's `requireRole`/`isAdmin` must be importable exactly as Tasks 2–8 reference them (names, signatures).
- `req.user` shape consistency across supabaseAuth vs sessionMiddleware (Task 1) vs route handlers reading `req.user?.id`.
- Ideas submit userId derivation (Task 3) must match how session/bearer identity is attached (Task 1).
- Geographic/ideology ownership comparisons (Task 8) must use the same caller-id source as policy-voting (Task 5).
- No task may introduce a NEW file-level TS error in a shared file another task edits.
