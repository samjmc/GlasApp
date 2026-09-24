ALTER TABLE "politics"."news_articles" ADD COLUMN "relevance_score" smallint;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD COLUMN "category" varchar(32);--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD COLUMN "ai_summary" text;