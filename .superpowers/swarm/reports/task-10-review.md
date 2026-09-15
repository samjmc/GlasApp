# Task 10 Review — Client compatibility: attach bearer tokens to privileged pages

**Reviewer**: task reviewer (spec + quality)
**Verdict**: SPEC **PASS** — QUALITY **APPROVED** (0 Critical, 0 Important, 4 Minor)
**Artifacts**: brief `briefs/task-10-brief.md`, diff `diffs/task-10.diff`, report `reports/task-10-report.md`

Note on scope: `git status` shows many modified `server/**` files, but none appear in
`diffs/task-10.diff` — those belong to Tasks 1–9 sharing the worktree. Task 10's diff is
limited to the five client files the brief names, so the "no server file changes" constraint
is satisfied for this task.

---

## 1. Spec compliance

All hardened endpoints have their client callers token-attached via the existing
`apiClient`/`apiRequest` helper (brief lines 7–12), plus the sanctioned minimal `apiFetch`
helper for the CSV response.

| Endpoint (brief lines 7–12) | Caller | Status |
|---|---|---|
| `GET /api/shadow/history` | `ShadowCabinetDashboard.tsx:121` `apiClient.get` | PASS |
| `GET /api/shadow/qa-history` | `ShadowCabinetDashboard.tsx:136` `apiClient.get` | PASS |
| `POST /api/shadow/analyze` | `ShadowCabinetDashboard.tsx:155` `apiClient.post('/api/shadow/analyze', { url })` | PASS |
| `GET /api/debate-workspace/views` | `MediaWorkspacePage.tsx:29` `apiClient.get` | PASS |
| `POST /api/debate-workspace/views` | `MediaWorkspacePage.tsx:77` `apiClient.post` | PASS |
| `DELETE /api/debate-workspace/views/:id` | `MediaWorkspacePage.tsx:94` `apiClient.delete` | PASS |
| `GET /api/debate-workspace/exports?limit=20` | `MediaWorkspacePage.tsx:34` `apiClient.get` | PASS |
| `POST /api/debate-workspace/exports` | `MediaWorkspacePage.tsx:103` `apiClient.post` | PASS |
| `GET /api/ideology-timeline/:userId` (enhanced JSON) | `IdeologyTimeSeriesChartEnhanced.tsx:114` `apiClient.get` | PASS |
| `GET /api/ideology-timeline/:userId?format=csv` | `IdeologyTimeSeriesChartEnhanced.tsx:155` `apiFetch` → `Blob` → client download | PASS |
| `GET /api/ideology-timeline/:userId` (plain JSON) | `IdeologyTimeSeriesChart.tsx:61` `apiClient.get` | PASS |

- A repo-wide grep for these endpoint strings under `client/src` returns only the four
  listed files; no leftover raw `fetch`/`window.location.href` callers of the hardened
  endpoints remain (brief line 18).
- Response shapes preserved against the actual server routes:
  - `/api/shadow/history`, `/api/shadow/qa-history` return a bare array
    (`server/routes/shadowRoutes.ts:41,54`) → `Array.isArray(data)` handling kept
    (diff 217–236).
  - `/views` returns `{ success, views }`, `/exports` returns `{ success, exports }`
    (`debateWorkspaceRoutes.ts:218,340`) → `payload?.views ?? []` / `payload?.exports ?? []`
    kept (diff 136–147).
  - `POST /exports` returns `{ export: { csvBase64, period, ... } }`
    (`debateWorkspaceRoutes.ts:424-433`) → `onSuccess` `data?.export?.csvBase64` /
    `data?.export?.period` untouched (`MediaWorkspacePage.tsx:108-118`).
  - Enhanced timeline returns `{ success, timeline, events, comparison, usingSnapshots }`
    (`ideologyTimelineRoutesEnhanced.ts:216-223`) and CSV is sent as raw `text/csv`
    (`:208-212`) → `apiClient.get` for JSON, `apiFetch(...).text()` for CSV is correct.
- Mutations still work: `apiRequest` throws on non-ok, and the removed `if (!response.ok)`
  blocks were redundant (brief lines 8–9); react-query surfaces `mutationFn` throws, and
  `useQuery` `isError`/`error` paths are unchanged (`MediaWorkspacePage.tsx:344-347,424-427`).
- Error handling preserved: every try/catch retained — `ShadowCabinetDashboard.tsx:120-131,
  135-146,154-164`; `IdeologyTimeSeriesChartEnhanced.tsx:101-129,154-166`;
  `IdeologyTimeSeriesChart.tsx:57-73`.
- `queryClient.ts` change is purely additive: new `apiFetch` (`queryClient.ts:90-105`); no
  existing function (`apiRequest`, `apiClient`, `getQueryFn`) was modified (diff 83–114),
  so no semantics changed.

## 2. Global constraints

- No server file changes in the task diff — PASS (see scope note).
- No new dependencies (`package.json` untouched) — PASS.
- No global `window.fetch` override — PASS.
- No UI/layout changes beyond fetch plumbing — PASS (see Minor 2 for a brief-sanctioned
  data-selection nuance in CSV).
- No TS config changes — PASS. Gates were already confirmed by the verifier (tsc 2642;
  per-file counts within baselines).
- No commit — PASS (last commit predates the task).

## 3. Findings

### Critical
None.

### Important
None.

### Minor

1. **`apiFetch` duplicates bearer-header logic** — `queryClient.ts:90-105` re-implements the
   token read + header build + `credentials: "include"` already present in `apiRequest`
   (`:55-84`) and `getQueryFn` (`:132-157`). This is explicitly sanctioned by brief line 12
   ("add a minimal exported helper `apiFetch(path: string): Promise<Response>`") and the
   module-restructure prohibition, so it is acceptable as-is. Non-blocking: a future cleanup
   could factor a private `authedFetch(path, init)` used by all three.

2. **CSV export now honors active filters** — the old URL was
   `?format=csv&weeks=${weeks}` only; the new one appends `fromDate`, `toDate`,
   `compareParty`, `compareAverage` (diff 57–66). When filters are set, the exported CSV can
   now contain a different window than before. Brief line 10 explicitly requires preserving
   those params, and the report documents it (report line 22), so this is spec-compliant —
   flagged only so it is not mistaken for pure plumbing.

3. **Failed-load error text surfaced in the UI changed** — dropping the generic
   `throw new Error("Failed to load saved views"/"Failed to load export history")` means the
   query error message now renders as `"<status>: <body>"` (`MediaWorkspacePage.tsx:344-347,
   424-427`) instead of the friendly string. Brief line 9 sanctions removing the `.ok`
   blocks, and the server message is still included (not lost), so this is minor/cosmetic.

4. **Object URL revoked synchronously after `link.click()`** —
   `IdeologyTimeSeriesChartEnhanced.tsx:162-163` calls `URL.revokeObjectURL(url)`
   immediately after `click()` without appending the anchor to the DOM. This can cancel the
   download in some browsers (notably Firefox). It faithfully follows the existing
   `exportJSON`/`exportPNG` pattern in the same file (`:169-178,180-195`) and brief line 10's
   instruction to reuse that pattern, so it is consistent with the codebase; noted as a
   robustness improvement opportunity only.

## 4. Undocumented deviations

None. The report accurately describes every change in the diff, including the new
`apiFetch` helper, the CSV blob-download rewrite, and the preserved query params.
