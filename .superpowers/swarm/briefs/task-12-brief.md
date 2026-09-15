### Task 12
**Owned files (16, 178 baseline errors):**
- scripts/fetch-oireachtas-debate-week.ts
- server/jobs/articleTriageJob.ts
- server/jobs/dailyDebateUpdate.ts
- server/jobs/dailyIdeologySnapshot.ts
- server/jobs/dailyNewsScraper.ts
- server/jobs/dailyVoteFetcher.ts
- server/jobs/debateIdeologyProcessor.ts
- server/jobs/extractPoliticianStances.ts
- server/jobs/masterNewsUpdate.ts
- server/jobs/parliamentaryDataUpdateJob.ts
- server/jobs/processDebateEmbeddings.ts
- server/jobs/processDebateSummaries.ts
- server/jobs/promiseVerificationJob.ts
- server/jobs/reviewNegativeFeedback.ts
- server/jobs/unifiedScoreCalculationJob.ts
- server/jobs/updatePersonalRankingsFromExistingVotes.ts

**Goal:** 0 errors in your owned files after `npx tsc --noEmit --incremental false`; total project
error count strictly decreases from the baseline recorded in the ledger; all 103 tests pass.

**Steps:**
1. Read the Global Constraints section of the plan file (this brief includes it) and the Fix
   strategy per error code.
2. For each of your owned files, fix every TypeScript error using the strategies above. Keep
   runtime behavior identical.
3. Run the verification gates (Verification section). Iterate until your owned files show 0
   errors and `npm run test` passes.

**Boundaries — do NOT touch:** any file not in your Owned Files list, `tsconfig.json`,
`shared/**` (Task 1 owns it), and package.json.

**Verification gates:**
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T12.txt; grep -cE "error TS" /tmp/tsc-T12.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T12.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
scripts/fetch-oireachtas-debate-week.ts(3,37): error TS2305: Module '"cheerio"' has no exported member 'Element'.
scripts/fetch-oireachtas-debate-week.ts(131,33): error TS2802: Type 'ArrayIterator<[number, unknown]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
scripts/fetch-oireachtas-debate-week.ts(241,33): error TS2802: Type 'ArrayIterator<[number, unknown]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
scripts/fetch-oireachtas-debate-week.ts(413,40): error TS2353: Object literal may only specify known properties, and 'decodeEntities' does not exist in type 'CheerioOptions'.
scripts/fetch-oireachtas-debate-week.ts(614,39): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(617,27): error TS2339: Property 'debateSection' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(736,24): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(736,54): error TS2339: Property 'contextDate' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(737,29): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(738,24): error TS2339: Property 'debateRecord' does not exist on type '{}'.
server/jobs/articleTriageJob.ts(75,45): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(173,44): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(244,44): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(249,45): error TS18047: 'supabase' is possibly 'null'.
server/jobs/dailyDebateUpdate.ts(105,53): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyDebateUpdate.ts(191,54): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyIdeologySnapshot.ts(24,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyIdeologySnapshot.ts(25,19): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(101,84): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(147,39): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(204,56): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(329,28): error TS2339: Property 'role' does not exist on type '{ name: string; constituency: string; party: string; confidence: number; }'.
server/jobs/dailyNewsScraper.ts(356,25): error TS2551: Property 'published_at' does not exist on type 'ScrapedArticle'. Did you mean 'published_date'?
server/jobs/dailyNewsScraper.ts(375,39): error TS2551: Property 'published_at' does not exist on type 'ScrapedArticle'. Did you mean 'published_date'?
server/jobs/dailyNewsScraper.ts(398,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(399,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(414,9): error TS2353: Object literal may only specify known properties, and 'crossCheck' does not exist in type 'ProcessingOptions'.
server/jobs/dailyNewsScraper.ts(425,47): error TS18046: 'scoringError' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(426,40): error TS18046: 'scoringError' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(469,39): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(517,64): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(552,37): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(553,37): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(554,32): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(562,74): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(578,72): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(675,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(676,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(677,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(678,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(679,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(680,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(681,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(682,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(683,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(684,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(685,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(686,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(687,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(688,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(689,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(690,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(691,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(705,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(706,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(725,49): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(821,49): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(855,24): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(856,29): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(857,30): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(858,26): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(859,28): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(860,37): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(877,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(878,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(879,23): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(881,25): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(882,23): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(895,24): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(896,29): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(897,30): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(898,26): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(899,28): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(900,37): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(902,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(903,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(904,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(917,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(927,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(928,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(929,25): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(930,27): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(931,36): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(986,44): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(988,75): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(990,54): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(154,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(263,78): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(305,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(312,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(319,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(78,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(105,64): error TS18046: 'error' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(168,60): error TS18046: 'error' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(78,37): error TS2802: Type 'ArrayIterator<[number, { id: any; politician_name: any; party: any; }]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/extractPoliticianStances.ts(98,28): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(101,53): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(119,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(144,30): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(161,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(168,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(176,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(193,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(201,56): error TS18046: 't' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(201,65): error TS18046: 'v' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(210,60): error TS18046: 'a' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(210,89): error TS18046: 'b' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,52): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,67): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,85): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,117): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(214,65): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(214,96): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(217,61): error TS2571: Object is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(217,88): error TS2571: Object is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(271,89): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(274,69): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(275,56): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(280,24): error TS18046: 'politician' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(87,41): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(88,43): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(102,9): error TS2353: Object literal may only specify known properties, and 'crossCheck' does not exist in type 'ProcessingOptions'.
server/jobs/masterNewsUpdate.ts(117,41): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(118,40): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(145,43): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(146,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(167,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(188,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(205,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(249,33): error TS18046: 'fatalError' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(129,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(147,33): error TS2802: Type 'Map<string, any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/parliamentaryDataUpdateJob.ts(177,68): error TS18046: 'error' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(184,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(108,72): error TS18046: 'c' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(147,53): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(156,14): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(158,31): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(160,62): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(163,28): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(164,18): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(166,57): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(166,78): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(198,20): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(201,26): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(202,16): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(203,15): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(204,16): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(212,11): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(216,45): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(227,57): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(234,49): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateSummaries.ts(130,53): error TS2339: Property 'message' does not exist on type '{}'.
server/jobs/processDebateSummaries.ts(457,88): error TS2339: Property 'message' does not exist on type '{}'.
server/jobs/promiseVerificationJob.ts(115,72): error TS18046: 'error' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(56,21): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(57,25): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(58,23): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(59,25): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(96,53): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(110,17): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(113,48): error TS18046: 'item' is of type 'unknown'.
server/jobs/unifiedScoreCalculationJob.ts(122,16): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(140,15): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(141,18): error TS2304: Cannot find name 'desc'.
server/jobs/unifiedScoreCalculationJob.ts(141,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(146,19): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(148,18): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(148,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(152,34): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/unifiedScoreCalculationJob.ts(161,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(163,20): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(163,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(168,27): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/unifiedScoreCalculationJob.ts(177,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(179,20): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(179,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/updatePersonalRankingsFromExistingVotes.ts(15,35): error TS18047: 'supabaseDb' is possibly 'null'.

## Task 13

