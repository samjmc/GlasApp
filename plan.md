# GlasApp Refactoring Plan

Full roadmap: see [REFACTORING_ROADMAP.md](REFACTORING_ROADMAP.md) and live status in [PHASE_PROGRESS.md](PHASE_PROGRESS.md).

## Implementation Boundaries

Phase 1 (complete):
- `server/storage.ts`
- `server/routes/ideologyTimelineRoutes.ts`
- `package.json`
- `server/replitAuth.ts`
- `server/auth/supabaseAuth.ts`

Phase 1B — Gate Remediation (dispatched, see Task 1E below):
- `server/storage.ts`
- `server/routes/authRoutes.ts`
- `package.json`

Phase 2+ boundaries are declared per-task in each DeepSeek team dispatch brief (see [TEAM_DISPATCH_PROTOCOL.md](TEAM_DISPATCH_PROTOCOL.md)) and appended here as tasks are dispatched, so the Scope gate check stays accurate.

## Branch Reconciliation (2026-09-14)

`main` and `test-gate-fix` had diverged (see [DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md](DISPATCH_ISOLATION_AND_BRANCH_STRATEGY.md), now ADOPTED). One-time reconciliation executed:

- `main` merged with `origin/main`'s admin-security fix (`001656f`) → new `main` tip `9961db2` (local only, not pushed — pending sign-off).
- `test-gate-fix` rebased onto reconciled `main` → new tip `6d19bc0`.
- `feature/phase-2a-component-consolidation` rebased → `3e12cca`.
- `feature/phase-2b-schema-cleanup` rebased → `a9804f8`.
- `feature/phase-2c-service-consolidation` rebased → `6d19bc0` (0 unique commits; identical to test-gate-fix tip).

**Pinned base SHA for the next dispatch round:** `6d19bc0` (test-gate-fix's current tip). Every team dispatched after this point must branch from this exact SHA via `git worktree add -b <branch> <worktree_path> 6d19bc0`, per Section 3 of the strategy doc — not from a mutable branch name.

Phase 2A/2B/2C boundaries (for Scope gate accuracy):
- `feature/phase-2a-component-consolidation`: deleted map/results/quiz-helper dead components; `client/src/App.tsx`; `client/src/hooks/useQuiz.ts`; `client/src/contexts/QuizContext.tsx` (renamed from `QuizContextNew.tsx`).
- `feature/phase-2b-schema-cleanup`: `migrations/0002_archive_quiz_results_history.sql`; `migrations/0003_add_query_performance_indices.sql`; `shared/schema.ts`.
- `feature/phase-2c-service-consolidation`: investigation only, no files modified.
