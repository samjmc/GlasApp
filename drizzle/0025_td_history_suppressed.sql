CREATE TABLE "politics"."td_history_suppressed" (
	"td_id" integer PRIMARY KEY NOT NULL,
	"suppressed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "politics"."td_history_suppressed" ADD CONSTRAINT "td_history_suppressed_td_id_tds_id_fk" FOREIGN KEY ("td_id") REFERENCES "politics"."tds"("id") ON DELETE cascade ON UPDATE no action;