# Phase 3A — Self-Review Pass (AI Integration Centralization)

Date: 2026-09-14. Reviewing commits `fa875d5` + `b5ff729` (HEAD) against
`DISPATCH_BRIEF.md` acceptance criteria.

## What I checked

1. **Wrapper vs. acceptance criteria** — read `server/services/aiService.ts`
   line by line: `callAI`/`callChatCompletion`/`callResponses`/`callEmbedding`/
   `callImageGeneration`/`callAnthropicMessage` all share one
   `executeWithRetry` core (exponential backoff w/ full jitter, default 3
   attempts, per-attempt `AbortSignal.timeout` 30s, retryable-status
   classification, optional in-memory fallback cache, `[aiService]` structured
   logging with attempt count / elapsed ms / token usage, typed `AIError`).
   No new dependencies; `dotenv` re-used.
2. **Every migrated file** (`git diff 9961db2 HEAD`, all 24 files) read
   line-by-line against the pre-change version — verified each call was really
   migrated and the payload (model, messages, temperature, response_format,
   max_tokens, tool_choice) is byte-identical to the original.
3. **No direct SDK call sites remain** — grep for `new OpenAI`/`new Anthropic`/
   SDK method calls across `server/`. Only `multiAgentTDScoring.ts` still
   constructs `new OpenAI` and calls `chat.completions.create`; it matches the
   brief's `server/services/*Scoring*.ts` exclusion (parallel team owns it), so
   it was intentionally left. `twilioService.ts` is a grep false positive
   (Twilio `client.messages.create`, not an AI SDK). Type-only `import type
   OpenAI` in 5 files is fine — none constructs a client.
4. **Behavior/response-shape diffs** — `politicalEvolutionRoutes.ts` (raw
   fetch → wrapper): identical payload, same `503` no-key pre-check, same
   `500` catch contract, only error type changes `Error`→`AIError` (Error
   subclass). `chatRoutes.ts`/`quiz`/`analyze_narrative.ts`/`shadowCabinet.ts`:
   `as unknown` casts replaced with typed casts — runtime identical. Vision
   agent `content` was already `unknown[]` of content parts; the
   `ChatCompletionContentPart[]` cast is type-only.
5. **`dailySessionService.ts`** — confirmed it imports only
   `generateVoteQuestion` from openaiService (which now routes through the
   wrapper) and makes no direct SDK call; correctly left unmodified.
6. **Secrets scan** — no hardcoded keys/tokens; all key access via
   `process.env`.
7. **TypeScript** — re-derived the baseline from scratch:
   - `main@9961db2` in a fresh scratch worktree, `npm run check` = **2699**
     errors.
   - This worktree after fixes, `npm run check` = **2690** errors (**9 fewer**).
   - Diffed error sets as `(file, error-code)` pairs: **zero new pairs** vs
     baseline; 4 `TS2769` error sites eliminated (`chatRoutes.ts`,
     `quiz/index.ts`, `analyze_narrative.ts`, `shadowCabinet.ts`).
     `aiService.ts` itself: 0 errors.

## What I found and fixed

1. **Removed "API key not set" warnings (behavior change, criterion 7).**
   Three services' original `getOpenAIClient()` logged a `console.warn`
   before returning null when `OPENAI_API_KEY` was unset; the migration
   silently dropped those. Restored the exact original warnings in
   `policyOpportunityService.ts` (×2), `policyStanceHarvester.ts` (×2) and
   `topicClassificationService.ts` (×1).
2. **30s default timeout regresses long-generation calls.** The raw SDK calls
   previously used the SDK's ~10-minute default timeout. The wrapper's 30s
   default would newly time out the highest-token calls: `researchWithClaude`
   / `researchWithGPT4` (`max_tokens: 4000`) and `verifyDelivery`
   (`max_tokens: 2000`). Added explicit `timeoutMs` at those call sites
   (300s / 300s / 120s) to preserve their previous tolerance while still
   bounding runtime. Other call sites keep the brief-sanctioned 30s default.
3. **REPORT.md factual errors.** It claimed `callAI` was "used by some
   services" and that `callResponses`/`callEmbedding`/`callImageGeneration`/
   `callAnthropicMessage` were "not yet consumed by any migrated call site" —
   both wrong. All four typed wrappers ARE consumed; only `callAI` is unused
   (kept because the brief's acceptance criteria require the
   `callAI(prompt, options)` export shape). Corrected both statements.

## Final `npm run check`

**2690 errors** (baseline 2699) — 9 fewer, zero new `(file, error-code)` pairs.
All errors in the touched files are pre-existing.

## Risks / not changed

- `multiAgentTDScoring.ts` left as-is per the brief's `*Scoring*` exclusion;
  migrate after the scoring team merges.
- SDK `maxRetries: 0` + wrapper retry loop is behaviorally equivalent to the
  SDK's default 2 retries but should be verified in staging under flaky
  conditions.
- `fallbackToCache` is an in-memory stopgap and no call site currently opts in.
- The wrapper retries any error without a numeric `status` (network-shaped) —
  intended, but retryable classification is broader than the SDK's.