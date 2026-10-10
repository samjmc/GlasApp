ALTER TABLE "politics"."debate_participation" ADD COLUMN "replies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."debate_participation" ADD COLUMN "taken_up" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."debate_participation" ADD COLUMN "taken_up_points" integer DEFAULT 0 NOT NULL;