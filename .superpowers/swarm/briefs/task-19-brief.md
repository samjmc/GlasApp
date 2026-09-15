### Task 19
**Owned files (7, 87 baseline errors):**
- client/src/components/BoundaryProcessor.ts
- client/src/components/CategoryRankingInterface.tsx
- client/src/components/ContextAnalysis.tsx
- client/src/components/InteractiveConstituencyMap.tsx
- client/src/components/PartyRankingsWidget.tsx
- client/src/components/PledgeVotingInterface.tsx
- client/src/components/TDScoresWidget.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T19.txt; grep -cE "error TS" /tmp/tsc-T19.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T19.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/components/BoundaryProcessor.ts(60,36): error TS2339: Property 'features' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(60,75): error TS2339: Property 'features' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(66,39): error TS2339: Property 'features' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(66,76): error TS18046: 'feature' is of type 'unknown'.
client/src/components/BoundaryProcessor.ts(66,96): error TS18046: 'feature' is of type 'unknown'.
client/src/components/BoundaryProcessor.ts(82,15): error TS2339: Property 'features' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(83,18): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(85,28): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(86,27): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(87,27): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(90,28): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(91,27): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(94,29): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(95,29): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/components/BoundaryProcessor.ts(99,25): error TS18046: 'f' is of type 'unknown'.
client/src/components/BoundaryProcessor.ts(99,63): error TS18046: 'f' is of type 'unknown'.
client/src/components/CategoryRankingInterface.tsx(139,7): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/components/CategoryRankingInterface.tsx(204,43): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/components/CategoryRankingInterface.tsx(204,60): error TS2638: Type '{}' may represent a primitive value, which is not permitted as the right operand of the 'in' operator.
client/src/components/CategoryRankingInterface.tsx(209,35): error TS2638: Type '{}' may represent a primitive value, which is not permitted as the right operand of the 'in' operator.
client/src/components/CategoryRankingInterface.tsx(221,15): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/components/CategoryRankingInterface.tsx(221,39): error TS2638: Type '{}' may represent a primitive value, which is not permitted as the right operand of the 'in' operator.
client/src/components/CategoryRankingInterface.tsx(233,15): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/components/CategoryRankingInterface.tsx(233,37): error TS2638: Type '{}' may represent a primitive value, which is not permitted as the right operand of the 'in' operator.
client/src/components/ContextAnalysis.tsx(101,66): error TS18046: 'event' is of type 'unknown'.
client/src/components/ContextAnalysis.tsx(102,72): error TS18046: 'event' is of type 'unknown'.
client/src/components/ContextAnalysis.tsx(181,24): error TS2339: Property 'issue' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(192,21): error TS2339: Property 'issue' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(392,70): error TS2339: Property 'issue' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(394,37): error TS2339: Property 'stance' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(395,37): error TS2339: Property 'stance' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(396,39): error TS2339: Property 'stance' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/ContextAnalysis.tsx(399,36): error TS2339: Property 'stance' does not exist on type '{ description: never; } | { issue: string; stance: string; percentile?: number | undefined; description: string; }'.
client/src/components/InteractiveConstituencyMap.tsx(76,8): error TS2604: JSX element type 'Icon' does not have any construct or call signatures.
client/src/components/InteractiveConstituencyMap.tsx(76,8): error TS2786: 'Icon' cannot be used as a JSX component.
client/src/components/InteractiveConstituencyMap.tsx(197,36): error TS18046: 'td' is of type 'unknown'.
client/src/components/InteractiveConstituencyMap.tsx(197,75): error TS18046: 'td' is of type 'unknown'.
client/src/components/InteractiveConstituencyMap.tsx(201,34): error TS18046: 'td' is of type 'unknown'.
client/src/components/InteractiveConstituencyMap.tsx(204,34): error TS18046: 'td' is of type 'unknown'.
client/src/components/InteractiveConstituencyMap.tsx(209,34): error TS18046: 'td' is of type 'unknown'.
client/src/components/InteractiveConstituencyMap.tsx(222,39): error TS2322: Type '{ className: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/components/InteractiveConstituencyMap.tsx(255,11): error TS2698: Spread types may only be created from object types.
client/src/components/PartyRankingsWidget.tsx(48,46): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(51,10): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(54,20): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(55,23): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(62,39): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(64,14): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(64,36): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(70,14): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(73,14): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(73,88): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(79,41): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(87,16): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(142,60): error TS18046: 'p' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(143,60): error TS18046: 'p' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(144,69): error TS18046: 'b' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(144,94): error TS18046: 'a' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(158,22): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(175,22): error TS18046: 'party' is of type 'unknown'.
client/src/components/PartyRankingsWidget.tsx(192,22): error TS18046: 'party' is of type 'unknown'.
client/src/components/PledgeVotingInterface.tsx(115,30): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(116,49): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(123,29): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(131,64): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(136,36): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(141,44): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(144,56): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(148,36): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(151,55): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(160,36): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/PledgeVotingInterface.tsx(163,55): error TS2339: Property 'data' does not exist on type '{}'.
client/src/components/TDScoresWidget.tsx(48,8): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(48,32): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(49,8): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(49,41): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(52,43): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(55,10): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(57,18): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(58,18): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(63,14): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(69,14): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(72,14): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(78,41): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(152,22): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(170,22): error TS18046: 'td' is of type 'unknown'.
client/src/components/TDScoresWidget.tsx(189,22): error TS18046: 'td' is of type 'unknown'.

## Task 20

