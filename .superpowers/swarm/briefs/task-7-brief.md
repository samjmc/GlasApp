### Task 7 — SMS test endpoint admin-gating + AI analysis input bounds

**Files**: `server/routes/smsRoutes.ts`, `server/routes/ai/analysis.ts`

**Background**: `GET /api/sms/test` is marked "FOR DEVELOPMENT ONLY" but ships in production and reveals Twilio config state with NO auth. `POST /api/sms/send` is already authenticated + zod-validated (leave it). The AI analysis routes hit paid LLM endpoints with unbounded input: `POST /api/ai/analyze-bulk` accepts an unbounded `responses` array; `complete-analysis`/`context-analysis` accept unvalidated `dimensions`/`weights`.

**Changes**:
1. `smsRoutes.ts`: gate `GET /test` with `requireAdminAccess` (import from `../middleware/adminAccess`). Log the test call with the existing `requestLogger(req)` pattern from `../utils/logger`. Do NOT rely on new Task 1 exports. Leave `/send` and `/status` as-is.
2. `ai/analysis.ts`:
   - `bulkAnalysisSchema`: add `.max(50)` to the `responses` array, and `.max(4000)` to each `text` and `question` string.
   - `singleAnalysisSchema`: `.max(4000)` on `text`, `.max(2000)` on `questionContext`.
   - `complete-analysis` and `context-analysis`: add zod validation using `dimensionsSchema` (already defined — `z.number().min(-10).max(10)` per dimension) for `req.body.dimensions`, and a `weights` schema of `z.record(z.string(), z.number().min(0).max(3)).optional()`.
   - On zod failure respond 400 `{ success:false, message:'Invalid request data', details: error.errors }` (mirror the existing pattern in `analyze-text`/`analyze-bulk`).
   - Do NOT add authentication to these user-facing AI routes (frontend quiz flow calls them unauthenticated) — input bounds only.

**Do NOT**: change `callChatCompletion`/openaiService, or the `/send` route.

**Gates**:
- tsc total ≤ 2644; per-file counts: smsRoutes.ts ≤ 0, ai/analysis.ts ≤ 0 (these are currently error-free — keep them error-free).

---

