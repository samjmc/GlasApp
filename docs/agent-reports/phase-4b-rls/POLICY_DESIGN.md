# Phase 4B — RLS Policy Design

Detailed policy matrix for the deployable migration
`supabase/migrations/20260915_phase4b_rls_policies.sql`.

## Helpers

```sql
create or replace function public.glas_uid() returns text ...
  select auth.uid()::text;

create or replace function public.glas_is_admin() returns boolean ...
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
```

## Ownership conventions

- Own row: `public.glas_uid() = <owner_col>::text`
- Admin: `public.glas_is_admin()`
- Public: `USING (true)`

## High-risk tables

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `users` | own + admin | — (service role) | own + admin | — (service role) |
| `user_preferences` | own + admin | own (WC) | own + admin | admin |
| `user_activity` | own + admin | own (WC) | admin | admin |
| `user_locations` (`firebase_uid`) | own + admin | own (WC) | own + admin | admin |
| `quiz_results` | own + shared + admin; anon: shared | own (WC) | own + admin | admin |
| `quiz_history` | own + admin | own (WC) | own + admin | admin |
| `archived_quiz_results_history` | own + admin | own (WC) | own + admin | admin |
| `political_evolution` | own + admin | own (WC) | own + admin | admin |
| `user_quiz_results` | own + admin | own (WC) | own + admin | admin |
| `user_td_ratings` | **public** | own (WC) | own + admin | own + admin |
| `user_ideology_profiles` | own + admin | own (WC) | own + admin | admin |
| `user_ideology_snapshots` | own + admin | own (WC) | own + admin | admin |
| `user_ideology_events` | own + admin | own (WC) | own + admin | admin |
| `user_personal_rankings` | own + admin | own (WC) | own + admin | admin |
| `user_td_policy_agreements` | own + admin | own (WC) | own + admin | admin |
| `user_policy_votes` | own + admin | own (WC) | own + admin | own + admin |
| `user_policy_vote_responses` | own + admin | own (WC) | own + admin | admin |
| `idea_votes` | own + admin | own (WC) | own + admin | own + admin |
| `problem_votes` | own + admin | own (WC) | own + admin | own + admin |
| `solution_votes` | own + admin | own (WC) | own + admin | own + admin |
| `party_sentiment_votes` | own + admin | own (WC) | own + admin | own + admin |
| `user_category_votes` | own + admin | own (WC) | own + admin | own + admin |
| `user_pledge_votes` | own + admin | own (WC) | own + admin | own + admin |
| `user_category_rankings` | own + admin | own (WC) | own + admin | own + admin |
| `ideas` | public-active + own + admin | own (WC) | own + admin | own + admin |
| `problems` | public-active + own + admin | own (WC) | own + admin | own + admin |
| `solutions` | public-active + own + admin | own (WC) | own + admin | own + admin |
| `engagement_points` | own + admin | own (WC) | admin | admin |
| `activity_logs` | own + admin | own (WC) | admin | admin |
| `chat_feedback` | admin | authenticated (WC true) | admin | admin |
| `debate_saved_views` (`created_by`) | own + admin | own (WC) | own + admin | own + admin |
| `debate_exports` (`requested_by`) | own + admin | own (WC) | admin | admin |
| `email_verification_tokens` | — | — | — | — |
| `phone_verification_tokens` | — | — | — | — |
| `two_factor_tokens` | — | — | — | — |
| `sessions` | — | — | — | — |

`WC` = `WITH CHECK`. Credential/token/session tables: `FOR ALL USING (false)` —
service role only.

## Public reference tables

`SELECT USING (true)` on: politicians, political_parties, parties,
constituencies, elections, election_results, candidates, pledges, pledge_actions,
pledge_category_weights, party_performance_scores, party_positions,
performance_scores, score_component_weights, policy_positions, policy_promises,
td_questions, td_votes, td_legislation, td_debates, unified_td_scores,
unified_score_history, td_ideology_profiles, td_ideology_events,
td_historical_baselines, td_debate_metrics, td_debate_running_scores,
td_issue_focus, article_td_scores, article_vote_stats, td_policy_stances,
policy_vote_opportunities, policy_vote_option_stats, policy_vote_option_vectors,
parliamentary_activity, poll_party_results, polling_time_series,
poll_performance_correlation, polling_aggregates_cache, polls, poll_sources,
debate_days, debate_sections, debate_speeches, debate_section_tasks,
debate_section_summaries, debate_section_outcomes,
debate_section_score_contributions, debate_alerts, debate_highlights,
debate_chunks, debate_speech_stances, debate_ideology_analysis,
debate_ideology_history.

## Excluded (RLS intentionally disabled — `migrations/disable_rls_news_tables.sql`)

`news_articles`, `td_scores`, `td_score_history`, `news_sources`, `scraping_jobs`.

## Excluded (already RLS'd — `20251106_create_daily_retention_session.sql`)

`daily_sessions`, `daily_session_items`, `daily_session_votes`.

## Design rationale notes

1. **Admin = JWT `app_metadata.role`** — matches `isAdmin` middleware in
   `server/auth/supabaseAuth.ts`; no subquery against `users.role` (avoids
   recursive policy evaluation and stale role data).
2. **Varchar id columns + text cast** — `users.id` and all `user_id` columns are
   `varchar`; `auth.uid()` is `uuid`. Cast once via `glas_uid()`.
3. **Delete conservatism** — GDPR account deletion is a server-side job using the
   service role (`accountRoutes.ts` deletion plan). Users don't get direct DELETE
   on core data; self-service delete is limited to vote/workspace rows.
4. **`user_td_ratings` public SELECT** — the app aggregates ratings into
   politician scores; public read preserves that while write stays owner-scoped.
5. **Service-role bypass** — the server's `supabaseDb`/`supabaseAdmin` clients
   bypass RLS, so this migration cannot break existing server routes; it only
   hardens direct (JWT) access paths.