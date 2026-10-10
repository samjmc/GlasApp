# Question sessions: a record of what a question secured

Status: **plan, 2026-10-10, revised after an adversarial review the same day. Nothing is built.**
Sam chooses the rule (see "Decision for Sam") before any model call is made.

## Why

The debate record (`docs/plans/debate-analysis.md`) covers argued debates only. Question sessions
were left out because they need rules of their own: a member asks, a minister answers, so "who
drives the debate" does not apply. They are also most of what a backbencher says in the Dáil:

| Kind (`debates.kind`) | Sections | Turns per section | Speakers per section | Words |
|---|---|---|---|---|
| `questions` | 2,475 | 9.8 (median 6) | 3.3 | 3.6 M |
| `topical_issue` | 750 | 4.9 (median 4) | 2.1 | 1.3 M |
| `leaders_questions` | 168 (one a day) | 55 | 9.4 | 1.0 M |

Measured on GlasCore, 2026-10-10. The TD score already counts parliamentary questions as numbers
(`docs/scoring.md`), and its debate pillar already counts every section a TD speaks in, of every
kind (`repository.ts`). Nothing reads **what was said**.

## The principle (unchanged)

A model finds and quotes items; code checks every quote word for word and gives every point by
published rules; the record is a card, not part of the TD score. Never "won", never "did they
answer the question": whether an answer is good is the judgement the design keeps from the model.

## What a question session can show

1. **A commitment secured.** A minister, replying to a member's question, says they, their
   Department or the Government will do a specific thing. It is the one outcome of a question that
   is concrete, quotable and checkable later, and it belongs to the member who asked.
2. **A specific answer.** The minister's reply contains a specific claim (a figure, a named
   source, a cost, a date). Shown for office holders; **never compared or ranked**, because a
   Taoiseach at Leaders' Questions and a Minister of State reading a Topical Issue reply are not
   alike.

Not used: the number of questions (already scored), speaking time, follow-ups, tone, and any view
on whether the question was answered. Concessions are left out too: in a question session
"the Deputy is right to raise this" is a courtesy, not a point conceded.

### A commitment is not a follow-up

Ministers often promise to "come back to the Deputy", "write to the Deputy" or "ask the HSE to
reply". That is procedure, and counting it would reward asking for a letter. This is a
classification, so the model gives a typed `commitment_type`: `action` (a specific thing will be
done) or `follow_up` (someone will reply or revert). Code scores `action` only; `follow_up` is shown
as its own count. No keyword lists.

## Design

### Step Q0. Keep who asked each oral question (no model)

The questions feed already returns, for every oral PQ, its `debateSection.debateSectionId` and the
asker's `by.memberCode` (`client.ts` fetches them on every sync), but `parse.ts` (`RawQuestion`)
drops the section and `countQuestions` keeps only totals. Store them: table
`politics.question_askers` (section id, member code, question number, date), written by the
questions feed. This is the authority for who asked an oral PQ, including grouped questions to the
Taoiseach (PQs 1–9 from 9 askers in one section, in the fixture).

### Step Q1. Exchanges (code, no model)

An exchange is one asker's question and the answers to it. Table `politics.question_exchanges`
(derived, rebuilt in the sync like `debates`): id, section, kind, asker(s), first and last speech.

- **`topical_issue`**: one section is one exchange; the asker is the one member not in office.
- **Oral PQs**: one section is one exchange; its askers come from `question_askers` (Step Q0),
  never from speaker order. A grouped section has several askers.
- **`leaders_questions`** and the rapid sessions inside `questions` (Questions on Policy or
  Legislation, Questions on Promised Legislation, Other Members' Questions; matched by the
  heading lists in `debateGroups.ts`): split on speaker order. A new exchange starts only when an
  office holder **answers** a member who is not the current asker, so a heckle or a one-word
  interjection never starts one. On 2026-09-30: McDonald (turns 0–10), Cian O'Callaghan (11–18),
  Boyd Barrett (19–24), Gogarty (25–). The chair's turns are dropped. A pure splitter, tested from
  real speaker orders with interruptions, the Tánaiste answering, and a leader returning later.

### Step Q2. Items (model): a second extractor

- **Its own version**, `QUESTION_EXTRACTOR_VERSION = 'q1'`, beside `EXTRACTOR_VERSION = 'v2'`.
  Argued debates stay on `v2` untouched. Reusing or bumping `EXTRACTOR_VERSION` would empty the
  debate record at the next sync (`debateRecord.ts` filters on it) and make the nightly job re-read
  every argued debate with the wrong prompt.
- `extractDebates` (`run.ts`) is generalised to take its unit list, prompt, version and window
  builder as inputs; the debate path passes today's values, so its behaviour and tests stay the same.
- **One window per exchange, with no context speeches.** `buildWindows` would pack 10,000 words
  across exchange boundaries, and a context speech could be the previous exchange.
- Kinds: `specific_claim`, `commitment` (with `commitment_type`), `question`. Replies and
  concessions are left out.
- Schema: enum `commitment_type` and a nullable column on `debate_items` (NULL for every `v2`
  item); `RawItem`, `itemSchema` and `VerifiedItem` gain the field; items carry an `exchange_id`
  (nullable, set for `q1`). Runs are kept per exchange in `question_extraction_runs`.
- Cost at the v2 rate, with one call per exchange (about 3,900 calls, each repeating the
  instructions) and answers dense in claims: **about $3 to $3.50 off-peak, double at peak.** A
  100-exchange pilot first (about 150,000 words, about $0.07).

### Step Q3. The check (the gate)

The blind marking page built for debates on 2026-10-10 (an Artifact in Sam's claude.ai account,
not in the repo; its key and scorer are rebuilt from the database) takes exchanges unchanged.

- **Recall**: 30 random exchanges across the kinds, marked before any model output is seen.
- **Precision**: 50 commitments the model found, judged one by one (as Part 2 of the debate page
  does for replies), because 30 random exchanges hold too few commitments for one error not to
  decide a 90% target.
- A kind is shown only at precision 90% and recall 70%; `commitment_type` needs 90% agreement
  with the person on `action` against `follow_up`.

### Step Q4. Rules q1 (code)

| Rule | Points | Limit |
|---|---|---|
| An `action` commitment in reply to your question | +2 for each asker the exchange has | 1 per asker per exchange; **only across the House** |
| A `follow_up` commitment | shown | no points |
| Specific claims in a minister's answer | shown | no points, no ranking |
| Questions asked | shown | no points |

- **Across the House only**, as for concessions (`governmentSide.ts`): a government backbencher's
  question answered with an announcement is not a commitment secured from the government.
- **Grouped questions**: every asker of the exchange is credited once (the answer is to all of
  them). One answer cannot score twice for the same asker.
- **Term figure per kind**, never pooled: commitments secured per 10 oral PQs and per 10 Topical
  Issues, each against the 75th percentile of backbenchers with at least 10 of that kind. Leaders'
  Questions and the rapid sessions are shown, never in a figure: only party leaders ask Leaders'
  Questions, and rapid sessions are a few seconds each.
- Stored like the debate record: `question_participation` (one row per member per exchange),
  rebuilt from items with no model calls, in the sync and after each extraction run.

### Step Q5. Show

A "Question record" section in the TD profile's Debates tab, separate from the debate record, with
the quotes; the exchange on the Dáil record page. New routes go through `route-coverage.test.ts`.
Nightly reading behind its own flag, `QUESTION_ITEMS=on`, off by default.

## Migrations and CI

One additive migration (the next free number, 0023 today): `question_askers`, `question_exchanges`,
`question_extraction_runs`, `question_participation`, the `commitment_type` enum and the nullable
`debate_items` columns. Its journal `when` must exceed main's newest (CI's migration guard).

## Fairness

- The asker is credited for what the minister commits to, not for the question's wording, so a
  well-aimed question from any opposition party scores the same.
- Backbenchers are compared only with backbenchers, per kind.
- A minister who commits to nothing loses nothing: answers are shown, never scored or ranked.

## Risks

| Risk | Answer |
|---|---|
| A commitment that restates an existing plan | the v2 prompt already excludes descriptions of existing plans (a prompt rule, not a code check); the precision check measures it |
| Follow-ups counted as outcomes | `commitment_type`, scored only for `action`, with its own agreement target |
| Credit to the wrong asker | oral PQ askers from the API (Q0); speaker order only where no API data exists |
| Leaders' Questions split by heckles | a new exchange only when an office holder answers the new member; tested on real days |
| The debate record emptied by a version change | separate `QUESTION_EXTRACTOR_VERSION`; `v2` untouched |
| A commitment is made but never kept | out of scope; a later "promises kept" check can reuse the stored quotes |

## Decision for Sam

1. **Commitments secured (recommended).** Build Q0–Q5: one concrete outcome per question, about
   $3–3.50 off-peak for the whole term, behind the same check.
2. **Counts only.** Build Q0–Q1 and show exchanges asked per TD, with no model and no points. Free,
   but it adds almost nothing: the score already counts both the questions and the sections spoken in.

## Tests and CI

- Q0: the questions feed stores (section, asker) for every oral PQ, grouped ones included.
- Q1: the exchange splitter from real speaker orders (array literals): interruptions, chair turns,
  the Tánaiste answering, a leader returning later in the day.
- Q2: `commitment_type` parsing; the debate path unchanged (its existing tests pass untouched);
  one window per exchange with no context.
- Q4: rules from array literals: across the House only, one per asker per exchange, `follow_up`
  never scores, kinds never pooled.
- Integration on Docker Postgres with a fake model, as for the debate record.

## As built (2026-10-10): option 1, commitments secured

Sam chose option 1. Built as planned, with these differences and measurements.

- **Q0** `parse.ts` `questionAskerRows` keeps (section, question number, asker) for every oral PQ
  in `politics.question_askers`, written by the questions feed for the months it reads. A full
  backfill needs one sync with `--since 2024-11-29` (3,831 askers on the local copy).
- **Q1** `questionItems/exchanges.ts`, pure and tested from real speaker orders, and
  `politics.question_exchanges`, rebuilt in a new sync step, `question-exchanges`, after the
  questions feed. **Added after measuring**: a new exchange also needs a question of at least
  `MIN_QUESTION_WORDS` (40) words. Without it the disorderly sitting of 2025-03-25 (dozens of
  3- to 10-word interjections, each answered in a line) was 70 exchanges; with it, 8. Leaders'
  Questions now split into 4 exchanges on 147 of 168 days, the usual four slots. All formats on the
  local copy: 2,257 oral PQ exchanges (1.65 askers each), 742 Topical Issues, 660 Leaders'
  Questions, 1,914 rapid.
- **Q2** the debate runner became `extractUnits(config)`; `DEBATE_EXTRACTION` passes today's values
  (its tests pass untouched) and `QUESTION_EXTRACTION` reads one window per exchange, no context.
  Runs share `debate_extraction_runs`, keyed by exchange id under version `q1`, which the debate
  record never reads (tested). Job `npm run questions:items`; nightly behind `QUESTION_ITEMS=on`.
- **`commitment_type` has three values, not two.** The first 100-exchange pilot with
  `action`/`follow_up` called about half of all undertakings actions, most of them general ("I will
  work as hard as is humanely possible", "we will continue to progress it"), so 3 oral PQs in 4
  looked like a commitment secured. `general` was added (shown, no points) and `action` made
  strict: a specific thing someone could later check was done.
- **The check (Q3)**, run by two independent Claude markers on 30 random pilot exchanges marked
  blind, plus 50 of the extractor's commitments from the other 70 judged one by one:
  - markers agree on 97 commitments (B against A: 85% precision, 97% recall);
  - the extractor finds commitments 93% right (57 of 61) but only 58% of the shared ones; the
    misses are mostly scheduled deliveries in prepared answers ("292 additional beds by 2028"),
    which the prompt leaves out as descriptions of existing plans, and which both markers called
    hard calls;
  - on commitments all three found, action or not agrees 95% (53 of 56);
  - **what scores, a specific commitment in the exchange or not: precision 91%, recall 67%** on
    the 24 exchanges the markers agree on (just under the 70% recall target);
  - part 2: 7 of the 10 "actions" both markers agreed on were actions; the misreadings were a
    refusal ("I do not intend to … publish") and offers to circulate figures or analyse proposals,
    now named in the prompt; a pilot re-run confirmed all three read correctly.
- **Cost**: the pilot read 100 exchanges for $0.11; the whole term (5,573 exchanges, 5.9 M words)
  projects to about **$5 off-peak, $10 peak**, more than the plan's $3–3.50 because answers are
  dense in claims.
- **Q4** `questionItems/rules.ts` (rules q1) and `politics.question_participation` (migration 0024
  with the three tables and the `commitment_type` column), rebuilt after every read and every sync.
- **Q5** a "Question record" card under the debate record on the TD profile, and a panel under
  each question section on the Dáil record page; routes `GET /api/parliament/tds/:id/question-record`
  and `GET /api/parliament/question-records/:sectionId`.
