### Task 7
**Owned files (10, 180 baseline errors):**
- server/routes/ideologyTimelineRoutes.ts
- server/routes/ideologyTimelineRoutesEnhanced.ts
- server/routes/personalRankingsRoutes.ts
- server/routes/personalizedInsightsRoutes.ts
- server/routes/policyVotingRoutes.ts
- server/routes/politicalEvolutionRoutes.ts
- server/routes/problemsRoutes.ts
- server/routes/user/rankings/category.ts
- server/routes/user/rankings/personal.ts
- server/routes/user/rankings/policy.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T7.txt; grep -cE "error TS" /tmp/tsc-T7.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T7.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/ideologyTimelineRoutes.ts(98,38): error TS18046: 'session' is of type 'unknown'.
server/routes/ideologyTimelineRoutes.ts(138,11): error TS18046: 'interpolated' is of type 'unknown'.
server/routes/ideologyTimelineRoutes.ts(145,11): error TS2698: Spread types may only be created from object types.
server/routes/ideologyTimelineRoutesEnhanced.ts(76,15): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(77,45): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(78,26): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(79,24): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(80,26): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(81,27): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(82,31): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(83,25): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(84,27): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(85,30): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(86,23): error TS18046: 'snapshot' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(100,9): error TS2698: Spread types may only be created from object types.
server/routes/ideologyTimelineRoutesEnhanced.ts(130,15): error TS2698: Spread types may only be created from object types.
server/routes/ideologyTimelineRoutesEnhanced.ts(138,13): error TS2698: Spread types may only be created from object types.
server/routes/ideologyTimelineRoutesEnhanced.ts(148,22): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(149,13): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(150,14): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(151,13): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(152,18): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(153,18): error TS18046: 'event' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(184,11): error TS18046: 'averages' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(230,24): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(231,22): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(232,24): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(233,25): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(234,29): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(235,23): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(236,25): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(237,28): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(241,24): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(242,22): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(243,24): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(244,25): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(245,29): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(246,23): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(247,25): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(248,28): error TS18046: 'data' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(256,5): error TS18046: 'result' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(256,19): error TS18046: 'baseline' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(256,36): error TS18046: 'current' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(256,51): error TS18046: 'baseline' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(265,34): error TS18046: 'session' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(301,7): error TS18046: 'point' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(302,11): error TS18046: 'point' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(303,41): error TS18046: 'point' is of type 'unknown'.
server/routes/ideologyTimelineRoutesEnhanced.ts(304,7): error TS18046: 'point' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(19,22): error TS7053: Element implicitly has an 'any' type because expression of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"' can't be used to index type '{}'.
server/routes/personalRankingsRoutes.ts(224,13): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/personalRankingsRoutes.ts(226,17): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/personalRankingsRoutes.ts(228,17): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/personalRankingsRoutes.ts(236,26): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/personalRankingsRoutes.ts(247,11): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(248,12): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(249,19): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(250,31): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(251,31): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(252,33): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(253,23): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(254,11): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(255,17): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(256,19): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(257,16): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(258,21): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(258,38): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(258,61): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(267,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/personalRankingsRoutes.ts(309,15): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(310,16): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(311,23): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(312,35): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(313,35): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(314,37): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(315,15): error TS18046: 'r' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(324,14): error TS18046: 'error' is of type 'unknown'.
server/routes/personalRankingsRoutes.ts(367,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/personalizedInsightsRoutes.ts(53,36): error TS18047: 'db' is possibly 'null'.
server/routes/personalizedInsightsRoutes.ts(54,16): error TS2769: No overload matches this call.
server/routes/personalizedInsightsRoutes.ts(60,32): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
server/routes/personalizedInsightsRoutes.ts(61,30): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
server/routes/personalizedInsightsRoutes.ts(62,11): error TS2322: Type 'string | null' is not assignable to type 'string'.
server/routes/personalizedInsightsRoutes.ts(91,36): error TS18047: 'db' is possibly 'null'.
server/routes/personalizedInsightsRoutes.ts(103,34): error TS18047: 'db' is possibly 'null'.
server/routes/personalizedInsightsRoutes.ts(124,35): error TS18047: 'db' is possibly 'null'.
server/routes/policyVotingRoutes.ts(35,42): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(51,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(70,66): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(84,54): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(100,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(112,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/policyVotingRoutes.ts(128,45): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(145,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(156,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/policyVotingRoutes.ts(166,42): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(183,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(196,42): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(213,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(225,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/policyVotingRoutes.ts(249,66): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(273,42): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(303,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(314,30): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/policyVotingRoutes.ts(341,57): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(353,22): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(365,22): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(394,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(423,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(457,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(481,14): error TS18046: 'error' is of type 'unknown'.
server/routes/policyVotingRoutes.ts(496,53): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(512,42): error TS18047: 'supabase' is possibly 'null'.
server/routes/policyVotingRoutes.ts(528,14): error TS18046: 'error' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(13,30): error TS2339: Property 'claims' does not exist on type '{}'.
server/routes/politicalEvolutionRoutes.ts(59,9): error TS2367: This comparison appears to be unintentional because the types 'string' and 'number | undefined' have no overlap.
server/routes/politicalEvolutionRoutes.ts(87,60): error TS2345: Argument of type '{ ideology: string; userId: string; economicScore: string; socialScore: string; label?: string | null | undefined; culturalScore?: string | null | undefined; globalismScore?: string | null | undefined; ... 6 more ...; notes?: string | ... 1 more ... | undefined; }' is not assignable to parameter of type 'PoliticalEvolutionInput'.
server/routes/politicalEvolutionRoutes.ts(134,9): error TS2367: This comparison appears to be unintentional because the types 'string' and 'number | undefined' have no overlap.
server/routes/politicalEvolutionRoutes.ts(176,27): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(179,15): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(180,13): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(181,15): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(182,16): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(183,20): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(184,16): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(185,14): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(186,19): error TS18046: 'entry' is of type 'unknown'.
server/routes/politicalEvolutionRoutes.ts(187,12): error TS18046: 'entry' is of type 'unknown'.
server/routes/problemsRoutes.ts(12,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/problemsRoutes.ts(15,37): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(42,42): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(91,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/problemsRoutes.ts(102,32): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(114,13): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(122,13): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(132,34): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(156,13): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(173,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/problemsRoutes.ts(184,32): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(196,13): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(204,13): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(214,35): error TS18047: 'db' is possibly 'null'.
server/routes/problemsRoutes.ts(238,13): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/category.ts(48,9): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/category.ts(57,9): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/category.ts(69,26): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/category.ts(106,31): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/category.ts(167,26): error TS18047: 'db' is possibly 'null'.
server/routes/user/rankings/personal.ts(22,22): error TS7053: Element implicitly has an 'any' type because expression of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"' can't be used to index type '{}'.
server/routes/user/rankings/personal.ts(186,13): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/user/rankings/personal.ts(188,17): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/user/rankings/personal.ts(190,17): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/user/rankings/personal.ts(198,26): error TS2339: Property 'total_weight' does not exist on type '{}'.
server/routes/user/rankings/personal.ts(212,11): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(213,12): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(214,19): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(215,31): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(216,31): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(217,33): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(218,23): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(219,11): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(220,17): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(221,19): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(222,16): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(223,21): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(223,38): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/personal.ts(223,61): error TS18046: 'r' is of type 'unknown'.
server/routes/user/rankings/policy.ts(38,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(61,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(75,52): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(108,43): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(134,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(152,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(190,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(213,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(266,55): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(277,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(288,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(370,51): error TS18047: 'supabase' is possibly 'null'.
server/routes/user/rankings/policy.ts(384,40): error TS18047: 'supabase' is possibly 'null'.

## Task 8

