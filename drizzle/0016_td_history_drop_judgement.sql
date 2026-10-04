-- TD history (docs/plans/td-history.md): drop the old writer's judgement columns. The table has
-- never held a row (its writer saved to a public table that does not exist), and this checks
-- that instead of assuming it: dropping these columns from a filled table would lose research.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "politics"."td_historical_baselines") THEN
    RAISE EXCEPTION 'td_historical_baselines has rows; this migration expects it empty';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "baseline_score";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "confidence";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "historical_summary";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "key_findings";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "reasoning";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "controversies_noted";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "research_date";--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" DROP COLUMN "analyzed_by";
