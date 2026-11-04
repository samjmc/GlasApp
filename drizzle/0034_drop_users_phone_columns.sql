DROP INDEX "politics"."users_phone_number_idx";--> statement-breakpoint
ALTER TABLE "politics"."users" DROP COLUMN "phone_number";--> statement-breakpoint
ALTER TABLE "politics"."users" DROP COLUMN "phone_verified";--> statement-breakpoint
ALTER TABLE "politics"."users" DROP COLUMN "phone_code_hash";--> statement-breakpoint
ALTER TABLE "politics"."users" DROP COLUMN "phone_code_expires_at";--> statement-breakpoint
ALTER TABLE "politics"."users" DROP COLUMN "phone_code_attempts";