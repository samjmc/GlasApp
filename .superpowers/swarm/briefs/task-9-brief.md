### Task 9
**Owned files (4, 186 baseline errors):**
- server/services/aiNewsAnalysisService.ts
- server/services/newsToTDScoringService.ts
- server/services/oireachtasAPIService.ts
- server/services/outcomesTrackingService.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T9.txt; grep -cE "error TS" /tmp/tsc-T9.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T9.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/services/aiNewsAnalysisService.ts(105,75): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(105,99): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(134,12): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(135,14): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(136,13): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(137,11): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(377,3): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(378,18): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(379,27): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(380,7): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(380,81): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(381,15): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(382,13): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(383,20): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(384,14): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(386,40): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(386,76): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(389,8): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(529,28): error TS18047: 'supabaseDb' is possibly 'null'.
server/services/aiNewsAnalysisService.ts(572,30): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(573,33): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(574,30): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(611,7): error TS2322: Type 'unknown' is not assignable to type '"none" | "moderate" | "major" | "minor"'.
server/services/aiNewsAnalysisService.ts(662,28): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(778,38): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(791,7): error TS2322: Type '{ critical_impact: number; downsides: string[]; reality_check: string; exaggeration_detected: boolean; } | null' is not assignable to type '{ critical_impact: number; downsides: string[]; reality_check: string; exaggeration_detected: boolean; } | undefined'.
server/services/aiNewsAnalysisService.ts(806,17): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(806,39): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(843,59): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(846,10): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(946,54): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ name: string; constituency: string; party?: string | undefined; }'.
server/services/aiNewsAnalysisService.ts(950,46): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(989,10): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(990,12): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(990,51): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,9): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,32): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,51): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(94,57): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(134,13): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(182,13): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(223,68): error TS2339: Property 'url' does not exist on type '{ id: number; title: string; content: string; source?: string | undefined; published_date?: string | undefined; }'.
server/services/newsToTDScoringService.ts(229,21): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(250,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(322,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(322,40): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(333,32): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(359,30): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(381,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(382,14): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(383,16): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(384,15): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(399,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(400,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(401,12): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(402,14): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(405,5): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(412,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(413,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(414,15): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(422,9): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(425,19): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(446,11): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(449,21): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(471,9): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(473,18): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(474,20): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(475,19): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(476,27): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(476,61): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(509,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(510,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(511,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(514,9): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(560,33): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(580,41): error TS2802: Type 'Map<string, any[]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/newsToTDScoringService.ts(582,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(582,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(586,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(586,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(590,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(590,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(594,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(594,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(598,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(598,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(602,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(602,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(606,37): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(615,45): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(635,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(640,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(660,42): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(676,9): error TS2739: Type '{ totalArticles: number; importanceScored: number; selectedForScoring: number; skippedLowImportance: number; articlesProcessed: number; tdsUpdated: number; scoresChanged: number; errors: number; articlesFailed: never[]; }' is missing the following properties from type 'ProcessingStats': clustersFound, duplicatesRemoved, uniqueEventsToScore
server/services/oireachtasAPIService.ts(68,8): error TS18046: 'member' is of type 'unknown'.
server/services/oireachtasAPIService.ts(71,10): error TS18046: 'member' is of type 'unknown'.
server/services/oireachtasAPIService.ts(72,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(73,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(74,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(107,38): error TS2339: Property 'parties' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(110,45): error TS2339: Property 'represents' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(122,35): error TS2339: Property 'dateRange' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(123,33): error TS2339: Property 'dateRange' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(133,54): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(214,67): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(256,51): error TS18046: 'r' is of type 'unknown'.
server/services/oireachtasAPIService.ts(257,54): error TS18046: 'r' is of type 'unknown'.
server/services/oireachtasAPIService.ts(276,67): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(314,49): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(339,5): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(340,17): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(357,68): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(380,5): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(381,17): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(393,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(456,71): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(501,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(530,24): error TS2339: Property 'committees' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(532,25): error TS2339: Property 'committees' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(533,29): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(535,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(536,18): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(537,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(538,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(539,15): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(541,16): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(542,14): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(580,11): error TS18046: 's' is of type 'unknown'.
server/services/oireachtasAPIService.ts(595,5): error TS2322: Type 'unknown[]' is not assignable to type '{ billNo: string; title: string; type: string; status: string; year: string; }[]'.
server/services/oireachtasAPIService.ts(598,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(649,61): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(755,70): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(813,50): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(949,66): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(959,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(960,21): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(961,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(967,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(968,22): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(969,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(975,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(976,24): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(977,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(999,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1000,20): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1001,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1006,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1007,21): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1008,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1013,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1014,23): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1015,7): error TS18046: 'm' is of type 'unknown'.
server/services/outcomesTrackingService.ts(62,17): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(62,39): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(115,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(117,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(118,24): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(119,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(120,22): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(121,31): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(134,28): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(135,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(136,9): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(141,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(142,35): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(143,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(144,33): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(145,42): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(154,32): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(156,21): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(157,33): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(158,18): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(159,31): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(160,40): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(197,25): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(198,28): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(199,30): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(217,46): error TS18046: 'error' is of type 'unknown'.
server/services/outcomesTrackingService.ts(227,56): error TS18046: 'td' is of type 'unknown'.
server/services/outcomesTrackingService.ts(229,10): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(230,12): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(264,14): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(353,12): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(354,7): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(355,14): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(356,11): error TS18046: 'promise' is of type 'unknown'.

## Task 10

