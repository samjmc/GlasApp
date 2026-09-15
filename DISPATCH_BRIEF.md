# Phase 4C — TypeScript Strict Mode Hardening

**Worktree:** `/private/tmp/glasapp-worktrees/phase-4c-typescript-strict`  
**Branch:** `feature/phase-4c-typescript-strict` (cut from `main`)  
**Task Slug:** `phase-4c-typescript-strict`  
**Status:** Research + Implementation required

## Context

GlasApp's TypeScript compiler is currently in a permissive mode (no `strict` flag, many `any` types allowed). This causes 2,644 baseline errors, many of which hide potential runtime bugs.

This phase enables TypeScript strict mode progressively, fixes the errors it reveals, and ships with stricter type safety as the new baseline. This is a large refactoring.

## Task: Progressive TypeScript Strict Mode Enablement

### 1. Audit: Current Compiler Config
- **Read `tsconfig.json`:**
  - Current flags enabled? (strict, strictNullChecks, strictFunctionTypes, noImplicitAny, etc.)
  - Target version? (ES2020? ES2023?)
  - Excluded paths? (node_modules, dist, etc.)
- **Baseline error count:**
  - Run `npm run check` today → record error count (expected: 2644)
  - Identify which error codes are most common (TS2339, TS2345, TS18046, etc.)

### 2. Enable Strict Mode Progressively
**Strategy:** Don't enable all flags at once (would create 5000+ errors immediately). Instead, enable gradually:

- **Step 1:** Enable `strict: true` in `tsconfig.json` → observe error count spike
- **Step 2:** Fix high-frequency error codes first:
  - `TS2339` (Property does not exist) — usually missing interface definitions
  - `TS2345` (Argument type mismatch) — usually `unknown`/`any` parameters
  - `TS18046` (Value is of type 'unknown') — replace `unknown` with proper types
  - `TS7006` (Parameter has an implicit 'any' type) — add parameter types
- **Step 3:** Work down by frequency until error count reaches a manageable target:
  - Commit after every 100-200 error fixes (keeps history clean)
  - Use `// @ts-ignore` sparingly only for genuinely incompatible legacy code
  - Prefer real type fixes over ignore comments

### 3. Implementation: Fix Errors
For each error, choose the right fix strategy:

- **Missing type definitions:**
  - Error: `TS2339: Property 'x' does not exist on type 'Y'`
  - Fix: Add the property to the interface/type definition
- **Function parameter types:**
  - Error: `TS7006: Parameter 'x' has an implicit 'any' type`
  - Fix: Add `: <type>` annotation to the parameter
- **Generic constraints:**
  - Error: `TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'`
  - Fix: Use generics properly or cast to the expected type (with `as` only when safe)
- **Null/undefined handling:**
  - Error: `TS18046: 'x' is of type 'unknown'` or `TS2531: Object is possibly 'null'`
  - Fix: Add proper null/undefined checks or use optional chaining (`?.`)
- **Union type narrowing:**
  - Error: Type mismatches with union types
  - Fix: Use type guards (`if (typeof x === '...')` or `x instanceof Y`)

### 4. Priority Areas (tackle in this order)
- **High impact (affects many files):**
  - `server/services/*.ts` — service layer has lots of `any` types
  - `server/routes/*.ts` — route handlers accept `req.body` (often untyped)
  - `client/src/contexts/*.ts` — React context often loses types
- **Medium impact:**
  - `client/src/pages/*.ts` — page components
  - `shared/*.ts` — shared types (fixing these helps everything else)
- **Lower priority:**
  - Test files (can use looser types)
  - Generated code (don't waste time on it)

### 5. Verification
- **Progressive error count reduction:**
  - Record error count after each major fix batch
  - Target: reduce to <1000 errors by end of phase
  - Ultimate goal: reduce to <500 errors (or full 0, but that's ambitious)
- **Test suite must pass:**
  - `npm run test` (if tests exist and run)
- **No regressions:**
  - Ensure existing functionality still works
  - TypeScript strict mode should only **catch** bugs, not introduce them
- **Coverage:**
  - Document which error codes were most common
  - Document fix strategy per error type
  - Show before/after error counts

## Files in Scope
- `tsconfig.json` — enable `strict: true`
- `client/src/**/*.ts` — client-side type fixes
- `server/**/*.ts` — server-side type fixes
- `shared/**/*.ts` — shared type definitions
- `docs/agent-reports/phase-4c-typescript-strict/` — REPORT.md, error fix log

## Do Not
- Refactor application logic (stay focused on types)
- Change runtime behavior (strict mode is a compile-time check)
- Add new dependencies just to fix types (be pragmatic)
- Break existing functionality while fixing types

## Acceptance Criteria
- ✅ `strict: true` enabled in tsconfig.json
- ✅ Error count reduced from 2644 → target (document target in report)
- ✅ All high-frequency error codes addressed (document strategy per type)
- ✅ No new runtime errors introduced (existing tests still pass)
- ✅ `npm run check` runs with fewer errors (document before/after counts)
- ✅ REPORT.md written: errors fixed, strategy per error type, before/after metrics

## Report Location
- **Path:** `docs/agent-reports/phase-4c-typescript-strict/REPORT.md`
- **Contents:** Config changes, error fixes by category, before/after error counts, test results, lessons learned

---

**Do this now. Enable strict mode, fix errors, reduce baseline, test, report. Ambitious but important. No approval needed.**
