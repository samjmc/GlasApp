### Task 4 — Parliamentary scores: protect trigger-scrape

**File**: `server/routes/parliamentary/scores.ts`

**Background**: `POST /api/parliamentary/scores/trigger-scrape` triggers a full news scrape job (LLM + network + DB cost) with NO auth. `/recalculate` already uses `requireAdminAccess` — keep it.

**Changes**:
- Add `requireAdminAccess` middleware to `POST /trigger-scrape` (import already exists at line 31).
- Inside the handler, log with `requestLogger(req)` pattern (import from `../../utils/logger`) — do NOT rely on new Task 1 exports.
- Leave `/recalculate` as-is.

**Do NOT**: touch any other endpoint in the file (58 baseline errors there — keep your change minimal).

**Gates**:
- tsc total ≤ 2644; per-file count: parliamentary/scores.ts ≤ 58.

---

