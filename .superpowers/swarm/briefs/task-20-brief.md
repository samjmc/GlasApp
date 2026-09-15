### Task 20
**Owned files (28, 78 baseline errors):**
- client/src/components/ConflictTrackingMap.tsx
- client/src/components/ConstituencyMap.tsx
- client/src/components/EnhancedPoliticalProfileExplanationNew.tsx
- client/src/components/EnhancedProfileExplanation.tsx
- client/src/components/GeographicHeatMap.tsx
- client/src/components/Header.tsx
- client/src/components/HistoricalContext.tsx
- client/src/components/HomePageTabs.tsx
- client/src/components/IdeologyTimeSeriesChart.tsx
- client/src/components/IdeologyTimeSeriesChartEnhanced.tsx
- client/src/components/PWAInstallButton.tsx
- client/src/components/PartyMatchResults.tsx
- client/src/components/PartyPollingWidget.tsx
- client/src/components/PartyQuickInfoModal.tsx
- client/src/components/PhoneVerification.tsx
- client/src/components/PolicyVotePrompt.tsx
- client/src/components/PolicyVoting.tsx
- client/src/components/PoliticalEvolutionChart.tsx
- client/src/components/QuestionCard.tsx
- client/src/components/QuizAssistant.tsx
- client/src/components/SimilarFigures.tsx
- client/src/components/SimpleIrishCountiesGraph.tsx
- client/src/components/ZoomableIrelandMap.tsx
- client/src/components/auth/AuthStatusIndicator.tsx
- client/src/components/auth/LoginForm.tsx
- client/src/components/auth/RegisterForm.tsx
- client/src/components/onboarding/EmptyStates.tsx
- client/src/components/onboarding/WelcomeBanner.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T20.txt; grep -cE "error TS" /tmp/tsc-T20.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T20.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/components/ConflictTrackingMap.tsx(83,24): error TS2345: Argument of type 'ConflictZone[] | undefined' is not assignable to parameter of type 'SetStateAction<ConflictZone[]>'.
client/src/components/ConflictTrackingMap.tsx(331,59): error TS18046: 'geo' is of type 'unknown'.
client/src/components/ConflictTrackingMap.tsx(336,40): error TS18046: 'geo' is of type 'unknown'.
client/src/components/ConstituencyMap.tsx(179,19): error TS18046: 'party' is of type 'unknown'.
client/src/components/ConstituencyMap.tsx(179,50): error TS18046: 'party' is of type 'unknown'.
client/src/components/EnhancedPoliticalProfileExplanationNew.tsx(199,70): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanationNew.tsx(199,147): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanationNew.tsx(202,58): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanationNew.tsx(202,145): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedProfileExplanation.tsx(169,76): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedProfileExplanation.tsx(172,51): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedProfileExplanation.tsx(176,11): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedProfileExplanation.tsx(179,74): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedProfileExplanation.tsx(183,41): error TS18046: 'event' is of type 'unknown'.
client/src/components/GeographicHeatMap.tsx(190,41): error TS18046: 'geo' is of type 'unknown'.
client/src/components/GeographicHeatMap.tsx(195,32): error TS18046: 'geo' is of type 'unknown'.
client/src/components/GeographicHeatMap.tsx(215,51): error TS18046: 'evt' is of type 'unknown'.
client/src/components/GeographicHeatMap.tsx(215,64): error TS18046: 'evt' is of type 'unknown'.
client/src/components/Header.tsx(20,29): error TS2339: Property 'streakCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/components/Header.tsx(21,27): error TS2339: Property 'streakCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/components/Header.tsx(23,22): error TS2339: Property 'completion' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/components/Header.tsx(24,27): error TS2339: Property 'completion' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/components/HistoricalContext.tsx(253,68): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<"economic" | "social" | "issues">'.
client/src/components/HomePageTabs.tsx(166,41): error TS18046: 'article' is of type 'unknown'.
client/src/components/HomePageTabs.tsx(166,53): error TS2322: Type 'unknown' is not assignable to type 'NewsArticle'.
client/src/components/IdeologyTimeSeriesChart.tsx(70,18): error TS18046: 'err' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChart.tsx(180,31): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChart.tsx(180,82): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChart.tsx(181,43): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChart.tsx(182,58): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(126,16): error TS18046: 'err' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(240,9): error TS18046: 'data' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(457,27): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(459,33): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(459,84): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(460,45): error TS18046: 'entry' is of type 'unknown'.
client/src/components/IdeologyTimeSeriesChartEnhanced.tsx(461,60): error TS18046: 'entry' is of type 'unknown'.
client/src/components/PWAInstallButton.tsx(25,24): error TS2571: Object is of type 'unknown'.
client/src/components/PWAInstallButton.tsx(165,24): error TS2571: Object is of type 'unknown'.
client/src/components/PartyMatchResults.tsx(58,67): error TS18046: 'event' is of type 'unknown'.
client/src/components/PartyMatchResults.tsx(62,11): error TS18046: 'event' is of type 'unknown'.
client/src/components/PartyMatchResults.tsx(68,26): error TS18046: 'event' is of type 'unknown'.
client/src/components/PartyPollingWidget.tsx(161,7): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/components/PartyPollingWidget.tsx(211,15): error TS2741: Property 'datasets' is missing in type '{}' but required in type 'ChartData<"line", (number | Point | null)[], unknown>'.
client/src/components/PartyPollingWidget.tsx(221,55): error TS18047: 'context.parsed.y' is possibly 'null'.
client/src/components/PartyQuickInfoModal.tsx(162,58): error TS18046: 'b' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(162,75): error TS18046: 'a' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(166,32): error TS18046: 'member' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(167,40): error TS18046: 'member' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(172,32): error TS18046: 'member' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(175,32): error TS18046: 'member' is of type 'unknown'.
client/src/components/PartyQuickInfoModal.tsx(180,32): error TS18046: 'member' is of type 'unknown'.
client/src/components/PhoneVerification.tsx(208,20): error TS2322: Type '"success"' is not assignable to type '"default" | "destructive" | "outline" | "secondary" | null | undefined'.
client/src/components/PolicyVotePrompt.tsx(187,20): error TS18046: 'err' is of type 'unknown'.
client/src/components/PolicyVotePrompt.tsx(337,16): error TS18046: 'err' is of type 'unknown'.
client/src/components/PolicyVotePrompt.tsx(340,22): error TS18046: 'err' is of type 'unknown'.
client/src/components/PolicyVoting.tsx(95,62): error TS18046: 's' is of type 'unknown'.
client/src/components/PolicyVoting.tsx(111,62): error TS18046: 'v' is of type 'unknown'.
client/src/components/PolicyVoting.tsx(201,13): error TS18046: 'error' is of type 'unknown'.
client/src/components/PoliticalEvolutionChart.tsx(3,10): error TS2724: '"@shared/schema"' has no exported member named 'PoliticalEvolutionRecord'. Did you mean 'PoliticalEvolution'?
client/src/components/QuestionCard.tsx(2,10): error TS2305: Module '"@shared/schema"' has no exported member 'QuizQuestion'.
client/src/components/QuestionCard.tsx(146,36): error TS7006: Parameter 'answer' implicitly has an 'any' type.
client/src/components/QuestionCard.tsx(146,44): error TS7006: Parameter 'index' implicitly has an 'any' type.
client/src/components/QuizAssistant.tsx(2,10): error TS2305: Module '"@shared/schema"' has no exported member 'QuizQuestion'.
client/src/components/SimilarFigures.tsx(2,10): error TS2305: Module '"@shared/schema"' has no exported member 'PoliticalFigure'.
client/src/components/SimpleIrishCountiesGraph.tsx(134,93): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<"economic" | "social" | "issues">'.
client/src/components/ZoomableIrelandMap.tsx(468,93): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<"economic" | "social" | "issues">'.
client/src/components/auth/AuthStatusIndicator.tsx(33,12): error TS2339: Property 'isGuest' does not exist on type '{}'.
client/src/components/auth/AuthStatusIndicator.tsx(48,61): error TS2339: Property 'displayName' does not exist on type '{}'.
client/src/components/auth/AuthStatusIndicator.tsx(48,81): error TS2339: Property 'email' does not exist on type '{}'.
client/src/components/auth/LoginForm.tsx(33,28): error TS2722: Cannot invoke an object which is possibly 'undefined'.
client/src/components/auth/LoginForm.tsx(33,28): error TS18048: 'login' is possibly 'undefined'.
client/src/components/auth/LoginForm.tsx(42,18): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'SetStateAction<string | null>'.
client/src/components/auth/RegisterForm.tsx(54,28): error TS2722: Cannot invoke an object which is possibly 'undefined'.
client/src/components/auth/RegisterForm.tsx(54,28): error TS18048: 'register' is possibly 'undefined'.
client/src/components/auth/RegisterForm.tsx(70,18): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'SetStateAction<string | null>'.
client/src/components/onboarding/EmptyStates.tsx(197,47): error TS2339: Property 'cta' does not exist on type '{ icon: Element; title: string; description: string; gradient: string; } | { icon: Element; title: string; description: string; gradient: string; } | { icon: Element; title: string; description: string; gradient: string; cta: { ...; }; }'.
client/src/components/onboarding/WelcomeBanner.tsx(34,27): error TS2345: Argument of type 'boolean | null' is not assignable to parameter of type 'SetStateAction<boolean>'.

## Task 21

