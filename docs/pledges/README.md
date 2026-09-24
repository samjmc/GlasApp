# Pledge data

The pledge tracker (`server/pledges`, `/api/pledges`) starts **empty**. Pledges are entered
one at a time on the admin page (`/admin`), each with a source link, and a pledge's status
is set only from dated, sourced evidence.

## Why it does not ship with seed data

The old app had pledge data in three places. None of it was fit to publish:

| Old source | What it held | Problem |
|---|---|---|
| 13 scripts in `scripts/` | ~70 pledges, many repeated (the same 13 Fine Gael pledges in 5 scripts) | Party ids contradicted each other (id 2 was Fine Gael in one script, Fianna Fáil in another). Joint Programme for Government commitments were assigned to single parties. Progress "evidence" had precise, untraceable figures and guessed links, e.g. a "Land Development Agency Act 2024" (the LDA Act passed in 2021). |
| `shared/educationData.ts` | 26 pledges with "% fulfilled" and an evidence sentence | No source for any figure. Only reachable through a tab that had no button. |
| `server/services/pledgeScoring.ts` | party performance and trust scores | Hand-typed opinion numbers per party (integrity, transparency, accuracy). |

Seeding only the parts with a working source would have published pledges for two parties and none for the rest. That imbalance is worse for a politics app than an empty tracker.

## `import-candidates-2026-09.json`

The 36 pledges from the four most usable scripts, one per party, with the result of an
automated link check on 2026-09-24 and review notes. Status and evidence were
deliberately NOT carried over.

| Party | Candidates | Link loads | No review concerns |
|---|---|---|---|
| Aontú | 10 | 10 | 0 (sources are news articles and Wikipedia) |
| Fianna Fáil | 3 | 0 | 0 (joint 2020 Programme for Government, gov.ie blocks automated checks) |
| Fine Gael | 13 | 0 | 0 (`finegael.ie/manifesto/*` pages did not respond; the home page did) |
| Social Democrats | 10 | 10 | 10 |

To use one: open its source, confirm the pledge is stated there, then enter it on the admin
page. Do not bulk-import this file.
