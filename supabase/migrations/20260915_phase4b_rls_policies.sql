-- ============================================================================
-- PHASE 4B — ROW LEVEL SECURITY (RLS) POLICIES
-- Task slug: phase-4b-rls   |   Branch: feature/phase-4b-rls
-- Date: 2026-09-15
--
-- Purpose
--   Enable RLS on all user-scoped (high-risk) tables and add per-operation
--   policies (SELECT / INSERT / UPDATE / DELETE). Public reference tables get
--   RLS enabled with a public-read policy for defense-in-depth.
--
-- Design decisions
--   * Admin check uses the Supabase JWT app_metadata.role claim, mirroring the
--     application-level `isAdmin` middleware in server/auth/supabaseAuth.ts
--     (`user.app_metadata?.role === 'admin'`).
--   * `users.id` (and every `user_id` / `firebase_uid` column) is a VARCHAR.
--     `auth.uid()` returns a UUID, so all ownership comparisons cast to text:
--       auth.uid()::text = user_id
--   * Ownership-only DELETE is granted where the app exposes self-service
--     delete (votes, saved views). Core data rows (profiles, results, history,
--     evolution, rankings) are admin-DELETE only; user-initiated account
--     deletion runs through the service-role account-deletion plan in
--     server/routes/accountRoutes.ts.
--   * The app's ~95% of DB access uses the service-role client (supabaseDb /
--     supabaseAdmin) which BYPASSES RLS entirely — so enabling RLS cannot break
--     existing server flows. The one browser direct query
--     (client/src/hooks/useOnboarding.ts → user_quiz_results) is satisfied by
--     the "user_quiz_results select own" policy below.
--   * Tables whose RLS was explicitly disabled by
--     migrations/disable_rls_news_tables.sql (news_articles, td_scores,
--     td_score_history, news_sources, scraping_jobs) are LEFT DISABLED — they
--     are system/admin-scraped tables and the repo made a deliberate choice.
--
-- Migration safety
--   * Every table reference is guarded with to_regclass() so this file can be
--     applied to a partially-migrated or freshly restored project without
--     erroring on tables that do not yet exist.
--   * Every policy is created with DROP POLICY IF EXISTS + CREATE POLICY, so
--     the file is idempotent and re-runnable.
--   * No tables are dropped or renamed (RLS is additive only).
--
-- Status
--   Authored and verified as a deployable artifact. Direct deployment to the
--   GlasApp Supabase project was BLOCKED because the app's production project
--   (ref ospxqnxlotakujloltqy) has been deleted from the account; see
--   docs/agent-reports/phase-4b-rls/REPORT.md for the full audit + blocker.
-- ============================================================================

begin;

-- ============================================================================
-- SECTION 0: Helpers
-- ============================================================================

-- Current user id as text (users.* id columns are varchar).
create or replace function public.glas_uid()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select auth.uid()::text
$$;

-- True when the caller's JWT app_metadata.role claim is 'admin'.
-- Mirrors server/auth/supabaseAuth.ts isAdmin() app_metadata check.
create or replace function public.glas_is_admin()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  )
$$;

grant execute on function public.glas_uid() to anon, authenticated;
grant execute on function public.glas_is_admin() to anon, authenticated;

-- ============================================================================
-- SECTION 1: HIGH-RISK — USERS & CREDENTIAL TABLES
-- ============================================================================

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;

    drop policy if exists "users_select_own_or_admin" on public.users;
    create policy "users_select_own_or_admin" on public.users
      for select to authenticated
      using (public.glas_uid() = id::text or public.glas_is_admin());

    drop policy if exists "users_update_own_or_admin" on public.users;
    create policy "users_update_own_or_admin" on public.users
      for update to authenticated
      using (public.glas_uid() = id::text or public.glas_is_admin())
      with check (public.glas_uid() = id::text or public.glas_is_admin());

    -- No INSERT / DELETE policy: user accounts are created and removed via
    -- service role only (signUp / account deletion), matching current app flow.
  end if;
end $$;

-- Credential/token tables: no public access (service role only).
do $$
declare
  t text;
begin
  foreach t in array array[
    'email_verification_tokens',
    'phone_verification_tokens',
    'two_factor_tokens',
    'sessions'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%s_no_public_access" on public.%I', t, t);
      execute format('create policy "%s_no_public_access" on public.%I for all using (false)', t, t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- SECTION 2: HIGH-RISK — USER PROFILES / ACTIVITY / LOCATION
-- ============================================================================

do $$
begin
  if to_regclass('public.user_preferences') is not null then
    alter table public.user_preferences enable row level security;

    drop policy if exists "user_preferences_select_own_or_admin" on public.user_preferences;
    create policy "user_preferences_select_own_or_admin" on public.user_preferences
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_preferences_insert_own" on public.user_preferences;
    create policy "user_preferences_insert_own" on public.user_preferences
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_preferences_update_own_or_admin" on public.user_preferences;
    create policy "user_preferences_update_own_or_admin" on public.user_preferences
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_preferences_delete_admin" on public.user_preferences;
    create policy "user_preferences_delete_admin" on public.user_preferences
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.user_activity') is not null then
    alter table public.user_activity enable row level security;

    drop policy if exists "user_activity_select_own_or_admin" on public.user_activity;
    create policy "user_activity_select_own_or_admin" on public.user_activity
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_activity_insert_own" on public.user_activity;
    create policy "user_activity_insert_own" on public.user_activity
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_activity_update_admin" on public.user_activity;
    create policy "user_activity_update_admin" on public.user_activity
      for update to authenticated
      using (public.glas_is_admin())
      with check (public.glas_is_admin());

    drop policy if exists "user_activity_delete_admin" on public.user_activity;
    create policy "user_activity_delete_admin" on public.user_activity
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.user_locations') is not null then
    alter table public.user_locations enable row level security;

    drop policy if exists "user_locations_select_own_or_admin" on public.user_locations;
    create policy "user_locations_select_own_or_admin" on public.user_locations
      for select to authenticated
      using (public.glas_uid() = firebase_uid::text or public.glas_is_admin());

    drop policy if exists "user_locations_insert_own" on public.user_locations;
    create policy "user_locations_insert_own" on public.user_locations
      for insert to authenticated
      with check (public.glas_uid() = firebase_uid::text);

    drop policy if exists "user_locations_update_own_or_admin" on public.user_locations;
    create policy "user_locations_update_own_or_admin" on public.user_locations
      for update to authenticated
      using (public.glas_uid() = firebase_uid::text or public.glas_is_admin())
      with check (public.glas_uid() = firebase_uid::text or public.glas_is_admin());

    drop policy if exists "user_locations_delete_admin" on public.user_locations;
    create policy "user_locations_delete_admin" on public.user_locations
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- ============================================================================
-- SECTION 3: HIGH-RISK — QUIZ / HISTORY / EVOLUTION
-- ============================================================================

do $$
begin
  if to_regclass('public.quiz_results') is not null then
    alter table public.quiz_results enable row level security;

    -- Own results, or any result that carries a public share_code.
    drop policy if exists "quiz_results_select_own_shared_or_admin" on public.quiz_results;
    create policy "quiz_results_select_own_shared_or_admin" on public.quiz_results
      for select to authenticated
      using (
        public.glas_uid() = user_id::text
        or share_code is not null
        or public.glas_is_admin()
      );

    -- Anonymous users may read results that have a public share link.
    drop policy if exists "quiz_results_select_shared_anon" on public.quiz_results;
    create policy "quiz_results_select_shared_anon" on public.quiz_results
      for select to anon
      using (share_code is not null);

    drop policy if exists "quiz_results_insert_own" on public.quiz_results;
    create policy "quiz_results_insert_own" on public.quiz_results
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "quiz_results_update_own_or_admin" on public.quiz_results;
    create policy "quiz_results_update_own_or_admin" on public.quiz_results
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "quiz_results_delete_admin" on public.quiz_results;
    create policy "quiz_results_delete_admin" on public.quiz_results
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- quiz_history (raw-SQL table used by quizHistoryService) and the archived
-- Drizzle table. Both are private to the owner; only admins may delete.
do $$
declare
  t text;
begin
  foreach t in array array['quiz_history', 'archived_quiz_results_history'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_update_own_or_admin" on public.%I for update to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin()) with check (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.political_evolution') is not null then
    alter table public.political_evolution enable row level security;

    drop policy if exists "political_evolution_select_own_or_admin" on public.political_evolution;
    create policy "political_evolution_select_own_or_admin" on public.political_evolution
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "political_evolution_insert_own" on public.political_evolution;
    create policy "political_evolution_insert_own" on public.political_evolution
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "political_evolution_update_own_or_admin" on public.political_evolution;
    create policy "political_evolution_update_own_or_admin" on public.political_evolution
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "political_evolution_delete_admin" on public.political_evolution;
    create policy "political_evolution_delete_admin" on public.political_evolution
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- ============================================================================
-- SECTION 4: HIGH-RISK — USER RANKINGS / RATINGS / IDEOLOGY
-- ============================================================================

-- user_quiz_results is the ONE table the browser queries directly with the
-- user's JWT (client/src/hooks/useOnboarding.ts). Its select policy MUST keep
-- auth.uid()::text = user_id working.
do $$
begin
  if to_regclass('public.user_quiz_results') is not null then
    alter table public.user_quiz_results enable row level security;

    drop policy if exists "user_quiz_results_select_own_or_admin" on public.user_quiz_results;
    create policy "user_quiz_results_select_own_or_admin" on public.user_quiz_results
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_quiz_results_insert_own" on public.user_quiz_results;
    create policy "user_quiz_results_insert_own" on public.user_quiz_results
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_quiz_results_update_own_or_admin" on public.user_quiz_results;
    create policy "user_quiz_results_update_own_or_admin" on public.user_quiz_results
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_quiz_results_delete_admin" on public.user_quiz_results;
    create policy "user_quiz_results_delete_admin" on public.user_quiz_results
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- user_td_ratings: ratings power public aggregation, so SELECT is public; writes
-- are ownership-restricted. NOTE: legacy rows may carry anon_<ts>_<rand> or
-- session-based user_ids (server/routes/ratings/tdRatings.ts) — those rows are
-- written/read through the service-role client and are unaffected by RLS.
do $$
begin
  if to_regclass('public.user_td_ratings') is not null then
    alter table public.user_td_ratings enable row level security;

    drop policy if exists "user_td_ratings_select_all" on public.user_td_ratings;
    create policy "user_td_ratings_select_all" on public.user_td_ratings
      for select using (true);

    drop policy if exists "user_td_ratings_insert_own" on public.user_td_ratings;
    create policy "user_td_ratings_insert_own" on public.user_td_ratings
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_td_ratings_update_own_or_admin" on public.user_td_ratings;
    create policy "user_td_ratings_update_own_or_admin" on public.user_td_ratings
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_td_ratings_delete_own_or_admin" on public.user_td_ratings;
    create policy "user_td_ratings_delete_own_or_admin" on public.user_td_ratings
      for delete to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());
  end if;
end $$;

-- Ideology profiles / snapshots / events. Profiles are also aggregated
-- cross-user for the "average user" comparison (ideologyTimelineRoutesEnhanced),
-- but that read runs on the service-role client, so RLS does not restrict it.
do $$
declare
  t text;
begin
  foreach t in array array['user_ideology_profiles', 'user_ideology_snapshots', 'user_ideology_events'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_update_own_or_admin" on public.%I for update to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin()) with check (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

-- Personal rankings + policy agreements: private, owner + admin.
do $$
declare
  t text;
begin
  foreach t in array array['user_personal_rankings', 'user_td_policy_agreements'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_update_own_or_admin" on public.%I for update to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin()) with check (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- SECTION 5: HIGH-RISK — POLICY VOTING
-- ============================================================================

do $$
begin
  if to_regclass('public.user_policy_votes') is not null then
    alter table public.user_policy_votes enable row level security;

    drop policy if exists "user_policy_votes_select_own_or_admin" on public.user_policy_votes;
    create policy "user_policy_votes_select_own_or_admin" on public.user_policy_votes
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_policy_votes_insert_own" on public.user_policy_votes;
    create policy "user_policy_votes_insert_own" on public.user_policy_votes
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_policy_votes_update_own_or_admin" on public.user_policy_votes;
    create policy "user_policy_votes_update_own_or_admin" on public.user_policy_votes
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    -- Self-service delete matches the DELETE endpoints in
    -- policyVotingRoutes.ts and user/rankings/policy.ts (which also perform an
    -- app-layer ownership check).
    drop policy if exists "user_policy_votes_delete_own_or_admin" on public.user_policy_votes;
    create policy "user_policy_votes_delete_own_or_admin" on public.user_policy_votes
      for delete to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.user_policy_vote_responses') is not null then
    alter table public.user_policy_vote_responses enable row level security;

    drop policy if exists "user_policy_vote_responses_select_own_or_admin" on public.user_policy_vote_responses;
    create policy "user_policy_vote_responses_select_own_or_admin" on public.user_policy_vote_responses
      for select to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_policy_vote_responses_insert_own" on public.user_policy_vote_responses;
    create policy "user_policy_vote_responses_insert_own" on public.user_policy_vote_responses
      for insert to authenticated
      with check (public.glas_uid() = user_id::text);

    drop policy if exists "user_policy_vote_responses_update_own_or_admin" on public.user_policy_vote_responses;
    create policy "user_policy_vote_responses_update_own_or_admin" on public.user_policy_vote_responses
      for update to authenticated
      using (public.glas_uid() = user_id::text or public.glas_is_admin())
      with check (public.glas_uid() = user_id::text or public.glas_is_admin());

    drop policy if exists "user_policy_vote_responses_delete_admin" on public.user_policy_vote_responses;
    create policy "user_policy_vote_responses_delete_admin" on public.user_policy_vote_responses
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- ============================================================================
-- SECTION 6: HIGH-RISK — LEGACY VOTING / USER-GENERATED CONTENT
-- ============================================================================

-- Vote tables: vote rows are private to their owner (protects user_id);
-- public vote COUNTS are served by the server through aggregate endpoints.
do $$
declare
  t text;
begin
  foreach t in array array['idea_votes', 'problem_votes', 'solution_votes', 'party_sentiment_votes', 'user_category_votes', 'user_pledge_votes', 'user_category_rankings'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_update_own_or_admin" on public.%I for update to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin()) with check (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_own_or_admin" on public.%I for delete to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

-- User-generated content (ideas/problems/solutions): active + non-admin-only
-- rows are publicly readable; owners and admins can modify; admin-only rows
-- are visible to admins only.
do $$
declare
  t text;
begin
  foreach t in array array['ideas', 'problems', 'solutions'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_public_active" on public.%I', t, t);
      execute format('create policy "%s_select_public_active" on public.%I for select using ((status = ''active'' or status is null) and (is_admin_only is null or is_admin_only = false))', t, t);

      execute format('drop policy if exists "%s_select_admin_only" on public.%I', t, t);
      execute format('create policy "%s_select_admin_only" on public.%I for select to authenticated using (public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
      execute format('create policy "%s_select_own" on public.%I for select to authenticated using (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_update_own_or_admin" on public.%I for update to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin()) with check (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_own_or_admin" on public.%I for delete to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- SECTION 7: HIGH-RISK — ENGAGEMENT / ACTIVITY / FEEDBACK
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['engagement_points', 'activity_logs'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "%s_select_own_or_admin" on public.%I', t, t);
      execute format('create policy "%s_select_own_or_admin" on public.%I for select to authenticated using (public.glas_uid() = user_id::text or public.glas_is_admin())', t, t);

      -- System writes these via service role; allow owner inserts for parity.
      execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
      execute format('create policy "%s_insert_own" on public.%I for insert to authenticated with check (public.glas_uid() = user_id::text)', t, t);

      execute format('drop policy if exists "%s_update_admin" on public.%I', t, t);
      execute format('create policy "%s_update_admin" on public.%I for update to authenticated using (public.glas_is_admin()) with check (public.glas_is_admin())', t, t);

      execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);
      execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.glas_is_admin())', t, t);
    end if;
  end loop;
end $$;

-- chat_feedback: feedback rows have no user_id ownership column; authenticated
-- users may submit, only admins may read/modify.
do $$
begin
  if to_regclass('public.chat_feedback') is not null then
    alter table public.chat_feedback enable row level security;

    drop policy if exists "chat_feedback_select_admin" on public.chat_feedback;
    create policy "chat_feedback_select_admin" on public.chat_feedback
      for select to authenticated
      using (public.glas_is_admin());

    drop policy if exists "chat_feedback_insert_authenticated" on public.chat_feedback;
    create policy "chat_feedback_insert_authenticated" on public.chat_feedback
      for insert to authenticated
      with check (true);

    drop policy if exists "chat_feedback_update_admin" on public.chat_feedback;
    create policy "chat_feedback_update_admin" on public.chat_feedback
      for update to authenticated
      using (public.glas_is_admin())
      with check (public.glas_is_admin());

    drop policy if exists "chat_feedback_delete_admin" on public.chat_feedback;
    create policy "chat_feedback_delete_admin" on public.chat_feedback
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- ============================================================================
-- SECTION 8: HIGH-RISK — DEBATE WORKSPACE
-- ============================================================================

do $$
begin
  if to_regclass('public.debate_saved_views') is not null then
    alter table public.debate_saved_views enable row level security;

    drop policy if exists "debate_saved_views_select_own_or_admin" on public.debate_saved_views;
    create policy "debate_saved_views_select_own_or_admin" on public.debate_saved_views
      for select to authenticated
      using (public.glas_uid() = created_by::text or public.glas_is_admin());

    drop policy if exists "debate_saved_views_insert_own" on public.debate_saved_views;
    create policy "debate_saved_views_insert_own" on public.debate_saved_views
      for insert to authenticated
      with check (public.glas_uid() = created_by::text);

    drop policy if exists "debate_saved_views_update_own_or_admin" on public.debate_saved_views;
    create policy "debate_saved_views_update_own_or_admin" on public.debate_saved_views
      for update to authenticated
      using (public.glas_uid() = created_by::text or public.glas_is_admin())
      with check (public.glas_uid() = created_by::text or public.glas_is_admin());

    drop policy if exists "debate_saved_views_delete_own_or_admin" on public.debate_saved_views;
    create policy "debate_saved_views_delete_own_or_admin" on public.debate_saved_views
      for delete to authenticated
      using (public.glas_uid() = created_by::text or public.glas_is_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.debate_exports') is not null then
    alter table public.debate_exports enable row level security;

    drop policy if exists "debate_exports_select_own_or_admin" on public.debate_exports;
    create policy "debate_exports_select_own_or_admin" on public.debate_exports
      for select to authenticated
      using (public.glas_uid() = requested_by::text or public.glas_is_admin());

    drop policy if exists "debate_exports_insert_own" on public.debate_exports;
    create policy "debate_exports_insert_own" on public.debate_exports
      for insert to authenticated
      with check (public.glas_uid() = requested_by::text);

    drop policy if exists "debate_exports_update_admin" on public.debate_exports;
    create policy "debate_exports_update_admin" on public.debate_exports
      for update to authenticated
      using (public.glas_is_admin())
      with check (public.glas_is_admin());

    drop policy if exists "debate_exports_delete_admin" on public.debate_exports;
    create policy "debate_exports_delete_admin" on public.debate_exports
      for delete to authenticated
      using (public.glas_is_admin());
  end if;
end $$;

-- ============================================================================
-- SECTION 9: LOWER-RISK — PUBLIC REFERENCE TABLES (defense-in-depth)
--   RLS enabled with public-read only; writes remain service-role only.
--   news_articles, td_scores, td_score_history, news_sources, scraping_jobs
--   are intentionally excluded (RLS disabled by migrations/disable_rls_news_tables.sql).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'politicians', 'political_parties', 'parties', 'constituencies',
    'elections', 'election_results', 'candidates', 'pledges', 'pledge_actions',
    'pledge_category_weights', 'party_performance_scores', 'party_positions',
    'performance_scores', 'score_component_weights', 'policy_positions',
    'policy_promises', 'td_questions', 'td_votes', 'td_legislation', 'td_debates',
    'unified_td_scores', 'unified_score_history', 'td_ideology_profiles',
    'td_ideology_events', 'td_historical_baselines', 'td_debate_metrics',
    'td_debate_running_scores', 'td_issue_focus', 'article_td_scores',
    'article_vote_stats', 'td_policy_stances', 'policy_vote_opportunities',
    'policy_vote_option_stats', 'policy_vote_option_vectors',
    'parliamentary_activity', 'poll_party_results', 'polling_time_series',
    'poll_performance_correlation', 'polling_aggregates_cache', 'polls',
    'poll_sources', 'debate_days', 'debate_sections', 'debate_speeches',
    'debate_section_tasks', 'debate_section_summaries', 'debate_section_outcomes',
    'debate_section_score_contributions', 'debate_alerts', 'debate_highlights',
    'debate_chunks', 'debate_speech_stances', 'debate_ideology_analysis',
    'debate_ideology_history'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "%s_public_read" on public.%I', t, t);
      execute format('create policy "%s_public_read" on public.%I for select using (true)', t, t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- SELECT c.relname AS table, c.relrowsecurity AS rls_enabled
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
-- ORDER BY c.relname;

commit;