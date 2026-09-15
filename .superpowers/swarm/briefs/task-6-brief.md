### Task 6 — Shadow cabinet + debate workspace: admin-only

**Files**: `server/routes/shadowRoutes.ts`, `server/routes/debateWorkspaceRoutes.ts`

**Background**: Shadow Cabinet routes (`/api/shadow/analyze|history|qa-history`) have NO auth: `/analyze` runs an LLM pipeline on an arbitrary caller-supplied URL (cost + SSRF risk) and the history endpoints expose internal QA-audit data. The client surfaces these only on the `/admin/shadow` dashboard. Debate workspace (`/api/debate-workspace/views` GET/POST/PATCH/DELETE, `/exports` GET/POST) have NO auth — anonymous users can create/delete shared views and exports.

**Changes**:
- `shadowRoutes.ts`: protect ALL three routes (`/analyze`, `/history`, `/qa-history`) with `requireAdminAccess` (import from `../middleware/adminAccess`). Log each operation with the existing `requestLogger(req)` pattern (import from `../utils/logger`) — `log.info({ operation: 'admin.bots', actor: req.user?.email ?? req.session?.userId }, 'Bot admin action')`. Do NOT rely on new Task 1 exports.
- `debateWorkspaceRoutes.ts`: protect `/views` (GET/POST/PATCH/DELETE) and `/exports` (GET/POST) with `requireAdminAccess`. Log write operations (views POST/PATCH/DELETE, exports POST) with the existing `requestLogger(req)` pattern from `../../utils/logger`. Do NOT rely on new Task 1 exports.
- Keep existing response shapes and validation.

**Do NOT**: change the workspace query helpers (`normalizeFilters`, `createExportEntry`) or any debate data services.

**Gates**:
- tsc total ≤ 2644; per-file counts: shadowRoutes.ts ≤ 2, debateWorkspaceRoutes.ts ≤ 40.

---

