# Debate analysis: a structured way to see who drives a debate

Status: **plan, vetted 2026-10-02, not built.** Sam chose "the most robust way forward" at every fork.

## Why

Sam (2026-10-02): analysing the debates themselves adds a lot of value, as long as the process
is structured, so that the rules make the judgement and AI does not.

An old version existed (`scripts/generate-debate-outcomes.ts` and four more). An LLM read a
*summary* of each section and picked a winner and a runner-up. Its tables were never in any
migration, and it was deleted in the parliament rebuild (`1b21fbf`, 2026-09-22). This plan
does not bring it back.

## The principle

**AI finds and quotes. Code checks and scores.**

1. AI reads each speech and fills a fixed form: what kind of item, and the exact words.
2. Code checks every quote word for word against the stored speech. An item that fails is
   dropped and counted.
3. Code gives points from a published rule table with a version number. The same rules apply
   to every TD.
4. Every point links to its quote. A reader can check why a TD got a number.

The AI never writes "good", "strong", "true" or "won". The quote check proves the words exist,
**not** that the AI classified them correctly. That part is measured (the check set below), and an
item type that fails the check set is not used.

## Decisions taken

| Fork | Taken | Why |
|---|---|---|
| Which debates first | **Argued debates only**: bill stages, motions, statements | Question sessions are Q&A by Standing Orders and need their own rules |
| "Did they answer the question?" | **Shown, no points** | It is a judgement, the same kind removed from news scoring (`docs/scoring.md`) |
| TD score | **Card only**, not in the score | Sam decides after the check set passes |
| Check set | **Marked by a person, blind** | Two runs of one model agree with themselves and prove nothing |

## What the data says (local copy of GlasCore, measured 2026-10-02)

- 4,622 debate sections; 2,928 are children of another section.
- **A section is not a debate.** 179 "(Resumed)" sections continue 163 debates on later days.
  210 of the 408 votes linked to a section sit in a stub with 0–1 TDs speaking (median 102
  words): the arguing happened on an earlier day.
- Argued debates: **618 bill stages** (`bill_debates`, Dáil only), **232 motions**, **101
  statements**. 16,568 speeches, **7.1 million words** (chair excluded).
- Largest debated section: 71,601 words. One AI call per debate does not fit.
- A minister speaks last in **3,212 of 3,865** debated sections (83%): the closing reply.
- The government lost **1 of 412** votes.
- About 1,000 speeches by 70 TDs are in Irish (a rough word count).
- Government bill sponsors are offices ("Minister for Health"). Every label sampled matches a
  `td_offices.title` exactly, so the minister who moved a bill can be found by date.
- `LLM_API_KEY` is set (model `deepseek-flash`).

## Design

### Step 1. Group sections into debates (no AI)

New table `politics.debates`, one row per debate, and a nullable `debate_id` on
`debate_sections`. Rules, in order, each unit-tested from real titles:

1. A Dáil section in `bill_debates` belongs to the debate of (bill, stage), where the stage is
   the title without "(Resumed)" / "(Atógáil)".
2. A top-level section titled "… (Resumed)" joins the most recent earlier debate with the same
   title without that suffix. Otherwise it starts a new debate. (A title such as "Ministerial
   Rota for Parliamentary Questions: Motion" recurs 15 times as separate debates.)
3. The kind comes from a **fixed list of Official Report headings** in
   `server/parliament/debateKinds.ts` (bilingual headings, e.g. "Ceisteanna ó Cheannairí -
   Leaders' Questions"). It is a typed enum: `bill_stage | motion | statements |
   leaders_questions | questions | topical_issue | excluded`. A heading not in the list is
   `excluded` and is listed by the job so the list can grow. Order of Business and messages
   from the Seanad or committees are `excluded`.

Facts stored on each debate (shown, never scored):
- **Moved by**: the bill's primary sponsor, or the minister holding that office on that date;
  for a Private Members' motion, the first TD to speak (`mover_source = 'first_speaker'`,
  correct on 6 of 6 samples; check more before trusting it).
- **Result**: the votes in any of the debate's sections, with Carried / Lost.
- **Speakers and words** per TD. Speaking time is allotted by party size, so it gets no points.

### Step 2. Extract items (AI), argued debates only

- The AI reads the debate in **windows of whole speeches** (about 10,000 words). Each speech has
  an id. An item can point only to a speech in the same debate that came earlier.
- **Quote in the original language.** Never translate. Irish speeches are part of the check set.
- Item kinds (typed enum):

| Kind | What it is | Needs |
|---|---|---|
| `specific_claim` | a figure, a named report, Act or body, a cost or a date | quote, subtype |
| `response` | this speech takes up a specific earlier point by another speaker | quote here, quote there, target speech |
| `concession` | explicit agreement with a point from another speaker | quote, target speech |
| `question` | a direct question to a named member or office | quote, addressee |
| `commitment` | a minister commits to an action | quote, date if given |

- Code checks (pure, tested): the quote is in that speech after `normalise()` from
  `server/stances/verify.ts` (it already handles fadas, curly quotes and dashes); the length is
  within limits; a target speech is earlier, in the same debate, by a different speaker; an
  addressee is a known member or office. Rejections are counted by reason **and by language**.
- Table `politics.debate_items`: one row per accepted item, with `extractor_version`. Table
  `politics.debate_extraction_runs`: per debate and version, the status, rejection counts,
  tokens used. A debate is extracted once per extractor version.

### Step 3. The check set (the gate)

- 20 argued debates, chosen to cover each kind, short and long, government and opposition
  movers, and at least 3 with Irish speech.
- A person marks them blind with the same form, before seeing any AI output.
- Per item kind, the AI must reach **precision 90% and recall 70%** against the person, and the
  Irish rejection rate must be within 5 points of the English rate.
- A kind that fails is not shown and not scored. The prompt can be changed and the gate run
  again (a new `extractor_version`).

### Step 4. Points (code), rules version 1

Points come only from kinds that passed the gate. Version 1 starts small:

| Rule | Points | Limit |
|---|---|---|
| A specific claim | +1 | 3 per speech, so length does not win |
| Another speaker took up your point | +2 per distinct speaker | the debate's closing reply does not count, so procedure does not win |
| A speaker conceded a point to you | +3 | |
| Questions, commitments | shown, no points | |
| Moved the debate, result of the vote, speaking time | shown, no points | |

- **Per debate**: participants listed by points, with every item quoted. The label is "most
  points under the published rules (v1)". The words "won" and "winner" are not used.
- **Per TD, over the term**: points per argued debate taken part in, compared only with TDs in the
  same role (office holders vs everyone else), against the 75th percentile (reuse
  `percentile()` in `server/parliament/metrics.ts`). Below 5 argued debates: no figure. The chair
  is left out.
- Rules live in `server/parliament/debateRules.ts` with `RULES_VERSION`. Changing a rule
  recomputes from stored items with **no new AI calls**.

### Step 5. Show it

- TD profile: a "Debate record" card, separate from the score, with the term figure and links to
  each debate's items.
- Dáil record page (`/debates`): a debate's detail lists participants, items and quotes.
- `docs/scoring.md` gets the rule table, stated as **not part of the score**.

## Rollout

1. Step 1 (grouping) and its tests. No AI and no cost.
2. Step 2 on a **pilot of 50 debates**: measure tokens, cost and rejection rates. Report the
   cost of the full backfill (7.1 million words) to Sam **before** running it.
3. The check set (Step 3). Nothing is shown until it passes.
4. Steps 4 and 5, behind a flag until Sam has looked at real output.
5. Daily: after the parliament sync, extract only new argued debates.

## Fairness

- The rules score **how** a TD argues, never **what** they argue.
- The same rules apply to every party. Office holders are compared only with office holders.
- Procedure is not scored: speaking time, who moved, who spoke last, the vote result.
- An item is never inferred: no quote, no item.

## Not in this plan

- Question sessions (Leaders' Questions, parliamentary questions, Topical Issues): they need
  their own rules, as a separate plan.
- Fact-checking claims. A specific claim gets the same point whether it is true or not, which is
  why it is capped and called "specific", not "evidence".
- Any change to the TD score.

## Tests and CI

- Grouping: pure functions tested with real titles (Resumed, Atógáil, recurring titles,
  bilingual headings, unknown headings).
- Verification: tests that a translated quote, a quote from another speech, a later target and a
  self-target are each rejected; each test is shown failing with its check removed.
- Rules: points from array literals, including the limits and the closing-reply rule.
- Integration test on Docker Postgres: grouping and extraction runs with a fake model.
- New migration: the next free number on main (the quiz session has 0015).
- New admin or job routes go through the route-coverage invariant.

## Risks

| Risk | Answer |
|---|---|
| AI labels items wrongly but the quote is real | The check set, per kind; failing kinds are not used |
| Irish speakers lose items when quotes are translated | Original-language rule, Irish in the check set, rejection rate per language |
| Long debates break cross-speech links | Windows of whole speeches, targets only earlier in the same debate |
| Procedure scored as skill | Closing reply excluded; speaking time, mover and vote result get no points |
| Cost | Pilot first; the full backfill only with Sam's go |
| A public "winner" label on a named TD | Not used; always "points under the published rules", with the quotes |
