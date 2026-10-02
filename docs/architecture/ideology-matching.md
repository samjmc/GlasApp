# Ideology and matching

One ideology model for users, TDs and parties, and one formula for how close two of them are.
Rebuilt 2026-09-24 (`docs/plans/quiz-ideology-rebuild.md` has the history and what it replaced).

## Dimensions and sign rule

`shared/ideology.ts` is the only definition: eight dimensions, each −10..+10, and on **every**
dimension + is the right-coded pole.

| Dimension | −10 | +10 |
|---|---|---|
| economic | collective | market |
| social | progressive | conservative |
| cultural | multicultural | traditional |
| authority | libertarian | authoritarian |
| environmental | ecological | pro-growth |
| welfare | expand welfare | self-reliance |
| globalism | internationalist | nationalist |
| technocratic | expert-led | populist |

Every source is stored in this convention. Before the rebuild the quiz used the opposite sign on
globalism, environmental, welfare and technocratic while every model prompt used this one.

## The model (`server/ideology/model.ts`)

A profile is a per-dimension **weighted mean of positions**: a prior plus every observation that
says something about that dimension. An observation silent on a dimension does not pull it to 0.
It is order-independent, so every profile can be rebuilt from its evidence at any time:
`npm run ideology -- --recalculate`.

| Subject | Prior | Evidence | Decay |
|---|---|---|---|
| user | none | latest quiz (weight 10, only the dimensions it asked) + every policy vote (`listUserVoteVectors`) | none |
| TD | party baseline (`partyBaselines.ts`), weight 3; independents none | `politics.td_ideology_evidence`: verified news stances (`stance`, `server/stances`), debate stances (not wired yet) | 180-day half-life |
| party | — | mean of its TDs' profiles, each weighted 3 + its evidence weight; baseline when it has none | — |

Source scales (`sources.ts`): debate stances (and the old `article` rows) are ±0.5 (×20); vote
options and `stance` evidence are ±2 (×5), because a stance IS an option position. A value under
10% of its source's maximum is no signal.

A `stance` row is the option of the article's own daily-vote question that a TD's verified quote
states (`sourceRef = question:<id>`), weighted option weight × option confidence × quote kind
(direct 1, paraphrase 0.6, `QUOTE_KIND_WEIGHT`). It is the TD's current answer to that question:
a newer one replaces it, an older one never does (`insertTdEvidence`).

## Alignment (`server/ideology/alignment.ts`)

`100 × (1 − Σ wᵢ|aᵢ − bᵢ| / Σ wᵢ·20)`: 100 = identical, 0 = opposite ends of every weighted
dimension. Weights default to 1 and are capped at 3. Used for user↔TD, user↔party and TD↔party.

## Shared issues (`userMatches`, signed in only)

A signed-in user's TD match blends that axis alignment with how often the TD answered the user's
own daily-vote questions the way the user did (`server/stances/agreement.ts`):

- items = questions the user answered on which the TD has a CURRENT stance with an answer
  (latest `stated_at` wins);
- per item, `agree = 1 − d(yours, theirs) / widest d between two of that question's options`;
- weight `w = kind × 0.5^(age / 180 days)`;
- `shown = (Σ w·100·agree + 2·axis) / (Σ w + 2)`. No items = the axis number exactly.

The response carries `issues: { agree, disagree, items }`, with items only for the TD asked about
(`?td=`) and the top 5. `matchesFor` (signed out, `POST /matches`) is axis only, unchanged.

**The same stance is counted twice, on purpose.** Stance evidence is inside the TD's axis profile
(the broad direction) and is also an item here (the specific issue, where the user answered the
same question). The axis says "these two lean the same way overall"; the item says "on this
question, they chose the same answer". Removing it from either would lose one of those.

## Seams

- `server/voting` calls `recomputeProfile(userId)` after each vote and `getIdeologyProfile(userId)`.
- `server/stances/record.ts` (news pipeline and `npm run stances -- --rebuild`) calls
  `recordTdEvidence({ source: 'stance', sourceRef: 'question:<id>', … })`.
- Nothing records `article` evidence any more. `npm run stances -- --rebuild` deletes those rows
  (`deleteTdEvidence('article')`) and backfills stances from articles that already have a question.
- A debate pipeline calls `recordTdEvidence({ source: 'debate', sourceRef: <speech id>, … })`.
