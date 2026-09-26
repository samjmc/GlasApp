-- Facts-only TD score (docs/plans/facts-only-scoring.md).
-- Part 1 is drizzle-kit's output, verbatim, minus its article_tds statements.
-- Part 2 is HAND-WRITTEN and replaces those statements (see the note there).
ALTER TABLE "politics"."party_scores" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politics"."td_score_history" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "politics"."party_scores" CASCADE;--> statement-breakpoint
DROP TABLE "politics"."td_score_history" CASCADE;--> statement-breakpoint
DROP INDEX "politics"."td_scores_overall_elo_idx";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" ADD COLUMN "computed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "politics"."news_sources" DROP COLUMN "credibility";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "overall_elo";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "transparency_elo";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "effectiveness_elo";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "integrity_elo";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "consistency_elo";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "news_score";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "elo_change_7d";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "elo_change_30d";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "total_stories";--> statement-breakpoint
ALTER TABLE "politics"."td_scores" DROP COLUMN "last_scored_at";--> statement-breakpoint
-- ===========================================================================================
-- Part 2, HAND-WRITTEN: article_td_scores -> article_tds, keeping every existing link row.
-- drizzle-kit (answer "rename" at its prompt) emits the RENAME but then drops and re-creates
-- the foreign key and both indexes, and adds the new primary key BEFORE dropping `id`, which
-- fails ("multiple primary keys"). Instead: drop `id` (its primary key and sequence go with it),
-- promote the existing unique index to the primary key, rename the FK and index in place, then
-- drop the verdict columns. The names match the snapshot, so a re-generate reports no change.
-- ===========================================================================================
ALTER TABLE "politics"."article_td_scores" RENAME TO "article_tds";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" ADD CONSTRAINT "article_tds_article_id_td_id_pk" PRIMARY KEY USING INDEX "article_td_scores_article_td_idx";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" RENAME CONSTRAINT "article_td_scores_td_id_tds_id_fk" TO "article_tds_td_id_tds_id_fk";--> statement-breakpoint
ALTER INDEX "politics"."article_td_scores_td_created_idx" RENAME TO "article_tds_td_created_idx";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "impact";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "dimension_scores";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "story_type";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "sentiment";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "needs_review";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "reasoning";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "analyzed_by";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "is_ideological_policy";--> statement-breakpoint
ALTER TABLE "politics"."article_tds" DROP COLUMN "policy_direction";
