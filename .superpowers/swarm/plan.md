# Phase 4C — TypeScript Strict Mode Hardening (Swarm Plan)

## Context
GlasApp's tsconfig.json already has `"strict": true` (verified on `main`). The compiler therefore
reports 2,644 errors across ~211 files — mostly `TS18046` (value is of type `unknown`, 1481),
`TS2339` (property does not exist, 496), `TS18047` (possibly null, 198), `TS2322` (113),
`TS2345` (76), `TS2304` (60), `TS2571` (57), `TS7006` (32). This plan fixes those errors so the
project typechecks cleanly under strict mode. This is a type-only refactor: no runtime behavior
changes.

## Global Constraints (bind every task)
1. **Type-only changes.** Do not refactor application logic, reorder control flow, rename
   exports, change runtime behavior, or alter messages/HTTP responses.
2. **No new dependencies.** Do not add packages to package.json.
3. **Prefer real type fixes.** For each error, prefer proper types, interfaces, generics, type
   guards, and optional chaining. Use `as` casts only when the shape is genuinely untyped at the
   boundary (e.g. raw Supabase JSON, untyped `req.body`). Use `// @ts-ignore` ONLY as a last
   resort for genuinely incompatible legacy code, and never in shared types.
4. **Owned files only.** Edit ONLY files listed in your task's Owned Files. Do NOT touch
   `shared/**` or any file another task owns. If a fix requires a change in a file you do not
   own, use a local cast/guard in your own file instead and note it in your report.
5. **Keep exports compatible.** Do not change the signature/return type of any exported function,
   class, or constant that other files consume, unless the change is purely additive (widening a
   union, making a param optional). If you must narrow, verify callers in YOUR OWN files still
   compile.
6. **`strict` stays on.** Do not weaken tsconfig.json compiler options.
7. **No ts-ignore for the shared task** (Task 1) in shared types themselves.

## Fix strategy per error code (apply in order of frequency)
- **TS18046 / TS2571 (value is of type 'unknown')**: find where the `unknown` value originates
  (Supabase `.select()` rows, `req.body`, `JSON.parse`, `catch (e)` variables, callback params
  annotated `: unknown`). Fix the source type when it's in your file (e.g. type the Supabase row,
  the zod schema, the function return). Otherwise, at the usage site: narrow with a type guard
  (`if (typeof x === 'string')`, `x instanceof Error`), use optional chaining `?.`, or cast
  `x as ConcreteType`. Prefer removing a `: unknown` annotation so inference flows from the array
  element type.
- **TS2339 (Property does not exist)**: if the property belongs on a type you own, add it to the
  interface/type. Otherwise narrow/cast. For `Property 'x' does not exist on type '{}'` the value
  is an empty object literal type — type it explicitly or cast at the boundary.
- **TS18047 / TS18048 (possibly null/undefined)**: add a null check, use `?.` / `??`, or use `!`
  only when you've verified the value is set (e.g. after an early `if (!x) return`).
- **TS2322 / TS2345 (type mismatch / arg mismatch)**: annotate the target with the correct type,
  widen the source type (additive), or cast where safe.
- **TS2304 (Cannot find name)**: the name is genuinely missing — import it, define it locally, or
  fix the typo. Do not stub with `any` unless unavoidable.
- **TS7006 (parameter implicitly 'any')**: add the parameter type.
- **TS2305 / TS2802 / TS2769 / TS2353 / TS7053 / TS7017 / TS2367 / TS2352 / TS2638 / TS2551 /
  TS2722 / TS18048 / TS7015 / TS2786 / TS2741 / TS2604 / TS2739 / TS2724 / TS2614 / TS2559 /
  TS2554**: mechanical — align types with the declared interfaces, adjust overloads, fix index
  signatures, or cast at the untyped boundary.

## Verification (every task)
From repo root `/private/tmp/glasapp-worktrees/phase-4c-typescript-strict`:
- Gate 1: `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-$TASK.txt; grep -cE "error TS" /tmp/tsc-$TASK.txt` — total project error count must be LOWER than the pre-task baseline (recorded in the ledger), and errors in your OWNED files (grep the file paths) must be 0.
- Gate 2: `npm run test` — the 103 existing tests must still pass.
- Gate 3 (strict-mode sanity): confirm tsconfig.json still has `"strict": true`.
- Expected: your owned files show 0 errors after your fixes. Record the before/after count for
  your owned files.

## Task ownership (disjoint by construction — verified: no file belongs to two tasks)
- T1 (foundational, WAVE 0 — must complete before WAVE 1): shared types + server core.
- T2–T21 (WAVE 1, parallel): server routes/services/jobs/scripts, client pages/components/core.

## Commit strategy
Each implementer works on files only; the coordinator commits per task after verification and
review. Do NOT run `git commit` yourself.

## Task 1

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

### Task 2
**Owned files (1, 168 baseline errors):**
- server/routes/debatesRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T2.txt; grep -cE "error TS" /tmp/tsc-T2.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T2.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/debatesRoutes.ts(157,23): error TS2352: Conversion of type '{ td_id: any; performance_delta: any; effectiveness_delta: any; influence_delta: any; calculated_at: any; metadata: any; debate_sections: { title: any; }[]; debate_days: { date: any; chamber: any; title: any; }[]; }' to type 'DebateContributionRow' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
server/routes/debatesRoutes.ts(158,29): error TS2339: Property 'td_id' does not exist on type 'DebateContributionRow'.
server/routes/debatesRoutes.ts(199,49): error TS2769: No overload matches this call.
server/routes/debatesRoutes.ts(257,53): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(268,59): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(270,13): error TS2339: Property 'data' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(270,31): error TS2339: Property 'error' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(280,13): error TS2339: Property 'data' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(280,32): error TS2339: Property 'error' does not exist on type 'unknown'.
server/routes/debatesRoutes.ts(292,60): error TS18046: 'summary' is of type 'unknown'.
server/routes/debatesRoutes.ts(296,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(296,39): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(324,30): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(325,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(327,25): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(331,45): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(333,39): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(333,67): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(334,44): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(334,66): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(337,42): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(339,17): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(340,26): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(341,20): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(342,25): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(343,27): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(344,24): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(345,26): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(349,23): error TS18046: 'section' is of type 'unknown'.
server/routes/debatesRoutes.ts(353,48): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(363,13): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(364,15): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(365,18): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(366,16): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(367,20): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(368,22): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(369,23): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(370,22): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(371,25): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(371,43): error TS18046: 'day' is of type 'unknown'.
server/routes/debatesRoutes.ts(384,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(412,27): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/routes/debatesRoutes.ts(413,28): error TS2339: Property 'party' does not exist on type '{}'.
server/routes/debatesRoutes.ts(414,35): error TS2339: Property 'constituency' does not exist on type '{}'.
server/routes/debatesRoutes.ts(415,31): error TS2339: Property 'image_url' does not exist on type '{}'.
server/routes/debatesRoutes.ts(447,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(520,13): error TS2339: Property 'period_start' does not exist on type '{}'.
server/routes/debatesRoutes.ts(520,27): error TS2339: Property 'period_end' does not exist on type '{}'.
server/routes/debatesRoutes.ts(534,42): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(534,64): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(550,30): error TS2339: Property 'speeches' does not exist on type '{}'.
server/routes/debatesRoutes.ts(551,33): error TS2339: Property 'words_spoken' does not exist on type '{}'.
server/routes/debatesRoutes.ts(552,34): error TS2339: Property 'unique_topics' does not exist on type '{}'.
server/routes/debatesRoutes.ts(553,37): error TS2339: Property 'engagement_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(554,37): error TS2339: Property 'leadership_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(555,36): error TS2339: Property 'sentiment_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(556,40): error TS2339: Property 'effectiveness_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(557,36): error TS2339: Property 'influence_score' does not exist on type '{}'.
server/routes/debatesRoutes.ts(558,30): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(561,49): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(562,22): error TS2339: Property 'metadata' does not exist on type '{}'.
server/routes/debatesRoutes.ts(567,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(607,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(608,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(609,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(610,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(611,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(612,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(613,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(614,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(615,27): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(616,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(617,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(639,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(686,11): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(687,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(688,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(689,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(690,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(691,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(692,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(693,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(694,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(695,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(696,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(711,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(808,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(809,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(810,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(811,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(812,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(814,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(815,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(816,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(817,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(818,23): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(819,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(820,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(821,22): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(824,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(825,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(826,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(827,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(838,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(854,8): error TS2339: Property 'group' does not exist on type 'PostgrestFilterBuilder<any, any, any, ParserError<"Unexpected input: (*)">[], "debate_section_tasks", unknown, "GET">'.
server/routes/debatesRoutes.ts(866,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(966,25): error TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
server/routes/debatesRoutes.ts(1019,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1059,27): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1060,24): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1070,37): error TS2345: Argument of type 'string | number | true | JsonObject | JsonArray' is not assignable to parameter of type 'string'.
server/routes/debatesRoutes.ts(1080,11): error TS2322: Type 'string | number | true | JsonObject | JsonArray | null' is not assignable to type 'string | null'.
server/routes/debatesRoutes.ts(1113,41): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(1113,60): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(1130,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1198,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1241,73): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1249,61): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1253,11): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1254,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1255,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1256,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1257,14): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1258,24): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1259,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1260,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1261,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1262,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1263,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1264,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1265,27): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1266,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1267,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1282,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1315,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1372,60): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1448,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1449,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1450,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1451,20): error TS18046: 'contrib' is of type 'unknown'.
server/routes/debatesRoutes.ts(1462,73): error TS2339: Property 'confidence' does not exist on type '{}'.
server/routes/debatesRoutes.ts(1469,25): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1475,29): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1476,28): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1478,19): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1482,44): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1483,44): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1484,46): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1485,46): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1486,42): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1487,42): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1488,32): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1489,50): error TS18046: 'contribution' is of type 'unknown'.
server/routes/debatesRoutes.ts(1495,51): error TS18046: 'b' is of type 'unknown'.
server/routes/debatesRoutes.ts(1495,92): error TS18046: 'a' is of type 'unknown'.
server/routes/debatesRoutes.ts(1498,26): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1501,13): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1502,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1503,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1504,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1506,15): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1507,17): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1508,20): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1509,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1513,18): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1523,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1525,78): error TS18046: 'row' is of type 'unknown'.
server/routes/debatesRoutes.ts(1558,60): error TS2339: Property 'message' does not exist on type '{}'.

## Task 3

### Task 3
**Owned files (7, 140 baseline errors):**
- server/routes/parliamentary/activity.ts
- server/routes/parliamentary/constituencies.ts
- server/routes/parliamentary/enhanced-profiles.ts
- server/routes/parliamentary/profiles.ts
- server/routes/parliamentary/scores.ts
- server/routes/parliamentary/voting.ts
- server/routes/parliamentaryActivityRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T3.txt; grep -cE "error TS" /tmp/tsc-T3.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T3.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/parliamentary/activity.ts(131,29): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(131,45): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(142,87): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(143,88): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(144,93): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(152,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(152,37): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(156,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(156,43): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(174,13): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(175,23): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(176,29): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(177,23): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(178,24): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(199,85): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(202,63): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(205,63): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(210,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(210,37): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(214,6): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(214,43): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentary/activity.ts(305,34): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(305,59): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(306,40): error TS18046: 'b' is of type 'unknown'.
server/routes/parliamentary/activity.ts(306,66): error TS18046: 'a' is of type 'unknown'.
server/routes/parliamentary/activity.ts(309,13): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(310,18): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(311,14): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/activity.ts(312,19): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentary/constituencies.ts(26,51): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/constituencies.ts(153,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/constituencies.ts(163,34): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/routes/parliamentary/enhanced-profiles.ts(324,29): error TS18046: 'c' is of type 'unknown'.
server/routes/parliamentary/enhanced-profiles.ts(340,38): error TS2345: Argument of type 'string | 0' is not assignable to parameter of type 'string'.
server/routes/parliamentary/profiles.ts(288,27): error TS18046: 'c' is of type 'unknown'.
server/routes/parliamentary/profiles.ts(304,36): error TS2345: Argument of type 'string | 0' is not assignable to parameter of type 'string'.
server/routes/parliamentary/scores.ts(97,45): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(142,45): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(152,50): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(153,33): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(154,13): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(154,65): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(155,34): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(157,33): error TS18046: 'change' is of type 'unknown'.
server/routes/parliamentary/scores.ts(200,33): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(250,23): error TS2551: Property 'weekly_elo_change' does not exist on type 'UnifiedTDScore'. Did you mean 'weekly_change'?
server/routes/parliamentary/scores.ts(271,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/routes/parliamentary/scores.ts(317,19): error TS2351: This expression is not constructable.
server/routes/parliamentary/scores.ts(320,23): error TS7006: Parameter 'error' implicitly has an 'any' type.
server/routes/parliamentary/scores.ts(868,34): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(887,31): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(900,34): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(920,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(939,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(952,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(965,27): error TS18047: 'db' is possibly 'null'.
server/routes/parliamentary/scores.ts(1123,9): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1125,22): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1126,12): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1127,19): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1128,16): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1129,18): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1130,33): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1131,23): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1132,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1133,20): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1134,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1135,25): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1136,24): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1137,20): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1195,23): error TS18046: 'td' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1202,11): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1203,19): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1204,12): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1205,11): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1206,33): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1209,20): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1210,35): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1211,25): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1212,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1213,22): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1214,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1215,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1216,34): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1217,31): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1221,28): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1222,26): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1223,28): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1224,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1225,33): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1226,29): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1227,27): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1228,32): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/scores.ts(1231,24): error TS18046: 'score' is of type 'unknown'.
server/routes/parliamentary/voting.ts(35,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(56,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(69,52): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(84,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(98,43): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(114,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(123,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(140,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(156,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(177,64): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(199,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(230,28): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/parliamentary/voting.ts(251,55): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(262,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(273,20): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(352,51): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentary/voting.ts(366,40): error TS18047: 'supabase' is possibly 'null'.
server/routes/parliamentaryActivityRoutes.ts(151,31): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(151,47): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(163,89): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(164,90): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(165,95): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(173,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(173,39): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(177,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(177,45): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(197,17): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(198,27): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(199,33): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(200,27): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(201,28): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(228,87): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(231,65): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(234,65): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(239,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(239,39): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(243,8): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(243,45): error TS18046: 'top' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(353,36): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(353,61): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(354,42): error TS18046: 'b' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(354,68): error TS18046: 'a' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(357,15): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(358,20): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(359,16): error TS18046: 'member' is of type 'unknown'.
server/routes/parliamentaryActivityRoutes.ts(360,21): error TS18046: 'member' is of type 'unknown'.

## Task 4

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

### Task 5
**Owned files (6, 104 baseline errors):**
- server/routes/botRoutes.ts
- server/routes/chatRoutes.ts
- server/routes/debateMonitoringRoutes.ts
- server/routes/debateWorkspaceRoutes.ts
- server/routes/politicianChatRoutes.ts
- server/routes/shadowRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T5.txt; grep -cE "error TS" /tmp/tsc-T5.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T5.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/botRoutes.ts(14,3): error TS18046: 'next' is of type 'unknown'.
server/routes/botRoutes.ts(53,16): error TS18046: 'error' is of type 'unknown'.
server/routes/botRoutes.ts(89,16): error TS18046: 'error' is of type 'unknown'.
server/routes/chatRoutes.ts(89,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(89,36): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(90,28): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(90,47): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(93,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(95,28): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(95,47): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(98,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(100,24): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(101,27): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(102,32): error TS18046: 'msg' is of type 'unknown'.
server/routes/debateMonitoringRoutes.ts(115,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(18,13): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,20): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,41): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,68): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,88): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(22,27): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(23,25): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(27,13): error TS2339: Property 'party' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(27,47): error TS2339: Property 'party' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(28,13): error TS2339: Property 'topic' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(28,47): error TS2339: Property 'topic' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(29,13): error TS2339: Property 'chamber' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(29,51): error TS2339: Property 'chamber' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(62,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(63,33): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(63,55): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(66,14): error TS7006: Parameter 'a' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(66,17): error TS7006: Parameter 'b' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(68,13): error TS7006: Parameter 'entry' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(76,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(77,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(78,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(80,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(81,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(156,44): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(179,5): error TS2698: Spread types may only be created from object types.
server/routes/debateWorkspaceRoutes.ts(180,34): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(185,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(186,7): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(186,52): error TS18046: 'entry' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(192,40): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(192,73): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(194,26): error TS18046: 'activity' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(195,63): error TS18046: 'activity' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(219,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(253,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(287,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(309,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(332,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(422,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/politicianChatRoutes.ts(69,121): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(109,13): error TS2698: Spread types may only be created from object types.
server/routes/politicianChatRoutes.ts(137,79): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(137,94): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(140,33): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(147,62): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(170,30): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(171,38): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(172,36): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(177,30): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(189,25): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(189,43): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(190,25): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(190,43): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(196,35): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(197,41): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(207,27): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(207,49): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(208,40): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(211,22): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(212,29): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(222,116): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(239,22): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(239,40): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(240,17): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,43): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,76): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,98): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(525,11): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(527,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(527,47): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(530,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(533,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(539,21): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(539,52): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(540,19): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(540,48): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(556,16): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(558,28): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(572,79): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(575,16): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(576,17): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(577,26): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(577,79): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(578,25): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(578,113): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(579,25): error TS18046: 'p' is of type 'unknown'.
server/routes/shadowRoutes.ts(32,31): error TS18047: 'db' is possibly 'null'.
server/routes/shadowRoutes.ts(42,31): error TS18047: 'db' is possibly 'null'.

## Task 6

### Task 6
**Owned files (8, 83 baseline errors):**
- server/routes/accountRoutes.ts
- server/routes/activityRoutes.ts
- server/routes/auth.ts
- server/routes/authRoutes.ts
- server/routes/dailySessionRoutes.ts
- server/routes/electionRoutes.ts
- server/routes/regionRoutes.ts
- server/routes/session-auth/index.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T6.txt; grep -cE "error TS" /tmp/tsc-T6.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T6.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/accountRoutes.ts(40,17): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/accountRoutes.ts(40,33): error TS2339: Property 'user' does not exist on type '{}'.
server/routes/accountRoutes.ts(40,55): error TS2339: Property 'sub' does not exist on type '{}'.
server/routes/accountRoutes.ts(40,72): error TS2339: Property 'claims' does not exist on type '{}'.
server/routes/accountRoutes.ts(68,34): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/accountRoutes.ts(97,21): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/activityRoutes.ts(20,20): error TS2571: Object is of type 'unknown'.
server/routes/activityRoutes.ts(52,20): error TS2571: Object is of type 'unknown'.
server/routes/activityRoutes.ts(73,20): error TS2571: Object is of type 'unknown'.
server/routes/auth.ts(26,21): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/auth.ts(27,20): error TS2339: Property 'email' does not exist on type '{}'.
server/routes/authRoutes.ts(246,12): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(246,39): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(247,12): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(274,9): error TS18046: 'error' is of type 'unknown'.
server/routes/authRoutes.ts(275,26): error TS18046: 'error' is of type 'unknown'.
server/routes/authRoutes.ts(303,12): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(303,39): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(304,29): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(314,12): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.
server/routes/authRoutes.ts(326,9): error TS18046: 'error' is of type 'unknown'.
server/routes/authRoutes.ts(327,26): error TS18046: 'error' is of type 'unknown'.
server/routes/authRoutes.ts(350,31): error TS2571: Object is of type 'unknown'.
server/routes/authRoutes.ts(495,45): error TS2345: Argument of type '{ password: string; latitude: string | undefined; longitude: string | undefined; emailVerified: false; email?: string | null | undefined; username?: string | null | undefined; county?: string | ... 1 more ... | undefined; ... 10 more ...; updatedAt?: Date | ... 1 more ... | undefined; }' is not assignable to parameter of type '{ id: string; email?: string | null | undefined; password?: string | null | undefined; username?: string | null | undefined; county?: string | null | undefined; bio?: string | null | undefined; ... 13 more ...; updatedAt?: Date | ... 1 more ... | undefined; }'.
server/routes/authRoutes.ts(522,37): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
server/routes/authRoutes.ts(545,11): error TS18046: 'dbError' is of type 'unknown'.
server/routes/authRoutes.ts(546,13): error TS18046: 'dbError' is of type 'unknown'.
server/routes/authRoutes.ts(551,13): error TS18046: 'dbError' is of type 'unknown'.
server/routes/authRoutes.ts(602,60): error TS2769: No overload matches this call.
server/routes/authRoutes.ts(618,5): error TS2571: Object is of type 'unknown'.
server/routes/authRoutes.ts(667,40): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/routes/authRoutes.ts(711,28): error TS2367: This comparison appears to be unintentional because the types 'string' and 'number | undefined' have no overlap.
server/routes/authRoutes.ts(753,13): error TS2304: Cannot find name 'sendVerificationCode'.
server/routes/authRoutes.ts(798,40): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/routes/authRoutes.ts(806,54): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/routes/authRoutes.ts(840,40): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
server/routes/authRoutes.ts(862,30): error TS2304: Cannot find name 'sendVerificationCode'.
server/routes/authRoutes.ts(884,86): error TS2769: No overload matches this call.
server/routes/authRoutes.ts(944,38): error TS18047: 'verificationRecord.createdAt' is possibly 'null'.
server/routes/dailySessionRoutes.ts(36,12): error TS2339: Property 'user_metadata' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(36,42): error TS2339: Property 'app_metadata' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(38,12): error TS2339: Property 'user_metadata' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(39,12): error TS2339: Property 'app_metadata' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(47,43): error TS2722: Cannot invoke an object which is possibly 'undefined'.
server/routes/dailySessionRoutes.ts(47,57): error TS2349: This expression is not callable.
server/routes/dailySessionRoutes.ts(52,12): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(70,16): error TS18046: 'error' is of type 'unknown'.
server/routes/dailySessionRoutes.ts(100,14): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(116,18): error TS18046: 'error' is of type 'unknown'.
server/routes/dailySessionRoutes.ts(134,68): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/dailySessionRoutes.ts(144,16): error TS18046: 'error' is of type 'unknown'.
server/routes/dailySessionRoutes.ts(194,16): error TS18046: 'error' is of type 'unknown'.
server/routes/electionRoutes.ts(15,25): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(45,34): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(52,31): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(76,16): error TS18046: 'resultsByConstituency' is of type 'unknown'.
server/routes/electionRoutes.ts(77,13): error TS18046: 'resultsByConstituency' is of type 'unknown'.
server/routes/electionRoutes.ts(85,11): error TS18046: 'resultsByConstituency' is of type 'unknown'.
server/routes/electionRoutes.ts(104,41): error TS2769: No overload matches this call.
server/routes/electionRoutes.ts(139,30): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(149,34): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(159,27): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(172,8): error TS2339: Property 'where' does not exist on type 'Omit<PgSelectBase<"election_results", { resultId: PgColumn<{ name: "id"; tableName: "election_results"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 5 more ...; seats: PgColumn<...>; }, ... 5 more...'.
server/routes/electionRoutes.ts(175,38): error TS7006: Parameter 'result' implicitly has an 'any' type.
server/routes/electionRoutes.ts(221,30): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(231,27): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(241,27): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(253,8): error TS2339: Property 'where' does not exist on type 'Omit<PgSelectBase<"election_results", { resultId: PgColumn<{ name: "id"; tableName: "election_results"; dataType: "number"; columnType: "PgSerial"; data: number; driverParam: number; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 4 more ...; seats: PgColumn<...>; }, ... 5 more...'.
server/routes/electionRoutes.ts(257,40): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/routes/electionRoutes.ts(257,45): error TS7006: Parameter 'result' implicitly has an 'any' type.
server/routes/electionRoutes.ts(258,40): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/routes/electionRoutes.ts(258,45): error TS7006: Parameter 'result' implicitly has an 'any' type.
server/routes/electionRoutes.ts(260,25): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/routes/electionRoutes.ts(260,30): error TS7006: Parameter 'result' implicitly has an 'any' type.
server/routes/electionRoutes.ts(263,45): error TS7006: Parameter 'result' implicitly has an 'any' type.
server/routes/electionRoutes.ts(313,30): error TS18047: 'db' is possibly 'null'.
server/routes/electionRoutes.ts(323,32): error TS18047: 'db' is possibly 'null'.
server/routes/regionRoutes.ts(50,17): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/regionRoutes.ts(52,41): error TS2339: Property 'user_metadata' does not exist on type '{}'.
server/routes/regionRoutes.ts(53,41): error TS2339: Property 'id' does not exist on type '{}'.
server/routes/session-auth/index.ts(436,33): error TS2345: Argument of type 'string | null | undefined' is not assignable to parameter of type 'string'.
server/routes/session-auth/index.ts(671,99): error TS2345: Argument of type '(req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>' is not assignable to parameter of type 'AsyncRouteHandler'.
server/routes/session-auth/index.ts(777,15): error TS2339: Property 'id' does not exist on type '{}'.

## Task 7

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

### Task 9
**Owned files (4, 186 baseline errors):**
- server/services/aiNewsAnalysisService.ts
- server/services/newsToTDScoringService.ts
- server/services/oireachtasAPIService.ts
- server/services/outcomesTrackingService.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T9.txt; grep -cE "error TS" /tmp/tsc-T9.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T9.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/services/aiNewsAnalysisService.ts(105,75): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(105,99): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(134,12): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(135,14): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(136,13): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(137,11): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(377,3): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(378,18): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(379,27): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(380,7): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(380,81): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(381,15): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(382,13): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(383,20): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(384,14): error TS18046: 'partyPositions' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(386,40): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(386,76): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(389,8): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(529,28): error TS18047: 'supabaseDb' is possibly 'null'.
server/services/aiNewsAnalysisService.ts(572,30): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(573,33): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(574,30): error TS2571: Object is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(611,7): error TS2322: Type 'unknown' is not assignable to type '"none" | "moderate" | "major" | "minor"'.
server/services/aiNewsAnalysisService.ts(662,28): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(778,38): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(791,7): error TS2322: Type '{ critical_impact: number; downsides: string[]; reality_check: string; exaggeration_detected: boolean; } | null' is not assignable to type '{ critical_impact: number; downsides: string[]; reality_check: string; exaggeration_detected: boolean; } | undefined'.
server/services/aiNewsAnalysisService.ts(806,17): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(806,39): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(843,59): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(846,10): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(946,54): error TS2345: Argument of type 'unknown' is not assignable to parameter of type '{ name: string; constituency: string; party?: string | undefined; }'.
server/services/aiNewsAnalysisService.ts(950,46): error TS18046: 'politician' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(989,10): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(990,12): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(990,51): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,9): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,32): error TS18046: 'article' is of type 'unknown'.
server/services/aiNewsAnalysisService.ts(1078,51): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(94,57): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(134,13): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(182,13): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(223,68): error TS2339: Property 'url' does not exist on type '{ id: number; title: string; content: string; source?: string | undefined; published_date?: string | undefined; }'.
server/services/newsToTDScoringService.ts(229,21): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(250,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(322,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(322,40): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(333,32): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(359,30): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(381,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(382,14): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(383,16): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(384,15): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(399,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(400,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(401,12): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(402,14): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(405,5): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(412,11): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(413,23): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(414,15): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(422,9): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(425,19): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(446,11): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(449,21): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(471,9): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(473,18): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(474,20): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(475,19): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(476,27): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(476,61): error TS18046: 'article' is of type 'unknown'.
server/services/newsToTDScoringService.ts(509,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(510,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(511,5): error TS18046: 'updateData' is of type 'unknown'.
server/services/newsToTDScoringService.ts(514,9): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(560,33): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(580,41): error TS2802: Type 'Map<string, any[]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/newsToTDScoringService.ts(582,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(582,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(586,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(586,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(590,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(590,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(594,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(594,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(598,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(598,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(602,26): error TS7006: Parameter 'sum' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(602,31): error TS7006: Parameter 'td' implicitly has an 'any' type.
server/services/newsToTDScoringService.ts(606,37): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(615,45): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(635,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(640,15): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(660,42): error TS18047: 'supabase' is possibly 'null'.
server/services/newsToTDScoringService.ts(676,9): error TS2739: Type '{ totalArticles: number; importanceScored: number; selectedForScoring: number; skippedLowImportance: number; articlesProcessed: number; tdsUpdated: number; scoresChanged: number; errors: number; articlesFailed: never[]; }' is missing the following properties from type 'ProcessingStats': clustersFound, duplicatesRemoved, uniqueEventsToScore
server/services/oireachtasAPIService.ts(68,8): error TS18046: 'member' is of type 'unknown'.
server/services/oireachtasAPIService.ts(71,10): error TS18046: 'member' is of type 'unknown'.
server/services/oireachtasAPIService.ts(72,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(73,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(74,5): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(107,38): error TS2339: Property 'parties' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(110,45): error TS2339: Property 'represents' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(122,35): error TS2339: Property 'dateRange' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(123,33): error TS2339: Property 'dateRange' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(133,54): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(214,67): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(256,51): error TS18046: 'r' is of type 'unknown'.
server/services/oireachtasAPIService.ts(257,54): error TS18046: 'r' is of type 'unknown'.
server/services/oireachtasAPIService.ts(276,67): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(314,49): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(339,5): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(340,17): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(357,68): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(380,5): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(381,17): error TS18046: 'params' is of type 'unknown'.
server/services/oireachtasAPIService.ts(393,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(456,71): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(501,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(530,24): error TS2339: Property 'committees' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(532,25): error TS2339: Property 'committees' does not exist on type '{}'.
server/services/oireachtasAPIService.ts(533,29): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(535,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(536,18): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(537,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(538,13): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(539,15): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(541,16): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(542,14): error TS18046: 'c' is of type 'unknown'.
server/services/oireachtasAPIService.ts(580,11): error TS18046: 's' is of type 'unknown'.
server/services/oireachtasAPIService.ts(595,5): error TS2322: Type 'unknown[]' is not assignable to type '{ billNo: string; title: string; type: string; status: string; year: string; }[]'.
server/services/oireachtasAPIService.ts(598,63): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(649,61): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(755,70): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(813,50): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(949,66): error TS18046: 'error' is of type 'unknown'.
server/services/oireachtasAPIService.ts(959,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(960,21): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(961,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(967,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(968,22): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(969,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(975,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(976,24): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(977,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(999,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1000,20): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1001,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1006,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1007,21): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1008,7): error TS18046: 'm' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1013,7): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1014,23): error TS18046: 'division' is of type 'unknown'.
server/services/oireachtasAPIService.ts(1015,7): error TS18046: 'm' is of type 'unknown'.
server/services/outcomesTrackingService.ts(62,17): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(62,39): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(115,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(117,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(118,24): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(119,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(120,22): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(121,31): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(134,28): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(135,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(136,9): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(141,23): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(142,35): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(143,20): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(144,33): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(145,42): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(154,32): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(156,21): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(157,33): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(158,18): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(159,31): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(160,40): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(197,25): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(198,28): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(199,30): error TS18046: 'analysis' is of type 'unknown'.
server/services/outcomesTrackingService.ts(217,46): error TS18046: 'error' is of type 'unknown'.
server/services/outcomesTrackingService.ts(227,56): error TS18046: 'td' is of type 'unknown'.
server/services/outcomesTrackingService.ts(229,10): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(230,12): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(264,14): error TS18046: 'article' is of type 'unknown'.
server/services/outcomesTrackingService.ts(353,12): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(354,7): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(355,14): error TS18046: 'promise' is of type 'unknown'.
server/services/outcomesTrackingService.ts(356,11): error TS18046: 'promise' is of type 'unknown'.

## Task 10

### Task 10
**Owned files (6, 129 baseline errors):**
- server/services/dailySessionService.ts
- server/services/debateIdeologyAnalysisService.ts
- server/services/personalRankingsService.ts
- server/services/pledgeScoring.ts
- server/services/politicianAgent.ts
- server/services/quizResultsService.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T10.txt; grep -cE "error TS" /tmp/tsc-T10.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T10.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/services/dailySessionService.ts(648,15): error TS2339: Property 'setAuth' does not exist on type 'SupabaseAuthClient'.
server/services/dailySessionService.ts(809,29): error TS2339: Property 'immigration' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(810,28): error TS2339: Property 'healthcare' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(811,25): error TS2339: Property 'housing' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(812,25): error TS2339: Property 'economy' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(813,29): error TS2551: Property 'environment' does not exist on type 'UserIdeologyProfile'. Did you mean 'environmental'?
server/services/dailySessionService.ts(814,31): error TS2339: Property 'social_issues' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(815,25): error TS2339: Property 'justice' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(816,27): error TS2339: Property 'education' does not exist on type 'UserIdeologyProfile'.
server/services/dailySessionService.ts(851,36): error TS2802: Type 'MapIterator<[string, number]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/dailySessionService.ts(1164,36): error TS2802: Type 'MapIterator<["economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic", number]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/dailySessionService.ts(1165,19): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type 'Record<"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic", number>'.
server/services/dailySessionService.ts(1966,43): error TS2571: Object is of type 'unknown'.
server/services/dailySessionService.ts(1978,28): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2045,9): error TS2353: Object literal may only specify known properties, and 'imageUrl' does not exist in type 'DailySessionItem'.
server/services/dailySessionService.ts(2073,50): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2082,54): error TS18046: 'vote' is of type 'unknown'.
server/services/dailySessionService.ts(2324,7): error TS18046: 'votePayload' is of type 'unknown'.
server/services/dailySessionService.ts(2533,16): error TS2339: Property 'selected_option' does not exist on type '{}'.
server/services/dailySessionService.ts(2541,37): error TS2339: Property 'selected_option' does not exist on type '{}'.
server/services/dailySessionService.ts(2556,21): error TS2339: Property 'rating' does not exist on type '{}'.
server/services/dailySessionService.ts(2557,89): error TS2339: Property 'rating' does not exist on type '{}'.
server/services/dailySessionService.ts(2763,30): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(377,35): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(381,57): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(385,48): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(388,77): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(397,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(422,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(448,41): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(454,35): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(460,14): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(472,12): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(485,54): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/debateIdeologyAnalysisService.ts(524,61): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(564,59): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(966,30): error TS7053: Element implicitly has an 'any' type because expression of type '"economic" | "social" | "cultural" | "globalism" | "environmental" | "authority" | "welfare" | "technocratic"' can't be used to index type '{}'.
server/services/debateIdeologyAnalysisService.ts(1076,47): error TS18046: 's' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1081,56): error TS18046: 's' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1092,35): error TS18046: 'speech' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1097,50): error TS18046: 'speech' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1097,64): error TS18046: 'error' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1121,42): error TS18046: 'v' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1126,52): error TS18046: 'v' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1134,33): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1139,48): error TS18046: 'vote' is of type 'unknown'.
server/services/debateIdeologyAnalysisService.ts(1139,60): error TS18046: 'error' is of type 'unknown'.
server/services/personalRankingsService.ts(220,21): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(221,19): error TS2339: Property 'is_active' does not exist on type '{}'.
server/services/personalRankingsService.ts(236,20): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(237,33): error TS2339: Property 'politician_name' does not exist on type '{}'.
server/services/personalRankingsService.ts(640,15): error TS2339: Property 'personal_rank' does not exist on type '{ user_id: string; politician_name: string; ideology_match: number; policy_agreement: any; overall_compatibility: number; public_rank: number | null; policies_compared: any; last_calculated: string; }'.
server/services/personalRankingsService.ts(677,16): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(677,41): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(686,18): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(686,43): error TS2339: Property 'user_id' does not exist on type '{}'.
server/services/personalRankingsService.ts(708,75): error TS18046: 'error' is of type 'unknown'.
server/services/personalRankingsService.ts(792,24): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(793,22): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(794,24): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(795,25): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(796,29): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(797,25): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(798,23): error TS2571: Object is of type 'unknown'.
server/services/personalRankingsService.ts(799,28): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(36,35): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(56,25): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(73,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(103,39): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(104,41): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(111,7): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(111,37): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(113,40): error TS18046: 'pledge' is of type 'unknown'.
server/services/pledgeScoring.ts(142,36): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(143,41): error TS18046: 'action' is of type 'unknown'.
server/services/pledgeScoring.ts(149,34): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(150,33): error TS2571: Object is of type 'unknown'.
server/services/pledgeScoring.ts(167,25): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(188,30): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(228,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(239,9): error TS18047: 'db' is possibly 'null'.
server/services/pledgeScoring.ts(283,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(300,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(317,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(334,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(351,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(368,21): error TS18046: 'party' is of type 'unknown'.
server/services/pledgeScoring.ts(385,21): error TS18046: 'party' is of type 'unknown'.
server/services/politicianAgent.ts(45,30): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/services/politicianAgent.ts(45,53): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(49,42): error TS18047: 'supabaseDb' is possibly 'null'.
server/services/politicianAgent.ts(56,13): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(56,44): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(56,62): error TS18046: 'd' is of type 'unknown'.
server/services/politicianAgent.ts(62,11): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(63,14): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(64,34): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(65,11): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(66,14): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(67,21): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(68,15): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(69,18): error TS18046: 'v' is of type 'unknown'.
server/services/politicianAgent.ts(129,56): error TS18046: 'm' is of type 'unknown'.
server/services/quizResultsService.ts(43,13): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(50,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(51,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(52,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(53,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(54,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(55,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(56,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(57,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(58,7): error TS2322: Type 'number' is not assignable to type 'string'.
server/services/quizResultsService.ts(69,28): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(97,29): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(105,27): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(109,9): error TS2769: No overload matches this call.
server/services/quizResultsService.ts(120,12): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(123,14): error TS2769: No overload matches this call.
server/services/quizResultsService.ts(131,27): error TS18047: 'db' is possibly 'null'.
server/services/quizResultsService.ts(169,38): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(170,36): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(171,38): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(172,39): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(173,43): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(174,39): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(175,37): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(176,42): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'number | null'.
server/services/quizResultsService.ts(177,55): error TS2345: Argument of type 'Date | null' is not assignable to parameter of type 'Date'.

## Task 11

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

### Task 12
**Owned files (16, 178 baseline errors):**
- scripts/fetch-oireachtas-debate-week.ts
- server/jobs/articleTriageJob.ts
- server/jobs/dailyDebateUpdate.ts
- server/jobs/dailyIdeologySnapshot.ts
- server/jobs/dailyNewsScraper.ts
- server/jobs/dailyVoteFetcher.ts
- server/jobs/debateIdeologyProcessor.ts
- server/jobs/extractPoliticianStances.ts
- server/jobs/masterNewsUpdate.ts
- server/jobs/parliamentaryDataUpdateJob.ts
- server/jobs/processDebateEmbeddings.ts
- server/jobs/processDebateSummaries.ts
- server/jobs/promiseVerificationJob.ts
- server/jobs/reviewNegativeFeedback.ts
- server/jobs/unifiedScoreCalculationJob.ts
- server/jobs/updatePersonalRankingsFromExistingVotes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T12.txt; grep -cE "error TS" /tmp/tsc-T12.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T12.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
scripts/fetch-oireachtas-debate-week.ts(3,37): error TS2305: Module '"cheerio"' has no exported member 'Element'.
scripts/fetch-oireachtas-debate-week.ts(131,33): error TS2802: Type 'ArrayIterator<[number, unknown]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
scripts/fetch-oireachtas-debate-week.ts(241,33): error TS2802: Type 'ArrayIterator<[number, unknown]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
scripts/fetch-oireachtas-debate-week.ts(413,40): error TS2353: Object literal may only specify known properties, and 'decodeEntities' does not exist in type 'CheerioOptions'.
scripts/fetch-oireachtas-debate-week.ts(614,39): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(617,27): error TS2339: Property 'debateSection' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(736,24): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(736,54): error TS2339: Property 'contextDate' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(737,29): error TS2339: Property 'debateRecord' does not exist on type '{}'.
scripts/fetch-oireachtas-debate-week.ts(738,24): error TS2339: Property 'debateRecord' does not exist on type '{}'.
server/jobs/articleTriageJob.ts(75,45): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(173,44): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(244,44): error TS18047: 'supabase' is possibly 'null'.
server/jobs/articleTriageJob.ts(249,45): error TS18047: 'supabase' is possibly 'null'.
server/jobs/dailyDebateUpdate.ts(105,53): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyDebateUpdate.ts(191,54): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyIdeologySnapshot.ts(24,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyIdeologySnapshot.ts(25,19): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(101,84): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(147,39): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(204,56): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(329,28): error TS2339: Property 'role' does not exist on type '{ name: string; constituency: string; party: string; confidence: number; }'.
server/jobs/dailyNewsScraper.ts(356,25): error TS2551: Property 'published_at' does not exist on type 'ScrapedArticle'. Did you mean 'published_date'?
server/jobs/dailyNewsScraper.ts(375,39): error TS2551: Property 'published_at' does not exist on type 'ScrapedArticle'. Did you mean 'published_date'?
server/jobs/dailyNewsScraper.ts(398,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(399,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(414,9): error TS2353: Object literal may only specify known properties, and 'crossCheck' does not exist in type 'ProcessingOptions'.
server/jobs/dailyNewsScraper.ts(425,47): error TS18046: 'scoringError' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(426,40): error TS18046: 'scoringError' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(469,39): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(517,64): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(552,37): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(553,37): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(554,32): error TS2339: Property 'overall' does not exist on type '{}'.
server/jobs/dailyNewsScraper.ts(562,74): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(578,72): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(675,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(676,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(677,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(678,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(679,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(680,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(681,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(682,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(683,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(684,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(685,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(686,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(687,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(688,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(689,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(690,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(691,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(705,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(706,7): error TS18046: 'articleData' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(725,49): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(821,49): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(855,24): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(856,29): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(857,30): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(858,26): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(859,28): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(860,37): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(877,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(878,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(879,23): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(881,25): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(882,23): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(895,24): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(896,29): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(897,30): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(898,26): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(899,28): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(900,37): error TS18046: 'updatedScores' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(902,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(903,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(904,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(917,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(927,28): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(928,29): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(929,25): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(930,27): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(931,36): error TS18046: 'changes' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(986,44): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(988,75): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyNewsScraper.ts(990,54): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(154,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(263,78): error TS18046: 'error' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(305,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(312,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/dailyVoteFetcher.ts(319,7): error TS18046: 'm' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(78,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(105,64): error TS18046: 'error' is of type 'unknown'.
server/jobs/debateIdeologyProcessor.ts(168,60): error TS18046: 'error' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(78,37): error TS2802: Type 'ArrayIterator<[number, { id: any; politician_name: any; party: any; }]>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/extractPoliticianStances.ts(98,28): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(101,53): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(119,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(144,30): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(161,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(168,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(176,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(193,32): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(201,56): error TS18046: 't' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(201,65): error TS18046: 'v' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(210,60): error TS18046: 'a' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(210,89): error TS18046: 'b' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,52): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,67): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,85): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(211,117): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(214,65): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(214,96): error TS18046: 'politician' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(217,61): error TS2571: Object is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(217,88): error TS2571: Object is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(271,89): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(274,69): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(275,56): error TS18046: 'c' is of type 'unknown'.
server/jobs/extractPoliticianStances.ts(280,24): error TS18046: 'politician' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(87,41): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(88,43): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(102,9): error TS2353: Object literal may only specify known properties, and 'crossCheck' does not exist in type 'ProcessingOptions'.
server/jobs/masterNewsUpdate.ts(117,41): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(118,40): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(145,43): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(146,51): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(167,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(188,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(205,58): error TS18046: 'error' is of type 'unknown'.
server/jobs/masterNewsUpdate.ts(249,33): error TS18046: 'fatalError' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(129,52): error TS18046: 'error' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(147,33): error TS2802: Type 'Map<string, any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/parliamentaryDataUpdateJob.ts(177,68): error TS18046: 'error' is of type 'unknown'.
server/jobs/parliamentaryDataUpdateJob.ts(184,50): error TS18046: 'error' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(108,72): error TS18046: 'c' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(147,53): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(156,14): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(158,31): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(160,62): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(163,28): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(164,18): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(166,57): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(166,78): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(198,20): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(201,26): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(202,16): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(203,15): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(204,16): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(212,11): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(216,45): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(227,57): error TS18046: 'speech' is of type 'unknown'.
server/jobs/processDebateEmbeddings.ts(234,49): error TS18046: 'err' is of type 'unknown'.
server/jobs/processDebateSummaries.ts(130,53): error TS2339: Property 'message' does not exist on type '{}'.
server/jobs/processDebateSummaries.ts(457,88): error TS2339: Property 'message' does not exist on type '{}'.
server/jobs/promiseVerificationJob.ts(115,72): error TS18046: 'error' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(56,21): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(57,25): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(58,23): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(59,25): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(96,53): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(110,17): error TS18046: 'item' is of type 'unknown'.
server/jobs/reviewNegativeFeedback.ts(113,48): error TS18046: 'item' is of type 'unknown'.
server/jobs/unifiedScoreCalculationJob.ts(122,16): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(140,15): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(141,18): error TS2304: Cannot find name 'desc'.
server/jobs/unifiedScoreCalculationJob.ts(141,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(146,19): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(148,18): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(148,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(152,34): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/unifiedScoreCalculationJob.ts(161,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(163,20): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(163,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(168,27): error TS2802: Type 'Set<any>' can only be iterated through when using the '--downlevelIteration' flag or with a '--target' of 'es2015' or higher.
server/jobs/unifiedScoreCalculationJob.ts(177,21): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/unifiedScoreCalculationJob.ts(179,20): error TS2304: Cannot find name 'eq'.
server/jobs/unifiedScoreCalculationJob.ts(179,23): error TS2304: Cannot find name 'unifiedTDScores'.
server/jobs/updatePersonalRankingsFromExistingVotes.ts(15,35): error TS18047: 'supabaseDb' is possibly 'null'.

## Task 13

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

### Task 14
**Owned files (2, 164 baseline errors):**
- client/src/pages/TDProfilePage.tsx
- client/src/pages/TDProfilePageEnhanced.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T14.txt; grep -cE "error TS" /tmp/tsc-T14.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T14.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/TDProfilePage.tsx(148,9): error TS2698: Spread types may only be created from object types.
client/src/pages/TDProfilePage.tsx(149,17): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(309,27): error TS2304: Cannot find name 'colorClasses'.
client/src/pages/TDProfilePage.tsx(315,38): error TS2339: Property 'weight' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(315,76): error TS2339: Property 'weight' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(316,33): error TS2339: Property 'score' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(316,66): error TS2339: Property 'score' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(317,34): error TS2339: Property 'available' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(319,25): error TS2339: Property 'label' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(323,31): error TS2339: Property 'description' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(324,56): error TS2339: Property 'breakdown' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(324,79): error TS2339: Property 'breakdown' does not exist on type '{}'.
client/src/pages/TDProfilePage.tsx(502,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(503,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(504,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(589,27): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(598,28): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(600,26): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(602,30): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(606,58): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(608,43): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(609,28): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(615,35): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(615,71): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(617,39): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(617,75): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(622,34): error TS18046: 'article' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(760,19): error TS2322: Type '{ key: any; label: any; score: number | null; weight: string; color: string | number | symbol; description: any; breakdown: any; available: boolean; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(821,34): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(823,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(825,36): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(830,43): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(835,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(836,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(841,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(841,60): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(865,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(868,41): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(871,28): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(873,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(877,66): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(877,94): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(977,34): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(978,34): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(980,47): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(980,68): error TS18046: 'topic' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(993,34): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(994,34): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(995,94): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1024,43): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1028,34): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1049,35): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1049,56): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1051,37): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1052,37): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,24): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,69): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,126): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,182): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1055,239): error TS18046: 'entry' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1095,26): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1101,60): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1104,31): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1109,30): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1113,28): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,34): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,62): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1114,90): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1115,43): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1119,26): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1120,34): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1124,73): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1125,37): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1125,86): error TS2339: Property 'isLoading' does not exist on type 'UseMutationResult<any, Error, { id: string; status: string; }, unknown>'.
client/src/pages/TDProfilePage.tsx(1128,28): error TS18046: 'alert' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1237,19): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1245,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1253,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePage.tsx(1283,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,34): error TS2339: Property 'score' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,41): error TS2339: Property 'weight' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,49): error TS2339: Property 'color' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,56): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,69): error TS2339: Property 'breakdown' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1283,80): error TS2339: Property 'available' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1328,36): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1330,50): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1332,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1333,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1335,26): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1340,18): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1342,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,21): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,28): error TS2339: Property 'rank' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1360,34): error TS2339: Property 'total' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,20): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,26): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1374,33): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,21): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1386,34): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePage.tsx(1406,49): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePage.tsx(1410,22): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePageEnhanced.tsx(99,35): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(101,85): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(105,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(109,34): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(111,85): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(115,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(119,35): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(121,86): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(125,16): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(193,18): error TS2571: Object is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(326,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(327,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(328,25): error TS2322: Type '{ label: string; rank: any; total: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(336,24): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(338,17): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(343,17): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(518,19): error TS2322: Type '{ key: any; label: any; score: number | null; weight: string; color: string; description: any; breakdown: any; available: boolean; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(579,34): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(581,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(583,36): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(588,43): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(593,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(594,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(599,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(599,60): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(616,36): error TS2304: Cannot find name 'politicianName'.
client/src/pages/TDProfilePageEnhanced.tsx(623,32): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(626,41): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(629,28): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(631,33): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(635,66): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(635,94): error TS18046: 'vote' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(715,24): error TS18046: 'committee' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(739,19): error TS2322: Type '{ icon: Element; label: string; value: any; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(747,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(755,19): error TS2322: Type '{ icon: Element; label: string; value: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/TDProfilePageEnhanced.tsx(786,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,34): error TS2339: Property 'score' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,41): error TS2339: Property 'weight' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,49): error TS2339: Property 'color' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,56): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,69): error TS2339: Property 'breakdown' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(786,80): error TS2339: Property 'available' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(829,36): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(831,50): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(833,22): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(834,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(835,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(839,18): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(840,85): error TS18046: 'item' is of type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,21): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,28): error TS2339: Property 'rank' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(857,34): error TS2339: Property 'total' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,20): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,26): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(871,33): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,21): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,27): error TS2339: Property 'label' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(883,34): error TS2339: Property 'value' does not exist on type 'unknown'.
client/src/pages/TDProfilePageEnhanced.tsx(903,49): error TS18047: 'performanceScore' is possibly 'null'.
client/src/pages/TDProfilePageEnhanced.tsx(907,22): error TS18047: 'performanceScore' is possibly 'null'.

## Task 15

### Task 15
**Owned files (2, 133 baseline errors):**
- client/src/pages/EducationPage.tsx
- client/src/pages/PollingSystemInfo.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T15.txt; grep -cE "error TS" /tmp/tsc-T15.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T15.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/EducationPage.tsx(1088,80): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1330,13): error TS2322: Type '{ pledgesData: any; pledgesLoading: boolean; getScoreColor: (score: number) => "text-red-600" | "text-green-600" | "text-yellow-600"; getScoreBadge: (score: number) => "bg-red-100 text-red-800" | "bg-green-100 text-green-800" | "bg-yellow-100 text-yellow-800"; formatDate: (dateString: string) => string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/EducationPage.tsx(1587,33): error TS2339: Property 'pledgesData' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,46): error TS2339: Property 'pledgesLoading' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,62): error TS2339: Property 'getScoreColor' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,77): error TS2339: Property 'getScoreBadge' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,92): error TS2339: Property 'formatDate' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1611,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1639,65): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1648,28): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1649,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1788,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1807,65): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1817,26): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1818,27): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1879,35): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1880,68): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1882,41): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1884,28): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1886,32): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2134,59): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2136,76): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2137,81): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2138,38): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2307,106): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2307,167): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2315,17): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2430,61): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2433,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2437,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2446,125): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2448,57): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2454,69): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2522,61): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2525,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2529,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2538,123): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2540,57): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2546,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2616,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2620,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2624,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2633,124): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2641,68): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2711,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2715,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2719,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2728,126): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2736,70): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3233,35): error TS2339: Property 'success' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3233,63): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3241,25): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3246,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3250,56): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3251,58): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3251,71): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3256,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3259,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3334,63): error TS18046: 'b' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3334,80): error TS18046: 'a' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3338,38): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3340,65): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3344,99): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3345,74): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3347,84): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3383,72): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3383,97): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(3384,25): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(3385,62): error TS18046: 'b' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3385,96): error TS18046: 'a' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3389,36): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3391,63): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3395,97): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3396,72): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3398,83): error TS18046: 'party' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(199,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(205,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(211,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(217,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(229,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(235,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(241,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(399,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(412,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(427,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(468,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(474,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(480,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(486,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(506,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(518,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(530,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; estimatedTime: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(549,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(555,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(561,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(567,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(579,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(585,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(591,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(597,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(603,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(609,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(655,22): error TS2339: Property 'name' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,28): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,41): error TS2339: Property 'columns' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,50): error TS2339: Property 'status' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,30): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,37): error TS2339: Property 'recommended' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,50): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,63): error TS2339: Property 'pros' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,69): error TS2339: Property 'cons' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,75): error TS2339: Property 'example' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,25): error TS2339: Property 'page' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,31): error TS2339: Property 'component' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,42): error TS2339: Property 'priority' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,52): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,22): error TS2339: Property 'phase' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,29): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,36): error TS2339: Property 'status' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,44): error TS2339: Property 'items' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,51): error TS2339: Property 'estimatedTime' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(758,30): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(759,16): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(761,30): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(761,78): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,25): error TS2339: Property 'number' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,33): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,40): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,53): error TS2339: Property 'command' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,28): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,34): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,41): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,54): error TS2339: Property 'priority' does not exist on type 'unknown'.

## Task 16

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

### Task 18
**Owned files (4, 138 baseline errors):**
- client/src/components/EnhancedPoliticalProfileExplanation.tsx
- client/src/components/GlobalSearch.tsx
- client/src/components/LeafletIrelandMap.tsx
- client/src/components/OfficialElectoralMap.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T18.txt; grep -cE "error TS" /tmp/tsc-T18.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T18.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/components/EnhancedPoliticalProfileExplanation.tsx(63,85): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(66,28): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(79,9): error TS2304: Cannot find name 'setData'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(80,9): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(84,9): error TS2304: Cannot find name 'setIsError'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(85,9): error TS2304: Cannot find name 'setError'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(86,9): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(90,7): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(161,7): error TS2304: Cannot find name 'isLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(181,7): error TS2552: Cannot find name 'isError'. Did you mean 'Error'?
client/src/components/EnhancedPoliticalProfileExplanation.tsx(192,14): error TS2304: Cannot find name 'error'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(192,39): error TS2304: Cannot find name 'error'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(203,7): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(205,44): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,22): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,47): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,79): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,29): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,62): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,94): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(213,23): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(214,17): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(215,16): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(215,39): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(216,31): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(217,23): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(219,25): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(220,43): error TS7006: Parameter 's' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(220,65): error TS7006: Parameter 's' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(223,36): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(223,53): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(224,28): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(225,40): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(225,62): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(226,48): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(226,78): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(256,70): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(256,147): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(259,58): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(259,145): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(592,36): error TS7006: Parameter 'tension' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(592,45): error TS7006: Parameter 'index' implicitly has an 'any' type.
client/src/components/GlobalSearch.tsx(115,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(116,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(117,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(123,37): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(129,19): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(129,54): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(213,54): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(216,57): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(220,47): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(362,28): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(362,40): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(364,70): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(376,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(379,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(379,72): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(384,26): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(384,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(398,28): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(401,56): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(414,44): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(417,30): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(434,30): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(438,31): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(452,46): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(455,33): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(455,57): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(36,111): error TS2345: Argument of type '{}' is not assignable to parameter of type '"all" | "constituencies" | "provinces" | "electoral" | "cities" | (() => "all" | "constituencies" | "provinces" | "electoral" | "cities")'.
client/src/components/LeafletIrelandMap.tsx(272,16): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(280,27): error TS2345: Argument of type 'HTMLDivElement | null' is not assignable to parameter of type 'string | HTMLElement'.
client/src/components/LeafletIrelandMap.tsx(363,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'GeoJsonObject | GeoJsonObject[] | null | undefined'.
client/src/components/LeafletIrelandMap.tsx(407,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'GeoJsonObject | GeoJsonObject[] | null | undefined'.
client/src/components/LeafletIrelandMap.tsx(495,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(496,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(497,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(498,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(499,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(511,26): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(514,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(515,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(516,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(517,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(526,17): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(527,27): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(528,28): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(529,30): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(574,26): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<"all" | "constituencies" | "provinces" | "electoral" | "cities">'.
client/src/components/OfficialElectoralMap.tsx(62,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(63,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(64,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(73,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(73,44): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(75,22): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(76,25): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(79,31): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(79,55): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(81,22): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(82,27): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(82,36): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(93,51): error TS2339: Property 'tdCount' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(164,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(165,21): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(231,26): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(231,46): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(232,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(233,27): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(236,33): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(236,57): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(237,24): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(238,29): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(238,38): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(270,52): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(273,36): error TS2339: Property 'averageScore' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(279,42): error TS2339: Property 'genderBreakdown' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(316,26): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(316,46): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(317,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(318,27): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(319,26): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(329,33): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(329,57): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(330,24): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(331,44): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(332,32): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(336,32): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(578,13): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(578,30): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(579,36): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(580,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(581,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(582,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(587,15): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(588,13): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(594,25): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(595,29): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(596,15): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(597,13): error TS18046: 'layer' is of type 'unknown'.

## Task 19

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

### Task 21
**Owned files (13, 45 baseline errors):**
- client/src/App.tsx
- client/src/contexts/AuthContext.tsx
- client/src/contexts/QuizContext.tsx
- client/src/contexts/RegionContext.tsx
- client/src/helpers/processOfficialBoundaries.ts
- client/src/hooks/use-location.tsx
- client/src/hooks/useActivityTracker.tsx
- client/src/hooks/useDailySession.ts
- client/src/hooks/useOnboarding.ts
- client/src/hooks/usePWA.ts
- client/src/lib/supabase.ts
- client/src/pwa.ts
- client/src/services/apiConfig.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T21.txt; grep -cE "error TS" /tmp/tsc-T21.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T21.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/App.tsx(82,19): error TS2339: Property 'status' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/App.tsx(83,20): error TS2339: Property 'items' does not exist on type 'NonNullable<NoInfer<TQueryFnData>>'.
client/src/contexts/AuthContext.tsx(169,56): error TS2339: Property 'error' does not exist on type '{}'.
client/src/contexts/QuizContext.tsx(2,10): error TS2305: Module '"@shared/schema"' has no exported member 'PoliticalFigure'.
client/src/contexts/QuizContext.tsx(2,39): error TS2305: Module '"@shared/schema"' has no exported member 'UserResponse'.
client/src/contexts/QuizContext.tsx(2,53): error TS2305: Module '"@shared/schema"' has no exported member 'QuizQuestion'.
client/src/contexts/QuizContext.tsx(220,7): error TS2353: Object literal may only specify known properties, and 'economic' does not exist in type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/contexts/QuizContext.tsx(275,9): error TS2353: Object literal may only specify known properties, and 'economic' does not exist in type '{ id: number; description: string | null; ideology: string | null; createdAt: Date | null; userId: string | null; economicScore: string | null; socialScore: string | null; ... 12 more ...; irishContextInsights: string | null; }'.
client/src/contexts/RegionContext.tsx(92,30): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'URL | RequestInfo'.
client/src/contexts/RegionContext.tsx(104,32): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'URL | RequestInfo'.
client/src/contexts/RegionContext.tsx(131,30): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'URL | RequestInfo'.
client/src/contexts/RegionContext.tsx(134,30): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'URL | RequestInfo'.
client/src/helpers/processOfficialBoundaries.ts(17,24): error TS2571: Object is of type 'unknown'.
client/src/helpers/processOfficialBoundaries.ts(52,23): error TS2339: Property 'coordinates' does not exist on type '{ type: "Point"; coordinates: Position; bbox?: BBox | undefined; } | { type: "MultiPoint"; coordinates: Position[]; bbox?: BBox | undefined; } | { type: "LineString"; coordinates: Position[]; bbox?: BBox | undefined; } | { ...; } | { ...; } | { ...; } | { ...; }'.
client/src/helpers/processOfficialBoundaries.ts(55,23): error TS2339: Property 'coordinates' does not exist on type '{ type: "Point"; coordinates: Position; bbox?: BBox | undefined; } | { type: "MultiPoint"; coordinates: Position[]; bbox?: BBox | undefined; } | { type: "LineString"; coordinates: Position[]; bbox?: BBox | undefined; } | { ...; } | { ...; } | { ...; } | { ...; }'.
client/src/helpers/processOfficialBoundaries.ts(58,23): error TS2339: Property 'coordinates' does not exist on type '{ type: "Point"; coordinates: Position; bbox?: BBox | undefined; } | { type: "MultiPoint"; coordinates: Position[]; bbox?: BBox | undefined; } | { type: "LineString"; coordinates: Position[]; bbox?: BBox | undefined; } | { ...; } | { ...; } | { ...; } | { ...; }'.
client/src/helpers/processOfficialBoundaries.ts(63,23): error TS2339: Property 'coordinates' does not exist on type '{ type: "Point"; coordinates: Position; bbox?: BBox | undefined; } | { type: "MultiPoint"; coordinates: Position[]; bbox?: BBox | undefined; } | { type: "LineString"; coordinates: Position[]; bbox?: BBox | undefined; } | { ...; } | { ...; } | { ...; } | { ...; }'.
client/src/helpers/processOfficialBoundaries.ts(86,44): error TS2339: Property 'features' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(86,87): error TS2339: Property 'features' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(98,45): error TS2339: Property 'features' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(99,30): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(99,53): error TS2339: Property 'geometry' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(102,33): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(103,31): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(115,41): error TS2339: Property 'geometry' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(120,21): error TS2339: Property 'id' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(120,35): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(121,29): error TS2339: Property 'properties' does not exist on type '{}'.
client/src/helpers/processOfficialBoundaries.ts(135,3): error TS2322: Type '{ type: string; features: Feature<Geometry, GeoJsonProperties>[]; }' is not assignable to type 'FeatureCollection<Geometry, GeoJsonProperties>'.
client/src/helpers/processOfficialBoundaries.ts(139,3): error TS2322: Type '{ type: string; features: Feature<Geometry, GeoJsonProperties>[]; }' is not assignable to type 'FeatureCollection<Geometry, GeoJsonProperties>'.
client/src/hooks/use-location.tsx(113,11): error TS18046: 'err' is of type 'unknown'.
client/src/hooks/use-location.tsx(115,18): error TS18046: 'err' is of type 'unknown'.
client/src/hooks/use-location.tsx(117,18): error TS18046: 'err' is of type 'unknown'.
client/src/hooks/useActivityTracker.tsx(81,7): error TS2322: Type 'unknown' is not assignable to type '{ latitude: number; longitude: number; county?: string | undefined; } | undefined'.
client/src/hooks/useDailySession.ts(18,5): error TS2769: No overload matches this call.
client/src/hooks/useOnboarding.ts(72,9): error TS2322: Type 'boolean | null' is not assignable to type 'boolean'.
client/src/hooks/usePWA.ts(26,24): error TS2571: Object is of type 'unknown'.
client/src/hooks/usePWA.ts(44,7): error TS18046: 'e' is of type 'unknown'.
client/src/hooks/usePWA.ts(80,20): error TS2339: Property 'prompt' does not exist on type '{}'.
client/src/hooks/usePWA.ts(81,46): error TS2339: Property 'userChoice' does not exist on type '{}'.
client/src/lib/supabase.ts(136,7): error TS2322: Type 'unknown' is not assignable to type 'object | undefined'.
client/src/pwa.ts(115,22): error TS2339: Property 'prompt' does not exist on type '{}'.
client/src/pwa.ts(116,48): error TS2339: Property 'userChoice' does not exist on type '{}'.
client/src/pwa.ts(166,10): error TS2571: Object is of type 'unknown'.
client/src/services/apiConfig.ts(6,12): error TS2571: Object is of type 'unknown'.


## Task 1 — shared types (foundational, WAVE 0)

Note: `shared/schema.ts` is missing exports that consumers import:
- `QuizQuestion`, `UserResponse` exist in `shared/quizTypes.ts` — re-export them from
  `shared/schema.ts` (or add type aliases) so `@shared/schema` resolves them.
- `PoliticalFigure`, `PoliticalParty` do not exist anywhere. Define them in `shared/schema.ts`
  (or `shared/types.ts` and re-export) matching the shapes used in `shared/data.ts`:
  - PoliticalFigure: `{ id: string; name: string; economic: number; social: number; description: string; imageUrl?: string }`
  - PoliticalParty: `{ id: string; name: string; country: string; economic: number; social: number; description: string; color?: string }`
  - Verify against the actual data objects in `shared/data.ts` (politicalFigures, politicalParties)
    and consumers (`client/src/components/SimilarFigures.tsx`, `CompassChart.tsx`,
    `client/src/contexts/QuizContext.tsx`).
- `server/db.ts`: `pool` and `db` are typed `null`; `pool.end()`, `pool.query()` and
  `version.split` errors (TS2339 on `never`). Since pool is permanently disabled, fix types so
  the error lines compile (e.g. narrow the dead branch, or cast `result.rows[0]`). Do NOT
  re-enable the pool at runtime.
- `server/storage.ts`: `db` possibly null (TS18047) — the code already guards; adjust the type
  flow (e.g. `db!` where the guard proves non-null, or local typed helpers).
- `server/middleware/regionMiddleware.ts`: `req.user` typed `{}` — add a typed interface for the
  authenticated user shape used here (id, user_metadata) OR widen the request type in your own
  files only.
- `server/replitAuth.ts`, `server/vite.ts`, `server/api/researched-tds.ts`, `server/index.ts`,
  `server/auth/supabaseAuth.ts`: fix `unknown`/null/type-mismatch errors per the global strategy.

Boundaries for Task 1: you own `shared/**`, `server/db.ts`, `server/storage.ts`,
`server/index.ts`, `server/api/**`, `server/middleware/**`, `server/auth/**`,
`server/replitAuth.ts`, `server/vite.ts`. Do NOT edit any `server/routes/**`, `server/services/**`,
`server/jobs/**`, `server/scripts/**`, `client/**` file, or tsconfig.json. If a client file needs a
type you define, just make the export available from `@shared/schema`/`shared`; client tasks will
import it.
