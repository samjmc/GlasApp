### Task 4
**Owned files (5, 92 baseline errors):**
- server/routes/categoryRankingRoutes.ts
- server/routes/ideasRoutes.ts
- server/routes/newsFeedRoutes.optimized.ts
- server/routes/newsFeedRoutes.ts
- server/routes/partySentimentRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T4.txt; grep -cE "error TS" /tmp/tsc-T4.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T4.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/categoryRankingRoutes.ts(40,11): error TS18047: 'db' is possibly 'null'.
server/routes/categoryRankingRoutes.ts(50,11): error TS18047: 'db' is possibly 'null'.
server/routes/categoryRankingRoutes.ts(66,28): error TS18047: 'db' is possibly 'null'.
server/routes/categoryRankingRoutes.ts(111,33): error TS18047: 'db' is possibly 'null'.
server/routes/categoryRankingRoutes.ts(153,7): error TS18046: 'result' is of type 'unknown'.
server/routes/categoryRankingRoutes.ts(154,7): error TS18046: 'result' is of type 'unknown'.
server/routes/categoryRankingRoutes.ts(155,7): error TS18046: 'result' is of type 'unknown'.
server/routes/categoryRankingRoutes.ts(174,28): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(12,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/ideasRoutes.ts(15,34): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(60,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/ideasRoutes.ts(71,32): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(84,13): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(93,13): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(103,31): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(128,13): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(145,46): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/ideasRoutes.ts(161,24): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(176,27): error TS18047: 'db' is possibly 'null'.
server/routes/ideasRoutes.ts(205,33): error TS18047: 'db' is possibly 'null'.
server/routes/newsFeedRoutes.optimized.ts(58,10): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/newsFeedRoutes.optimized.ts(320,41): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
server/routes/newsFeedRoutes.optimized.ts(341,36): error TS2339: Property 'image_url' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(354,17): error TS2322: Type '{ id: any; question: any; options: any; domain: any; topic: any; confidence: any; rationale: any; sourceHint: any; } | null' is not assignable to type 'PolicyVoteOpportunity | null'.
server/routes/newsFeedRoutes.optimized.ts(366,37): error TS2339: Property 'td_policy_stances' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(367,21): error TS2339: Property 'td_policy_stances' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(375,29): error TS2339: Property 'source' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(379,32): error TS2339: Property 'ai_summary' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(391,26): error TS2339: Property 'url' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(392,37): error TS2339: Property 'politician_name' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(393,35): error TS2339: Property 'constituency' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(394,28): error TS2339: Property 'party' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(402,27): error TS2339: Property 'politician_name' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(403,39): error TS2339: Property 'impact_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(407,32): error TS2339: Property 'story_type' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(408,32): error TS2339: Property 'sentiment' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(409,34): error TS2339: Property 'ai_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(410,40): error TS2339: Property 'transparency_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(411,37): error TS2339: Property 'integrity_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(412,41): error TS2339: Property 'effectiveness_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(413,39): error TS2339: Property 'consistency_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(414,44): error TS2339: Property 'transparency_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(415,41): error TS2339: Property 'integrity_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(416,45): error TS2339: Property 'effectiveness_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(417,43): error TS2339: Property 'consistency_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(418,42): error TS2339: Property 'is_ideological_policy' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(419,38): error TS2339: Property 'policy_direction' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(420,41): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(421,36): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(422,25): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(423,42): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(424,36): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(425,25): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.optimized.ts(426,43): error TS2339: Property 'is_opposition_advocacy' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(61,10): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/newsFeedRoutes.ts(327,41): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
server/routes/newsFeedRoutes.ts(349,36): error TS2339: Property 'image_url' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(362,17): error TS2322: Type '{ id: any; question: any; options: any; domain: any; topic: any; confidence: any; rationale: any; sourceHint: any; } | null' is not assignable to type 'PolicyVoteOpportunity | null'.
server/routes/newsFeedRoutes.ts(374,37): error TS2339: Property 'td_policy_stances' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(375,21): error TS2339: Property 'td_policy_stances' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(383,29): error TS2339: Property 'source' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(387,32): error TS2339: Property 'ai_summary' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(399,26): error TS2339: Property 'url' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(400,37): error TS2339: Property 'politician_name' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(401,35): error TS2339: Property 'constituency' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(402,28): error TS2339: Property 'party' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(410,27): error TS2339: Property 'politician_name' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(411,39): error TS2339: Property 'impact_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(415,32): error TS2339: Property 'story_type' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(416,32): error TS2339: Property 'sentiment' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(417,34): error TS2339: Property 'ai_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(418,40): error TS2339: Property 'transparency_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(419,37): error TS2339: Property 'integrity_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(420,41): error TS2339: Property 'effectiveness_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(421,39): error TS2339: Property 'consistency_score' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(422,44): error TS2339: Property 'transparency_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(423,41): error TS2339: Property 'integrity_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(424,45): error TS2339: Property 'effectiveness_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(425,43): error TS2339: Property 'consistency_reasoning' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(426,42): error TS2339: Property 'is_ideological_policy' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(427,38): error TS2339: Property 'policy_direction' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(428,41): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(429,36): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(430,25): error TS2339: Property 'policy_facts' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(431,42): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(432,36): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(433,25): error TS2339: Property 'perspectives' does not exist on type 'NewsArticleWithScores'.
server/routes/newsFeedRoutes.ts(434,43): error TS2339: Property 'is_opposition_advocacy' does not exist on type 'NewsArticleWithScores'.
server/routes/partySentimentRoutes.ts(17,20): error TS18046: 'req' is of type 'unknown'.
server/routes/partySentimentRoutes.ts(22,67): error TS18046: 'req' is of type 'unknown'.
server/routes/partySentimentRoutes.ts(50,20): error TS18046: 'req' is of type 'unknown'.
server/routes/partySentimentRoutes.ts(55,25): error TS18046: 'req' is of type 'unknown'.

## Task 5

