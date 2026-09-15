### Task 10
**Owned files (6, 129 baseline errors):**
- server/services/dailySessionService.ts
- server/services/debateIdeologyAnalysisService.ts
- server/services/personalRankingsService.ts
- server/services/pledgeScoring.ts
- server/services/politicianAgent.ts
- server/services/quizResultsService.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T10.txt; grep -cE "error TS" /tmp/tsc-T10.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T10.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/services/dailySessionService.ts(648,15): error TS2339: Property 'setAuth' does not exist on type 'SupabaseAuthClient'.
server/services/dailySessionService.ts(809,29): error TS2339: Property 'immigration' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(810,28): error TS2339: Property 'healthcare' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(811,25): error TS2339: Property 'housing' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(812,25): error TS2339: Property 'economy' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(813,29): error TS2551: Property 'environment' does not exist on type 'UserIdeologyProfile'. Did you mean 'environmental'?
server/services/dailySessionService.ts(814,31): error TS2339: Property 'social_issues' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(815,25): error TS2339: Property 'justice' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(816,27): error TS2339: Property 'education' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(851,36): error TS2802: Type 'MapIterator<[string, number]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/dailySessionService.ts(1164,36): error TS2802: Type 'MapIterator<["economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic", number]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/dailySessionService.ts(1165,19): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic", number>'.
server/services/dailySessionService.ts(1966,43): error TS2571: Object is of type 'unknown'.
server/services/dailySessionService.ts(1978,28): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2045,9): error TS2353: Object literal may only specify known properties, and 'imageUrl' does not exist in type 'DailySessionItem'.
server/services/dailySessionService.ts(2073,50): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2082,54): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2324,7): error TS18046: 'votePayload' is of type 'unknown'.
server/services/dailySessionService.ts(2533,16): error TS2339: Property 'selected_option' does not exist on type '{}'.
server/services/dailySessionService.ts(2541,37): error TS2339: Property 'selected_option' does not exist on type '{}'.
server/services/dailySessionService.ts(2556,21): error TS2339: Property 'rating' does not exist on type '{}'.
server/services/dailySessionService.ts(2557,89): error TS2339: Property 'rating' does not exist on type '{}'.
server/services/dailySessionService.ts(2763,30): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(377,35): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(381,57): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(385,48): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(388,77): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(397,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(422,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(448,41): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(454,35): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(460,14): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(472,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(485,54): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(524,61): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(564,59): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(966,30): error TS7053: Element implicitly has an 'any' type because expression of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"' can't be used to index type '{}'.
server/services/debateIdeologyAnalysisService.ts(1076,47): error TS18046: 's' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1081,56): error TS18046: 's' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1092,35): error TS18046: 'speech' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1097,50): error TS18046: 'speech' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1097,64): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1121,42): error TS18046: 'v' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1126,52): error TS18046: 'v' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1134,33): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1139,48): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1139,60): error TS18046: 'error' is of type 'unknown'.
server/services/personalRankingsService.ts(220,21): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(221,19): error TS2339: Property 'is_active' does not exist on type '{}'.
server/services/personalRankingsService.ts(236,20): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(237,33): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(640,15): error TS2339: Property 'personal_rank' does not exist on type '{ user_id: string; politician_name: string; ideology_match: number; policy_agreement: any; overall_compatibility: number; public_rank: number | null; policies_compared: any; last_calculated: string; }'.
server/services/personalRankingsService.ts(677,16): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(677,41): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(686,18): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(686,43): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(708,75): error TS18046: 'error' is of type 'unknown'.
server/services/personalRankingsService.ts(792,24): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(793,22): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(794,24): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(795,25): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(796,29): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(797,25): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(798,23): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(799,28): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(36,35): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(56,25): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(73,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(103,39): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(104,41): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(111,7): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(111,37): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(113,40): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(142,36): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(143,41): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(149,34): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(150,33): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(167,25): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(188,30): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(228,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(239,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(283,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(300,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(317,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(334,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(351,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(368,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(385,21): error TS18046: 'party' is of type 'unknown'.
server/services/politicianAgent.ts(45,30): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/politicianAgent.ts(45,53): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(49,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/services/politicianAgent.ts(56,13): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(56,44): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(56,62): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(62,11): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(63,14): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(64,34): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(65,11): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(66,14): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(67,21): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(68,15): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(69,18): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(129,56): error TS18046: 'm' is of type 'unknown'.
server/services/quizResultsService.ts(43,13): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(50,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(51,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(52,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(53,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(54,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(55,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(56,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(57,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(58,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(69,28): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(97,29): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(105,27): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(109,9): error TS2769: No overload matches this call.
server/services/quizResultsService.ts(120,12): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(123,14): error TS2769: No overload matches this call.
server/services/quizResultsService.ts(131,27): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(169,38): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(170,36): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(171,38): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(172,39): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(173,43): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(174,39): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(175,37): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(176,42): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(177,55): error TS2345: Argument of type 'Date | null' is not assignable to parameter of type 'Date'.

## Task 11

