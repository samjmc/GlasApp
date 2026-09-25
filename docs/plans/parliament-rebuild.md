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
- **Chair speeches:** acting chairs carry `speech@as` ("An Cathaoirleach Gníomhach"), but the
  Ceann Comhairle and Leas-Cheann Comhairle carry NO `as` at all; the only mark is the
  `<from>` label ("An Ceann Comhairle"). Found on the first live run, where it let the
  Leas-Cheann Comhairle top the participation table (9,335 chair speeches, not 2,392).
- A sitting day can be listed before its transcript is published (`formats.xml` null).

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
incremental from `parliament_sync_state` (re-reads a 14-day overlap). A day that fails, or
is listed without a transcript, goes in `parliament_sync_state.failures` and is retried on
the next 10 runs; it never blocks the days after it. `--since` never moves the resume point
past days it did not fetch. A failed question fetch keeps the last good counts. Named query for the pledges session:
`parliament.votesOf(tdId, { divisionId? })` → "TD voted X on division Y".

## v2 (2026-09-24): offices, committees, bills, question topics

The pieces of the API worth adding, from a deep dive of all 8 endpoints:

| Piece | Source | Stored | Shown |
|---|---|---|---|
| Offices (Taoiseach, Ministers, Ministers of State) | roster `offices` (already downloaded) | `tds.offices`, `tds.committees` | TD profile header |
| Committee attendance | roster `committees` + committee transcripts' `<rollCall>` | `committees`, `committee_memberships`, `committee_sittings`, `committee_attendance`; two columns on `td_parliament_stats` | TD profile, leaderboard, parties |
| Bills | `/legislation` (whole term, ~414 bills) | `bills`, `bill_sponsors`, `bill_stages`, `bill_debates` | Debates page Bills tab, TD profile |
| Question topics | `/questions`, whole house, month by month | `question_counts` (counts only) | TD profile "Question focus" |

Facts measured while building it:
- A committee membership and a committee sitting share the committee URI; that is the join.
  1,024 committee sittings in the term so far, every one with a `<rollCall>`.
- A roll call does NOT link everyone. Some present members have no `TLCPerson`, so they
  are matched to the roster by name (129 TD presences in a two-month sample of 163
  sittings). A joint committee's roll call is a table with "Deputies" and "Senators"
  columns; the Senators column carries no "Senator" title, and skipping it by its header
  took unmatched sittings from 451 of 1,024 to 1. A sitting with a name that could still
  be a TD is stored but counts for nobody.
- The roster lists committees of earlier terms and of the Seanad too (12 of 696), and
  memberships that ended before the seat began (14). Only this Dáil's are kept.
- `bill.debates[].debateSectionId` + date + house is the same key as
  `divisions.debate_section_id`, so a bill shows every Dáil vote held on it. The house
  comes from the debate URI (`/debateRecord/<dail|seanad|committee-id>/`): a committee-stage
  debate can share a Dáil debate's date and section id, and keying it as Dáil joined 2
  bills to unrelated votes. There is no direct bill field on a division (`isBill` is false
  on all 413).
- The API **refuses `skip` beyond 10,000** and caps its counts at 10,000, so questions are
  read a month at a time (~7,500), and a window that still hits 10,000 is split.
- Question text is not stored: ~150k questions a term would add ~150 MB to a database that
  is 123 MB in total (85 MB of it debate speeches).
- Question totals for scoring now come from `question_counts`; this replaced 348 per-TD API
  calls a run. They are used only when every month since the Dáil's first day is stored (no
  failed month, and a resume point exists, which a fresh `--since` run does not leave).
  Otherwise the last written totals are kept. A failed month is retried every run.
- Each feed runs on its own: a feed that fails outright is listed in `failedFeeds` and the
  others still run. A resumed run (plus a full re-read of committee sittings) took 95 s.
- The first live sync on GlasCore died with "deadlock detected": the scoring cron also runs
  at 04:00. The parliament sync moved to 04:45 and its set-based writes retry on 40P01.

Not in the API: gender (empty for all 176), members' interests and expenses (PDFs only).

## Deleted

Server: `services/{oireachtasAPIService,politicianAgent}`, `jobs/{dailyDebateUpdate,dailyVoteFetcher,
parliamentaryDataUpdateJob,processDebateSummaries,processDebateEmbeddings,extractPoliticianStances,
reviewNegativeFeedback}`, `routes/{debatesRoutes,debateWorkspaceRoutes,debateMonitoringRoutes,
politicianChatRoutes}`, `routes/admin/{debateAdminRoutes,parliamentaryRoutes}`, and the whole
`routes/parliamentary/` folder (the voting rebuild removed `voting.ts`, this one `activity.ts`,
so `/api/parliamentary` had nothing left), `data/parliamentary-activity.json`,
`data/party-parliamentary-activity.json`, the `parliamentaryActivity` table in `shared/schema.ts`.
Ask TD (decision 3A): the page, its chat routes and `politicianAgent`; the general `/api/chat`
assistant's `compare_positions` tool went with it (it read `policy_positions`).

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

## Decisions (Sam, 2026-09-22)

1. Delete at the scale above: yes.
2. Debate pillar: measured participation, not the LLM "debate win" score.
3. Ask TD: deleted now; rebuild later on `politics.debate_speeches` / `division_votes`.
4. (2026-09-25) Committee attendance feeds the parliamentary pillar now (option B), at 20%:
   questions 50%, Dáil votes 30%, committees 20%, renormalised over what a TD has. The
   benchmark is 85%, by the same rule as votes (75th percentile, 87.7%, rounded down to 5).

## Still open

- Ministers ask 0 questions. Questions are now 50% of the parliamentary pillar (62.5% for a
  TD with no committee measure, which is most ministers), so every minister still scores low
  there. That is a `server/scoring/weights.ts` change; not made here.
- Measured attendance is low for party leaders (live: Taoiseach 44%, Tánaiste 32.5%,
  Mary Lou McDonald 39.5%; median TD 90.6%). This is what the Official Report records, but
  whether "attendance at divisions" is fair to leaders is a scoring decision. (Tellers are
  in the lobby lists — checked on vote_91, all four — so they are not the cause.)
