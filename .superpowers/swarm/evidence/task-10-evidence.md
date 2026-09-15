# Task 10 Evidence — Client bearer-token attachment (independent verification)

Worktree: `/private/tmp/glasapp-worktrees/phase-4a-route-security`
Verifier: independent (ran every gate from worktree root; implementer claims not trusted).
Date: 2026-09-15

## Gate 1 — Total TS error count

Command:
```
node_modules/.bin/tsc 2>&1 | grep -c "error TS"
```
Actual output:
```
2642
```
Expected ≤ 2644 → **PASS** (2642 ≤ 2644).

## Gate 2 — Per-file error counts

Command:
```
node_modules/.bin/tsc 2>&1 | grep "error TS" | grep -oE "^client/[^(]+" | sort | uniq -c
```
Actual output (relevant lines):
```
   5 client/src/components/IdeologyTimeSeriesChart.tsx
   7 client/src/components/IdeologyTimeSeriesChartEnhanced.tsx
  17 client/src/pages/MediaWorkspacePage.tsx
   2 client/src/pages/admin/ShadowCabinetDashboard.tsx
```
`client/src/lib/queryClient.ts` — not present in output (0 errors).

| File | Actual | Baseline max | Result |
|---|---|---|---|
| client/src/pages/admin/ShadowCabinetDashboard.tsx | 2 | ≤ 2 | PASS |
| client/src/pages/MediaWorkspacePage.tsx | 17 | ≤ 17 | PASS |
| client/src/components/IdeologyTimeSeriesChartEnhanced.tsx | 7 | ≤ 7 | PASS |
| client/src/components/IdeologyTimeSeriesChart.tsx | 5 | ≤ 5 | PASS |
| client/src/lib/queryClient.ts | 0 | ≤ 0 | PASS |

## Gate 3 — ShadowCabinetDashboard endpoint calls

Command: `grep -n "fetch|apiClient|apiFetch" client/src/pages/admin/ShadowCabinetDashboard.tsx`
Actual:
```
121:        const data = await apiClient.get("/api/shadow/history");
136:        const data = await apiClient.get("/api/shadow/qa-history");
155:        await apiClient.post("/api/shadow/analyze", { url });
```
No raw `fetch` remains to `/api/shadow/history`, `/qa-history`, `/analyze` → **PASS**.

## Gate 4 — MediaWorkspacePage endpoint calls + payload shapes

Command: `grep -n "fetch|apiClient|apiFetch|views|exports|csvBase64" client/src/pages/MediaWorkspacePage.tsx`
Actual:
```
29:  const payload = await apiClient.get("/api/debate-workspace/views");
30:  return payload?.views ?? [];
34:  const payload = await apiClient.get("/api/debate-workspace/exports?limit=20");
35:  return payload?.exports ?? [];
77:      return apiClient.post("/api/debate-workspace/views", payload);
94:      return apiClient.delete(`/api/debate-workspace/views/${viewId}`);
103:      return apiClient.post("/api/debate-workspace/exports", payload);
108:      const base64 = data?.export?.csvBase64;
```
All five calls use `apiClient` (2× get, 2× post, 1× delete). `payload.views`, `payload.exports`, `data.export.csvBase64` preserved → **PASS**. No raw `fetch` in file.

## Gate 5 — IdeologyTimeSeriesChartEnhanced (JSON + CSV)

Command: `grep -n "fetch|apiClient|apiFetch|window.location.href|ideology-timeline" client/src/components/IdeologyTimeSeriesChartEnhanced.tsx`
Actual:
```
8:import { apiClient, apiFetch } from '@/lib/queryClient';
114:      const data = await apiClient.get(`/api/ideology-timeline/${userId}?${params}`);
155:      const response = await apiFetch(`/api/ideology-timeline/${userId}?${params}`);
161:      link.download = `ideology-timeline-${userId}.csv`;
```
- JSON timeline via `apiClient.get` → PASS.
- CSV export uses `apiFetch` (token-attached fetch) → `response.text()` → `Blob` → `<a download>`; no `window.location.href` to `/api/ideology-timeline` remains → PASS.
- Query params `weeks`, `fromDate`, `toDate`, `compareParty`, `compareAverage`, plus `format=csv` preserved (diff lines 57–65) → PASS.

## Gate 6 — IdeologyTimeSeriesChart (plain)

Command: `grep -n "fetch|apiClient|apiFetch|ideology-timeline" client/src/components/IdeologyTimeSeriesChart.tsx`
Actual:
```
5:import { apiClient } from '@/lib/queryClient';
61:        const data = await apiClient.get(`/api/ideology-timeline/${userId}?weeks=${weeks}`);
```
Uses `apiClient.get` → **PASS**.

## Gate 7 — queryClient.ts change minimal + non-behavioral

Command: `git diff HEAD -- client/src/lib/queryClient.ts` and full read of file.
Added export `apiFetch(path: string): Promise<Response>` (lines 86–105) that reuses `getAccessToken`, attaches `Authorization: Bearer`, sets `credentials: "include"`, calls `throwIfResNotOk`, and returns the raw Response. `apiRequest` (lines 55–84) and `apiClient` (lines 109–115) are unchanged. Module not restructured → **PASS**.

## Gate 8 — No global fetch override added; scope confinement

- `git status --porcelain` shows exactly these 5 modified client files (plus server files owned by other tasks):
  `IdeologyTimeSeriesChart.tsx`, `IdeologyTimeSeriesChartEnhanced.tsx`, `queryClient.ts`, `MediaWorkspacePage.tsx`, `ShadowCabinetDashboard.tsx`.
- No other client file modified by this task; the task-10.diff touches only those 5 files.
- task-10.diff contains zero server-file hunks → no server files changed by Task 10 (server modifications in the worktree belong to Tasks 1–9).
- Pre-existing `window.fetch =` override exists at `client/src/contexts/RegionContext.tsx:88`, but that file is NOT modified and is NOT in task-10.diff — it is pre-existing, not added by this task → **PASS**.

## Verdict

**PASS** — all gates met; no failing gate.
