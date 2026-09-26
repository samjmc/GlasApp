# TD scoring

A TD's score is built **only from facts anyone can check in the Oireachtas record**. News carries
no weight: judging whether a statement was good or bad has no neutral answer, so it is not part
of the number (decision 2026-09-25, `docs/plans/facts-only-scoring.md`). Everything about how a
TD gets a number lives in `server/scoring/`; the facts themselves come from `server/parliament/`.

## The model

Four components, each measured inside the TD's own membership of the current Dáil:

| Component | Fact | Full marks at |
|---|---|---|
| questions | oral + written parliamentary questions this term | 200 (`QUESTIONS_BENCHMARK`) |
| attendance | Dáil votes cast ÷ divisions held while a member | 95% (`ATTENDANCE_BENCHMARK`) |
| committees | sittings of the TD's own committees attended ÷ held | 85% (`COMMITTEE_ATTENDANCE_BENCHMARK`) |
| debate | debate sections spoken in per sitting day, against the 75th percentile of TDs | the 75th percentile |

Each is capped at its benchmark. They form two pillars, and the pillars form the overall 0–100:

| Pillar | Weight | Made of |
|---|---|---|
| parliamentary | 0.55 | questions 0.5 · attendance 0.3 · committees 0.2 (`PARLIAMENTARY_WEIGHTS`) |
| debate | 0.45 | debate |

The weights live in `server/scoring/weights.ts` and nowhere else. They were news 0.45 /
parliamentary 0.30 / debate 0.25 until 2026-09-25; with news removed the other two are
renormalised. The parliamentary weights and benchmarks are Sam's choice from PR #77.

### NULL means "not expected / not measurable", never 0

A component is NULL when the TD was not expected to produce it, or when there is too little to
measure. It is then left out, and the weights renormalise over what is there: a TD on no committee
is scored 62.5 / 37.5 on questions and votes, not given 0 for committees.

**Fair inputs are the parliament module's job, not scoring's** (split agreed 2026-09-25).
`server/parliament/` is responsible for deciding when a TD was not expected to produce an input —
questions for periods in government office, documented absences out of attendance denominators,
every input for the Ceann Comhairle, too little eligible time for a by-election TD — and handing
scoring a NULL. Today it already NULLs attendance and debate for the chair and anything below its
minimums (`metrics.ts`). Scoring adds no office-holder rule of its own. Its contract is `repository.rollupInputs`: questions,
attendancePct, committeeAttendancePct, debateScore and isPresiding. As a backstop, `rollup.ts`
treats a TD who holds the chair (`isPresiding`) as having every component NULL, because the
question count defaults to 0 and committee attendance is measured for anyone.

Two things are stated rather than adjusted:

- **Vote attendance** is scored as the Official Report records it. Pairing is not published, so
  a paired absence counts as a missed vote; the profile page says so next to the count. There is
  no special case for Cabinet: an exemption for ministers would lift government leaders and not
  the opposition leader, whose attendance is also low.
- **Ministers' debate participation is not adjusted.** Ministers move bills and answer in the
  chamber, which raises it. Only speeches from the chair are excluded (`parse.ts isPresidingRole`).

### Minimum evidence

A TD with fewer than `MIN_COMPONENTS_FOR_RANK` (2) non-NULL components gets an overall score of
NULL and no rank. One number — say, vote attendance alone — is not enough to rank against TDs
measured on four. Their pillars are still stored and shown.

### Ranks

National, party and constituency ranks are over TDs with an overall score. Equal scores share a
rank and the next rank skips (1, 2, 2, 4); lists show ties in name order.

### Party score

The mean overall score of the party's ranked members, computed on read (`party.ts`); unranked
members are left out, not counted as 0. A party with no ranked member has no score. Nothing is
stored. Pledge delivery stays on the party page as its own counts and is never blended in.

## Where the facts come from

`npm run parliament:sync` (`server/parliament/`, daily at 04:45 from the scheduler) ingests
divisions, debates, questions and committee sittings from `api.oireachtas.ie`, recomputes
`politics.td_parliament_stats`, writes the scoring inputs onto `tds`, then calls
`recalculateAll()`. The roster sync runs first. See `docs/plans/parliament-rebuild.md` for the
API facts behind each count.

```
recalculateAll()                         recalculate.ts
  rollupInputs()                         repository.ts   tds + td_parliament_stats (via parliament repo)
  debate participation                   debateInputs.ts → parliament/metrics.debateScores
  components, pillars, overall, ranks    rollup.ts
  writeRollup()                          td_scores
```

Also run by `npm run scores:recalculate` and `POST /api/scores/recalculate` (admin).
`npm run td-scoring -- --recalculate` is an alias kept for one release.

## News

News is **not part of the score**. The news → TD pipeline (`server/news/tdPipeline.ts`,
`npm run news:tds`, every two hours from the scheduler, and `POST /api/admin/td-scoring/run`)
only records facts and makes questions:

1. importance triage (newsworthiness, also the feed's "Top stories" order);
2. find the TDs each article is substantially about and link them in `article_tds`
   (`linkArticleTd`, idempotent), which feeds "In the news" on a TD's page;
3. what those TDs say becomes stance records, never a score (`server/stances`,
   `docs/plans/td-stances.md`): a quote checked against the article text, in `td_stances`. Only an
   article with at least one verified stance gets a daily-vote question
   (`generateQuestionForArticle`), and each stance is matched to one of its answers.

Each event is processed once: ingest links same-event copies to the first report
(`server/news/events.ts`, `news_articles.duplicate_of`), and only that canonical is claimed. A
manual run on a duplicate's id (`npm run news:tds -- --article <id>`) processes its canonical.

## Getting a TD table

`npm run sync-tds` upserts the current Dáil roster by member code (falling back to name), and
**deactivates rather than deletes**: scores cascade from `tds.id`, so removing a row when someone
leaves the Dáil would erase their record. An empty roster from the API changes nothing, so a
failed fetch cannot wipe the table. The diff itself is pure (`tdSync.ts`) and unit-tested.

## Tables (`politics` schema)

| Table | Holds |
|---|---|
| `tds` | who a TD is, plus the scoring inputs: question counts, vote and committee attendance |
| `td_parliament_stats` | per-TD raw counts from `server/parliament/`, and `is_presiding` |
| `td_scores` | one row per TD: the stored pillars, overall and ranks. `computed_at` is when the rollup last wrote it |
| `article_tds` | article ↔ TD: this TD is named in this article. A fact, not a verdict |
| `td_historical_baselines` | researched history per TD; shown, not scored |

The facts-only migration (`drizzle/*_facts_only_scoring.sql`) dropped the ELO, news, trend and
story-count columns, `td_score_history` and `party_scores`, and renamed `article_td_scores` to
`article_tds` without its verdict columns. `td_policy_stances` was dropped by
`drizzle/0012_td_stances.sql`; `td_stances` replaces it.

## API — `/api/scores`

Response types are in `shared/scoresApi.ts`, imported by the router and the client, so a field
dropped on one side fails `tsc` on the other.

| Route | Serves |
|---|---|
| `GET /tds` | every active TD, best first (+ `hasResearch`) |
| `GET /widget` | homepage: top 5, bottom 5, totals |
| `GET /td/:name` | profile, components, pillars, and the raw facts (votes cast / divisions eligible, questions oral / written, committee sittings, debate sections) with a link to the TD's oireachtas.ie page |
| `GET /td/:id/summary` | quick-info modal |
| `GET /parties` · `GET /party/:name` | party means (computed on read) and one party's members |
| `GET /constituencies` · `GET /constituencies/summary` · `GET /constituency/:name` | constituency pages and the map |
| `POST /recalculate` (admin) | rebuild derived scores and ranks |

Every response is `{ success, data, meta? }`.

## Tests

`weights`, `rollup`, `party` and `tdSync` are pure and unit-tested from array literals.
`routes/scores.test.ts` covers the router against a mocked repository and asserts the card has
exactly the fields `shared/scoresApi.ts` declares.

`repository.integration.test.ts` runs the real SQL. It skips unless you point it at a throwaway
database, and it drops and recreates the `politics` schema in whatever you give it:

```bash
docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
$env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
npx vitest run server/scoring/repository.integration.test.ts
```
