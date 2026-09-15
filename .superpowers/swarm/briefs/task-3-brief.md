### Task 3
**Owned files (7, 140 baseline errors):**
- server/routes/parliamentary/activity.ts
- server/routes/parliamentary/constituencies.ts
- server/routes/parliamentary/enhanced-profiles.ts
- server/routes/parliamentary/profiles.ts
- server/routes/parliamentary/scores.ts
- server/routes/parliamentary/voting.ts
- server/routes/parliamentaryActivityRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T3.txt; grep -cE "error TS" /tmp/tsc-T3.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T3.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/parliamentary/activity.ts(131,29): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(131,45): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(142,87): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(143,88): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(144,93): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(152,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(152,37): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(156,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(156,43): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(174,13): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(175,23): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(176,29): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(177,23): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(178,24): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(199,85): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(202,63): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(205,63): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(210,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(210,37): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(214,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(214,43): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(305,34): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(305,59): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(306,40): error TS18046: 'b' is of type 'unknown'.
server/routes/parliamentary/activity.ts(306,66): error TS18046: 'a' is of type 'unknown'.
server/routes/parliamentary/activity.ts(309,13): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(310,18): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(311,14): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(312,19): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/constituencies.ts(26,51): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/constituencies.ts(153,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/constituencies.ts(163,34): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/routes/parliamentary/enhanced-profiles.ts(324,29): error TS18046: 'c' is of type 'unknown'.
server/routes/parliamentary/enhanced-profiles.ts(340,38): error TS2345: Argument of type 'string | 0' is not assignable to parameter of type 'string'.
server/routes/parliamentary/profiles.ts(288,27): error TS18046: 'c' is of type 'unknown'.
server/routes/parliamentary/profiles.ts(304,36): error TS2345: Argument of type 'string | 0' is not assignable to parameter of type 'string'.
server/routes/parliamentary/scores.ts(97,45): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(142,45): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(152,50): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(153,33): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(154,13): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(154,65): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(155,34): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(157,33): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(200,33): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(250,23): error TS2551: Property 'weekly_elo_change' does not exist on type 'UnifiedTDScore'. Did you mean 'weekly_change'?
server/routes/parliamentary/scores.ts(271,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(317,19): error TS2351: This expression is not constructable.
server/routes/parliamentary/scores.ts(320,23): error TS7006: Parameter 'error' implicitly has an 'any' type.
server/routes/parliamentary/scores.ts(868,34): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(887,31): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(900,34): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(920,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(939,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(952,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(965,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(1123,9): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1125,22): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1126,12): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1127,19): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1128,16): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1129,18): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1130,33): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1131,23): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1132,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1133,20): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1134,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1135,25): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1136,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1137,20): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1195,23): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1202,11): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1203,19): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1204,12): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1205,11): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1206,33): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1209,20): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1210,35): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1211,25): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1212,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1213,22): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1214,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1215,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1216,34): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1217,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1221,28): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1222,26): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1223,28): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1224,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1225,33): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1226,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1227,27): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1228,32): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1231,24): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/voting.ts(35,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(56,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(69,52): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(84,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(98,43): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(114,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(123,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(140,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(156,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(177,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(199,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(230,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(251,55): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(262,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(273,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(352,51): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(366,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentaryActivityRoutes.ts(151,31): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(151,47): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(163,89): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(164,90): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(165,95): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(173,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(173,39): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(177,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(177,45): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(197,17): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(198,27): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(199,33): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(200,27): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(201,28): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(228,87): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(231,65): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(234,65): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(239,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(239,39): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(243,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(243,45): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(353,36): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(353,61): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(354,42): error TS18046: 'b' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(354,68): error TS18046: 'a' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(357,15): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(358,20): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(359,16): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(360,21): error TS18046: 'member' is of type 'unknown'.

## Task 4

