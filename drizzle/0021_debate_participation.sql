CREATE TYPE "politics"."debate_role" AS ENUM('office', 'backbench');--> statement-breakpoint
CREATE TABLE "politics"."debate_participation" (
	"debate_id" varchar(80) NOT NULL,
	"member_code" varchar(120) NOT NULL,
	"td_id" integer,
	"role" "politics"."debate_role" NOT NULL,
	"speeches" integer NOT NULL,
	"words" integer NOT NULL,
	"claims" integer NOT NULL,
	"claim_points" integer NOT NULL,
	"concessions_received" integer NOT NULL,
	"concession_points" integer NOT NULL,
	"questions" integer NOT NULL,
	"commitments" integer NOT NULL,
	"points" integer NOT NULL,
	"rules_version" varchar(20) NOT NULL,
	CONSTRAINT "debate_participation_debate_id_member_code_pk" PRIMARY KEY("debate_id","member_code")
);
--> statement-breakpoint
ALTER TABLE "politics"."debate_participation" ADD CONSTRAINT "debate_participation_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debate_participation_member_idx" ON "politics"."debate_participation" USING btree ("member_code");--> statement-breakpoint
CREATE INDEX "debate_participation_td_idx" ON "politics"."debate_participation" USING btree ("td_id");