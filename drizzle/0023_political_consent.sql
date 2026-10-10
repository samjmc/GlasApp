ALTER TABLE "politics"."users" ADD COLUMN "political_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "politics"."users" ADD COLUMN "political_consent_version" smallint;