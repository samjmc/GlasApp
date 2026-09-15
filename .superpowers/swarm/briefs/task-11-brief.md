### Task 11
**Owned files (37, 200 baseline errors):**
- server/services/activityTracker.ts
- server/services/authService.ts
- server/services/botBehaviorService.ts
- server/services/botService.ts
- server/services/cacheService.ts
- server/services/chatTools.ts
- server/services/comprehensiveTDScoringService.ts
- server/services/customScrapers/breakingNewsScraper.ts
- server/services/customScrapers/businessPostScraper.ts
- server/services/customScrapers/ditchScraper.ts
- server/services/customScrapers/griptScraper.ts
- server/services/debateFetchService.ts
- server/services/eloScoringService.ts
- server/services/eventDeduplicationService.ts
- server/services/historicalBaselineService.ts
- server/services/historicalContextChecker.ts
- server/services/ideologySnapshotService.ts
- server/services/multiAgentTDScoring.ts
- server/services/newsArticleManager.ts
- server/services/newsImageGenerationService.ts
- server/services/newsScraperService.ts
- server/services/partyPerformanceService.ts
- server/services/personalizedScoringService.ts
- server/services/policyOpportunityService.ts
- server/services/policyStanceHarvester.ts
- server/services/pollingAggregationService.ts
- server/services/qaAgent.ts
- server/services/quizHistoryService.ts
- server/services/scheduler.ts
- server/services/shadowCabinet.ts
- server/services/tdExtractionService.ts
- server/services/tdIdeologyProfileService.ts
- server/services/tdScoreCalculator.ts
- server/services/titleDeduplicationService.ts
- server/services/topicClassificationService.ts
- server/services/twilioService.ts
- server/services/unifiedTDScoringService.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T11.txt; grep -cE "error TS" /tmp/tsc-T11.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T11.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/services/activityTracker.ts(32,9): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/activityTracker.ts(39,32): error TS18047: 'db' is possibly 'null'.
server/services/activityTracker.ts(49,32): error TS18047: 'db' is possibly 'null'.
server/services/activityTracker.ts(52,16): error TS2769: No overload matches this call.
server/services/activityTracker.ts(71,27): error TS18047: 'db' is possibly 'null'.
server/services/activityTracker.ts(79,13): error TS2769: No overload matches this call.
server/services/activityTracker.ts(97,27): error TS18047: 'db' is possibly 'null'.
server/services/authService.ts(54,9): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
server/services/authService.ts(70,9): error TS2322: Type 'string' is not assignable to type 'number'.
server/services/authService.ts(131,62): error TS2769: No overload matches this call.
server/services/authService.ts(141,23): error TS2554: Expected 4 arguments, but got 1.
server/services/authService.ts(151,11): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
server/services/authService.ts(164,11): error TS2322: Type 'string' is not assignable to type 'number'.
server/services/authService.ts(172,9): error TS2322: Type 'string' is not assignable to type 'number'.
server/services/authService.ts(186,56): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/services/authService.ts(225,30): error TS2367: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.
server/services/authService.ts(232,33): error TS2367: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.
server/services/botBehaviorService.ts(93,69): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'ActivityMetadata | undefined'.
server/services/botBehaviorService.ts(102,11): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(111,11): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(117,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(123,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(127,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(128,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(132,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(137,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(141,9): error TS18046: 'metadata' is of type 'unknown'.
server/services/botBehaviorService.ts(153,63): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/services/botBehaviorService.ts(168,11): error TS2322: Type 'string' is not assignable to type 'number'.
server/services/botService.ts(93,18): error TS2339: Property 'role' does not exist on type '{}'.
server/services/cacheService.ts(71,32): error TS2802: Type 'MapIterator<[string, CacheEntry<unknown>]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/chatTools.ts(407,37): error TS18047: 'supabaseDb' is possibly 'null'.
server/services/comprehensiveTDScoringService.ts(501,23): error TS18046: 'scoreData.statistics' is of type 'unknown'.
server/services/comprehensiveTDScoringService.ts(502,25): error TS18046: 'scoreData.statistics' is of type 'unknown'.
server/services/comprehensiveTDScoringService.ts(503,31): error TS18046: 'scoreData.statistics' is of type 'unknown'.
server/services/comprehensiveTDScoringService.ts(504,22): error TS18046: 'scoreData.statistics' is of type 'unknown'.
server/services/comprehensiveTDScoringService.ts(505,24): error TS18046: 'scoreData.statistics' is of type 'unknown'.
server/services/comprehensiveTDScoringService.ts(543,18): error TS2339: Property 'code' does not exist on type '{}'.
server/services/comprehensiveTDScoringService.ts(623,16): error TS2339: Property 'code' does not exist on type '{}'.
server/services/comprehensiveTDScoringService.ts(637,25): error TS2339: Property 'message' does not exist on type '{}'.
server/services/comprehensiveTDScoringService.ts(637,43): error TS2339: Property 'hint' does not exist on type '{}'.
server/services/customScrapers/breakingNewsScraper.ts(96,22): error TS18046: 'link' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(97,22): error TS18046: 'link' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(122,11): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(123,33): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(130,16): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(131,14): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(132,18): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(149,58): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/breakingNewsScraper.ts(233,74): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(124,11): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(125,33): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(132,16): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(133,14): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(134,18): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(151,58): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/businessPostScraper.ts(239,74): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(127,14): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(128,68): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(132,33): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(134,77): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(134,95): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(139,18): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(140,36): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(141,20): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(159,54): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/ditchScraper.ts(240,66): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(105,14): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(106,68): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(111,33): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(115,29): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(125,77): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(125,95): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(130,18): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(131,36): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(132,20): error TS18046: 'item' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(150,56): error TS18046: 'error' is of type 'unknown'.
server/services/customScrapers/griptScraper.ts(220,66): error TS18046: 'error' is of type 'unknown'.
server/services/debateFetchService.ts(109,53): error TS18046: 'error' is of type 'unknown'.
server/services/eloScoringService.ts(106,7): error TS2322: Type 'unknown' is not assignable to type 'number'.
server/services/eloScoringService.ts(134,18): error TS2571: Object is of type 'unknown'.
server/services/eventDeduplicationService.ts(204,18): error TS18046: 'c' is of type 'unknown'.
server/services/eventDeduplicationService.ts(205,25): error TS18046: 'c' is of type 'unknown'.
server/services/eventDeduplicationService.ts(206,17): error TS18046: 'c' is of type 'unknown'.
server/services/eventDeduplicationService.ts(207,26): error TS18046: 'c' is of type 'unknown'.
server/services/eventDeduplicationService.ts(208,24): error TS18046: 'c' is of type 'unknown'.
server/services/eventDeduplicationService.ts(351,36): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/eventDeduplicationService.ts(352,29): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/eventDeduplicationService.ts(352,40): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/historicalBaselineService.ts(282,53): error TS18046: 'error' is of type 'unknown'.
server/services/historicalBaselineService.ts(293,38): error TS18046: 'error' is of type 'unknown'.
server/services/historicalBaselineService.ts(428,59): error TS18046: 'error' is of type 'unknown'.
server/services/historicalBaselineService.ts(435,39): error TS18046: 'error' is of type 'unknown'.
server/services/historicalBaselineService.ts(496,53): error TS18046: 'error' is of type 'unknown'.
server/services/historicalContextChecker.ts(105,39): error TS18047: 'supabase' is possibly 'null'.
server/services/historicalContextChecker.ts(111,33): error TS7015: Element implicitly has an 'any' type because index expression is not of type 'number'.
server/services/historicalContextChecker.ts(115,44): error TS7015: Element implicitly has an 'any' type because index expression is not of type 'number'.
server/services/historicalContextChecker.ts(166,17): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(166,39): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(181,17): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(181,39): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(243,34): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(247,17): error TS18046: 'article' is of type 'unknown'.
server/services/historicalContextChecker.ts(247,39): error TS18046: 'article' is of type 'unknown'.
server/services/ideologySnapshotService.ts(73,71): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(114,79): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(163,67): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(210,75): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(250,72): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(284,68): error TS18046: 'error' is of type 'unknown'.
server/services/ideologySnapshotService.ts(319,65): error TS18046: 'error' is of type 'unknown'.
server/services/multiAgentTDScoring.ts(1087,7): error TS2322: Type 'IdeologyDelta' is not assignable to type 'Record<string, number>'.
server/services/multiAgentTDScoring.ts(1181,5): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'ArticleAnalysis'.
server/services/multiAgentTDScoring.ts(1298,5): error TS2345: Argument of type 'IdeologyDelta' is not assignable to parameter of type 'IdeologyAdjustments'.
server/services/newsArticleManager.ts(60,16): error TS2339: Property 'enforc' does not exist on type 'NewsArticleManager'.
server/services/newsArticleManager.ts(62,1): error TS2304: Cannot find name 'eLimits'.
server/services/newsImageGenerationService.ts(76,22): error TS18048: 'response.data' is possibly 'undefined'.
server/services/newsImageGenerationService.ts(98,53): error TS18046: 'error' is of type 'unknown'.
server/services/newsScraperService.ts(93,27): error TS2339: Property 'active' does not exist on type '{ name: string; rss: string; credibility: number; bias: number; }'.
server/services/partyPerformanceService.ts(58,39): error TS2802: Type 'Map<string, { party: any; overall_elo: any; transparency_elo: any; effectiveness_elo: any; integrity_elo: any; consistency_elo: any; constituency_service_elo: any; }[]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/partyPerformanceService.ts(72,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/partyPerformanceService.ts(72,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/partyPerformanceService.ts(143,16): error TS18046: 'error' is of type 'unknown'.
server/services/partyPerformanceService.ts(145,86): error TS18046: 'error' is of type 'unknown'.
server/services/partyPerformanceService.ts(173,60): error TS18046: 'error' is of type 'unknown'.
server/services/partyPerformanceService.ts(177,42): error TS18046: 'error' is of type 'unknown'.
server/services/personalizedScoringService.ts(42,47): error TS18047: 'supabase' is possibly 'null'.
server/services/personalizedScoringService.ts(60,56): error TS18047: 'supabase' is possibly 'null'.
server/services/personalizedScoringService.ts(68,58): error TS18047: 'supabase' is possibly 'null'.
server/services/personalizedScoringService.ts(237,37): error TS18047: 'supabase' is possibly 'null'.
server/services/personalizedScoringService.ts(256,26): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/personalizedScoringService.ts(258,36): error TS18047: 'supabase' is possibly 'null'.
server/services/policyOpportunityService.ts(383,67): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"'.
server/services/policyOpportunityService.ts(389,54): error TS18046: 'error' is of type 'unknown'.
server/services/policyOpportunityService.ts(429,56): error TS18046: 'error' is of type 'unknown'.
server/services/policyOpportunityService.ts(435,20): error TS2322: Type 'undefined' is not assignable to type 'number | null'.
server/services/policyOpportunityService.ts(471,61): error TS18046: 'error' is of type 'unknown'.
server/services/policyOpportunityService.ts(644,57): error TS18046: 'error' is of type 'unknown'.
server/services/policyOpportunityService.ts(660,52): error TS18046: 'error' is of type 'unknown'.
server/services/policyOpportunityService.ts(729,36): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"'.
server/services/policyStanceHarvester.ts(182,49): error TS18046: 'error' is of type 'unknown'.
server/services/policyStanceHarvester.ts(218,49): error TS18046: 'error' is of type 'unknown'.
server/services/policyStanceHarvester.ts(258,58): error TS18046: 'error' is of type 'unknown'.
server/services/policyStanceHarvester.ts(333,32): error TS2339: Property 'debate' does not exist on type '{}'.
server/services/policyStanceHarvester.ts(348,58): error TS18046: 'error' is of type 'unknown'.
server/services/pollingAggregationService.ts(79,43): error TS2571: Object is of type 'unknown'.
server/services/pollingAggregationService.ts(80,42): error TS2571: Object is of type 'unknown'.
server/services/pollingAggregationService.ts(281,66): error TS2339: Property 'first_preference' does not exist on type '{ first_preference: any; polls: { poll_date: any; }[]; } | { approval_rating: any; polls: { poll_date: any; }[]; }'.
server/services/pollingAggregationService.ts(281,87): error TS2339: Property 'approval_rating' does not exist on type '{ first_preference: any; polls: { poll_date: any; }[]; } | { approval_rating: any; polls: { poll_date: any; }[]; }'.
server/services/pollingAggregationService.ts(419,42): error TS7053: Element implicitly has an 'any' type because expression of type '"first_preference" | "approval_rating"' can't be used to index type '{ first_preference: any; polls: { poll_date: any; }[]; } | { approval_rating: any; polls: { poll_date: any; }[]; }'.
server/services/pollingAggregationService.ts(420,42): error TS7053: Element implicitly has an 'any' type because expression of type '"first_preference" | "approval_rating"' can't be used to index type '{ first_preference: any; polls: { poll_date: any; }[]; } | { approval_rating: any; polls: { poll_date: any; }[]; }'.
server/services/pollingAggregationService.ts(421,42): error TS7053: Element implicitly has an 'any' type because expression of type '"first_preference" | "approval_rating"' can't be used to index type '{ first_preference: any; polls: { poll_date: any; }[]; } | { approval_rating: any; polls: { poll_date: any; }[]; }'.
server/services/pollingAggregationService.ts(426,27): error TS7053: Element implicitly has an 'any' type because expression of type '"first_preference" | "approval_rating"' can't be used to index type '{ first_preference: any; polls: { poll_date: any; poll_sources: { name: any; }[]; }[]; } | { approval_rating: any; polls: { poll_date: any; poll_sources: { name: any; }[]; }[]; }'.
server/services/pollingAggregationService.ts(433,37): error TS2571: Object is of type 'unknown'.
server/services/pollingAggregationService.ts(449,29): error TS2571: Object is of type 'unknown'.
server/services/qaAgent.ts(10,27): error TS18047: 'db' is possibly 'null'.
server/services/qaAgent.ts(11,26): error TS18047: 'db' is possibly 'null'.
server/services/qaAgent.ts(42,15): error TS18047: 'db' is possibly 'null'.
server/services/quizHistoryService.ts(39,13): error TS18047: 'db' is possibly 'null'.
server/services/quizHistoryService.ts(46,28): error TS18047: 'db' is possibly 'null'.
server/services/quizHistoryService.ts(77,14): error TS2352: Conversion of type 'Record<string, unknown>' to type 'QuizHistoryResult' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/services/quizHistoryService.ts(89,28): error TS18047: 'db' is possibly 'null'.
server/services/quizHistoryService.ts(95,14): error TS2352: Conversion of type 'Record<string, unknown>[]' to type 'QuizHistoryResult[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/services/quizHistoryService.ts(107,28): error TS18047: 'db' is possibly 'null'.
server/services/quizHistoryService.ts(117,14): error TS2352: Conversion of type 'Record<string, unknown>' to type 'QuizHistoryResult' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/services/scheduler.ts(45,27): error TS18046: 'ArticleTriageJob' is of type 'unknown'.
server/services/scheduler.ts(52,61): error TS18046: 'error' is of type 'unknown'.
server/services/scheduler.ts(55,5): error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'.
server/services/scheduler.ts(67,27): error TS18046: 'NewsToTDScoringService' is of type 'unknown'.
server/services/scheduler.ts(80,57): error TS18046: 'error' is of type 'unknown'.
server/services/scheduler.ts(83,5): error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'.
server/services/scheduler.ts(93,30): error TS18046: 'NewsScraperService' is of type 'unknown'.
server/services/scheduler.ts(96,59): error TS18046: 'error' is of type 'unknown'.
server/services/scheduler.ts(99,5): error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'.
server/services/scheduler.ts(125,5): error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'.
server/services/scheduler.ts(137,5): error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'.
server/services/shadowCabinet.ts(347,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ role: string; content: string; }'.
server/services/shadowCabinet.ts(352,31): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ role: string; content: string; }'.
server/services/shadowCabinet.ts(468,20): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/shadowCabinet.ts(550,112): error TS2345: Argument of type 'Promise<string | null>' is not assignable to parameter of type 'Promise<string>'.
server/services/shadowCabinet.ts(577,135): error TS2322: Type 'Promise<string | null>' is not assignable to type 'Promise<string>'.
server/services/shadowCabinet.ts(624,15): error TS18047: 'db' is possibly 'null'.
server/services/tdExtractionService.ts(32,40): error TS18047: 'supabase' is possibly 'null'.
server/services/tdExtractionService.ts(189,48): error TS2802: Type 'MapIterator<[string, TDMention[]]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/tdExtractionService.ts(302,3): error TS2322: Type 'string | boolean' is not assignable to type 'boolean'.
server/services/tdIdeologyProfileService.ts(151,9): error TS2322: Type 'unknown' is not assignable to type 'number'.
server/services/tdScoreCalculator.ts(160,27): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/titleDeduplicationService.ts(68,36): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/titleDeduplicationService.ts(69,29): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/titleDeduplicationService.ts(69,38): error TS2802: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/titleDeduplicationService.ts(136,17): error TS18047: 'supabase' is possibly 'null'.
server/services/titleDeduplicationService.ts(217,51): error TS18047: 'supabase' is possibly 'null'.
server/services/topicClassificationService.ts(111,54): error TS18046: 'error' is of type 'unknown'.
server/services/twilioService.ts(56,7): error TS18046: 'messageOptions' is of type 'unknown'.
server/services/twilioService.ts(60,50): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'MessageListInstanceCreateOptions'.
server/services/unifiedTDScoringService.ts(241,61): error TS2559: Type '{ transparency: number; effectiveness: number; integrity: number; consistency: number; constituency_service: number; }' has no properties in common with type '{ transparency_elo?: number | undefined; effectiveness_elo?: number | undefined; integrity_elo?: number | undefined; consistency_elo?: number | undefined; constituency_service_elo?: number | undefined; }'.
server/services/unifiedTDScoringService.ts(434,32): error TS2339: Property 'elo_7d_change' does not exist on type 'UnifiedTDScore'.
server/services/unifiedTDScoringService.ts(435,33): error TS2339: Property 'elo_30d_change' does not exist on type 'UnifiedTDScore'.
server/services/unifiedTDScoringService.ts(486,32): error TS2802: Type 'Map<string, { constituency: string; party: string | null; }>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/unifiedTDScoringService.ts(493,56): error TS18046: 'error' is of type 'unknown'.

## Task 12

