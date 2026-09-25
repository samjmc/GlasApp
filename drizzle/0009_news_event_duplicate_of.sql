ALTER TABLE "politics"."news_articles" ADD COLUMN "duplicate_of" integer;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_duplicate_of_news_articles_id_fk" FOREIGN KEY ("duplicate_of") REFERENCES "politics"."news_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_articles_duplicate_of_idx" ON "politics"."news_articles" USING btree ("duplicate_of") WHERE "politics"."news_articles"."duplicate_of" is not null;--> statement-breakpoint
-- Hand-written data step: link the rows the old scoring-time clustering marked `duplicate`
-- (it only wrote "Duplicate of article <id> ..." into skip_reason), when that id exists and is
-- not itself a duplicate. Every other `duplicate` row becomes `skipped`, and so visible again.
UPDATE "politics"."news_articles" d
   SET "duplicate_of" = substring(d."skip_reason" from 'Duplicate of article (\d+)')::integer
 WHERE d."status" = 'duplicate'
   AND EXISTS (
     SELECT 1 FROM "politics"."news_articles" c
      WHERE c."id" = substring(d."skip_reason" from 'Duplicate of article (\d+)')::integer
        AND c."status" <> 'duplicate');--> statement-breakpoint
UPDATE "politics"."news_articles"
   SET "status" = 'skipped', "updated_at" = now()
 WHERE "status" = 'duplicate' AND "duplicate_of" IS NULL;--> statement-breakpoint
ALTER TABLE "politics"."news_articles" ADD CONSTRAINT "news_articles_duplicate_link_chk" CHECK (("politics"."news_articles"."status" = 'duplicate') = ("politics"."news_articles"."duplicate_of" is not null));
