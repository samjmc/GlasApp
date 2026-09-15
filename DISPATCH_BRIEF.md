# Phase 4B — Row-Level Security (RLS) Policies

**Worktree:** `/private/tmp/glasapp-worktrees/phase-4b-rls`  
**Branch:** `feature/phase-4b-rls` (cut from `main`)  
**Task Slug:** `phase-4b-rls`  
**Status:** Research + Implementation required

## Context

GlasApp uses Supabase for authentication and data storage. RLS (Row-Level Security) is a database-level access control mechanism that ensures users can only access rows they're authorized to see, enforced at the query layer — not just the application layer.

Current state: Some tables have RLS enabled, others don't. This phase reviews which tables should have RLS, designs policies for them, and implements the policies in Supabase.

## Task: Design & Deploy RLS Policies

### 1. Audit: Which Tables Need RLS?
- **High-risk tables** (contain user-sensitive data):
  - `users` / `user_profiles` — personal data, should be user-readable only by themselves + admins
  - `quiz_results` — user's quiz history, should be private to that user + admins
  - `political_evolution` — user's voting/stance data, should be private + admins
  - `user_activity` — user's activity log, private + admins
  - `rankings` — user's rankings/scores, user-readable but write-restricted
- **Lower-risk tables** (public data):
  - `politicians`, `political_parties`, `constituencies` — public, may not need RLS
  - `debates`, `debate_topics` — public, may not need RLS
- **Check current state:**
  - Which tables already have RLS enabled? (query `information_schema`)
  - Which policies exist? (read Supabase dashboard)
  - Which are missing or incomplete?

### 2. Design RLS Policies
For each high-risk table, define policies:
- **SELECT:** who can read rows?
  - User can read their own row (e.g., `auth.uid() = user_id`)
  - Admins can read all (e.g., `is_admin()` custom claim)
  - Specific roles can read certain rows (moderators read flagged content, etc.)
- **INSERT:** who can create rows?
  - User can insert with `user_id = auth.uid()` (set by trigger, not user input)
  - Admin can insert anything
- **UPDATE:** who can modify rows?
  - User can update their own row only
  - Admin can update any row
- **DELETE:** who can delete rows?
  - User cannot delete (soft delete only via admin)
  - Admin can delete

### 3. Implementation: Apply Policies via Supabase
- **Enable RLS on each high-risk table:**
  ```sql
  ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
  ```
- **Create policies** (via Supabase dashboard or direct SQL):
  - Per-table, per-operation (SELECT/INSERT/UPDATE/DELETE)
  - Use `auth.uid()`, `auth.jwt()` claims, custom functions
- **Test policies:**
  - Logged-in user can read/write their own data ✅
  - Logged-in user **cannot** read/write other users' data ✅
  - Admin (with admin claim) can read all ✅
  - Unauthenticated request is rejected ✅

### 4. Application-Layer Integration
- **Verify PostgREST queries respect RLS:**
  - GlasApp makes API calls to Supabase PostgREST (`/rest/v1/...`)
  - PostgREST enforces RLS per request based on `Authorization: Bearer <jwt>`
  - Queries should NOT need filtering logic — RLS filters at DB level
- **Remove redundant app-layer checks** (if any):
  - If code was manually checking `user_id == auth.uid()` before querying, it can now rely on RLS
  - Keep security-paranoia checks (defense in depth), but note RLS is the enforcement layer

### 5. Verification
- **No new TypeScript errors:** `npm run check` must pass (baseline 2644 errors)
- **RLS status check:**
  - Verify tables have RLS enabled (Supabase dashboard or `information_schema` query)
  - Verify policies exist for each sensitive operation
- **Manual test (if possible):**
  - Connect as user A, query should only return A's data
  - Connect as user B, query should only return B's data
  - Connect as admin, query should return all data
- **Coverage:** Document all tables audited, which have RLS, policy design rationale

## Files in Scope
- `server/routes/*.ts` — read auth/query patterns (identify what's calling which tables)
- `server/db.ts` — understand Supabase client setup
- `server/middleware/supabaseAuth.ts` — understand how JWT is passed
- Supabase dashboard — apply RLS policies directly (not code changes)
- `docs/agent-reports/phase-4b-rls/` — REPORT.md, policy design, implementation log

## Do Not
- Modify Route handlers (that's Phase 4A)
- Change TypeScript compiler settings (that's Phase 4C)
- Drop or rename tables (RLS is additive only)

## Acceptance Criteria
- ✅ All high-risk tables identified (list in report)
- ✅ RLS policies designed (SELECT/INSERT/UPDATE/DELETE per table)
- ✅ Policies deployed to Supabase
- ✅ Policies tested (user isolation, admin access, unauthenticated rejection verified)
- ✅ `npm run check` passes (no new TS errors)
- ✅ REPORT.md written: tables audited, policy design, deployment steps, test results

## Report Location
- **Path:** `docs/agent-reports/phase-4b-rls/REPORT.md`
- **Contents:** Tables audited, RLS policies designed/deployed, testing methodology, verification results

---

**Do this now. Audit tables, design policies, deploy to Supabase, test, report. No approval needed.**
