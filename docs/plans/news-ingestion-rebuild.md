# News ingestion rebuild

Branch `rebuild/news`. Same standard as `server/scoring/`: one implementation per concern,
pure logic with unit tests, a thin repository, everything before it deleted in the same PR.
Vetted 2026-09-22 (three parallel readers + live feed probes); deltas from that are folded in
and listed at the end.

## What exists today (mapped 2026-09-22)

- **Four writers into `public.news_articles`**, each setting a different mix of
  `visible`/`processed`/`image_url`: `dailyNewsScraper.saveArticleToDatabase`,
  `POST /api/news-feed/save` (Python aggregator), `manualArticleRoutes /add`, and the dead
  `saveArticleAnalysis`.
- **The scheduled scrape never saves.** `scheduler.ts:86` calls `fetchAllIrishNews()` every 4 h
  and only logs a count (PRs #4 #23 #30 #36 #37 #41). The job that saves (`dailyNewsScraper`)
  has a 06:00 schedule nobody registers.
- **Two importance passes.** `articleTriageJob` then `runPipeline`. Triage re-queues
  already-scored hidden articles (`processed: !needsScoring`, no `score_applied` check): the
  double-ELO bug of #17 / #23.
- **No claim step, no overlap guard.** Cron every 2 h plus `/api/admin/td-scoring/run` and
  `/full-pipeline` (hit by cronjob.org) can run `runPipeline` concurrently; both read the same
  `processed=false` rows and both apply ELO (#37 #38 #41).
- **`/save` resets scoring state** on re-save (#23).
- **Feed pagination is broken.** Client sends `offset`; server ignores it (`newsFeedRoutes.ts:205`),
  slices page 1 every time, reports the unfiltered count (#2 #30 #42).
- **The feed is empty on the client anyway.** Every handler returns `{success, data}`; all three
  callers read `.articles` at the top level. US region double-wraps a mock.
- **"Today" is wrong twice:** server-local midnight (UTC on a host), then newest-first, not
  highest-impact.
- **Share links 404.** `NewsArticleCard` shares `/news/:id`; no such route.
- **Schema is unmanaged.** `newsArticles`/`newsSources`/`scrapingJobs` in `shared/schema.ts` are
  outside the Drizzle config and miss ~15 columns the code uses.
- **Gript/Ditch Playwright scrapers cannot run anywhere:** no `playwright install` step exists.
  Both sites publish RSS (probed live: `gript.ie/feed/` 10 items, `ontheditch.com/rss/` 15 items
  with full `content:encoded`).
- `aiNewsAnalysisService.ts:1095` uses `a`, a `const` from the `try` at 1001, inside the `catch`.
  No live caller; `scoring/panel.ts` replaced it. `articleIdeologyEnhancements.ts` and
  `eloScoringService.ts`: imported by nobody.

## The new shape

```
server/news/
  sources.ts      the source list: ONE const (7 RSS feeds + a `manual` source), upserted
                  into politics.news_sources at the start of each ingest
  rss.ts          fetch one feed -> RawItem[] (rss-parser, media:content/thumbnail/enclosure) I/O
  normalize.ts    url canonicalisation, summary cut, age cutoff, RawItem -> NewArticle  pure
  dedupe.ts       url + title similarity against recent rows                        pure
  classify.ts     ONE batched LLM call: "Irish politics?" per title, typed result
  content.ts      full-body fetch (fetch + cheerio); the one scoring also uses
  ingest.ts       fetch -> normalize -> dedupe (vs DB) -> classify NEW only -> insert
  feed.ts         sort + page + "today" window in Europe/Dublin                      pure
  repository.ts   Drizzle: upsert sources, insert, claim, mark, feed and status queries
server/routes/news.ts   GET  /api/news-feed          ?sort=score|recent|today&limit&offset
                        GET  /api/news-feed/td/:name
                        POST /api/admin/news/ingest            (requireJob)
                        POST /api/admin/news/articles {url}    (requireJob)
shared/schema/news.ts
server/scoring/articleSource.ts   same interface, Drizzle on politics.news_articles
```

The router lives under `server/routes/` because `route-coverage.test.ts` only walks that folder.

**Tables, in `politics`, varchar status like the rest of the schema:**

- `news_sources`: slug (unique), name, homepage_url, feed_url (null for `manual`), logo_url,
  credibility, enabled.
- `news_articles`: source_id FK not null, url unique (canonical), title, summary, content,
  image_url, published_at, fetched_at, status (`pending|claimed|scored|skipped|failed`),
  claimed_at, attempts, importance_score, importance_reasoning, skip_reason, error_message,
  created_at, updated_at.
- `scraping_jobs`: dropped, not replaced.

**Lifecycle.**

- Ingest inserts `pending` with `ON CONFLICT (url) DO NOTHING`, so a re-save cannot reset state.
- `fetchUnprocessed` is an atomic claim: `UPDATE … SET status='claimed', claimed_at=now(),
  attempts=attempts+1 WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`.
  - It picks `pending` rows, plus `claimed` rows older than a **6 h lease** (a crash or deploy).
  - It skips rows published more than 7 days ago; they are marked `skipped / stale`.
  - After 3 attempts a row goes to `failed`, so a poison article cannot loop.
  - Two overlapping runs claim disjoint rows. That fixes the double-ELO race without touching
    pipeline logic.
- `markProcessed` maps `errorMessage` → `failed`, `skippedReason` → `skipped`, otherwise
  `scored`.

**Feed = same visibility as today.** The old triage set `visible=true` on every article, so the
old feed showed all of them. The new feed shows every non-failed article as soon as it is
ingested (no 30-minute lag).

- `score` sort: TD-scored first, by |impact| then date.
- `recent`: by date.
- `today`: today in Europe/Dublin, highest |impact| first, falling back to the last 30 days.
- Offset pagination in SQL; `total` is the filtered count.
- Affected TDs come from `politics.article_td_scores` ⨝ `politics.tds`.
- `policyVote` comes from the GApp session's `getQuestionsForArticles(ids)` in
  `server/voting/index.ts` (`politics.policy_questions`). `public.policy_vote_opportunities`
  exists in no schema on the new DB, so the old join goes. If GApp's PR has not landed when this
  one is ready, `policyVote` is `null` and the call is added once it lands.
- Region: IE is live; any region with a `REGION_NEWS_MOCK` entry gets that mock, wrapped once.

**Response fields** are exactly what the three client callers render: id, title, summary, url,
source, sourceLogoUrl, publishedAt, imageUrl, storyType, sentiment, impactScore,
affectedTDs[{name, impactScore}], policyVote, plus `{total, hasMore}`. Clients unwrap `json.data`
inline, as every other caller does; there is no shared helper. Share uses the publisher URL.

**Images.** RSS media only. No DALL·E, no `public/news-images`, no `express.static` line. The
card already falls back to a gradient.

**Scheduler.**

- The 30-minute triage cron and the no-op scraper cron are removed.
- `ingest()` runs every 2 h, before `runPipeline`.
- `tdScoringRoutes`: `/triage` goes. `/full-pipeline` becomes ingest + pipeline, because
  cronjob.org calls it. `/status` reports news status counts.

## What gets deleted

| Path | Lines |
|---|---|
| `server/services/newsScraperService.ts` | 394 |
| `server/services/customScrapers/` (Playwright gript + ditch) | 566 |
| `server/jobs/dailyNewsScraper.ts` | 533 |
| `server/jobs/masterNewsUpdate.ts` + `npm run update-news` | 247 |
| `server/jobs/articleTriageJob.ts` | 273 |
| `server/services/titleDeduplicationService.ts` | 292 |
| `server/services/newsImageGenerationService.ts` | 112 |
| `server/services/topicClassificationService.ts` | 122 |
| `server/services/aiNewsAnalysisService.ts` (bare `a` goes with it) | 1118 |
| `server/services/articleIdeologyEnhancements.ts` | 363 |
| `server/services/eloScoringService.ts` (dead, imports the above) | — |
| `server/routes/newsFeedRoutes.ts` | 744 |
| `server/routes/admin/newsScraperRoutes.ts` | 245 |
| `server/routes/admin/manualArticleRoutes.ts` | 308 |
| `server/scripts/testDeduplicationPipeline.ts`, `testIdeologyIntegration.ts` | — |
| `newsArticles`/`newsSources`/`scrapingJobs` + types in `shared/schema.ts` | ~110 |
| `HomePage.tsx` unused `mockArticles` | ~85 |
| `playwright` dependency | — |
| `news-aggregator/` (132 files, 214.6 MB) | approved |
| `public/news-images/` (344 PNGs, 944 MB) | approved |

**Kept, because scoring core depends on them:** `articleImportanceService.ts` and
`eventDeduplicationService.ts`. `rss-parser` and `cheerio` stay in use.

**Now dead but not mine, left alone:** `PersonalRankingsService.recalculateAllUserRankings` and
`CacheService.clearAllCaches`. `masterNewsUpdate` was their only caller.

**Edits outside `server/news/`, own lines only:**

- `server/routes.ts`: 3 imports and 3 mounts become 1 each.
- `scheduler.ts`: the news crons.
- `server/index.ts`: the static line.
- `tdScoringRoutes.ts`: triage endpoints.
- `drizzle.config.ts`: not edited. GApp is changing it to `./shared/schema/*.ts`. If this PR
  merges first, it makes exactly that one-line change.
- `server/db.ts`: not edited. The news repository uses the query builder, not `db.query.*`.
- `shared/schema/news.ts` imports `politics` from `./politics`. There is no second `pgSchema`.
- `chatTools.ts`: repoint 2 queries to the new table.
- `pipeline.ts`: 2 import lines (the adapter export and `content.ts`), no logic. The GApp
  session is also editing this file, so the two edits are agreed with it first.

## Tests

- Pure unit tests: normalize, dedupe, feed sort/page/today (including the Dublin midnight edge),
  claim-outcome → status mapping, RSS item mapping from recorded fixtures of the 7 live feeds.
- `server/news/repository.integration.test.ts`: `skipIf(!TEST_DATABASE_URL)`, applies **every**
  migration file, proves two concurrent claims return disjoint rows and that a re-insert
  keeps state.
- Mutation-check the claim test: drop `SKIP LOCKED` and watch it go red.

## Needs a real DB (none here)

1. `npm run db:migrate`, then `POST /api/admin/news/ingest` against live feeds.
2. `npm run td-scoring`.
3. Open `/` and check that page 2 differs from page 1. Open `/td/:name`.
4. Fire `/api/admin/td-scoring/run` twice at once and check that each article gets exactly one
   `article_td_scores` row per TD.
5. The integration test above runs only with `TEST_DATABASE_URL`.

## Vet deltas (what changed from the first draft)

- **Router location.** Moved to `server/routes/news.ts`. Under `server/news/` the
  route-coverage test would have skipped it silently.
- **drizzle.config.ts.** It takes one schema file, so `news.ts` would have been ignored. GApp's
  glob change covers this.
- **Claim lease.** 30 min was unsafe. `panel.ts` uses SDK defaults (10 min timeout, 2 retries)
  and a run can pass 30 min. Now a 6 h lease, an attempts cap, and a 7-day age cutoff.
- **Feed visibility.** An `importance >= 40` filter would have hidden most articles; the old
  feed showed all of them. Kept parity. Same-event duplicates also showed before. Hiding them
  needs a `duplicate_of` outcome field, which is a `pipeline.ts` logic change, so it is a
  follow-up for the scoring owner.
- **Fetchers.** Playwright dropped. Every source has RSS.
- **Classification.** Now runs on NEW items only, batched, one call per ~20 titles.
- **Manual adds.** Use a `manual` source row, so `source_id` can stay NOT NULL.
- **Article id collision (vet flagged).** It is moot. Decision A is a clean schema in GlasCore,
  which has no GlasApp `public` tables, so nothing holds old ids.
- **Readers of `public.news_articles` owned elsewhere** (`dailySessionService`,
  `personalizedScoringService`, the policy backfill scripts). They get the new column names by
  message. None of them has a table to read in GlasCore today, so this rebuild does not make
  them worse.
