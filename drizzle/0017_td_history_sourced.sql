ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "summary" text NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "passages" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "source_url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "source_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "source_revision" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "retrieved_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "politics"."td_historical_baselines" ADD COLUMN "model" varchar(80);--> statement-breakpoint
COMMENT ON TABLE "politics"."td_historical_baselines" IS 'TD background copied word for word from one Wikipedia revision (server/tdHistory). No model-written text: a model only chooses passages, and code checks each against source_revision. CC BY-SA 4.0 source text.';--> statement-breakpoint
COMMENT ON COLUMN "politics"."td_historical_baselines"."source_revision" IS 'The Wikipedia revision id (at least 72 hours old when read) that summary and every passage were checked against.';
