-- username and constituency join the other profile fields on politics.users (until now they lived only in
-- Supabase user_metadata). Nullable, no backfill: GET /api/profile/me copies each from the caller's
-- metadata the first time it sees the row value NULL, and the daily session reads the metadata until then.
ALTER TABLE "politics"."users" ADD COLUMN "username" varchar(50);--> statement-breakpoint
ALTER TABLE "politics"."users" ADD COLUMN "constituency" varchar(100);
