### Task 16
**Owned files (6, 165 baseline errors):**
- client/src/pages/ConstituencyProfilePage.tsx
- client/src/pages/DailySessionPage.tsx
- client/src/pages/DebatesPage.tsx
- client/src/pages/LocalRepresentativesPage.tsx
- client/src/pages/ResearchedTDsPage.tsx
- client/src/pages/Results.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T16.txt; grep -cE "error TS" /tmp/tsc-T16.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T16.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/ConstituencyProfilePage.tsx(151,23): error TS18046: 'party' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(154,20): error TS18046: 'party' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(157,20): error TS18046: 'party' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(157,34): error TS18046: 'party' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(161,59): error TS18046: 'party' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(178,24): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(178,44): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(183,24): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(185,22): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(185,36): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(188,26): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(191,22): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(192,50): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(197,47): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(198,22): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(198,39): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(201,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(201,55): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(204,22): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(207,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ConstituencyProfilePage.tsx(215,72): error TS18046: 'td' is of type 'unknown'.
client/src/pages/DailySessionPage.tsx(394,18): error TS2339: Property 'status' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(394,52): error TS2339: Property 'completion' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(395,31): error TS2339: Property 'completion' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(396,38): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(398,35): error TS2339: Property 'status' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(399,19): error TS2339: Property 'voteCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(400,40): error TS2339: Property 'voteCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(402,42): error TS2339: Property 'voteCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(402,61): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(415,30): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(416,20): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(421,31): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(422,35): error TS2339: Property 'status' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(424,46): error TS2339: Property 'voteCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(462,14): error TS2339: Property 'status' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(463,15): error TS2339: Property 'voteCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(463,44): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(466,30): error TS2339: Property 'completion' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(468,48): error TS2339: Property 'streakCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(487,28): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(519,15): error TS2322: Type 'number | null' is not assignable to type 'number | undefined'.
client/src/pages/DailySessionPage.tsx(524,42): error TS2339: Property 'message' does not exist on type '{}'.
client/src/pages/DailySessionPage.tsx(549,29): error TS2339: Property 'message' does not exist on type '{}'.
client/src/pages/DailySessionPage.tsx(555,48): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(595,20): error TS2339: Property 'message' does not exist on type '{}'.
client/src/pages/DailySessionPage.tsx(673,43): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(685,34): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(687,9): error TS2322: Type 'DailySessionState' is not assignable to type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(695,44): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DailySessionPage.tsx(705,29): error TS2339: Property 'message' does not exist on type '{}'.
client/src/pages/DailySessionPage.tsx(752,31): error TS2339: Property 'streakCount' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/pages/DebatesPage.tsx(264,5): error TS2698: Spread types may only be created from object types.
client/src/pages/DebatesPage.tsx(265,13): error TS18046: 'item' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(320,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(321,46): error TS18046: 'item' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(321,67): error TS18046: 'item' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(323,13): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(324,13): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(325,14): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(326,21): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(327,32): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(327,76): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(328,32): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(328,76): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(329,34): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(329,80): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(330,34): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(330,80): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(331,30): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(331,72): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(332,30): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(332,72): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(333,27): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(335,16): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(335,66): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(336,25): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(336,62): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(337,29): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(337,51): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(338,24): error TS18046: 'participant' is of type 'unknown'.
client/src/pages/DebatesPage.tsx(341,7): error TS2698: Spread types may only be created from object types.
client/src/pages/DebatesPage.tsx(343,16): error TS18046: 'item' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(184,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(185,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(190,53): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(192,16): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(195,16): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(201,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(204,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(204,56): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(205,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(218,52): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(219,53): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(220,49): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(221,51): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(222,47): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(229,16): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(233,16): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(236,16): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(243,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(246,14): error TS18046: 'td' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(247,25): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(251,29): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(256,51): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(260,24): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(264,25): error TS2322: Type '"success" | "destructive" | "secondary"' is not assignable to type '"default" | "destructive" | "outline" | "secondary" | null | undefined'.
client/src/pages/LocalRepresentativesPage.tsx(265,27): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(266,27): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(271,26): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(273,64): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(275,75): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(279,70): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(280,22): error TS18046: 'story' is of type 'unknown'.
client/src/pages/LocalRepresentativesPage.tsx(280,58): error TS18046: 'story' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(56,11): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(56,27): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(57,11): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(57,34): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(68,9): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(68,34): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(70,25): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(92,9): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(94,55): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(96,69): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(102,17): error TS18046: 'a' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(102,35): error TS18046: 'b' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(186,24): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(187,51): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(194,26): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(199,27): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(201,36): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(202,36): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(207,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(214,32): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(216,30): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(221,30): error TS18046: 'td' is of type 'unknown'.
client/src/pages/ResearchedTDsPage.tsx(230,59): error TS18046: 'td' is of type 'unknown'.
client/src/pages/Results.tsx(114,71): error TS18046: 'c' is of type 'unknown'.
client/src/pages/Results.tsx(160,53): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(162,27): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(167,53): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(169,27): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(185,34): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(186,32): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
client/src/pages/Results.tsx(187,36): error TS2339: Property 'quizSimilarFigures' does not exist on type 'Window & typeof globalThis'.
client/src/pages/Results.tsx(192,13): error TS2322: Type 'string | null' is not assignable to type 'string'.
client/src/pages/Results.tsx(193,13): error TS2322: Type 'string | null' is not assignable to type 'string'.
client/src/pages/Results.tsx(197,19): error TS2339: Property 'quizKeyInsights' does not exist on type 'Window & typeof globalThis'.
client/src/pages/Results.tsx(199,35): error TS2339: Property 'quizKeyInsights' does not exist on type 'Window & typeof globalThis'.
client/src/pages/Results.tsx(229,52): error TS2339: Property 'quizUniqueCombinations' does not exist on type 'Window & typeof globalThis'.
client/src/pages/Results.tsx(232,31): error TS2322: Type 'string | null' is not assignable to type 'string'.
client/src/pages/Results.tsx(239,36): error TS2339: Property 'economic' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(240,34): error TS2339: Property 'social' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(241,13): error TS2322: Type 'string | null' is not assignable to type 'string | undefined'.
client/src/pages/Results.tsx(254,44): error TS2339: Property 'similarFigures' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(257,45): error TS2339: Property 'economic' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(257,71): error TS2339: Property 'social' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(260,43): error TS2339: Property 'economic' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(260,69): error TS2339: Property 'social' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(282,36): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/Results.tsx(282,62): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/Results.tsx(283,22): error TS18046: 'constituency' is of type 'unknown'.
client/src/pages/Results.tsx(294,40): error TS2339: Property 'economic' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/pages/Results.tsx(295,38): error TS2339: Property 'social' does not exist on type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.

## Task 17

