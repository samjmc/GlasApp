# Launch checklist

The runbook for running the container is `docs/deploy.md`. This is what stands between it and a public
launch: what has been checked, what only the owner can do, and in what order.

## What is checked (2026-10-10)

Tested on a laptop, not on a real host:

- The production image **builds** from `main`, runs as the non-root user `node`, answers `/health`, serves
  the client and its SPA fallback, reads the database, refuses unauthenticated calls with 401, and **stops
  on SIGTERM in about 1.5 seconds with exit code 0**.
- Every migration applies to an **empty** database (25 when this was checked on 2026-10-10; `main` has 27 now,
  0000 to 0026, and CI applies them all).
- CI now builds the image and runs these checks on every pull request (`image` job), so the kit cannot rot.

Fixed in the same round: the server no longer dies when the database drops a connection, idle or in use
(listeners on the pool and on every client); unhandled errors are written to the structured log before the
process exits; the shutdown closes database connections; container logs are rotated by size; the request
log records the path only, never the query string or headers (a reset link carries a one-time token in its
query), and no health probe is logged; the service worker no longer caches signed-in API responses or
profile pictures (and deletes the old cache); two public endpoints that sent free text to an AI provider
are removed.

Not checked: Docker Compose with the Caddy profile, a real Supabase project sign-in, email delivery, and
anything on a real host.

## 1. Decide (the owner)

| Decision | Why it matters |
|---|---|
| **Host and domain.** One Docker host, one instance (`docs/deploy.md` "Rules that do not bend"). | Rate limits, the cache and the sync lock live in process memory. |
| **Own Supabase project, or keep sharing GlasCore.** | The auth user table, the Site URL and the connection budget (60, shared) are project-wide. |
| **The AI provider for the background jobs** (news ranking, stances, debates). | These send public text only. The two public analysis endpoints that sent each result's eight scores to the provider are gone (removed 2026-10-10). If you add a user-facing AI feature, name the provider, get a DPA and pick an EU or UK one first. |
| **Privacy policy rewrite, cookie banner, age gate, self-hosted fonts.** | The policy does not match the app. See the data protection impact assessment draft. |

## 2. Before the first boot

In the Supabase dashboard (Authentication):

1. **Redirect URLs:** add `https://<domain>/auth/callback` and `https://<domain>/auth/reset-password`.
2. **Site URL:** one value for the whole project. Check with whoever runs the other product first.
3. **Confirm email: ON.** The admin allow-list trusts `email_confirmed_at`.
4. **Google provider:** enabled, with the redirect URI Supabase shows.
5. **Reset-password email template:** use `{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery`
   so the link works in any browser.
6. **SMTP:** set a real sender. Supabase's built-in sender is rate limited and meant for testing.
7. **Database, API settings:** confirm the `politics` schema is **not** exposed through the public API.
   Migration 0026 is the second line: `anon` and `authenticated` have no grant on the schema, and every
   table has row level security with no policy (server/db.integration.test.ts checks both).
8. **Migrations:** from a checkout of `main`, `npm run db:migrate` against the session pooler
   (`docs/deploy.md` section 3). GlasCore had 0000 to 0024 on 2026-10-10; 0025 (TD history takedown) and 0026
   (row level security on the politics tables) came after. Compare `drizzle/meta/_journal.json` with the
   `drizzle.__drizzle_migrations` table before you migrate.
9. **Political data saved before consent existed.** Votes, rankings, pledge priorities and quiz results
   from people with no recorded consent (or consent to an older text) have no lawful basis under Article 9.
   Count them, then delete them or ask the people to consent again. Read-only count:

   ```sql
   select count(*) as users_with_opinions_and_no_current_consent
   from politics.users u
   where (u.political_consent_at is null or u.political_consent_version is distinct from 1)
     and (exists (select 1 from politics.policy_votes v where v.user_id::text = u.id::text)
       or exists (select 1 from politics.quiz_results q where q.user_id::text = u.id::text)
       or exists (select 1 from politics.daily_sessions d where d.user_id::text = u.id::text)
       or exists (select 1 from politics.pledge_category_priorities p where p.user_id::text = u.id::text)
       or exists (select 1 from politics.ideology_profiles i where i.subject_kind = 'user' and i.subject_id = u.id::text));
   ```

   Change `1` to `POLITICAL_CONSENT_VERSION` in `shared/consent.ts` if it has moved. Until this is done, the
   regional and party summaries also count those people.

On the host: fill `deploy/glasapp.env` (a secret per line; `VITE_SUPABASE_ANON_KEY` is needed at **build** time
or sign-in is silently disabled), set an admin secret, keep `SCHEDULER=off`.

## 3. First boot, then prove it

1. `docker compose --env-file deploy/glasapp.env -f deploy/compose.yml up -d --build`, then the checks in
   `docs/deploy.md` section 4.
2. Add the proxy profile for HTTPS (`docs/deploy.md` section 5). **One proxy hop only.**
3. Walk the product once by hand, in a private window:
   - take the quiz signed out, then sign up with email and confirm the link works;
   - sign in with Google;
   - the consent dialog appears at the first save, **Not now** saves nothing, **I agree** does;
   - vote, rank, download your data, withdraw consent (your data is erased), delete the account.
4. Reload with the network off after signing in: no profile or quiz response is served from cache.

## 4. Turning the crons on

Only when step 3 passes, the migrations are applied, and no other copy (a laptop, an old host) runs crons
against the same database. Then follow `docs/deploy.md` section 6. `DIVISION_STANCES`, `DEBATE_ITEMS` and
`QUESTION_ITEMS` stay off until you want the model cost.

## 5. Known limits at launch

- One instance; a deploy means a short gap. Uploads live on a volume that must be backed up.
- **The Content-Security-Policy is report-only** (`server/middleware/securityHeaders.ts`), so it blocks nothing
  while the sign-in token is in localStorage. Check what it reports, then set `reportOnly` to false.
- `/health` only says the process is up, not that the database is reachable. Watch `/api/parliament/status`.
- Database TLS certificates are not verified (the pooler's chain is not trusted by node-postgres).
- No error tracking (Sentry or similar) and no uptime monitor. Add one before the first campaign.

## 6. First week

- Read the container logs daily (rotated, about a week kept). Look for `Database pool:` and `fatal` lines.
- Watch pooler connections in Supabase against `DB_POOL_MAX` (default 10; the pooler holds 15, shared).
- Confirm the Supabase plan's backups, and do one restore drill into a scratch project.
- Watch model spend when the crons are on.
