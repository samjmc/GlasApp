# Parliament data rebuild

One ingestion and one query layer for Oireachtas data: Dáil divisions (votes), debates
(who spoke where), question counts and attendance. Same standard as `server/scoring/`.
Vetted 2026-09-22 against the code and the live API; every API claim below was measured.

## What is wrong today (measured against api.oireachtas.ie)

- **Attendance is 100% for every TD.** `calculateVotingAttendance` filters `/divisions`
  with `member=`, which the API ignores, so "votes cast" is the whole-house count, and it
  includes Seanad divisions. Jan–Jun 2025: 136 unfiltered, 108 Dáil only, 49 for Mary Lou
  McDonald with the real filter (`member_id=<member uri>`).
- **Question counts are the whole house.** Same ignored filter; every TD reads as ~1,000
  per year (the page cap). Real, same TD and period: 92 (15 oral + 77 written).
- **Party loyalty is always "loyal".** `determinePartyLoyalty` reads `member.party` on the
  tally, which the API does not return (tally members carry only showAs, uri, memberCode).
- The weekly job that fills these (`parliamentaryDataUpdateJob.start()`) is never called.
- Dead client calls today: `/api/parliamentary/voting/{stats,rebel,recent}` (TD profile)
  and `/api/parliamentary-activity/*` (Education page) have no server route; both 404.
- Debates: three generations of ingestion, a 12-step LLM chain (summaries, evaluations,
  outcomes, highlights, alerts, section contributions, weekly metrics, party aggregation)
  and a vector store, all writing `public.*` tables that do not exist in GlasCore.

## Shape

```
server/parliament/
  client.ts        typed api.oireachtas.ie client: roster (+ offices, membership window),
                   divisions, debate listings, AKN XML, question counts (qtype=oral|written)
  parse.ts         pure: division JSON -> rows; Akoma Ntoso XML -> speeches
  metrics.ts       pure: attendance, participation, party-line votes
  repository.ts    Drizzle reads/writes; the only DB access
  sync.ts          one incremental run: roster -> divisions -> debates -> questions
                   -> tds inputs -> recalculateAll()
  index.ts         public surface
shared/schema/parliament.ts   politics.divisions, politics.division_votes,
                              politics.debate_sections, politics.debate_speeches,
                              politics.parliament_sync_state
server/routes/parliament.ts   /api/parliament (public reads) + requireJob POST /sync
server/jobs/parliament-sync.ts   npm run parliament:sync [-- --since YYYY-MM-DD]
```

API facts the client must respect (all measured):
- Filter by member with `member_id=<full member uri>`; `member=` is silently ignored.
- Divisions: `chamber_type=house&chamber=dail`. Whole 34th Dáil = 403 divisions, one page
  at `limit=1000`. Id = the division `uri` (`voteId` like `vote_91` repeats across days).
- Debates: `chamber_type=house&chamber=dail`; `chamber=dail` alone also returns committees.
  Speeches are only in the AKN XML (~750 kB per sitting day); `speech@by="#eId"` resolves
  through `TLCPerson@href` to the member code; `speech@as` carries the role.
- Member codes contain non-ASCII (`Seán-Canney.D.2016-10-03`): URL-encode, and test it.
- `/questions?member_id=` counts questions ASKED by the member (Simon Harris: 0).

Scoring inputs, all measured, NULL when unknown (never 0):
- **attendance** = Dáil divisions the TD voted in / Dáil divisions held inside their own
  membership window (a by-election TD joined 2026-05-25 and has 56 votes; the whole-term
  denominator would read that as 14%). The **Ceann Comhairle** does not vote (Verona Murphy:
  0 of 403) and gets NULL, detected from the roster's current offices, not by name.
- **questions** = oral + written, two head-count calls per TD.
- **debate pillar** (`server/scoring/debateInputs.ts`) = distinct Dáil debate sections the
  TD spoke in, per sitting day inside their window, relative to the 75th percentile of
  active TDs, capped at 100. Speeches made in a presiding role (`speech@as` = Ceann
  Comhairle / Leas-Cheann Comhairle / Cathaoirleach Gníomhach) are not counted, or the chair
  tops the table.
- Party-line votes use the TD's current party from `politics.tds` (the API gives none);
  a TD who changed party mid-term is judged against the new one. Documented, not hidden.

`division_votes` is keyed `(division_id, member_code)` with a nullable `td_id`, so votes by
members not (yet) in `politics.tds` are kept and re-linked on the next roster sync.
Speech text: stored (`debate_speeches.text`), since the ideology rebuild and any future
Ask TD both need it and re-downloading ~110 MB of XML to get it back is the worse trade.

Scheduling: one entry in `server/services/scheduler.ts`, daily 04:00 Europe/Dublin,
incremental from `parliament_sync_state`. Named query for the pledges session:
`parliament.votesOf(tdId, { divisionId? })` → "TD voted X on division Y".

## Deleted

Server: `services/oireachtasAPIService`, `jobs/{dailyDebateUpdate,dailyVoteFetcher,
parliamentaryDataUpdateJob,processDebateSummaries,processDebateEmbeddings,extractPoliticianStances}`,
`routes/{debatesRoutes,debateWorkspaceRoutes,debateMonitoringRoutes}`,
`routes/admin/{debateAdminRoutes,parliamentaryRoutes}`, `routes/parliamentary/activity.ts`
(its one `router.use('/activity')` line in `parliamentary/index.ts`; `voting` stays),
`data/parliamentary-activity.json`, `data/party-parliamentary-activity.json`,
the `parliamentaryActivity` table in `shared/schema.ts`.

Scripts: every parliament ingestion, derivation, repair and debug script under `scripts/`
(about 70). npm: the 12 `debates:*` scripts and `fetch-votes` → one `parliament:sync`.
The other three the brief counted (`debate-ideology`, `update-debates-and-ideology`,
`generate-summaries*`) are ideology / scoring and stay.

Client: `MediaWorkspacePage` (`/debates/workspace`, both route lines in `App.tsx`),
`queryKeys.debates` and the debate/voting entries of `queryKeys.td`. `DebatesPage` rewritten
on `/api/parliament`. TD profile parliament panel repointed (it has `id` from
`/api/scores/td/:name`). Education page parliament panel repointed.

## Edits outside the deleted set (all required)

- `server/jobs/sync-tds.ts` and `server/services/historicalBaselineService.ts:390` import the
  roster from `oireachtasAPIService` → repoint to `server/parliament`.
- `drizzle.config.ts` `schema` is the single file `politics.ts` → make it an array with
  `parliament.ts`, or `db:generate` never sees the new tables. `server/db.ts` merges both.
- `server/scoring/repository.integration.test.ts:36` loads `0000_politics_scoring.sql` by
  name → load every file in `drizzle/meta/_journal.json` order, so a parliament integration
  test sees its tables.
- `server/middleware/route-guards.test.ts:68,117,223` imports `debatesRoutes` and asserts its
  source text → replace with the new `POST /api/parliament/sync` guard.
- `server/auth/route-coverage.test.ts:27-28` lists `politicianChatRoutes` → follows the
  Ask TD decision.
- `server/services/chatTools.ts` (general `/api/chat` assistant) imports `politicianAgent`
  and selects the legacy `parliamentary_activity` table → repoint its TD tool to
  `server/parliament` (it already breaks today: that table is not in GlasCore).

## Not touched (other sessions)

- Ideology: `debateIdeologyProcessor` imports `scripts/fetch-oireachtas-debate-week.ts`, so
  that one script stays until the quiz session moves the processor onto
  `politics.debate_speeches`. `server/scripts/testDebateProcessing.ts` imports the ideology
  service and is left to them too.
- `routes/parliamentary/voting.ts`: user policy voting (GApp session), not divisions.
- `policyStanceHarvester`, `policyOpportunityService`: news / policy-vote pipeline.
- `server/scoring/weights.ts`: see the ministers decision below; not changed here.

## Open decisions

1. Debate pillar: measured participation (above) vs rebuilding the LLM "debate win" score.
2. Ask TD (bottom nav): delete now with `politicianChatRoutes`, `politicianAgent`,
   embeddings and stances, vs port it onto the new tables in this PR.
3. Ministers ask 0 questions, and questions are 60% of the parliamentary pillar, so every
   minister scores low there. That is a `weights.ts` change, so it is written down for you,
   not made here.
</content>
</invoke>
