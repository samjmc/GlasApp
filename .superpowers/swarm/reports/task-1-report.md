# Task 1 Report — shared types + server core (WAVE 0)

**Status:** DONE_WITH_CONCERNS
**Owned files:** 9 modified (8 server core + `shared/schema.ts`); `shared/data.ts` / `shared/data-complete.ts` unmodified (fixed by the schema exports).
**Owned-file errors:** 47 → 0
**Project-wide errors:** 2644 → 2589 (strict decrease of 55; 12 were the TS2305 cascade this task was chartered to fix, 5 belonged to this task's own files)
**Tests:** `npm run test` → 103 passed (5 files), no failures.

## What changed (per file)

### shared/schema.ts (ownership: `shared/**`)
Added the missing exports that unblock 12 TS2305 errors (6 in `shared/data*.ts`, 6 in client files owned by Tasks 14/18/19/21):
- `export type { QuizQuestion, UserResponse } from "./quizTypes";` — re-export so consumers can import them from `@shared/schema`.
- New `PoliticalFigure` interface: `{ id, name, economic, social, description, imageUrl, distance? }`. `distance?: number` is optional and matches how `client/src/contexts/QuizContext.tsx` spreads `...figure` and reads `figure.distance`.
- New `PoliticalParty` interface: `{ id, name, country, economic, social, description, color }`.
- Verified against every object literal in `shared/data.ts` / `shared/data-complete.ts` (all compile).

### server/api/researched-tds.ts
- TS18047 (`supabaseDb` possibly null, lines 17/94): added `if (!supabaseDb) return res.status(503).json(...)` guards in both handlers — same pattern already used by `server/routes/political/parties.ts`.
- TS18046 (`error` unknown, lines 83/125): narrowed with `error instanceof Error ? error.message : String(error)`.

### server/auth/supabaseAuth.ts
- TS2322 (lines 234/296): cast `metadata` (`unknown`) to `object | undefined` at the two Supabase call sites (`data`, `user_metadata`). Signature of the exported functions unchanged.

### server/db.ts
- TS2339 `pool.end`/`pool.query` on `never`: typed `pool` as `PoolType | null` (`import type { Pool as PoolType } from 'pg'`) with initializer `null as PoolType | null`. The `as PoolType | null` cast is required because TypeScript carries the `null` initializer narrowing forward for a `const`, which narrows `pool` to `null` (and thus `never` inside `if (pool)`) in this module. The cast is a type-level fix only — the pool is still `null` at runtime (SCRAM auth disabled, per the existing comment); no code path re-enables it.
- TS18046 (lines 152-153): narrowed `error` in `checkDatabaseConnection`'s catch via `error instanceof Error ? error.message : error` and an `'code' in error` in-check with a cast.

### server/index.ts
- TS18046 (line 128): `(error as { code?: string } | null)?.code === 'EADDRINUSE'` — optional chaining preserves the existing runtime check.

### server/middleware/regionMiddleware.ts
- TS2339 `user_metadata` on `{}` (lines 33-34): `req.user` resolves to `unknown`/`{}` via the `Express.Request.user` global; cast `req.user` to a local `{ user_metadata?: { region_code?: string } } | undefined` and read through a `userMetadata` local.
- TS2571 (line 49): added `regionConfig?: unknown` to the file's own `declare global Express.Request` augmentation and used `req.regionConfig = ...` instead of `(req as unknown).regionConfig = ...`.

### server/replitAuth.ts
- `sessionConfig: unknown` → `sessionConfig: SessionOptions` (`import type { SessionOptions } from "express-session"`). Verified `new pgStore(...)` (connect-pg-simple) is assignable to `SessionOptions['store']`.
- `updateUserSession(user: unknown, ...)` → `user: Express.User` (the file's own global `Express.User` augmentation already declares `claims/access_token/refresh_token/expires_at`).
- `upsertUser(claims: unknown)` → `claims: object | undefined`, with `const c = (claims ?? {}) as Record<string, unknown>` for the index accesses.
- GATE 3: `const user = req.user as Express.User;` (was `req.user as unknown`). `req.user` is globally typed `unknown` (from `server/auth/supabaseAuth.ts`), so the cast to the file's augmented `Express.User` restores `claims/expires_at/refresh_token` access.

### server/storage.ts
- TS18047 (`db` possibly null, 6 sites): added `if (!db) throw new Error('Database not initialized');` guards — matching the existing convention used by every other method in this class (`getUser`, `getBotUsers`, `create2FAToken`, etc.).
- TS2352 (line 100): `result as QuizResult` → `result as unknown as QuizResult` (the two shapes genuinely do not overlap; the `QuizResultInput`/`QuizResult` mismatch is intentional — stub path).
- TS2345 (line 181): `.set(data)` → `.set(data as unknown as Partial<typeof politicalEvolution.$inferInsert>)` — the input uses `number` for decimal columns while Drizzle's insert type uses `string`; cast is confined to this dead path (`db` is permanently null).

### server/vite.ts
- TS2322 (line 52): annotated `serverOptions: ServerOptions` (from `vite`) — the object-literal inference widened `allowedHosts: true` to `boolean`, which is not assignable to `ServerOptions['allowedHosts']` (`string[] | true`). The annotation restores the literal type.
- TS2339 (line 63): `let viteServer: ViteDevServer | null = null;` (was `unknown`).

## Verification run (sanity — independent verifier will re-run)
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T1.txt` → total `grep -cE "error TS"` = **2589** (baseline 2644, strictly decreasing).
- `grep -E "^(server/api/researched-tds.ts|server/auth/supabaseAuth.ts|server/db.ts|server/index.ts|server/middleware/regionMiddleware.ts|server/replitAuth.ts|server/storage.ts|server/vite.ts|shared/data-complete.ts|shared/data.ts)" /tmp/tsc-T1.txt | wc -l` = **0**.
- `npm run test` → **103 passed (103)** across 5 test files.
- `tsconfig.json` still has `"strict": true`.

Per-file before → after error counts (baseline `server/db.ts`/etc. verified against `/tmp/tsc-baseline-T1.txt`):
researched-tds.ts 4→0, supabaseAuth.ts 2→0, db.ts 5→0, index.ts 1→0, regionMiddleware.ts 3→0, replitAuth.ts 15→0, storage.ts 9→0, vite.ts 2→0, data-complete.ts 3→0, data.ts 3→0. (schema.ts had 0 baseline errors.)

## Deviations from the brief
1. **`researched-tds.ts` 503 guards** — adding `if (!supabaseDb) return 503` technically changes the edge-case response for a misconfigured env (previously the `null.from` TypeError was caught and returned as a 500 JSON). This matches the repo's existing route-handler convention (`server/routes/political/parties.ts`, `newsFeedRoutes`), is a plan-endorsed null-check fix, and the edge case is unreachable in any configured deployment. Flagging it because the plan says "do not change HTTP responses"; the alternative `supabaseDb!` was rejected as it would leave a runtime crash in that path.
2. **`db.ts` initializer cast** (`null as PoolType | null`) — required to defeat TypeScript's const-initializer narrowing (see above); runtime value is still `null`, pool still disabled. No `@ts-ignore` used; types are genuinely correct (`PoolType | null`).
3. **`shared/schema.ts` modified** though not in the 10-file list — the brief's boundaries explicitly grant `shared/**` to Task 1, and the exports were the entire point of the task.

## Concerns
- **`PoliticalEvolutionChart.tsx`** imports `PoliticalEvolutionRecord` from `@shared/schema` (TS2724). This is Task 20's baseline error and is **not** a TS2305/TS2339 cascade from this task, so I deliberately did not add that export (risk of conflicting with Task 20's ownership). Task 20 should fix/rename its import.
- **QuizContext.tsx** still has 2 TS2353 errors (object literal `{ economic, social, ... }` vs `QuizResult` = `typeof quizResults.$inferSelect`). Confirmed these are Task 21's baseline errors; I did not change `QuizResult` because it is consumed as the Drizzle row type by `server/storage.ts` and other server code.
- The client-side cascade was 6 errors (QuizContext 3, QuestionCard 1, QuizAssistant 1, SimilarFigures 1), not "13+ files" as the brief's preamble suggested; the remainder of the 13-TS2305 count included shared/data files (this task) and an unrelated cheerio error in `scripts/`. All 12 schema-export-related TS2305s are gone.