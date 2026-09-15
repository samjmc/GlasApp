# Phase 4B — Row-Level Security (RLS) Policies — REPORT

**Task slug:** `phase-4b-rls`
**Branch:** `feature/phase-4b-rls`
**Date:** 2026-09-15
**Worktree:** `/private/tmp/glasapp-worktrees/phase-4b-rls`

---

## Executive summary

This phase audits every table the GlasApp server touches, determines which need
Row-Level Security, designs per-operation policies for each high-risk table, and
produces a deployable, idempotent migration.

**Deliverables**

| Artifact | Location | Status |
|---|---|---|
| RLS migration (deployable SQL) | `supabase/migrations/20260915_phase4b_rls_policies.sql` | ✅ Written & validated |
| RLS validation (functional tests in Postgres 16) | this report §6 | ✅ Passed |
| `npm run check` (TypeScript gate) | baseline **2644** errors | ✅ No new errors |
| Deployment to live Supabase | — | ⛔ **BLOCKED** (see §5) |

**Headline blocker:** the GlasApp application's production Supabase project —
ref `ospxqnxlotakujloltqy` (the URL hard-coded in
`client/src/lib/supabase.ts`, `scripts/populate-party-scores.ts`, and
`scripts/repair-vote-subjects.ts`) — has been **deleted** from the account
("Resource has been removed", DNS NXDOMAIN). The Supabase MCP project configured
as "the app project" (`ihecemdupqnxltdyebsh`, named **GlasCore**) contains a
**different product's** schema (Glas Intelligence: `simulations`,
`case_predictions`, `credit_transactions`, `scenario_sessions`, etc.) — none of
GlasApp's tables exist there. Consequently there is **no accessible live
database** to deploy these policies to. The migration is written so it can be
applied safely the moment the correct project is restored/recreated.

---

## 1. Table audit

Methodology: enumerated `.from('<table>')` calls across `server/` and
`client/src/`, cross-referenced with `shared/schema.ts` and the raw-SQL
migrations under `migrations/` and `supabase/migrations/`.

### 1.1 High-risk (user-scoped) tables → RLS enabled + policies

| Table | Owner column | Read (RLS) | Write (RLS) |
|---|---|---|---|
| `users` | `id` | own + admin | update own/admin; insert/delete service-role only |
| `user_preferences` | `user_id` | own + admin | insert/update own; delete admin |
| `user_activity` | `user_id` | own + admin | insert own; update/delete admin |
| `user_locations` | `firebase_uid` | own + admin | insert/update own; delete admin |
| `quiz_results` | `user_id` | own + shared (`share_code`) + admin | insert/update own; delete admin |
| `quiz_history` | `user_id` | own + admin | insert/update own; delete admin |
| `archived_quiz_results_history` | `user_id` | own + admin | insert/update own; delete admin |
| `political_evolution` | `user_id` | own + admin | insert/update own; delete admin |
| `user_quiz_results` | `user_id` | own + admin | insert/update own; delete admin |
| `user_td_ratings` | `user_id` | **public** (aggregation) | insert/update/delete own + admin |
| `user_ideology_profiles` | `user_id` | own + admin | insert/update own; delete admin |
| `user_ideology_snapshots` | `user_id` | own + admin | insert/update own; delete admin |
| `user_ideology_events` | `user_id` | own + admin | insert/update own; delete admin |
| `user_personal_rankings` | `user_id` | own + admin | insert/update own; delete admin |
| `user_td_policy_agreements` | `user_id` | own + admin | insert/update own; delete admin |
| `user_policy_votes` | `user_id` | own + admin | insert/update/delete own + admin |
| `user_policy_vote_responses` | `user_id` | own + admin | insert/update own; delete admin |
| `idea_votes` / `problem_votes` / `solution_votes` | `user_id` | own + admin | insert/update/delete own + admin |
| `party_sentiment_votes` | `user_id` | own + admin | insert/update/delete own + admin |
| `user_category_votes` | `user_id` | own + admin | insert/update/delete own + admin |
| `user_pledge_votes` | `user_id` | own + admin | insert/update/delete own + admin |
| `user_category_rankings` | `user_id` | own + admin | insert/update/delete own + admin |
| `ideas` / `problems` / `solutions` | `user_id` | public-active + own + admin | insert/update/delete own + admin |
| `engagement_points` | `user_id` | own + admin | insert own; update/delete admin |
| `activity_logs` | `user_id` | own + admin | insert own; update/delete admin |
| `chat_feedback` | — (no owner col) | admin | insert authenticated; update/delete admin |
| `debate_saved_views` | `created_by` | own + admin | insert/update/delete own + admin |
| `debate_exports` | `requested_by` | own + admin | insert own; update/delete admin |
| `email_verification_tokens` / `phone_verification_tokens` / `two_factor_tokens` / `sessions` | — | **deny all** (service-role only) | — |

### 1.2 Lower-risk (public reference) tables → RLS enabled, public-read only

`politicians`, `political_parties`, `parties`, `constituencies`, `elections`,
`election_results`, `candidates`, `pledges`, `pledge_actions`,
`pledge_category_weights`, `party_performance_scores`, `party_positions`,
`performance_scores`, `score_component_weights`, `policy_positions`,
`policy_promises`, `td_questions`, `td_votes`, `td_legislation`, `td_debates`,
`unified_td_scores`, `unified_score_history`, `td_ideology_profiles`,
`td_ideology_events`, `td_historical_baselines`, `td_debate_metrics`,
`td_debate_running_scores`, `td_issue_focus`, `article_td_scores`,
`article_vote_stats`, `td_policy_stances`, `policy_vote_opportunities`,
`policy_vote_option_stats`, `policy_vote_option_vectors`,
`parliamentary_activity`, `poll_party_results`, `polling_time_series`,
`poll_performance_correlation`, `polling_aggregates_cache`, `polls`,
`poll_sources`, `debate_days`, `debate_sections`, `debate_speeches`,
`debate_section_tasks`, `debate_section_summaries`, `debate_section_outcomes`,
`debate_section_score_contributions`, `debate_alerts`, `debate_highlights`,
`debate_chunks`, `debate_speech_stances`, `debate_ideology_analysis`,
`debate_ideology_history`.

These get RLS enabled with a `SELECT USING (true)` policy (defense-in-depth:
public reads keep working, writes remain service-role only).

### 1.3 Tables intentionally left with RLS DISABLED

`news_articles`, `td_scores`, `td_score_history`, `news_sources`,
`scraping_jobs` — RLS was explicitly disabled for these by
`migrations/disable_rls_news_tables.sql` (system-scraped content written via the
service role). They are excluded from the migration; do not re-enable them
without revisiting that decision.

### 1.4 Tables already covered by an earlier RLS migration

`daily_sessions`, `daily_session_items`, `daily_session_votes` already have RLS
enabled and `auth.uid()` policies from
`supabase/migrations/20251106_create_daily_retention_session.sql`. The migration
does not touch them.

---

## 2. Policy design

### 2.1 Ownership model

- All `users.id` / `user_id` / `firebase_uid` columns are `varchar`; `auth.uid()`
  returns a `uuid`. Ownership is compared as **`public.glas_uid() = <col>::text`**
  where `glas_uid()` is `auth.uid()::text`.
- **Admin** is detected from the JWT `app_metadata.role = 'admin'` via a helper
  `public.glas_is_admin()`, mirroring the app's own `isAdmin` middleware in
  `server/auth/supabaseAuth.ts` (`user.app_metadata?.role === 'admin'`).
- **Delete** is intentionally restricted: core data (profiles, results, history,
  evolution, rankings, points, activity) is admin-delete only — user-initiated
  account deletion runs through the service-role account-deletion plan in
  `server/routes/accountRoutes.ts`. Self-service delete is granted only where the
  app exposes it (votes, saved views).

### 2.2 Operation matrix (high-risk tables)

| Op | Default policy |
|---|---|
| SELECT | `glas_uid() = user_id::text OR glas_is_admin()` |
| INSERT | `WITH CHECK (glas_uid() = user_id::text)` |
| UPDATE | `USING (own OR admin) WITH CHECK (own OR admin)` |
| DELETE | admin-only (or own+admin where self-service delete exists) |

### 2.3 Special cases

- `quiz_results`: rows with a non-null `share_code` are readable by anyone,
  including anonymous (`anon`) users — preserves the share-link feature.
- `user_td_ratings`: SELECT is public (`USING (true)`) so leaderboard/aggregation
  queries keep working; writes are ownership-scoped. Note legacy rows may carry
  `anon_<ts>_<rand>` / session-based `user_id`s written through the service-role
  client — those are unaffected by RLS.
- `ideas` / `problems` / `solutions`: public rows are those with
  `status = 'active'` (or null) and `is_admin_only = false` (or null); admin-only
  rows are visible to admins; owners can always read their own.
- `chat_feedback`: no owner column, so authenticated users can insert, only
  admins can read/modify.

---

## 3. Deployment artifact

**File:** `supabase/migrations/20260915_phase4b_rls_policies.sql`

- Wrapped in a transaction (`begin` / `commit`).
- Idempotent: every policy is `DROP POLICY IF EXISTS` + `CREATE POLICY`, and every
  table access is guarded by `to_regclass()` so it applies cleanly to a
  partially-migrated or freshly-restored project.
- **Additive only** — no tables dropped or renamed; no route handlers or TS
  compiler settings touched (per phase constraints).

**Apply command (once the correct project exists):**

```bash
# via Supabase SQL editor: paste + run the file contents
# or via supabase CLI:
supabase db push   # after placing the file in supabase/migrations/ (already there)
```

---

## 4. Application-layer integration

- The server's ~95% of DB access uses the **service-role** client
  (`supabaseDb` / `supabaseAdmin` in `server/db.ts` / `server/auth/supabaseAuth.ts`),
  which **bypasses RLS** — enabling RLS does not break existing server flows.
- The **only** browser→PostgREST direct query is
  `client/src/hooks/useOnboarding.ts:60` → `supabase.from('user_quiz_results')
  .select('id').eq('user_id', user.id).limit(1)`. This is satisfied by the
  `user_quiz_results_select_own_or_admin` policy (`glas_uid() = user_id::text`).
- Server routes that already filter `.eq('user_id', userId)` (policy votes,
  rankings, ideology timeline, daily session, ratings) are app-layer defense-in-depth;
  RLS is now the enforcement layer for any direct/JWT-authenticated access.
- **No redundant app-layer checks were removed** (that's Phase 4A territory), and
  none needed changing for RLS compatibility.

---

## 5. Deployment status — ⛔ BLOCKED

### 5.1 Evidence

1. **App's project is deleted.** The ref `ospxqnxlotakujloltqy` (hard-coded in
   `client/src/lib/supabase.ts:11`, `scripts/populate-party-scores.ts:14`,
   `scripts/repair-vote-subjects.ts:7`) returns
   `{"message":"Resource has been removed"}` from the Supabase Management API and
   NXDOMAIN in DNS.
2. **The MCP "app" project is a different product.** `supabase-glas` MCP is
   configured to `ihecemdupqnxltdyebsh` ("GlasCore"), whose entire `public`
   schema is Glas Intelligence tables (`simulations`, `case_predictions`,
   `credit_transactions`, `scenario_sessions`, `feed_views`, … — 27 tables, none
   of them GlasApp's). A query for GlasApp's table names across all schemas
   returned only `auth.users`.
3. **Account inventory.** Both OAuth tokens (the `supabase` and `supabase-glas`
   MCP credentials) list the same two projects: `ihecemdupqnxltdyebsh` (GlasCore,
   ACTIVE_HEALTHY) and `gtnouykwytvpqvlhuoiz` (personal-kb, ACTIVE_HEALTHY).
   Neither hosts GlasApp's schema.
4. **The deleted project is not restorable** via the Management API restore
   endpoint (`{"message":"Resource has been removed"}`).

### 5.2 Consequence

The RLS migration could not be applied to a live GlasApp database, and it would
be **wrong to apply GlasApp's policies to the Glas Intelligence project** (tables
don't exist; it would alter a different product's security posture).

### 5.3 To complete deployment

1. Restore or recreate GlasApp's Supabase project (`ospxqnxlotakujloltqy` or a new
   ref) and re-point `SUPABASE_URL` / `VITE_SUPABASE_URL` env vars.
2. Re-apply the app's schema/migrations to that project.
3. Run `supabase/migrations/20260915_phase4b_rls_policies.sql` (see §3).
4. Run the verification queries in §7.

---

## 6. Testing methodology & results

Because the live project is unavailable, the migration was validated against a
fresh **Postgres 16 container** (Docker) with:

- A mock `auth` schema implementing `auth.uid()` and `auth.jwt()` from
  `request.jwt.*` settings (the same mechanism PostgREST uses).
- Representative tables matching `shared/schema.ts` column types.
- `anon` / `authenticated` roles granted table privileges (mirroring Supabase
  defaults so RLS is the gate, not missing grants).

### Results

| # | Test | Expect | Result |
|---|---|---|---|
| T1 | Anonymous reads `user_quiz_results` | 0 rows | ✅ 0 |
| T1 | Anonymous reads public `parties` | 2 rows | ✅ 2 |
| T1 | Anonymous reads shared `quiz_results` (`share_code`) | 1 row | ✅ 1 |
| T2 | User A sees own `user_quiz_results` | 1 row | ✅ 1 |
| T2 | User A sees own `political_evolution` only | 1 row | ✅ 1 |
| T2 | User A sees own `user_policy_votes` only | 1 row | ✅ 1 |
| T2 | User A sees own + shared `quiz_results` | 2 rows | ✅ 2 |
| T2 | User A cannot see user B's `political_evolution` | 0 rows | ✅ 0 |
| T3 | User B sees own data only | 1 row each | ✅ |
| T4 | Admin sees all `political_evolution` / `user_quiz_results` / `ideas` | all rows | ✅ |
| T4 | `glas_is_admin()` true for admin JWT | true | ✅ true |
| T5 | Non-admin cannot see admin-only `ideas` | 0 rows | ✅ 0 |
| T6 | Anonymous reads all `user_td_ratings` (aggregation) | 2 rows | ✅ 2 |
| T7 | Self INSERT succeeds; **cross-user INSERT rejected by RLS** | `new row violates row-level security policy` | ✅ |

All tests passed. The `npm run check` gate passed at the documented baseline of
**2644** TypeScript errors (no new errors introduced — this phase changes no TS).

---

## 7. Verification queries (post-deploy)

```sql
-- RLS status per table
SELECT c.relname AS table, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Policies per table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Manual acceptance checks (when a live project exists):
1. Connect as user A → only A's rows returned for every high-risk table.
2. Connect as user B → only B's rows returned.
3. Connect as admin (`app_metadata.role = 'admin'`) → all rows returned.
4. Unauthenticated request → empty result sets (except public tables).

---

## 8. Files changed

- `supabase/migrations/20260915_phase4b_rls_policies.sql` — **new** (RLS migration).
- `docs/agent-reports/phase-4b-rls/REPORT.md` — this report.
- `docs/agent-reports/phase-4b-rls/POLICY_DESIGN.md` — detailed policy matrix.
- `docs/agent-reports/phase-4b-rls/IMPLEMENTATION_LOG.md` — timeline.

No route handlers, no `tsconfig`, no tables dropped/renamed.