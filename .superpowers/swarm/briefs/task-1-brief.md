### Task 1
**Owned files (10, 47 baseline errors):**
- server/api/researched-tds.ts
- server/auth/supabaseAuth.ts
- server/db.ts
- server/index.ts
- server/middleware/regionMiddleware.ts
- server/replitAuth.ts
- server/storage.ts
- server/vite.ts
- shared/data-complete.ts
- shared/data.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T1.txt; grep -cE "error TS" /tmp/tsc-T1.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T1.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/api/researched-tds.ts(17,35): error TS18047: 'supabaseDb' is possibly 'null'.
server/api/researched-tds.ts(83,14): error TS18046: 'error' is of type 'unknown'.
server/api/researched-tds.ts(94,39): error TS18047: 'supabaseDb' is possibly 'null'.
server/api/researched-tds.ts(125,14): error TS18046: 'error' is of type 'unknown'.
server/auth/supabaseAuth.ts(234,7): error TS2322: Type 'unknown' is not assignable to type 'object | undefined'.
server/auth/supabaseAuth.ts(296,7): error TS2322: Type 'unknown' is not assignable to type 'object | undefined'.
server/db.ts(112,18): error TS2339: Property 'end' does not exist on type 'never'.
server/db.ts(144,31): error TS2339: Property 'query' does not exist on type 'never'.
server/db.ts(152,52): error TS18046: 'error' is of type 'unknown'.
server/db.ts(153,9): error TS18046: 'error' is of type 'unknown'.
server/db.ts(153,53): error TS18046: 'error' is of type 'unknown'.
server/index.ts(128,11): error TS18046: 'error' is of type 'unknown'.
server/middleware/regionMiddleware.ts(33,36): error TS2339: Property 'user_metadata' does not exist on type '{}'.
server/middleware/regionMiddleware.ts(34,47): error TS2339: Property 'user_metadata' does not exist on type '{}'.
server/middleware/regionMiddleware.ts(49,3): error TS2571: Object is of type 'unknown'.
server/replitAuth.ts(72,5): error TS18046: 'sessionConfig' is of type 'unknown'.
server/replitAuth.ts(82,18): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SessionOptions | undefined'.
server/replitAuth.ts(89,3): error TS18046: 'user' is of type 'unknown'.
server/replitAuth.ts(90,3): error TS18046: 'user' is of type 'unknown'.
server/replitAuth.ts(91,3): error TS18046: 'user' is of type 'unknown'.
server/replitAuth.ts(92,3): error TS18046: 'user' is of type 'unknown'.
server/replitAuth.ts(92,21): error TS18046: 'user' is of type 'unknown'.
server/replitAuth.ts(101,9): error TS18046: 'claims' is of type 'unknown'.
server/replitAuth.ts(102,12): error TS18046: 'claims' is of type 'unknown'.
server/replitAuth.ts(103,16): error TS18046: 'claims' is of type 'unknown'.
server/replitAuth.ts(104,15): error TS18046: 'claims' is of type 'unknown'.
server/replitAuth.ts(258,42): error TS2339: Property 'claims' does not exist on type '{}'.
server/replitAuth.ts(263,14): error TS2339: Property 'expires_at' does not exist on type '{}'.
server/replitAuth.ts(263,39): error TS2339: Property 'expires_at' does not exist on type '{}'.
server/replitAuth.ts(264,33): error TS2339: Property 'refresh_token' does not exist on type '{}'.
server/storage.ts(75,26): error TS18047: 'db' is possibly 'null'.
server/storage.ts(100,35): error TS2352: Conversion of type 'QuizResultInput' to type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/storage.ts(152,33): error TS18047: 'db' is possibly 'null'.
server/storage.ts(165,32): error TS18047: 'db' is possibly 'null'.
server/storage.ts(179,40): error TS18047: 'db' is possibly 'null'.
server/storage.ts(181,14): error TS2345: Argument of type 'Partial<PoliticalEvolutionInput>' is not assignable to parameter of type '{ ideology?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | undefined; userId?: string | SQL<...> | PgColumn<...> | undefined; ... 13 more ...; notes?: string | ... 3 more ... | undefined; }'.
server/storage.ts(193,26): error TS18047: 'db' is possibly 'null'.
server/storage.ts(213,25): error TS18047: 'db' is possibly 'null'.
server/storage.ts(238,26): error TS18047: 'db' is possibly 'null'.
server/vite.ts(52,5): error TS2322: Type '{ middlewareMode: boolean; hmr: { server: Server<typeof IncomingMessage, typeof ServerResponse>; port: number; clientPort: number; }; allowedHosts: boolean; }' is not assignable to type 'ServerOptions'.
server/vite.ts(63,24): error TS2339: Property 'close' does not exist on type '{}'.
shared/data-complete.ts(1,10): error TS2305: Module '"./schema"' has no exported member 'PoliticalFigure'.
shared/data-complete.ts(1,27): error TS2305: Module '"./schema"' has no exported member 'PoliticalParty'.
shared/data-complete.ts(1,43): error TS2305: Module '"./schema"' has no exported member 'QuizQuestion'.
shared/data.ts(1,10): error TS2305: Module '"./schema"' has no exported member 'PoliticalFigure'.
shared/data.ts(1,27): error TS2305: Module '"./schema"' has no exported member 'PoliticalParty'.
shared/data.ts(1,43): error TS2305: Module '"./schema"' has no exported member 'QuizQuestion'.

## Task 2

