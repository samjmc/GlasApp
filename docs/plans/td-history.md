# TD history: a sourced background for every TD

Status: APPROVED by Sam 2026-10-02 (both decisions: yes). Planned against main `7788093`, vetted
once against the code (revised with every finding), built on `193e183`.

Changes made while building, from measurement:
- Measured 2026-10-02: all 174 active TDs have a `member_code`, and all 174 match exactly one
  English Wikipedia article through P4690.
- R5 has a second code guard, `SENSITIVE` in `server/tdHistory/source.ts`: a summary sentence or
  passage with an allegation word (alleged, convicted, tribunal, court, criticised, …) is never
  shown, because "career" sections can carry allegations too. The summary stops at the first such
  sentence; a TD whose first sentence matches gets no background (fail closed).
- The cut-section list also covers family/private life and the non-prose sections (References,
  External links, …).
- Dry run on 3 real TDs: 1,100–2,700 prompt tokens and about 300 completion tokens per TD.

## Why

The TD profile's **Background** tab (`TDProfilePage.tsx:893-932`) reads
`politics.td_historical_baselines` through `repo.baselineFor` (`server/scoring/repository.ts:219`)
and `GET /api/scores/td/:name` (`server/routes/scores.ts:124-151`). That table has **0 rows**: the
writer (deleted in #101) saved to a `public` table that does not exist. Sam wants the content
back, done correctly.

## What was wrong with the old writer (each one is a rule below)

1. **No sources.** The model "researched" a living politician from memory, which can invent
   facts. On a politics site, that is a defamation risk.
2. **It scored people:** a 0.50–1.30 modifier and labels such as `severe_issues`, with two real
   TDs named in the prompt with target scores. Facts-only scoring (#94) removed judgement scores.
3. **It saved its failures as research** ("Error during research - defaulting to neutral").
4. **It matched by name** (`politician_name`), so two TDs with the same name would collide.
5. **No checks** that any output matched a source.

## Rules

- **R1 Only source words reach the page.** The page shows ONLY text copied word for word from
  the source: the summary is the article's first sentences, and each finding is a quote. **The
  model never writes text that a reader sees.** Its only job is to CHOOSE which passages to show.
  Code then checks that each chosen passage is in the source.
- **R2 No judgement.** No score, no category, no confidence. Each item is shown as
  "According to Wikipedia: '…'".
- **R3 Exact matching.** TD → article only through Wikidata **P4690** (Oireachtas member code,
  `politics.tds.member_code`, unique), which `server/parliament/sources/wikidata.ts` already uses.
  No match, a NULL `member_code`, or a disambiguation page means no research for that TD. We
  never guess by name.
- **R4 Fail loud, write nothing.** A fetch error, a model error (`completeJson` returns `null`), or
  zero verified findings writes no row. Each one is counted in the run summary.
- **R5 Vandalism guard.**
  - We read the newest revision that is **at least 72 hours old**, not the live page. Wikipedia
    reverts most vandalism within that time.
  - Code cuts the sections "Controversies", "Criticism", "Personal life" and "Legal issues" (a
    fixed list, matched case-insensitively) out of the source before anything else. An
    allegation is never shown, even when quoted. This is enforced in code, not only in the
    prompt.
- **R6 Attribution and takedown.**
  - The page links to the exact revision we read (`/w/index.php?oldid=<revision>`), shows the
    date we read it, and says "Text from Wikipedia, CC BY-SA 4.0" with a licence link.
  - `--delete --td <id>` removes one TD's row at once, if a complaint arrives.

## Sources (no paid API, no new key)

| Source | How | Gives |
|---|---|---|
| Wikidata | one SPARQL batch: `member_code` (P4690) → enwiki sitelink title | the exact article |
| Wikipedia | MediaWiki API with `redirects=1`, `prop=revisions` (`rvstart` = now − 72 h), `pageprops` (reject `disambiguation`) | text of that revision + revision id |

- Reuse `wikidata.ts`: export its `USER_AGENT` and add a `sitelinkQuery` next to `genderQuery`,
  following the `fetchGenders` batch pattern. The Wikipedia client is new; nothing like it exists.
- Send at most 1 request a second to Wikipedia.
- **Source text** = the lead, plus the following sections in page order, with the R5 sections cut
  out, up to `SOURCE_MAX_CHARS` (a named constant, about 12,000 characters). That exact string is
  what the model sees AND what verify checks.

## Pipeline (per active TD with a `member_code`)

1. `resolve` (P4690 → title).
2. `fetch` (the 72-hour-old revision → source text).
3. **Skip** if the stored `source_revision` is the same and `--force` is not given.
4. `summary` = the first 2 sentences of the lead, copied with **no model call**.
5. `choose`: one `completeJson` call: "from this text, pick up to 6 passages about the TD's
   public career (offices, elections, legislation, committee work); copy each one exactly".
   Output: `{ passages: string[] }`.
6. **verify** (pure). Reuse `normalise` from `server/stances/verify.ts:62`, and **also** apply its
   rules from `server/stances/extract.ts:34-35`:
   - the passage is 8–60 words;
   - it has no "..." or "…";
   - it is found in the source text after normalising;
   - the passage stored is the source's own wording (with its offsets), not the model's copy;
   - duplicates are dropped.
7. `save`: one upsert on `td_id`, in one transaction, or count the reject reason. A TD with 0
   verified passages still gets its summary row: the summary is source text and needs no model.

## Data model (migrations, numbered from main at build time: next free is `0016` today)

The table is empty. That is a checked fact: the first migration starts with
`DO $$ BEGIN IF EXISTS (SELECT 1 FROM politics.td_historical_baselines) THEN RAISE EXCEPTION ...`.

**Two generated migrations in one PR.** Mixing drops and adds makes `drizzle-kit generate` ask
"renamed or created?", which an agent cannot answer, and `text`→`jsonb` needs a `USING` cast.

1. **Drop:** `baseline_score`, `confidence`, `category`, `historical_summary`, `reasoning`,
   `controversies_noted`, `research_date`, `analyzed_by`.
2. **Add:**
   - `summary` text, not null;
   - `passages` jsonb (`string[]`, at most 6);
   - `source_url`, `source_title`;
   - `source_revision` bigint;
   - `retrieved_at` timestamptz;
   - `model` varchar (export `QUESTION_MODEL` from `server/voting/service.ts:48`, or the
     provider's override);
   - `COMMENT ON TABLE`: every passage is checked word for word against `source_revision`.

`key_findings` is replaced by `passages`. Kept: `id`, `td_id` (unique, FK cascade),
`created_at`, `updated_at`. Account deletion is not affected: this is data about TDs, not users.

## Job

`server/jobs/td-history.ts`, run with `npm run td-history -- [--td <id>] [--limit N] [--dry-run]
[--force] [--delete --td <id>]`. Same pattern as `server/jobs/stances.ts`:
- It stops before any work if no LLM key is set.
- `--dry-run` makes the calls and prints what it would save, but writes nothing.
- It prints a summary at the end: saved, unchanged, no Wikidata match, disambiguation, rejected
  passages by reason, failed.

It is not on the cron. A monthly cron can come later; "skip unchanged revision" keeps that
cheap.

## Reader changes (all readers, found by grep)

| File | Change |
|---|---|
| `server/scoring/repository.ts:215-222` | none (`select *`) |
| `server/routes/scores.ts:93` | `researched` = rows with a non-empty `summary` |
| `server/routes/scores.ts:143-151` | map `summary`, `passages`, `source { url, title, revision, retrievedAt }` |
| `shared/scoresApi.ts:111` | the new `baseline` type |
| `server/routes/scores.test.ts:109` | fixture: new columns |
| `TDProfilePage.tsx:896` | empty-state condition uses `baseline?.summary` only |
| `TDProfilePage.tsx:903-929` | summary + passages in quote style; source line with the revision link + CC BY-SA; delete the "Research category" box |
| `TDProfilePage.tsx:91` | delete `humanise` if it becomes unused |
| `docs/scoring.md:164`, `docs/plans/td-scoring-rebuild.md:65,84,113` | update the wording |

Fact check: the client does not show `hasResearch` or `researchedCount`. Only the server
computes them, so changing them affects nothing visible. These files were GApp's. That session
has ended, and the change touches only the baseline fields; ask any session that is active then.

## Tests (each one shown red once before it goes green)

- **Unit, pure.**
  - SPARQL parse: a duplicate or missing code is skipped.
  - Section cut: each R5 heading is removed, and a similar word in normal text stays.
  - Summary: the first 2 sentences, including names with initials ("W. T. Cosgrave").
  - verify:
    - an exact passage is accepted;
    - curly quotes and fadas still match;
    - a passage not in the text is rejected;
    - a passage from a CUT section is rejected;
    - passages under 8 or over 60 words are rejected;
    - "..." is rejected;
    - a duplicate is rejected;
    - prompt-injection text in the source cannot add a passage that is not in the source.
  - Arguments.
- **Integration (CI Postgres, its own database `<db>_td_history`).**
  - The upsert gives one row per TD.
  - A re-run with the same revision changes nothing.
  - A new revision replaces the row.
  - A reject writes no row.
  - `--delete` removes the row.
  - The migration guard stops when the table has a row.
- **Route.** `GET /api/scores/td/:name` returns the new shape, and `null` when there is no row.

## Rollout

1. One PR: the 2 migrations + the job + the reader changes. CI green (typecheck, test with DB,
   build, migration-guard, e2e). Merge.
2. Migrate GlasCore from main only.
3. **Pilot:** `--limit 5`. Sam reads all 5 against the linked revisions. Measure the real cost per
   TD (one model call each), and state it before the full run.
4. Full run (~174 TDs). Spot-check 10 at random against the revision.
5. Check the Background tab in the browser: one TD with research, and one with none.

## Sam's decisions (2026-10-02)

1. **No score or category** (R2), facts only like #94: **yes**.
2. **Publish:** after the 5-TD pilot review, verified passages go live with no further human
   check; the 72-hour revision rule, the section cut and `SENSITIVE` stand in for it: **yes**.

## Not in scope

- News or debate text (stances already cover what TDs say).
- Irish-language Wikipedia.
- Any change to scoring.
