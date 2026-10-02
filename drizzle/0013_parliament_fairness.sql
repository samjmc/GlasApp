CREATE TYPE "politics"."absence_reason" AS ENUM('parental_leave', 'medical_leave', 'bereavement', 'other_leave');--> statement-breakpoint
CREATE TYPE "politics"."office_type" AS ENUM('cabinet', 'minister_of_state', 'ceann_comhairle', 'leas_cheann_comhairle', 'other');--> statement-breakpoint
CREATE TABLE "politics"."disclosure_files" (
	"source_url" text PRIMARY KEY NOT NULL,
	"kind" varchar(20) NOT NULL,
	"period" date NOT NULL,
	"unmatched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."td_absences" (
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"reason" "politics"."absence_reason" NOT NULL,
	"source_url" text NOT NULL,
	"note" text,
	CONSTRAINT "td_absences_member_code_start_date_pk" PRIMARY KEY("member_code","start_date")
);
--> statement-breakpoint
CREATE TABLE "politics"."td_allowance_payments" (
	"source_url" text NOT NULL,
	"position" integer NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"month" date NOT NULL,
	"title" text,
	"taa_band" text,
	"narrative" text NOT NULL,
	"date_paid" date NOT NULL,
	"amount_cents" integer NOT NULL,
	CONSTRAINT "td_allowance_payments_source_url_position_pk" PRIMARY KEY("source_url","position")
);
--> statement-breakpoint
CREATE TABLE "politics"."td_interests" (
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"register_year" smallint NOT NULL,
	"category" smallint NOT NULL,
	"declared" text,
	"source_url" text NOT NULL,
	CONSTRAINT "td_interests_member_code_register_year_category_pk" PRIMARY KEY("member_code","register_year","category")
);
--> statement-breakpoint
CREATE TABLE "politics"."td_offices" (
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"title" text NOT NULL,
	"office_type" "politics"."office_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	CONSTRAINT "td_offices_member_code_title_start_date_pk" PRIMARY KEY("member_code","title","start_date")
);
--> statement-breakpoint
CREATE TABLE "politics"."td_party_leaders" (
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"party" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"source_url" text NOT NULL,
	CONSTRAINT "td_party_leaders_member_code_start_date_pk" PRIMARY KEY("member_code","start_date")
);
--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "divisions_chaired" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "divisions_excused" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "divisions_in_leadership" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "sitting_days_excused" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "questions_expected" real;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "attendance_benchmark" real;--> statement-breakpoint
ALTER TABLE "politics"."td_absences" ADD CONSTRAINT "td_absences_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_allowance_payments" ADD CONSTRAINT "td_allowance_payments_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_interests" ADD CONSTRAINT "td_interests_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_offices" ADD CONSTRAINT "td_offices_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."td_party_leaders" ADD CONSTRAINT "td_party_leaders_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disclosure_files_kind_period_idx" ON "politics"."disclosure_files" USING btree ("kind","period");--> statement-breakpoint
CREATE INDEX "td_absences_td_idx" ON "politics"."td_absences" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "td_allowance_payments_td_idx" ON "politics"."td_allowance_payments" USING btree ("td_id","month");--> statement-breakpoint
CREATE INDEX "td_interests_td_idx" ON "politics"."td_interests" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "td_offices_td_idx" ON "politics"."td_offices" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "td_party_leaders_td_idx" ON "politics"."td_party_leaders" USING btree ("td_id");