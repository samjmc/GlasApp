CREATE TABLE "politics"."political_data_consents" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
