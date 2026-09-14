-- Phase 2B schema cleanup: archive the unused quiz_results_history table.
--
-- Verification (2026-09-14): the only code path that reads/writes this table
-- (server/services/quizResultsService.ts, called exclusively from
-- server/routes/profileHistoryRoutes.ts) is never mounted in server/routes.ts
-- and has no client-side callers. The live quiz-history feature
-- (/api/quiz-history, server/routes/quiz/index.ts -> quizHistoryService.ts)
-- uses a separate raw-SQL "quiz_history" table, not this one. Renaming rather
-- than dropping keeps this reversible and zero-downtime.
--
-- shared/schema.ts has been updated so the Drizzle table object
-- (`quizResultsHistory`) now points at the new physical table name; no other
-- application code needed to change.

ALTER TABLE IF EXISTS quiz_results_history RENAME TO archived_quiz_results_history;

-- Rollback:
-- ALTER TABLE archived_quiz_results_history RENAME TO quiz_results_history;
