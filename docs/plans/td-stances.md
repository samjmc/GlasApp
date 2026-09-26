# TD stances: the LLM takes notes, the user decides

Status: approved by Sam 2026-09-25. Part 3 of 3 (after `news-event-dedupe.md` and
`facts-only-scoring.md`). Vetted against main 668cee7; revised with every vet finding.

## Why

A statement is good for some people and bad for others, so no model should score it. Instead the
LLM EXTRACTS what a TD said — with a verbatim quote that code checks against the article — and
matches it to an answer on the article's own daily-vote question. Each user then sees how often
a TD answered the way THEY answered, with the quote and the link beside every item.

## Sam's decisions (2026-09-25)

1. Match stances only against **the article's own daily-vote question** (not the 26 quiz
   questions: they are general scenarios, so matching a real quote to one is a judgement).
   When there is no overlap the UI says "No shared issues yet".
2. **Purge** the old LLM-invented `source='article'` rows in `td_ideology_evidence` and rebuild
   from verified stances, in a script (not in the migration), without creating new questions.

## Data model (migration 0011, after part 2's 0010)

New module `server/stances/`, schema `shared/schema/stances.ts`:

- `td_stances`: `id`, `td_id` FK tds (cascade), `article_id` FK news_articles (the event's
  canonical — part 1's root; the canonical id IS the event key), `question_id` FK
  policy_questions (nullable until mapped), `option_key` (nullable = no clear answer),
  `quote`, `quote_kind` (`direct` | `paraphrase`, CHECK), `policy_domain` (`POLICY_DOMAINS` key,
  CHECK), `option_text` (copy of the option's text at mapping time — the bank changes),
  `stated_at` (article `published_at`, fallback `created_at`), copies of `article_url`,
  `source_name`, `headline`, `created_at`. UNIQUE (`td_id`, `article_id`).
- No LLM-written `position` summary is stored (vet: the quote + link is the neutral record).
- DROP `td_policy_stances` (one writer, no reader).

## Pipeline (per canonical article, once — not once per TD)

mentions (existing TD extraction; ids and `offices` from `repo.findByName`, not from
`TDExtractionService`, which returns names only) → **extract** → **verify** → ensure the
article's question exists (`generateQuestionForArticle`, only when ≥ 1 verified stance) →
**map** each stance to one option of that question or none → save → record evidence.

### Extract (`server/stances/extract.ts`, zod-parsed)
Input: title + content (≤ 12,000 chars) + candidate TDs `{id, name, party, offices}`.
Output `{stances:[{td_id, policy_domain, quote, quote_kind}]}`. Rules: candidate ids only; ≤ 1
stance per TD; an empty list is normal. Direct = the TD's own words in quotation marks;
paraphrase = a reporter's sentence attributing a position to the TD by name or office. Exclude:
a mere mention; a party/government line not attributed to them; others' claims about them;
describing or rebutting an opponent; questions put to them; procedural or no policy content.
Quote 8–60 words, copied exactly, no ellipsis. Never rate, praise or criticise.

### Verify (`server/stances/verify.ts`, pure)
1. The quote is a substring of the text that was sent, after normalising both: NFD + strip
   combining marks (fadas: "Ó Murchú" = "O Murchu"), lower-case, curly quotes/dashes mapped
   explicitly to straight ones (NFKC does not), whitespace collapsed; keep an offset map back.
   Else reject `quote_not_found`.
2. `direct` needs an opening quote mark within 2 chars before the quote; else downgrade to
   `paraphrase`.
3. The TD's surname (last token of `tds.name`, normalised as above) or one of their `offices`
   titles, or "Taoiseach"/"Tánaiste" when they hold it, within 300 chars; else reject
   `td_not_near`. (Two TDs sharing a surname can pass for each other — accepted, quote shown.)
4. Unknown `td_id` / domain → reject `invalid`.
Rejected stances are not stored; counts go into pipeline stats.

### Map (`server/stances/map.ts`)
Only when ≥ 1 stance survives: input = the article's question + its options + each quote.
Output per stance `{option_key | null}`; rule: choose an option only when the quote itself
states that choice. Validate keys.

### Evidence
Matched stances feed the TD's ideology profile through `recordTdEvidence` under a NEW source
**`stance`** (add to `EVIDENCE_SOURCES`, its CHECK, and `server/ideology/sources.ts` with
`max: 2`, the same ruler as a user's vote), `sourceRef = question:<id>`, weight =
`option.weight × option.confidence × kind` (direct 1, paraphrase 0.6 — constants in
`sources.ts`). `insertTdEvidence` upserts for `stance`, guarded on `observed_at` so an older
article never overwrites a newer position. `article` stays as a source name only so old rows
can be purged.

## Per-user agreement (in `server/ideology`, which owns the one formula)

- Items = daily-vote questions the user answered that also have a CURRENT TD stance with an
  option (latest `stated_at` wins).
- Per item: `agree = 1 − d(optionU, optionT) / maxPairwise(d over that question's options)`
  (1 when the same option; 0 for the question's two most distant options; a single-option
  question counts only on an exact match). Vet finding: the existing `alignment()` never drops
  below 0.8 for opposite options, so it is not reused here.
- Weight `w = kind × 0.5^(age / TD_HALF_LIFE_DAYS)`.
- Blend: `shown = (Σ w·100·agree + PRIOR·axis) / (Σ w + PRIOR)`, `PRIOR = 2`, where `axis` is
  today's `userMatches` alignment. No items → exactly today's number. Stance evidence also sits
  inside the TD's axis profile; that overlap is intended (axis = broad direction, items = the
  specific issues) and documented.
- `userMatches` returns `alignment = shown` plus `issues: { agree, disagree, items[] }`, items
  only for the TD being viewed or the top 5 — not all 174.
- Signed-out users get today's axis-only number; the UI says "based on N shared issues" only when
  signed in.

## What users see

- TD page: "Positions on record", grouped by domain: Direct/Paraphrase badge, the quote, outlet
  link, date, "said N times", "changed position" (both dated quotes). Signed in: "You and this
  TD: 78% — agrees on housing (2/2), differs on foreign policy (0/1)", each item showing your
  answer vs theirs with the source.
- Match results: "based on N shared issues", expanding to the same breakdown.

## Deletes

`td_policy_stances` schema + `upsertPolicyStance`; the regex `policyDimension` in the pipeline;
the `is_ideological_policy` gate (replaced by "≥ 1 verified stance"); `docs/architecture/
ideology-matching.md` lines about article ideology (update). Part 2 already deleted the panel's
analyst and `tdIdeologyProfileService.ts`.

## Rebuild script (`npm run stances -- --rebuild [--days 180] [--dry-run]`)

Deletes `source='article'` evidence AND backfills in one run: canonical articles of the last N
days that ALREADY have a daily-vote question (never creates questions — vet: new questions with
today's `createdAt` would flood the daily sessions), extract → verify → map → save → evidence,
then `recalculateAll`. Needs an LLM key; prints counts; `--dry-run` writes nothing.

## Tests

- Fails on current code: an article where the TD is only mentioned, plus a mocked
  `callChatCompletion` returning a quote NOT in the text → no `td_stances` row and no
  `td_ideology_evidence` row (mock at pipeline level).
- Ten outlets, one event → one stance (part 1 links them; unique per canonical).
- `verify`: curly quotes, fadas, whitespace, ellipsis, direct → paraphrase downgrade, TD not
  near, "the Taoiseach", unknown id/domain.
- Agreement: no items = axis exactly; same option = 1; opposite ends = 0; decay; latest wins;
  paraphrase weight.
- Evidence upsert keeps the newer position; the `stance` CHECK accepts, junk is rejected.
- Update: `sources.test.ts:6`, `ideology.integration.test.ts` (keep the CHECK test).
- Route tests for `GET /api/stances/td/:id` and the `issues` field.

## Follow-up for Sam (not blocking the build)
Before trusting the section publicly: label 20 real stored stances; target ≥ 90% real,
correctly attributed positions.

## As built (2026-09-26, phase 3a + 3b)

What differs from the spec above, and why:

- **Migration 0012**, not 0011 (parts 1 and 2 took 0010 and 0011). drizzle-kit asks
  interactively whether `td_stances` is a rename of `td_policy_stances`, so it was generated in
  two passes (create, then drop) and folded into one file. Every line is generator-written.
- **`question_id` and `option_key` are set together, or both NULL** (`td_stances_answer_chk`),
  under ONE composite FK to `policy_question_options` that clears both when the option or its
  question is deleted. The spec had `question_id` set whenever the article had a question, with
  its own FK; the integration test showed that FK fires first and leaves an orphan `option_key`.
  So a quote that states no clear answer is stored with no question link.
- **"Said N times" and "changed position" cannot show yet.** One question per article and one
  stance per (TD, article) means at most one stance per (TD, question). Both are computed as
  specified and will work if questions are ever shared across articles (e.g. per event).
- `stated_at` = `coalesce(published_at, created_at)` in the INSERT … SELECT that also copies the
  url, outlet and headline. `published_at` is NOT NULL, so the fallback never happens today.
- The save refuses a duplicate article (`status <> 'duplicate'` in the INSERT), so "never for a
  duplicate" holds at the database, not only in the claim query. Re-running an article replaces
  its rows.
- The evidence upsert is guarded with `>=`, so re-running the same article refreshes its row. A
  re-run whose stance no longer maps to an option leaves the older evidence row in place.
- An option with no confidence counts as confidence 1, as it does for a user's vote.
- `QUOTE_KINDS` lives in `shared/stancesApi.ts` (the schema needs it); `QUOTE_KIND_WEIGHT` in
  `server/ideology/sources.ts`.
- `userMatches(userId, weights, { tdId, now })`; the route takes `?td=`. Party matches are
  unchanged: only TD matches carry `issues`.
- The rebuild takes its candidate TDs from `article_tds` rather than re-running TD extraction,
  and refuses to start without an LLM key, before the purge.
- The "fails on current code" test: after part 2 the pipeline no longer writes article
  evidence, so the defect on current code is the question made for a mere mention. The test
  asserts no `td_stances` row, no evidence row and no question (red with part 2's gate put back).
