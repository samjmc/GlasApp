CREATE TABLE "politics"."news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text DEFAULT '' NOT NULL,
	"image_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"importance_score" smallint,
	"importance_reasoning" text,
	"skip_reason" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics"."news_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"homepage_url" text NOT NULL,
	"feed_url" text,
	"logo_url" text,
	"credibility" real NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_source_id_news_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "politics"."news_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_articles_url_idx" ON "politics"."news_articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_articles_status_published_idx" ON "politics"."news_articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "news_articles_published_idx" ON "politics"."news_articles" USING btree ("published_at" desc);