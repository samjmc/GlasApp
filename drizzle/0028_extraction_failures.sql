-- Failed item-extraction runs in a row on the same speeches (sweep P22). A debate or exchange the
-- model can never read is then skipped at MAX_FAILED_RUNS instead of paid for every night.
-- Existing failed runs start at 0, so each gets the usual tries. Nothing is deleted.
ALTER TABLE "politics"."debate_extraction_runs" ADD COLUMN "failures" smallint DEFAULT 0 NOT NULL;
