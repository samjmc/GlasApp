# News: show each event once, from the source that published it first

Status: approved by Sam 2026-09-25 ("take recommendations and build it all"). Part 1 of 3
(then `facts-only-scoring.md`, then `td-stances.md`). Drafted by a planning agent, vetted
against main 668cee7, revised with every vet finding.

## Goal

1. One card per real-world event, from the outlet that published it FIRST.
2. Any later article about the same event, from any outlet, is a duplicate: stored and linked,
   never shown as a new story and never scored.

## Current behaviour (verified)

- Ingest title dedupe keeps whichever copy is first in the ARRAY (feed order), not the earliest
  `published_at` (`server/news/dedupe.ts:71-91`). Later copies are counted only, never stored
  (`server/news/ingest.ts:126-127`).
- `recentTitles` looks back 48h by `created_at`, returns url+title only (`repository.ts:63-70`).
- Scoring-time clustering (`server/services/eventDeduplicationService.ts`, called at
  `pipeline.ts:101-126`) sees only the top 25% of one batch of 50, picks the "best" article (not
  the earliest), and never matches a later batch. The other 75% stay visible as `skipped`.
- `duplicateOf` is not persisted: no column; `toOutcome` drops it (`articleSource.ts:60-75`).
- The feed hides `duplicate` rows (`VISIBLE`, `repository.ts:288`); claiming takes only `pending`.
- `ai_summary` is written by the relevance pass (`ingest.ts:88,130`), NULL when a relevance batch fails.

## Design

### Data model (migration 0010 — #82 took 0009 first)
- `news_articles.duplicate_of integer REFERENCES news_articles(id) ON DELETE RESTRICT` (SET NULL
  would break the check below, so deleting a canonical must re-point its duplicates first), partial
  index `WHERE duplicate_of IS NOT NULL`.
- Check constraint `(status = 'duplicate') = (duplicate_of IS NOT NULL)`, declared with `check()`.
- A link always points at the ROOT canonical (never at another duplicate).
- Hand-appended data step, BEFORE the constraint: set `duplicate_of` from
  `skip_reason ~ 'Duplicate of article (\d+)'` where that id exists and is not itself a duplicate;
  every remaining `duplicate` row becomes `skipped` (it becomes visible again — accepted).

### Where matching runs
In `ingest()`, after the relevance pass (so new items have `ai_summary`) and before images.

1. **Cheap pass (existing, changed).** URL match + title similarity ≥ 0.6. Title matches now
   return a LINK (`{ article, of: <existing id or index in this run> }`) instead of being dropped.
   Within one run, sort candidates by `published_at` first so the earliest copy wins.
2. **Event match (new `server/news/events.ts`).** ONE `callChatCompletion` call per ingest run,
   operation `news.events` (same style as `relevance.ts`), with ALL new above-floor items of the
   run (never split into parallel batches — vet finding: batches are per-feed, so a split never
   pairs RTÉ with The Journal). If a run has more than `EVENT_MATCH_MAX_ITEMS` (60) new items, run
   calls ONE AFTER ANOTHER in `published_at` order, adding each call's canonicals to the next
   call's candidates.
   - Candidates: visible canonicals with `published_at` in the last `EVENT_WINDOW_HOURS = 72`,
     newest first, capped at `EVENT_CANDIDATE_LIMIT = 300` (drop oldest first), each sent as id,
     title, `ai_summary` (title only when the summary is NULL).
   - Rule in the prompt: "same real-world decision, statement, vote or incident — not the same
     topic or the same person".
   - Reply `{"items":[{"i":0,"event":<candidate id|null>,"same_as":<index|null>}]}`, parsed with
     zod; unknown id / out-of-range index / malformed JSON = no match (like `parseRelevance`).
3. **Canonical rule (pure `assignCanonicals`).** Union the title links and the LLM links.
   - An article ALREADY STORED is always the canonical (frozen). Vet finding: ingest and scoring
     alternate every hour, so a stored canonical is almost never still pending; swapping would
     also move scores. No `demoteCanonical`, no re-pointing.
   - Within one run, the earliest `published_at` wins; tie → lowest URL (string order). Outlet
     credibility is NOT used (it is being deleted as a hand-typed value judgement, part 2).
   - A link to a duplicate resolves to its root.
4. **Insert** canonicals first, then duplicates with `status='duplicate'` + `duplicate_of`.
   `insertArticles` returns `{ id, url }` pairs (vet finding: `onConflictDoNothing` drops rows,
   so positional id matching is wrong). Duplicates skip image lookup.
5. **Single flight.** An in-process single-flight promise around `ingest()` (all three callers —
   `scheduler.ts`, `routes/admin/news.ts`, `tdScoringRoutes.ts` — run in one process). NOT a
   Postgres advisory lock: the pool (and the Supabase pooler) does not keep a session.

**Method: LLM, no embeddings.** Title similarity misses real rewordings
(`dedupe.test.ts:21-24`); classification is the LLM's job per house rules; embeddings would need
an OpenAI key on the ingest path.

**Failure = fail open.** If the event call throws, every new item is its own canonical (today's
behaviour); count it in `stats.eventMatchFailed`.

### Feed and API
- Lateral subquery in `feedSelect`: for each canonical, the earliest duplicate per OTHER OUTLET
  NAME (compare `news_sources.name`, not `source_id` — RTÉ has two feeds, `rte` and
  `rte-politics`). `FeedRow.alsoReportedBy: Array<{ source: string; url: string }>`.
- `client/src/lib/news.ts` gains `alsoReportedBy`; `NewsArticleCard` shows
  "Also reported by: X, Y" with links (hidden when empty).
- `missingImages` excludes `status = 'duplicate'`.

### Scoring
- Duplicates are never claimed (claim takes `pending` only).
- `findForScoring` / `scoreArticleById` refuse a duplicate (resolve to its root instead) — vet
  finding: `--article <duplicate id>` would otherwise apply scores and then fail the constraint.
- The clustering step in `pipeline.ts` is deleted.

### Manual adds (Sam's decision)
`addUrl` runs the same event match against the candidates. A match returns **409**
`"Same event as article #<id>"` unless the admin passes `force: true`; forced adds are canonical.

### Existing rows (Sam's decision)
No backfill of already-scored rows: they stay visible. A one-off script
`server/scripts/backfillNewsEvents.ts` (`--dry-run` prints pairs) links only rows that are still
`pending`/`skipped` and unscored, in `published_at` order.

## Files

- Change: `shared/schema/news.ts`, `server/news/dedupe.ts`, `server/news/ingest.ts`,
  `server/news/repository.ts`, `server/news/manual.ts` or wherever `addUrl` lives,
  `server/routes/admin/news.ts` (409 + force), `server/scoring/pipeline.ts`,
  `server/scoring/articleSource.ts`, `server/routes/news.ts`, `client/src/lib/news.ts`,
  `client/src/components/NewsArticleCard.tsx`, `docs/scoring.md`.
- New: `server/news/events.ts` (+ test), `server/news/ingest.integration.test.ts`,
  `server/scripts/backfillNewsEvents.ts`.
- Delete: `server/services/eventDeduplicationService.ts`, `server/scripts/testEventDeduplication.ts`,
  the clustering block and its stats in `pipeline.ts`, `ArticleOutcome.duplicateOf` and the
  `duplicate` branch of `toOutcome`.

## Tests

- `dedupe.test.ts`: a later-published copy first in the array → the earlier stays canonical
  (fails on current code). Update the `duplicates`-shape assertions (`:38-50`).
- `events.test.ts`: arrives 47h later → linked to the stored canonical; two copies in one run →
  earliest wins, tie → URL; stored canonical never swapped; link to a duplicate → root; bad
  replies → no match.
- `ingest.integration.test.ts` (own DB suffix `ingest`; mock `fetchFeed`, `fetchPage`,
  `loadsAsImage`, and `callChatCompletion` answering by operation name): run 1 RTÉ, run 2 (+47h)
  TheJournal same event → row 2 `duplicate`, `duplicate_of` = row 1, feed shows one row with
  `alsoReportedBy = [The Journal]`, claim returns only row 1. LLM throws → both canonical,
  `eventMatchFailed = 1`. Constraint rejects `duplicate` without a link. Manual add of a known
  event → 409; with force → canonical.
- Update `server/news/repository.integration.test.ts:172-179` (`markOutcome('duplicate')` without
  a link now violates the constraint) and `articleSource.test.ts:23-31`.
- Integration tests SKIP without `TEST_DATABASE_URL`, and there is no CI: run them locally
  against Docker Postgres and check the skipped count is 0.

## Cost
One call per ingest run, ~20–25k input tokens with 300 candidates, ~12 runs/day: cents per day
on DeepSeek. Each prevented duplicate saves a full panel run until part 2 removes the panel.
