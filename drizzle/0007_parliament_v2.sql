CREATE TYPE "politics"."question_type" AS ENUM('oral', 'written');--> statement-breakpoint
CREATE TABLE "politics"."bill_debates" (
	"bill_id" varchar(20) NOT NULL,
	"debate_section_id" varchar(80) NOT NULL,
	"date" date NOT NULL,
	"chamber" text,
	"title" text,
	CONSTRAINT "bill_debates_bill_id_debate_section_id_pk" PRIMARY KEY("bill_id","debate_section_id")
);
--> statement-breakpoint
CREATE TABLE "politics"."bill_sponsors" (
	"bill_id" varchar(20) NOT NULL,
	"position" integer NOT NULL,
	"member_code" varchar(120),
	"td_id" integer,
	"label" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "bill_sponsors_bill_id_position_pk" PRIMARY KEY("bill_id","position")
);
--> statement-breakpoint
CREATE TABLE "politics"."bill_stages" (
	"bill_id" varchar(20) NOT NULL,
	"position" integer NOT NULL,
	"stage" text NOT NULL,
	"chamber" text,
	"date" date,
	CONSTRAINT "bill_stages_bill_id_position_pk" PRIMARY KEY("bill_id","position")
);
--> statement-breakpoint
CREATE TABLE "politics"."bills" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"uri" text NOT NULL,
	"bill_no" integer NOT NULL,
	"bill_year" smallint NOT NULL,
	"short_title" text NOT NULL,
	"long_title" text,
	"source" varchar(40) NOT NULL,
	"status" varchar(40) NOT NULL,
	"origin_house" varchar(40),
	"most_recent_stage" text,
	"act" varchar(20),
	"latest_version_pdf" text,
	"memo_pdf" text,
	"last_updated" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "politics"."committee_attendance" (
	"sitting_uri" text NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	CONSTRAINT "committee_attendance_sitting_uri_member_code_pk" PRIMARY KEY("sitting_uri","member_code")
);
--> statement-breakpoint
CREATE TABLE "politics"."committee_memberships" (
	"committee_id" varchar(160) NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"role" text,
	"start_date" date NOT NULL,
	"end_date" date,
	CONSTRAINT "committee_memberships_committee_id_member_code_start_date_pk" PRIMARY KEY("committee_id","member_code","start_date")
);
--> statement-breakpoint
CREATE TABLE "politics"."committee_sittings" (
	"uri" text PRIMARY KEY NOT NULL,
	"committee_id" varchar(160) NOT NULL,
	"date" date NOT NULL,
	"present_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."committees" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"uri" text NOT NULL,
	"name" text NOT NULL,
	"committee_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "committees_uri_unique" UNIQUE("uri")
);
--> statement-breakpoint
CREATE TABLE "politics"."question_counts" (
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"month" date NOT NULL,
	"department" varchar(120) NOT NULL,
	"question_type" "politics"."question_type" NOT NULL,
	"n" integer NOT NULL,
	CONSTRAINT "question_counts_member_code_month_department_question_type_pk" PRIMARY KEY("member_code","month","department","question_type")
);
--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "committee_sittings_eligible" integer;--> statement-breakpoint
ALTER TABLE "politics"."td_parliament_stats" ADD COLUMN "committee_sittings_attended" integer;--> statement-breakpoint
ALTER TABLE "politics"."bill_debates" ADD CONSTRAINT "bill_debates_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "politics"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."bill_sponsors" ADD CONSTRAINT "bill_sponsors_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "politics"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."bill_sponsors" ADD CONSTRAINT "bill_sponsors_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."bill_stages" ADD CONSTRAINT "bill_stages_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "politics"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."committee_attendance" ADD CONSTRAINT "committee_attendance_sitting_uri_committee_sittings_uri_fk" FOREIGN KEY ("sitting_uri") REFERENCES "politics"."committee_sittings"("uri") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."committee_attendance" ADD CONSTRAINT "committee_attendance_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "politics"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."committee_memberships" ADD CONSTRAINT "committee_memberships_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."committee_sittings" ADD CONSTRAINT "committee_sittings_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "politics"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "politics"."question_counts" ADD CONSTRAINT "question_counts_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_debates_section_idx" ON "politics"."bill_debates" USING btree ("debate_section_id");--> statement-breakpoint
CREATE INDEX "bill_sponsors_td_idx" ON "politics"."bill_sponsors" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "bill_sponsors_member_idx" ON "politics"."bill_sponsors" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "bills_status_idx" ON "politics"."bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bills_last_updated_idx" ON "politics"."bills" USING btree ("last_updated");--> statement-breakpoint
CREATE INDEX "committee_attendance_td_idx" ON "politics"."committee_attendance" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "committee_memberships_td_idx" ON "politics"."committee_memberships" USING btree ("td_id");--> statement-breakpoint
CREATE INDEX "committee_sittings_committee_date_idx" ON "politics"."committee_sittings" USING btree ("committee_id","date");--> statement-breakpoint
CREATE INDEX "question_counts_td_idx" ON "politics"."question_counts" USING btree ("td_id");