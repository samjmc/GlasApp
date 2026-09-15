# Task 1 — Spec + Quality Review

**Reviewer:** task reviewer (independent of implementer and verifier)
**Artifacts read:** `briefs/task-1-brief.md`, `diffs/task-1.diff`, `reports/task-1-report.md`, `evidence/task-1-evidence.md`, `plan.md` (Task 1 section + Global Constraints), and the live files.
**Verifier result (not re-run):** all gates PASS — owned-file errors 0, project 2644→2589, 103/103 tests, `strict` on.

## Verdict

- **SPEC: PASS** — `PoliticalFigure`, `PoliticalParty`, `QuizQuestion`, `UserResponse` are exported from `@shared/schema` and match the shapes consumers use; all data conforms; `distance` is genuinely used and additive.
- **QUALITY: APPROVED** — type-only changes, no `@ts-ignore` in `shared/`, no out-of-scope files, no tsconfig change. The implementer-flagged deviations are acceptable per plan/convention (details below).

---

## Scope / ownership (review item 4)

PASS. The diff touches exactly:
`server/api/researched-tds.ts`, `server/auth/supabaseAuth.ts`, `server/db.ts`, `server/index.ts`, `server/middleware/regionMiddleware.ts`, `server/replitAuth.ts`, `server/storage.ts`, `server/vite.ts`, `shared/schema.ts`.

- `server/routes/**`, `server/services/**`, `server/jobs/**`, `server/scripts/**`, `client/**`: **not touched** (diff header + evidence §Gate 5).
- `shared/schema.ts` is outside the brief's 10-file list but inside Task 1 ownership per `plan.md:3494` ("you own `shared/**`") and the review charter. The brief's "do NOT touch `shared/**`" line is superseded by its own parenthetical "(Task 1 owns it)".
- `shared/data.ts` / `shared/data-complete.ts` were listed as owned but needed no edit — the TS2305s were resolved by exporting from `shared/schema.ts` (`diffs/task-1.diff:317-341`). Correct.
- No `ts-ignore`/`ts-expect-error`/`ts-nocheck` anywhere in `shared/` or the changed server files (verified by sweep). `tsconfig.json` unchanged (`strict` stays on).

## Spec compliance (review item 1)

### Exports
`shared/schema.ts:6-30` adds `export type { QuizQuestion, UserResponse } from "./quizTypes"` plus `PoliticalFigure` and `PoliticalParty`. Both source types exist in `shared/quizTypes.ts:40,49`. Consumers now resolve: `shared/data.ts:1`, `shared/data-complete.ts:1`, `client/src/components/SimilarFigures.tsx:2`, `client/src/contexts/QuizContext.tsx:2`. PASS.

### Data conformance
- `PoliticalFigure.imageUrl` (required): all 45 figure literals in `shared/data.ts` carry `imageUrl` (45/45); all 45 in `shared/data-complete.ts` (45/45). PASS.
- `PoliticalParty.color` (required): all 48 party literals in `shared/data.ts` carry `color` (48/48); all 46 in `shared/data-complete.ts` (46/46). PASS.
- `CompassChart.tsx:3-10` keeps a **local** interface with `imageUrl?: string`; it does not import the shared type, so required `imageUrl` cannot break it (required→optional is assignable anyway).
- `SimilarFigures.tsx:35` uses `figure.imageUrl` as an `<img src>`; required is fine.

### `distance`
Used, not dead:
- `client/src/components/SimilarFigures.tsx:50-52` reads `figure.distance`.
- `client/src/contexts/QuizContext.tsx:34` adds `distance` when spreading, and reads it at `:38, :72, :85`.

Adding optional `distance?: number` is purely additive (Global Constraint 5), compiles, and changes no runtime behavior. It does not break anything (structural/optional). PASS.

### Nothing extra
Two deviations from the plan's literal type spec (`plan.md:3477-3478`), both non-breaking — see Minor findings M1–M3.

## Code quality (review item 2)

- Casts are confined to untyped boundaries / dead paths; all are type-only (erased at runtime). No `as any`.
- `server/db.ts:21` `null as PoolType | null`: `as` is erased, so `pool` is still `null`; `db = pool ? … : null` (`db.ts:34`) is unchanged. Evidence §Concern 2 independently confirms.
- `server/replitAuth.ts` signature changes are on **non-exported** helpers (`updateUserSession:87`, `upsertUser:97`); exported `getSession`/`isAuthenticated` signatures unchanged. No cross-module break.
- `server/vite.ts:28` `viteServer` is module-local; widening `unknown`→`ViteDevServer | null` is additive.
- `server/db.ts` `pool` widening to `PoolType | null` is consumed by `server/middleware/sessionMiddleware.ts:8` (`pool ? …`); widening is additive and that file compiles (owned-file gate 0).
- `server/index.ts:128` `(error as { code?: string } | null)?.code` preserves the original runtime check (error-event args are never null).
- `server/api/researched-tds.ts:89,137` narrowing is safe at runtime: this supabase-js version's `PostgrestError extends Error` (`node_modules/@supabase/postgrest-js/dist/cjs/PostgrestError.js`), so `error instanceof Error` is true for query errors and `.message` is preserved.
- No dead code introduced: `regionConfig` is written where it already was (`regionMiddleware.ts:52`); the augmentation merely types the pre-existing assignment.

## Findings

### Critical
None.

### Important
None.

### Minor

**M1 — `imageUrl` made required, plan specified optional.** `shared/schema.ts:17` declares `imageUrl: string`; `plan.md:3477` specified `imageUrl?: string`. Non-breaking: every figure literal provides it (45/45 in both data files) and no consumer constructs a `PoliticalFigure` without it. Stricter than spec, arguably safer. (review item 1)

**M2 — `color` made required, plan specified optional.** `shared/schema.ts:29` declares `color: string`; `plan.md:3478` specified `color?: string`. Non-breaking: all 48/46 party literals provide it and no consumer constructs a `PoliticalParty` without it. (review item 1)

**M3 — `distance?: number` added beyond the plan's shape.** `shared/schema.ts:18`; `plan.md:3477` lists no `distance`. Justified: `SimilarFigures.tsx:50` and `QuizContext.tsx:34,72,85` read it, and it fixes those cascades. Additive/optional per Global Constraint 5, but it conflates the static data entity with a computed similarity result — a design choice the plan deliberately kept out. Acceptable as-is. (review item 1, "nothing extra")

**M4 — `researched-tds.ts` 503 guards change an edge-case response (500→503).** `diffs/task-1.diff:9-14,31-36` → `researched-tds.ts:17-22,100-105`. Judgement: **acceptable, not a Critical violation.** In the unconfigured-env path (`supabaseDb === null`) the previous behavior was a thrown `TypeError` caught by the same handler → 500; now it returns 503 with the file's own `{success:false,error}` shape. This exact 503 + "Database connection not available" pattern is the established repo convention (`server/routes/political/parties.ts:251-255` and many others), the path is unreachable in any configured deployment, and it is a plan-endorsed null-check fix. Documented in `reports/task-1-report.md:61`. (review item 3)

**M5 — `storage.ts` null guards alter the dead-path error type.** `diffs/task-1.diff:218,235,243,251,263,271,279` → `server/storage.ts:68,153,167,182,197,218,244`. Since `db` is permanently `null` (pool disabled, `db.ts:21,34`), every `DatabaseStorage` method already threw; the guard changes the thrown value from a `TypeError` to `Error('Database not initialized')`. This matches the class's own pre-existing convention (`storage.ts:62` `getUser` already had the guard; many later methods too) and the plan's "adjust the type flow" instruction (`plan.md:3486-3487`). Type-only in effect. (review item 3)

**M6 — double casts / redundant cast (type-only).** `server/storage.ts:101` `result as unknown as QuizResult` and `:182` `data as unknown as Partial<typeof politicalEvolution.$inferInsert>`; `server/db.ts:21` `null as PoolType | null`. All are compile-time-only, sit in stub/permanently-dead paths, and comply with Global Constraint 3 (no `as any`, no `@ts-ignore`). The `db.ts:21` cast is required to defeat const-initializer narrowing of `pool` to `null`; `db` still evaluates to `null` at runtime. Acceptable, stylistically noisy. (review items 2–3)

## Global Constraints check

| # | Constraint | Result |
|---|------------|--------|
| 1 | Type-only, no logic/flow/export/message changes | PASS with the two documented exceptions (M4 503 edge, M5 dead-path throw) — judged acceptable, not Critical |
| 2 | No new dependencies | PASS — only `import type` additions from existing packages (`pg`, `express-session`, `vite`) |
| 3 | Prefer real fixes; `as` only at boundaries; `@ts-ignore` last resort | PASS — all casts at boundaries/stub paths; no `@ts-ignore` |
| 4 | Edit only owned files | PASS — 9 files, all within `shared/**` + owned server files |
| 5 | Keep exports compatible | PASS — only additive widening (`pool`, `Express.Request.regionConfig`) and non-exported helper signatures |
| 6 | `strict` stays on | PASS — `tsconfig.json` unchanged |
| 7 | No `ts-ignore` in shared types | PASS — sweep clean |

## Non-issues explicitly checked

- `regionConfig` is written but never read anywhere (grep: no consumers) — **pre-existing**, not introduced.
- Report inconsistency (`reports/task-1-report.md:67` says 2 TS2353 in QuizContext, `:44` says 3) is documentation-only; those are Task 21's errors and correctly left untouched.
- `PoliticalEvolutionRecord` (Task 20) and `QuizResult` shape errors (Task 21) correctly **not** touched — no cross-task scope creep.
