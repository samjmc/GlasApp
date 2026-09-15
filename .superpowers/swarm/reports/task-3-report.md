# Task 3 Report — server/routes/parliamentary/** + parliamentaryActivityRoutes.ts

## Status: COMPLETE

## Error counts

| Scope | Before | After |
|---|---|---|
| Owned files (7) | 140 | **0** |
| Project total (`grep -cE "error TS"`) | 2589 | 2092 |

Project total 2092 < baseline 2589 (strictly decreasing). Note: other WAVE-1 tasks run
concurrently in this worktree, so the project-total delta (497) includes ~357 errors fixed by
other tasks; my owned-file contribution is exactly 140 → 0. `tsconfig.json` still has
`"strict": true` (line 9).

## Verification gates (run by me, re-runnable by verifier)

- Gate 1:
  - `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T3.txt; grep -cE "error TS" /tmp/tsc-T3.txt` → `2092`
  - `grep -E "^(server/routes/parliamentary/|server/routes/parliamentaryActivityRoutes\.ts)" /tmp/tsc-T3.txt | wc -l` → `0`
- Gate 2: `npm run test` → `Test Files 5 passed (5), Tests 103 passed (103)`
- Gate 3: `grep -n '"strict"' tsconfig.json` → `9:    "strict": true`

## Changes per file (all type-only, no runtime behavior change)

### server/routes/parliamentary/activity.ts (30 → 0)
- Added local interfaces `ParliamentaryActivityMember` and `PartyParliamentaryActivity`; typed the
  two JSON-loaded records as `Record<string, ...>` instead of `Record<string, any>`.
- Removed the `: unknown` annotations on all `.filter/.reduce/.map/.sort` callbacks so element
  inference flows from the typed array (the plan's documented strategy for TS18046).

### server/routes/parliamentaryActivityRoutes.ts (31 → 0)
- Identical treatment to activity.ts: same two local interfaces, records typed, `: unknown`
  annotations removed from callbacks.

### server/routes/parliamentary/constituencies.ts (3 → 0)
- TS18047: `supabaseDb` possibly null inside two `getCachedOrFetch` closures that sit behind the
  existing `if (!supabaseDb) return 503` guards — used `supabaseDb!` (narrowing is lost in the
  closure; the guard already guarantees non-null).
- TS2802: replaced `[...new Set(...)]` with `Array.from(new Set(...))` (target < es2015 spread of
  Set).

### server/routes/parliamentary/enhanced-profiles.ts (2 → 0)
- TS18046: committee-membership callback param `c: unknown` → `c: any` (untyped Supabase JSON
  array; `c.name || c` accepts string-or-object entries).
- TS2345: `femalePercentage` fallback `0` → `'0'` so the ternary is `string`, matching
  `parseFloat`. Numeric output identical (`parseFloat('0') === parseFloat(0) === 0`).

### server/routes/parliamentary/profiles.ts (2 → 0)
- Same two fixes as enhanced-profiles.ts (identical code).

### server/routes/parliamentary/voting.ts (17 → 0)
- TS18047 `supabase` possibly null (13 sites): `supabase!` — the alias is `supabaseDb` which is
  only null when env vars are missing (init-time); a `!` preserves the exact previous runtime
  behavior (TypeError → 500 via asyncHandler) where an added 503 guard would not.
- TS2339 `Property 'id' does not exist on type '{}'` on `req.user?.id` (4 sites): cast to
  `(req.user as { id?: string } | undefined)?.id` (same pattern Task 1 used in
  server/middleware/regionMiddleware.ts).

### server/routes/parliamentary/scores.ts (55 → 0)
- TS18047: `supabaseDb` in three closures (widget / td-scores) → `supabaseDb!` (guards already
  present at handler top); `db` in seven Drizzle/raw-SQL handlers → `db!` (pool is disabled,
  `db` is `null` at runtime — the `!` is a lie only if the DB were ever enabled; identical
  runtime to before).
- TS18046: removed `: unknown` from callback params over `any[]` rows (`change`, `td`, `score`)
  so inference flows from `any[]`.
- TS2551: `td.weekly_elo_change` not on local `UnifiedTDScore` interface (the raw `td_scores` DB
  row DOES have this column at runtime; the interface is missing it) → boundary cast
  `(td as { weekly_elo_change?: number }).weekly_elo_change || 0`. Runtime value unchanged.
- TS2351: `new DailyNewsScraperJob()` — `DailyNewsScraperJob` is exported as an OBJECT
  (`{ run, schedule, runManual, ... }`), not a constructor, and has no `execute()`. Cast to
  `new (DailyNewsScraperJob as unknown as new () => { execute: () => Promise<unknown> })()` to
  preserve the current runtime behavior (route 500s). See Concerns.
- TS7006: `.catch(error =>` resolved by the above cast (Promise `.catch` gives the param a
  contextual `any`); no code change needed.

## Deviations
- None from the task brief / boundaries. Only the 7 owned files were edited. No `shared/**`,
  tsconfig, package.json, or unowned-file changes.

## Concerns
1. **Pre-existing latent runtime bug (out of scope, not fixed):** `POST /scores/trigger-scrape`
   does `new DailyNewsScraperJob()` and `job.execute()`, but `server/jobs/dailyNewsScraper.ts`
   exports a plain object with no `execute`. This route always throws at runtime. I preserved the
   behavior exactly with a local cast rather than "fixing" it (would be a runtime change + a
   cross-file edit). Recommend a follow-up that wires it to `DailyNewsScraperJob.run()` /
   `runManual()` as `newsScraperRoutes.ts` does.
2. **`c: any` in enhanced-profiles.ts/profiles.ts:** the committee-membership entries are untyped
   Supabase JSON; `any` is the honest boundary type and avoids changing the `c.name || c`
   behavior (which can add a non-string object to a `Set<string>`). Acceptable per plan
   constraint #3 (untyped boundary).
3. **`supabaseDb!` / `db!`:** these rely on guards already present (closures) or on env/init
   state. They preserve runtime exactly; a future task could convert `db!` sites to real guards
   if the Drizzle pool is ever re-enabled.
4. Concurrent WAVE-1 tasks edited other files in this shared worktree; my report measures only my
   owned files for the before/after gate.