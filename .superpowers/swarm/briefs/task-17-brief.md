### Task 17
**Owned files (22, 170 baseline errors):**
- client/src/pages/AdminPage.tsx
- client/src/pages/AdminPollingEntry.tsx
- client/src/pages/AontuEfficiencyPage.tsx
- client/src/pages/ConstituenciesPage.tsx
- client/src/pages/ConstituencyComparisonPage.tsx
- client/src/pages/ElectoralDistrictsPage.tsx
- client/src/pages/EnhancedQuizPage.tsx
- client/src/pages/IdeasPage.tsx
- client/src/pages/LoginPage.tsx
- client/src/pages/MediaWorkspacePage.tsx
- client/src/pages/MyPoliticsPage.tsx
- client/src/pages/PartyProfilePage.tsx
- client/src/pages/PersonalizedInsightsPage.tsx
- client/src/pages/PollingDashboard.tsx
- client/src/pages/ProfilePage.tsx
- client/src/pages/RegionSelectionPage.tsx
- client/src/pages/RegisterPage.tsx
- client/src/pages/RegisterStepsPage.tsx
- client/src/pages/TDLeaderboardPage.tsx
- client/src/pages/TDScoresPage.tsx
- client/src/pages/UnifiedMapPage.tsx
- client/src/pages/admin/ShadowCabinetDashboard.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T17.txt; grep -cE "error TS" /tmp/tsc-T17.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T17.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/AdminPage.tsx(193,52): error TS18046: 'actionData' is of type 'unknown'.
client/src/pages/AdminPage.tsx(571,33): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(573,64): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(575,30): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(579,28): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(579,49): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(583,55): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(584,66): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(625,42): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(625,67): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(627,36): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(628,78): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/AdminPage.tsx(780,57): error TS18046: 'p' is of type 'unknown'.
client/src/pages/AdminPage.tsx(787,101): error TS18046: 'p' is of type 'unknown'.
client/src/pages/AdminPage.tsx(816,36): error TS18046: 'pledgeData' is of type 'unknown'.
client/src/pages/AdminPollingEntry.tsx(188,25): error TS18046: 'error' is of type 'unknown'.
client/src/pages/AontuEfficiencyPage.tsx(21,19): error TS2339: Property 'success' does not exist on type '{}'.
client/src/pages/AontuEfficiencyPage.tsx(21,41): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/AontuEfficiencyPage.tsx(21,59): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/AontuEfficiencyPage.tsx(34,11): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/AontuEfficiencyPage.tsx(34,26): error TS2339: Property 'metadata' does not exist on type '{}'.
client/src/pages/ConstituenciesPage.tsx(99,81): error TS18046: 'c' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(109,71): error TS18046: 'c' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(162,54): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(164,30): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(164,40): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(176,73): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(181,36): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(183,73): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(186,34): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(220,26): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(220,87): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(225,26): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(229,32): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(237,22): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(239,77): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(241,28): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(241,38): error TS18046: 'p' is of type 'unknown'.
client/src/pages/ConstituenciesPage.tsx(252,26): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/ConstituencyComparisonPage.tsx(16,36): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/ElectoralDistrictsPage.tsx(30,23): error TS18046: 'L' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(40,11): error TS18046: 'L' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(48,36): error TS18046: 'L' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(61,11): error TS18046: 'L' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(64,49): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/pages/ElectoralDistrictsPage.tsx(65,38): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/pages/ElectoralDistrictsPage.tsx(68,15): error TS18046: 'layer' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(71,15): error TS18046: 'layer' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(73,39): error TS18046: 'e' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(81,39): error TS18046: 'e' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(85,33): error TS18046: 'e' is of type 'unknown'.
client/src/pages/ElectoralDistrictsPage.tsx(104,32): error TS2339: Property 'remove' does not exist on type '{}'.
client/src/pages/EnhancedQuizPage.tsx(461,63): error TS2322: Type '{ value: number; className: string; indicatorClassName: string; }' is not assignable to type 'IntrinsicAttributes & Omit<ProgressProps & RefAttributes<HTMLDivElement>, "ref"> & { style?: CSSProperties | undefined; } & RefAttributes<...>'.
client/src/pages/IdeasPage.tsx(545,57): error TS18046: 'b' is of type 'unknown'.
client/src/pages/IdeasPage.tsx(545,71): error TS18046: 'a' is of type 'unknown'.
client/src/pages/IdeasPage.tsx(547,43): error TS18046: 'problem' is of type 'unknown'.
client/src/pages/IdeasPage.tsx(547,55): error TS2322: Type 'unknown' is not assignable to type 'Problem'.
client/src/pages/LoginPage.tsx(49,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/LoginPage.tsx(74,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/LoginPage.tsx(92,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/MediaWorkspacePage.tsx(214,7): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
client/src/pages/MediaWorkspacePage.tsx(352,44): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, unknown, unknown>'.
client/src/pages/MediaWorkspacePage.tsx(355,35): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, unknown, unknown>'.
client/src/pages/MediaWorkspacePage.tsx(360,40): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, { viewId?: string | undefined; filters?: unknown; requestedBy?: string | undefined; }, unknown>'.
client/src/pages/MediaWorkspacePage.tsx(363,31): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, { viewId?: string | undefined; filters?: unknown; requestedBy?: string | undefined; }, unknown>'.
client/src/pages/MediaWorkspacePage.tsx(403,40): error TS2339: Property 'period' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(405,46): error TS2339: Property 'period' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(405,86): error TS2339: Property 'period' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(407,38): error TS2339: Property 'party' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(409,48): error TS2339: Property 'party' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(412,38): error TS2339: Property 'topic' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(414,48): error TS2339: Property 'topic' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(417,38): error TS2339: Property 'chamber' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(419,50): error TS2339: Property 'chamber' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(430,27): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
client/src/pages/MediaWorkspacePage.tsx(481,50): error TS2339: Property 'period' does not exist on type '{}'.
client/src/pages/MediaWorkspacePage.tsx(503,66): error TS2339: Property 'rowCount' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(208,30): error TS2339: Property 'message' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(352,18): error TS2339: Property 'updatedProfile' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(353,27): error TS2339: Property 'updatedProfile' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(357,18): error TS2339: Property 'topMatches' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(358,30): error TS2339: Property 'topMatches' does not exist on type '{}'.
client/src/pages/MyPoliticsPage.tsx(475,49): error TS2339: Property 'axis' does not exist on type 'never'.
client/src/pages/MyPoliticsPage.tsx(475,67): error TS2339: Property 'axis' does not exist on type 'never'.
client/src/pages/MyPoliticsPage.tsx(477,16): error TS2339: Property 'value' does not exist on type 'never'.
client/src/pages/MyPoliticsPage.tsx(478,16): error TS2339: Property 'value' does not exist on type 'never'.
client/src/pages/MyPoliticsPage.tsx(684,65): error TS18046: 'match' is of type 'unknown'.
client/src/pages/MyPoliticsPage.tsx(688,26): error TS18046: 'match' is of type 'unknown'.
client/src/pages/MyPoliticsPage.tsx(691,26): error TS18046: 'match' is of type 'unknown'.
client/src/pages/MyPoliticsPage.tsx(696,26): error TS18046: 'match' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(44,9): error TS18046: 'p' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(505,25): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(507,50): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(507,73): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(530,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(530,72): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(535,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(538,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(543,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PartyProfilePage.tsx(543,53): error TS18046: 'td' is of type 'unknown'.
client/src/pages/PersonalizedInsightsPage.tsx(92,71): error TS18046: 'c' is of type 'unknown'.
client/src/pages/PersonalizedInsightsPage.tsx(173,36): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/PersonalizedInsightsPage.tsx(173,62): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/PersonalizedInsightsPage.tsx(174,22): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/PersonalizedInsightsPage.tsx(185,11): error TS2322: Type 'string | undefined' is not assignable to type 'number | undefined'.
client/src/pages/PollingDashboard.tsx(90,21): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(91,38): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(92,20): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(93,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(94,40): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(104,24): error TS18046: 'err' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(138,25): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
client/src/pages/PollingDashboard.tsx(147,43): error TS18046: 'r' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(148,47): error TS2339: Property 'mean_support' does not exist on type '{}'.
client/src/pages/PollingDashboard.tsx(264,9): error TS2322: Type 'unknown' is not assignable to type 'ReactNode'.
client/src/pages/PollingDashboard.tsx(335,17): error TS2741: Property 'datasets' is missing in type '{}' but required in type 'ChartData<"line", (number | Point | null)[], unknown>'.
client/src/pages/PollingDashboard.tsx(368,37): error TS18046: 'context' is of type 'unknown'.
client/src/pages/PollingDashboard.tsx(368,63): error TS18046: 'context' is of type 'unknown'.
client/src/pages/ProfilePage.tsx(44,28): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/ProfilePage.tsx(44,68): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/ProfilePage.tsx(45,32): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/RegionSelectionPage.tsx(99,31): error TS2367: This comparison appears to be unintentional because the types '"ready" | "needs-selection"' and '"loading"' have no overlap.
client/src/pages/RegisterPage.tsx(61,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/RegisterPage.tsx(90,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/RegisterPage.tsx(119,16): error TS18046: 'err' is of type 'unknown'.
client/src/pages/RegisterStepsPage.tsx(149,31): error TS2698: Spread types may only be created from object types.
client/src/pages/RegisterStepsPage.tsx(186,31): error TS2698: Spread types may only be created from object types.
client/src/pages/RegisterStepsPage.tsx(227,13): error TS18046: 'registrationData' is of type 'unknown'.
client/src/pages/RegisterStepsPage.tsx(460,49): error TS18046: 'registrationData' is of type 'unknown'.
client/src/pages/RegisterStepsPage.tsx(493,49): error TS18046: 'registrationData' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(81,89): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(110,43): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(115,24): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(116,51): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(131,24): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(133,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(134,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(139,28): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(146,28): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(149,34): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(151,34): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(159,65): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(163,65): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(167,65): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(174,28): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(179,26): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(181,29): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(183,30): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDLeaderboardPage.tsx(188,39): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(48,5): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(49,5): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(161,30): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(197,48): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(198,59): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(200,49): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(206,14): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(209,14): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(209,52): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(210,14): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(222,56): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(223,57): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(224,53): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(225,55): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(226,51): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(229,12): error TS2304: Cannot find name 'Link'.
client/src/pages/TDScoresPage.tsx(229,71): error TS18046: 'td' is of type 'unknown'.
client/src/pages/TDScoresPage.tsx(234,13): error TS2304: Cannot find name 'Link'.
client/src/pages/UnifiedMapPage.tsx(5,10): error TS2614: Module '"../pages/ElectoralDistrictsPage"' has no exported member 'ElectoralDistrictsPage'. Did you mean to use 'import ElectoralDistrictsPage from "../pages/ElectoralDistrictsPage"' instead?
client/src/pages/admin/ShadowCabinetDashboard.tsx(217,38): error TS2604: JSX element type 'agent.icon' does not have any construct or call signatures.
client/src/pages/admin/ShadowCabinetDashboard.tsx(217,38): error TS2786: 'agent.icon' cannot be used as a JSX component.

## Task 18

