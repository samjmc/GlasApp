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
| TD | party baseline (`partyBaselines.ts`), weight 3; independents none | `politics.td_ideology_evidence`: article stances (scoring panel), debate stances (not wired yet) | 180-day half-life |
| party | — | mean of its TDs' profiles, each weighted 3 + its evidence weight; baseline when it has none | — |

Source scales (`sources.ts`): article and debate stances are ±0.5 (×20), vote options ±2 (×5).
A value under 10% of its source's maximum is no signal.

## Alignment (`server/ideology/alignment.ts`)

`100 × (1 − Σ wᵢ|aᵢ − bᵢ| / Σ wᵢ·20)`: 100 = identical, 0 = opposite ends of every weighted
dimension. Weights default to 1 and are capped at 3. Used for user↔TD, user↔party and TD↔party.

## Seams

- `server/voting` calls `recomputeProfile(userId)` after each vote and `getIdeologyProfile(userId)`.
- Nothing records `article` evidence any more: the scoring panel's ideology analyst was deleted
  with the facts-only score. Stored rows stay until verified stances replace them
  (`docs/plans/td-stances.md`).
- A debate pipeline calls `recordTdEvidence({ source: 'debate', sourceRef: <speech id>, … })`.
