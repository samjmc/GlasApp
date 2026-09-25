CREATE TABLE "politics"."users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"county" varchar(50),
	"bio" text,
	"profile_image_url" text,
	"phone_number" varchar(20),
	"phone_verified" boolean DEFAULT false NOT NULL,
	"phone_code_hash" varchar(64),
	"phone_code_expires_at" timestamp with time zone,
	"phone_code_attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_number_idx" ON "politics"."users" USING btree ("phone_number") WHERE "politics"."users"."phone_number" is not null;