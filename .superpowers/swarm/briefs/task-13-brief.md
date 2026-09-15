### Task 13
**Owned files (10, 74 baseline errors):**
- server/scripts/analyze_narrative.ts
- server/scripts/correctPartyBaselines.ts
- server/scripts/populate-td-gender-comprehensive.ts
- server/scripts/regeneratePolicyQuestions.ts
- server/scripts/testDebateProcessing.ts
- server/scripts/testDeduplicationPipeline.ts
- server/scripts/testIdeologyIntegration.ts
- server/scripts/testIdeologyScoring.ts
- server/scripts/testNewsArticleScoringTeam.ts
- server/scripts/testPartyBaselines.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T13.txt; grep -cE "error TS" /tmp/tsc-T13.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T13.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/scripts/analyze_narrative.ts(367,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ role: string; content: string; }'.
server/scripts/analyze_narrative.ts(372,31): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ role: string; content: string; }'.
server/scripts/correctPartyBaselines.ts(50,9): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(51,20): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(52,26): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(53,24): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(54,26): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(55,27): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(56,31): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(57,27): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(58,25): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(59,30): error TS18046: 'party' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(107,9): error TS18046: 'correctedProfile' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(118,49): error TS18046: 'correctedProfile' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(118,97): error TS18046: 'correctedProfile' is of type 'unknown'.
server/scripts/correctPartyBaselines.ts(118,144): error TS18046: 'correctedProfile' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(102,11): error TS18046: 'm' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(103,11): error TS18046: 'm' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(104,11): error TS18046: 'm' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(145,45): error TS18046: 'error' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(210,58): error TS18046: 'error' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(265,39): error TS18046: 'error' is of type 'unknown'.
server/scripts/populate-td-gender-comprehensive.ts(266,19): error TS18046: 'error' is of type 'unknown'.
server/scripts/regeneratePolicyQuestions.ts(75,46): error TS2769: No overload matches this call.
server/scripts/regeneratePolicyQuestions.ts(128,38): error TS18046: 'error' is of type 'unknown'.
server/scripts/regeneratePolicyQuestions.ts(141,45): error TS18046: 'error' is of type 'unknown'.
server/scripts/regeneratePolicyQuestions.ts(215,43): error TS18046: 'error' is of type 'unknown'.
server/scripts/testDebateProcessing.ts(40,33): error TS18046: 'error' is of type 'unknown'.
server/scripts/testDebateProcessing.ts(41,19): error TS18046: 'error' is of type 'unknown'.
server/scripts/testDebateProcessing.ts(53,56): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/scripts/testDebateProcessing.ts(60,35): error TS18046: 'error' is of type 'unknown'.
server/scripts/testDebateProcessing.ts(61,21): error TS18046: 'error' is of type 'unknown'.
server/scripts/testDeduplicationPipeline.ts(61,37): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/scripts/testIdeologyIntegration.ts(39,56): error TS2339: Property 'ensureTDProfile' does not exist on type '{ applyAdjustments(politicianName: string, adjustments: IdeologyAdjustments, metadata: AdjustmentMetadata): Promise<void>; }'.
server/scripts/testIdeologyIntegration.ts(97,55): error TS2339: Property 'ensureTDProfile' does not exist on type '{ applyAdjustments(politicianName: string, adjustments: IdeologyAdjustments, metadata: AdjustmentMetadata): Promise<void>; }'.
server/scripts/testIdeologyIntegration.ts(129,11): error TS2339: Property 'data' does not exist on type 'PostgrestSingleResponse<{ user_id: any; }[]> | undefined'.
server/scripts/testIdeologyIntegration.ts(142,13): error TS2339: Property 'data' does not exist on type 'PostgrestSingleResponse<{ overall_compatibility: any; ideology_match: any; }> | undefined'.
server/scripts/testIdeologyIntegration.ts(156,13): error TS2339: Property 'data' does not exist on type 'PostgrestSingleResponse<{ overall_compatibility: any; ideology_match: any; }> | undefined'.
server/scripts/testIdeologyScoring.ts(127,25): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(127,42): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(128,31): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(130,9): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(131,33): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(132,33): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(132,91): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(133,36): error TS18046: 'r' is of type 'unknown'.
server/scripts/testIdeologyScoring.ts(141,19): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(193,9): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(194,24): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(196,29): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(197,25): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(197,60): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(198,29): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(198,68): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(199,25): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(200,23): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(201,24): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(213,9): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(213,21): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(215,22): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(215,39): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(217,9): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(218,33): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(219,33): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(219,86): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(220,36): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(225,34): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(226,39): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(229,35): error TS18046: 'r' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(246,32): error TS2571: Object is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(246,53): error TS2571: Object is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(250,24): error TS18046: 'martin' is of type 'unknown'.
server/scripts/testNewsArticleScoringTeam.ts(250,47): error TS18046: 'harris' is of type 'unknown'.
server/scripts/testPartyBaselines.ts(21,27): error TS2571: Object is of type 'unknown'.

## Task 14

