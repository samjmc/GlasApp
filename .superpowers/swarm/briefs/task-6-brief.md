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

