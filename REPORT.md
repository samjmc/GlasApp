# Phase 3A — AI Integration Centralization: Delivery Report

## What `server/services/aiService.ts` does

New single ownership point for all outbound AI calls. No other file constructs an
AI SDK client or calls the SDK directly.

Exported API (typed wrappers, all sharing one retry/timeout/logging core):

- `callAI(prompt, options)` — convenience string-prompt → string completion (delegates to `callChatCompletion`)
- `callChatCompletion(params, options)` — OpenAI Chat Completions
- `callResponses(params, options)` — OpenAI Responses API
- `callEmbedding(text, options)` — OpenAI text embeddings
- `callImageGeneration(params, options)` — OpenAI image generation (DALL-E)
- `callAnthropicMessage(params, options)` — Anthropic Messages API
- `AIError` + `isOpenAIConfigured()` / `isAnthropicConfigured()`

Cross-cutting behavior in one place:

- **Retry**: exponential backoff with full jitter, default `maxRetries = 2`
  (3 total attempts), configurable via `AIOptions.retries`. SDK clients are
  constructed with `maxRetries: 0` so the SDK's internal retry never stacks on
  our loop.
- **Timeout**: per-attempt `AbortSignal.timeout()`, default 30s,
  configurable via `AIOptions.timeoutMs`.
- **Retryable classification**: 408/409/429/529/≥500 statuses plus
  timeout/connection error names; network-shaped errors with no status retry.
- **Fallback**: optional in-memory cache (`AIOptions.fallbackToCache`), keyed by
  operation + FNV-1a hash of the payload (stopgap until Phase 3C cache adapter).
- **Structured logging**: every call logs `[aiService] <operation>` with
  success/failure, attempt count, elapsed ms, and token usage when the provider
  returns it.
- Errors thrown as typed `AIError` (operation, attempts, elapsedMs, status, cause).

## Research note

No live web search was run in this resumed session; the installed SDKs were
inspected directly: `openai ^4.100.0`, `@anthropic-ai/sdk ^0.37.0` (package.json).
The wrapper matches the installed SDK's `chat.completions`, `responses`,
`embeddings`, `images` and Anthropic `messages` shapes, and takes an
`AbortSignal` in request options for timeouts — all confirmed against the
installed package types before writing. `dotenv` is already a dependency
(re-used, no new dependencies added).

## Files migrated to route through aiService.ts

From `git status` (all under `server/`), 22 files modified + 1 new:

```
server/services/aiService.ts                      (NEW — the wrapper)
server/jobs/extractPoliticianStances.ts
server/jobs/processDebateSummaries.ts
server/jobs/reviewNegativeFeedback.ts
server/routes/admin/debateAdminRoutes.ts
server/routes/ai/analysis.ts
server/routes/chatRoutes.ts
server/routes/politicianChatRoutes.ts
server/routes/quiz/index.ts
server/routes/storytellingRoutes.ts
server/scripts/analyze_narrative.ts
server/services/aiNewsAnalysisService.ts
server/services/articleImportanceService.ts
server/services/debateIdeologyAnalysisService.ts
server/services/eventDeduplicationService.ts
server/services/historicalBaselineService.ts
server/services/newsImageGenerationService.ts
server/services/openaiService.ts
server/services/outcomesTrackingService.ts
server/services/policyOpportunityService.ts
server/services/policyStanceHarvester.ts
server/services/shadowCabinet.ts
server/services/topicClassificationService.ts
```

These go beyond the three files named in DISPATCH_BRIEF (openaiService,
aiNewsAnalysisService, dailySessionService). The extras are every other
direct-AI-SDK caller found by grep, which the brief explicitly permits ("Any
other file found via grep that calls an AI SDK directly"). `dailySessionService.ts`
was checked and does NOT call the AI SDK directly (only imports
`generateVoteQuestion` from openaiService), so it was left unmodified.

`chatRoutes.ts`, `politicianChatRoutes.ts`, `quiz/index.ts`,
`storytellingRoutes.ts`, `admin/debateAdminRoutes.ts`, `ai/analysis.ts` and
`scripts/analyze_narrative.ts` were migrated during this task run — note this
because an earlier session's status snapshot listed some of them as not-yet
migrated; the worktree on disk is the ground truth and they are done.

## `npm run check` comparison

- Verified baseline (main @ 9961db2, fresh scratch worktree): **2699** errors
  (provided externally; not re-derived).
- This worktree, clean tsc run (`rm tsbuildinfo && npm run check`): **2691**
  errors — **8 fewer** than baseline.

The migration net-reduced TypeScript errors. The typed `callChatCompletion`
boundary is stricter than the raw SDK calls it replaced; the handful of
`TS2322` ("unknown not assignable to ChatCompletionMessageParam[]") errors it
surfaced at migrated call sites were fixed with explicit casts to the OpenAI
types at those boundaries (same escape-hatch intent as the pre-existing
`as unknown`). `server/services/aiService.ts` itself compiles with zero errors.
All remaining errors in the edited files are pre-existing and unchanged.

## Remaining work for follow-up

Direct AI SDK call sites still present in `server/` after this migration:

- **`server/services/multiAgentTDScoring.ts`** — `new OpenAI(...)` (line 111) and
  four `.chat.completions.create(...)` calls (lines 571, 616, 695, 749).
  **Intentionally NOT migrated**: DISPATCH_BRIEF forbids touching
  `server/services/*Scoring*.ts` (scoring consolidation is owned by a parallel
  team; editing would cause merge conflicts). Migrate after that team merges.

Not an AI call (grep false positive, do not migrate):

- `server/services/twilioService.ts:60` — `client.messages.create(...)` is the
  Twilio SMS API, not an AI SDK call.

The wrapper exports `callResponses`/`callEmbedding`/`callImageGeneration`/
`callAnthropicMessage` which are not yet consumed by any migrated call site;
they were added to cover the SDK surface for follow-up migrations.

## Self-vetting checklist (per DISPATCH_BRIEF.md)

- [x] Re-read every changed line against acceptance criteria — verified the
      wrapper shape (retries, timeout, fallback, logging) and traced migrated
      call sites back through their callers.
- [x] Verified actual usage of each wrapper function by grep, not by name
      assumption — `callChatCompletion` is the only wrapper consumed by migrated
      sites (plus `callAI` used by some services).
- [x] No new abstractions/config beyond what was asked — the only added surface
      is the wrapper API + `AIOptions`; no new dependencies (`dotenv` reused).
- [x] Changes kept inside the files-to-modify list plus extra direct-AI-SDK
      callers found by grep (documented above). No `client/`, no `schema.ts`,
      no `*Scoring*.ts`, no adjacent refactoring.
- [x] Ran `npm run check` myself in this worktree: **2691** errors (clean run,
      cache cleared), below the 2699 baseline. Not assumed.
- [x] Risks flagged: (1) the fallback cache is an in-memory stopgap pending
      Phase 3C — not persisted; (2) boundary casts at migrated call sites
      preserve the prior `as unknown`/`@ts-ignore` escape-hatch behaviour rather
      than hardening message-array typing, which is pre-existing debt;
      (3) SDK clients now use `maxRetries: 0` (retry moved into the wrapper) —
      behaviorally equivalent, but verify in staging under flaky conditions.

## Commit

Created with the message:
`refactor: centralize AI integration into aiService wrapper (Phase 3A)`