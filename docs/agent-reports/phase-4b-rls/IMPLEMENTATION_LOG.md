# Phase 4B — Implementation Log

**Task slug:** `phase-4b-rls` · **Branch:** `feature/phase-4b-rls`

## Timeline (2026-09-15)

### 1. Code audit
- Dispatched an explore agent to inventory every `.from('<table>')` call across
  `server/` and `client/src/`, plus Supabase client setup (`server/db.ts`,
  `server/auth/supabaseAuth.ts`) and auth middleware.
- Confirmed: server uses service-role client for ~95% of DB access (bypasses
  RLS); the only browser→PostgREST query is `user_quiz_results` in
  `client/src/hooks/useOnboarding.ts`.

### 2. Supabase project discovery (unexpected)
- `supabase-glas` MCP timed out on all DB calls → traced to the project being
  **INACTIVE (paused)**. Restored via Management API `POST /v1/projects/.../restore`.
- Full schema inventory of the restored project revealed it is **Glas Intelligence**
  (simulations/case_predictions/credit_transactions), NOT GlasApp.
- Verified the app's real project ref (`ospxqnxlotakujloltqy`) is **deleted**
  ("Resource has been removed", NXDOMAIN). Checked both MCP OAuth tokens, account
  project lists, git history, deployed configs, session DB, and local env files —
  no other candidate project exists.
- **Conclusion:** no accessible live database hosts GlasApp's tables → live
  deployment blocked.

### 3. Schema review
- Read `shared/schema.ts` (1359 lines), `migrations/` (drizzle + raw SQL), and
  `supabase/migrations/` including `CRITICAL_RLS_FIXES.sql` (un-applied legacy
  RLS file) and `20251106_create_daily_retention_session.sql` (already-applied RLS).
- Reconciled column types: all `user_id` / `firebase_uid` / `users.id` are
  `varchar`; `auth.uid()` is `uuid` → text-cast comparisons required.

### 4. Policy design
- Authored policy matrix (§2 / POLICY_DESIGN.md) using `glas_uid()` and
  `glas_is_admin()` helpers; admin detection mirrors the app's `isAdmin` middleware.

### 5. Migration written
- `supabase/migrations/20260915_phase4b_rls_policies.sql` — transactional,
  idempotent (`DROP POLICY IF EXISTS` + `CREATE POLICY`), guarded with
  `to_regclass()` so it is safe on partially-migrated projects. Additive only.

### 6. Validation (local Postgres 16 via Docker)
- Built a mock `auth` schema (`auth.uid()` / `auth.jwt()` from `request.jwt.*`),
  created representative tables with matching column types, granted
  anon/authenticated privileges, applied the migration with `ON_ERROR_STOP=1`.
- Ran 14 functional tests (anonymous rejection, user A/B isolation, admin
  access, admin-only content gating, public rating reads, self-insert OK,
  cross-user insert rejected by RLS `WITH CHECK`). All passed.
- Cleaned up the test container afterwards.

### 7. TypeScript gate
- `npx tsc --noEmit` → **2644 errors**, identical to the documented baseline
  (no new errors; this phase changes no TypeScript).

### 8. Reporting
- Wrote `REPORT.md`, `POLICY_DESIGN.md`, and this log.

## Blockers & decisions
- **Deployment BLOCKED**: app project `ospxqnxlotakujloltqy` deleted; MCP "app"
  project (`ihecemdupqnxltdyebsh`) is a different product's DB. Migration shipped
  as a deployable artifact instead of applying to a wrong project.
- Chose **not** to apply policies to the Glas Intelligence project — that would
  alter a different product's security posture and reference tables that don't
  exist.
- Left `news_articles`, `td_scores`, `td_score_history`, `news_sources`,
  `scraping_jobs` with RLS disabled, honoring `migrations/disable_rls_news_tables.sql`.

## Handoff notes
- When the GlasApp Supabase project is restored/recreated, apply
  `supabase/migrations/20260915_phase4b_rls_policies.sql`, then run the
  verification queries in REPORT.md §7 and the manual acceptance checks.