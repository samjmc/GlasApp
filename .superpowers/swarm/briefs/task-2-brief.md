### Task 2
**Owned files (1, 168 baseline errors):**
- server/routes/debatesRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T2.txt; grep -cE "error TS" /tmp/tsc-T2.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T2.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/debatesRoutes.ts(157,23): error TS2352: Conversion of type '{ td_id: any; performance_delta: any; effectiveness_delta: any; influence_delta: any; calculated_at: any; metadata: any; debate_sections: { title: any; }[]; debate_days: { date: any; chamber: any; title: any; }[]; }' to type 'DebateContributionRow' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/routes/debatesRoutes.ts(158,29): error TS2339: Property 'td_id' does not exist on type 'DebateContributionRow'.
server/routes/debatesRoutes.ts(199,49): error TS2769: No overload matches this call.
server/routes/debatesRoutes.ts(257,53): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(268,59): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(270,13): error TS2339: Property 'data' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(270,31): error TS2339: Property 'error' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(280,13): error TS2339: Property 'data' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(280,32): error TS2339: Property 'error' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(292,60): error TS18046: 'summary' is of type 'unknown'.
server/routes/debatesRoutes.ts(296,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(296,39): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(324,30): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(325,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(327,25): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(331,45): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(333,39): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(333,67): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(334,44): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(334,66): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(337,42): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(339,17): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(340,26): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(341,20): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(342,25): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(343,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(344,24): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(345,26): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(349,23): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(353,48): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(363,13): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(364,15): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(365,18): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(366,16): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(367,20): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(368,22): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(369,23): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(370,22): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(371,25): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(371,43): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(384,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(412,27): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/routes/debatesRoutes.ts(413,28): error TS2339: Property 'party' does not exist on type '{}'.
server/routes/debatesRoutes.ts(414,35): error TS2339: Property 'constituency' does not exist on type '{}'.
server/routes/debatesRoutes.ts(415,31): error TS2339: Property 'image_url' does not exist on type '{}'.
server/routes/debatesRoutes.ts(447,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(520,13): error TS2339: Property 'period_start' does not exist on type '{}'.
server/routes/debatesRoutes.ts(520,27): error TS2339: Property 'period_end' does not exist on type '{}'.
server/routes/debatesRoutes.ts(534,42): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(534,64): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(550,30): error TS2339: Property 'speeches' does not exist on type '{}'.
server/routes/debatesRoutes.ts(551,33): error TS2339: Property 'words_spoken' does not exist on type '{}'.
server/routes/debatesRoutes.ts(552,34): error TS2339: Property 'unique_topics' does not exist on type '{}'.
server/routes/debatesRoutes.ts(553,37): error TS2339: Property 'engagement_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(554,37): error TS2339: Property 'leadership_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(555,36): error TS2339: Property 'sentiment_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(556,40): error TS2339: Property 'effectiveness_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(557,36): error TS2339: Property 'influence_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(558,30): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(561,49): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(562,22): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(567,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(607,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(608,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(609,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(610,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(611,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(612,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(613,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(614,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(615,27): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(616,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(617,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(639,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(686,11): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(687,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(688,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(689,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(690,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(691,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(692,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(693,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(694,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(695,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(696,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(711,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(808,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(809,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(810,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(811,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(812,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(814,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(815,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(816,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(817,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(818,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(819,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(820,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(821,22): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(824,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(825,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(826,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(827,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(838,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(854,8): error TS2339: Property 'group' does not exist on type 'PostgrestFilterBuilder<any, any, any, ParserError<"Unexpected input: (*)">[], "debate_section_tasks", unknown, "GET">'.
server/routes/debatesRoutes.ts(866,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(966,25): error TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
server/routes/debatesRoutes.ts(1019,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1059,27): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1060,24): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1070,37): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1080,11): error TS2322: Type 'string | number | true | JsonObject | JsonArray | null' is not assignable to type 'string | null'.
server/routes/debatesRoutes.ts(1113,41): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(1113,60): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(1130,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1198,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1241,73): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1249,61): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1253,11): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1254,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1255,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1256,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1257,14): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1258,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1259,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1260,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1261,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1262,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1263,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1264,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1265,27): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1266,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1267,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1282,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1315,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1372,60): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1448,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1449,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1450,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1451,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1462,73): error TS2339: Property 'confidence' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1469,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1475,29): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1476,28): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1478,19): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1482,44): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1483,44): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1484,46): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1485,46): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1486,42): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1487,42): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1488,32): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1489,50): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1495,51): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(1495,92): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(1498,26): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1501,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1502,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1503,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1504,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1506,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1507,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1508,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1509,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1513,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1523,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1525,78): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1558,60): error TS2339: Property 'message' does not exist on type '{}'.

## Task 3

