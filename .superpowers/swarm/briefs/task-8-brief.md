### Task 8
**Owned files (7, 83 baseline errors):**
- server/routes.ts
- server/routes/admin/manualArticleRoutes.ts
- server/routes/admin/newsScraperRoutes.ts
- server/routes/geographic/index.ts
- server/routes/political/parties.ts
- server/routes/political/pledges.ts
- server/routes/quiz/index.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T8.txt; grep -cE "error TS" /tmp/tsc-T8.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T8.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes.ts(209,9): error TS2322: Type '{ questionId: number; answerId?: number | undefined; customAnswer?: string | undefined; }[]' is not assignable to type 'Record<string, string | number | boolean>'.
server/routes.ts(213,9): error TS2322: Type 'number | null' is not assignable to type 'string | undefined'.
server/routes.ts(239,22): error TS2339: Property 'id' does not exist on type 'ApiResponse<{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }>'.
server/routes.ts(240,29): error TS2339: Property 'shareCode' does not exist on type 'ApiResponse<{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }>'.
server/routes.ts(308,32): error TS2339: Property 'claims' does not exist on type '{}'.
server/routes.ts(313,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(314,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(315,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(316,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(317,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(318,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(319,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(320,13): error TS2322: Type 'string' is not assignable to type 'number'.
server/routes.ts(361,11): error TS2322: Type '{ questionId: number; answerId?: number | undefined; customAnswer?: string | undefined; }[]' is not assignable to type 'Record<string, string | number | boolean>'.
server/routes.ts(377,22): error TS2339: Property 'id' does not exist on type 'ApiResponse<{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }> | { ...; }'.
server/routes.ts(378,29): error TS2339: Property 'shareCode' does not exist on type 'ApiResponse<{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }> | { ...; }'.
server/routes/admin/manualArticleRoutes.ts(94,22): error TS2339: Property 'length' does not exist on type 'Promise<TDMention[]>'.
server/routes/admin/manualArticleRoutes.ts(107,35): error TS2339: Property 'slice' does not exist on type 'Promise<TDMention[]>'.
server/routes/admin/manualArticleRoutes.ts(128,20): error TS18046: 'error' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(136,33): error TS2339: Property 'length' does not exist on type 'Promise<TDMention[]>'.
server/routes/admin/manualArticleRoutes.ts(267,14): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(268,16): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(269,18): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(270,17): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(271,25): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(275,21): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(276,20): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(277,23): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(278,30): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(279,31): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(280,27): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(281,29): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(282,38): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(283,21): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(284,23): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(285,36): error TS18046: 'analysis' is of type 'unknown'.
server/routes/admin/manualArticleRoutes.ts(288,28): error TS18046: 'article' is of type 'unknown'.
server/routes/admin/newsScraperRoutes.ts(172,18): error TS18046: 'error' is of type 'unknown'.
server/routes/admin/newsScraperRoutes.ts(234,44): error TS2339: Property 'IRISH_NEWS_SOURCES' does not exist on type '{ fetchAllIrishNews: (options?: FetchNewsOptions) => Promise<ScrapedArticle[]>; fetchRSSFeed: (feedUrl: string, sourceName: string, credibility: number) => Promise<...>; scrapeArticleContent: (url: string) => Promise<...>; filterPoliticalArticles: (articles: ScrapedArticle[]) => Promise<...>; isArticleAlreadyProcess...'.
server/routes/geographic/index.ts(72,34): error TS2339: Property 'features' does not exist on type '{}'.
server/routes/geographic/index.ts(78,36): error TS2339: Property 'features' does not exist on type '{}'.
server/routes/geographic/index.ts(149,28): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(152,31): error TS2339: Property 'firebaseUid' does not exist on type 'PgTableWithColumns<{ name: "user_locations"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "user_locations"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 6 more ...; updatedAt: PgColumn<...>; ...'.
server/routes/geographic/index.ts(157,13): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(167,33): error TS2339: Property 'firebaseUid' does not exist on type 'PgTableWithColumns<{ name: "user_locations"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "user_locations"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 6 more ...; updatedAt: PgColumn<...>; ...'.
server/routes/geographic/index.ts(170,13): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(171,9): error TS2769: No overload matches this call.
server/routes/geographic/index.ts(193,25): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(195,36): error TS2339: Property 'firebaseUid' does not exist on type 'PgTableWithColumns<{ name: "user_locations"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "user_locations"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 6 more ...; updatedAt: PgColumn<...>; ...'.
server/routes/geographic/index.ts(214,25): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(239,37): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(307,25): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(326,32): error TS18047: 'db' is possibly 'null'.
server/routes/geographic/index.ts(375,32): error TS18047: 'db' is possibly 'null'.
server/routes/political/parties.ts(93,16): error TS18046: 'party' is of type 'unknown'.
server/routes/political/parties.ts(93,43): error TS18046: 'party' is of type 'unknown'.
server/routes/political/parties.ts(94,16): error TS18046: 'party' is of type 'unknown'.
server/routes/political/parties.ts(147,65): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(148,61): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(149,65): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(150,67): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(151,75): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(152,67): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(153,63): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(154,73): error TS18046: 'partyDimensions' is of type 'unknown'.
server/routes/political/parties.ts(290,37): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/political/parties.ts(366,37): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/political/parties.ts(407,37): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/political/pledges.ts(37,25): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(51,29): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(69,26): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(84,25): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(103,33): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(128,9): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(132,33): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(164,30): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(219,29): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(261,30): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(276,25): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(284,5): error TS2322: Type '{}' is not assignable to type '"coalition" | "government" | "opposition"'.
server/routes/political/pledges.ts(322,30): error TS18047: 'db' is possibly 'null'.
server/routes/political/pledges.ts(474,30): error TS18047: 'db' is possibly 'null'.
server/routes/quiz/index.ts(116,30): error TS2339: Property 'claims' does not exist on type '{}'.

## Task 9

