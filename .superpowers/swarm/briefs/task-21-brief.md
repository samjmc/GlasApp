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
