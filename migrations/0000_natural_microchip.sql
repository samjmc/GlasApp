CREATE TABLE "political_evolution" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"economic_score" numeric(5, 2) NOT NULL,
	"social_score" numeric(5, 2) NOT NULL,
	"ideology" text NOT NULL,
	"quiz_result_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "quiz_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"economic_score" text NOT NULL,
	"social_score" text NOT NULL,
	"ideology" text NOT NULL,
	"description" text NOT NULL,
	"answers" jsonb NOT NULL,
	"similar_figures" jsonb NOT NULL,
	"unique_combinations" jsonb NOT NULL,
	"key_insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"share_code" text NOT NULL,
	CONSTRAINT "quiz_results_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"profile_image_url" text,
	"county" text,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "political_evolution" ADD CONSTRAINT "political_evolution_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "political_evolution" ADD CONSTRAINT "political_evolution_quiz_result_id_quiz_results_id_fk" FOREIGN KEY ("quiz_result_id") REFERENCES "public"."quiz_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;