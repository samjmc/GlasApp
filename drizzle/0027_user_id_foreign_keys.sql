-- Foreign keys from the user-keyed political tables to politics.users, ON DELETE CASCADE, so a
-- users row deleted by any route takes its political data with it (sweep D-F17).
-- drizzle-kit's four ADD CONSTRAINT statements, HAND-EDITED to add NOT VALID, then a HAND-WRITTEN
-- VALIDATE for each, which checks the rows already there. VALIDATE fails, and the migration with it,
-- if any row's user_id has no politics.users row. Nothing is deleted here; remove such rows by hand
-- first. (db:migrate runs this in one transaction, so the locks are held to the end; the tables are
-- small.)
-- ideology_profiles.subject_id is not included: it also holds TD ids and party names.
ALTER TABLE "politics"."pledge_category_priorities" ADD CONSTRAINT "pledge_category_priorities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "politics"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."quiz_results" ADD CONSTRAINT "quiz_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "politics"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."daily_sessions" ADD CONSTRAINT "daily_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "politics"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."policy_votes" ADD CONSTRAINT "policy_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "politics"."users"("id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "politics"."pledge_category_priorities" VALIDATE CONSTRAINT "pledge_category_priorities_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "politics"."quiz_results" VALIDATE CONSTRAINT "quiz_results_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "politics"."daily_sessions" VALIDATE CONSTRAINT "daily_sessions_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "politics"."policy_votes" VALIDATE CONSTRAINT "policy_votes_user_id_users_id_fk";
