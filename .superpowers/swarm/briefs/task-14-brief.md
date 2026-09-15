### Task 14
**Owned files (2, 164 baseline errors):**
- client/src/pages/TDProfilePage.tsx
- client/src/pages/TDProfilePageEnhanced.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T14.txt; grep -cE "error TS" /tmp/tsc-T14.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T14.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/TDProfilePage.tsx(148,9): error TS2698: Spread types may only be created from object types.
client/src/pages/TDProfilePage.tsx(149,17): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(309,27): error TS2304: Cannot find name 'colorClasses'.
client/src/pages/TDProfilePage.tsx(315,38): error TS2339: Property 'weight' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(315,76): error TS2339: Property 'weight' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(316,33): error TS2339: Property 'score' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(316,66): error TS2339: Property 'score' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(317,34): error TS2339: Property 'available' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(319,25): error TS2339: Property 'label' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(323,31): error TS2339: Property 'description' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(324,56): error TS2339: Property 'breakdown' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(324,79): error TS2339: Property 'breakdown' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(502,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(503,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(504,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(589,27): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(598,28): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(600,26): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(602,30): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(606,58): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(608,43): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(609,28): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(615,35): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(615,71): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(617,39): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(617,75): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(622,34): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(760,19): error TS2322: Type '{ key: any; label: any; score: number | null; weight: string; color: string | number | symbol; description: any; breakdown: any; available: boolean; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(821,34): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(823,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(825,36): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(830,43): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(835,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(836,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(841,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(841,60): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(865,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(868,41): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(871,28): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(873,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(877,66): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(877,94): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(977,34): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(978,34): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(980,47): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(980,68): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(993,34): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(994,34): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(995,94): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1024,43): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1028,34): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1049,35): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1049,56): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1051,37): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1052,37): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,24): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,69): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,126): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,182): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,239): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1095,26): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1101,60): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1104,31): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1109,30): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1113,28): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,34): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,62): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,90): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1115,43): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1119,26): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1120,34): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1124,73): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1125,37): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1125,86): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, { id: string; status: string; }, unknown>'.
client/src/pages/TDProfilePage.tsx(1128,28): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1237,19): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1245,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1253,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1283,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,34): error TS2339: Property 'score' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,41): error TS2339: Property 'weight' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,49): error TS2339: Property 'color' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,56): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,69): error TS2339: Property 'breakdown' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,80): error TS2339: Property 'available' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1328,36): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1330,50): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1332,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1333,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1335,26): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1340,18): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1342,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,21): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,28): error TS2339: Property 'rank' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,34): error TS2339: Property 'total' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,20): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,26): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,33): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,21): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,34): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1406,49): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePage.tsx(1410,22): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePageEnhanced.tsx(99,35): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(101,85): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(105,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(109,34): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(111,85): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(115,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(119,35): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(121,86): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(125,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(193,18): error TS2571: Object is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(326,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(327,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(328,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(336,24): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(338,17): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(343,17): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(518,19): error TS2322: Type '{ key: any; label: any; score: number | null; weight: string; color: string; description: any; breakdown: any; available: boolean; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(579,34): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(581,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(583,36): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(588,43): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(593,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(594,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(599,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(599,60): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(616,36): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(623,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(626,41): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(629,28): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(631,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(635,66): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(635,94): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(715,24): error TS18046: 'committee' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(739,19): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(747,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(755,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(786,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,34): error TS2339: Property 'score' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,41): error TS2339: Property 'weight' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,49): error TS2339: Property 'color' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,56): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,69): error TS2339: Property 'breakdown' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,80): error TS2339: Property 'available' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(829,36): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(831,50): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(833,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(834,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(835,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(839,18): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(840,85): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,21): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,28): error TS2339: Property 'rank' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,34): error TS2339: Property 'total' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,20): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,26): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,33): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,21): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,34): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(903,49): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePageEnhanced.tsx(907,22): error TS18047: 'performanceScore' is possibly 'null'.

## Task 15

