# Deploying GlasApp

GlasApp runs as one container. One Node process serves the API and the built client on
port 5000. The files for this are `Dockerfile`, `deploy/compose.yml`, `deploy/Caddyfile` and
`deploy/glasapp.env.example`.

Rules that do not bend:

- **One instance only.** Rate limits live in process
  memory. A second copy would not share them. (The job locks do not: each job takes a Postgres
  advisory lock, so a job started from the command line never runs alongside the server's cron.)
- **Migrations are manual** and never run at boot (see "Migrations").
- **One proxy only** in front of the app (see "HTTPS").

## What you need

- A Docker host with Docker Compose v2.
- The GlasCore database. Use the **IPv4 session pooler** connection string from the Supabase
  dashboard (Project Settings, Database). The direct host is IPv6 only. GlasCore cancels any
  statement that runs longer than **2 minutes**.
- A domain whose DNS record points straight at the host, if you want HTTPS.

## 1. Create the variables file

```
cp deploy/glasapp.env.example deploy/glasapp.env
```

`deploy/glasapp.env` is git-ignored and is never copied into the image. Fill it in. Variable
names only are listed here; the values come from you.

| Group | Names |
|---|---|
| Required. The server stops at start-up without them | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` when `NODE_ENV=production` (the image sets it) |
| Needed for real use | `ADMIN_EMAILS`, one admin secret (`ADMIN_API_SECRET`, or `ADMIN_SECRET`, `CRON_SECRET`, `JOB_SECRET`), `LLM_API_KEY`, `JEV_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` |
| Optional | `LLM_BASE_URL`, `LLM_MODEL_NAME` (every model call uses it when set; unset, DeepSeek uses `deepseek-flash` and OpenAI `gpt-4o-mini`), `OPENAI_API_KEY` (used only when `LLM_API_KEY` is unset), `LOG_LEVEL`, `PORT` (leave it unset with the compose file: the port mapping and the Caddyfile both assume 5000), `DB_POOL_MAX` (database connections, default 10; the session pooler's Pool Size in Supabase is 15 and shared with GlasIntelligence, so raise that first) |
| Scheduled jobs | `SCHEDULER` (must be exactly `on` to run any cron; anything else leaves them off), `DIVISION_STANCES`, `DEBATE_ITEMS`, `QUESTION_ITEMS` |
| Only with the proxy profile | `SITE_DOMAIN` |
| Tests and one-off tools, never on the host | `TEST_DATABASE_URL` (a disposable Postgres, for `npm test` and `npm run test:e2e`), `E2E_PORT` (port of the e2e server, default 5055), `ROBOTS_SOURCE_DATABASE_URL` (`npm run robots`, read-only copy source), `DIRECT_URL` (a non-pooled URL for `db:migrate`, wins over `DATABASE_URL`) |

Leave a line commented out (`# NAME=`) when you have no value. An empty value is not the same
as unset: an empty `SUPABASE_SERVICE_ROLE_KEY` stops the server.

The compose file builds the client with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`, so the
browser and the server always use the same Supabase project. Those two values are fixed when
the image is built. Change one, then rebuild. A variable already exported in your shell beats
the file when Compose reads it for the build, so build from a shell that does not export
`SUPABASE_URL` or `SUPABASE_ANON_KEY` (a different value there would bring the 401 problem back).

Quotes are not needed in the file, with one exception: Compose expands `$` in an unquoted
value. Single-quote any value that contains `$`, and check it with
`docker compose --env-file deploy/glasapp.env -f deploy/compose.yml config`.

## 2. Set up Supabase

The Supabase project (GlasCore) is **shared with GlasIntelligence**. Add to its settings. Do
not replace what is there.

In Authentication, URL Configuration:

- Add these to the **Redirect URLs** allow-list:
  - `https://<domain>/auth/callback`
  - `https://<domain>/auth/reset-password`
- **Site URL** is one value for the whole project. Set it to `https://<domain>` only if
  nobody else relies on it. Ask whoever runs GlasIntelligence first.

The app sends its own redirect address with every sign-in, sign-up and reset. Supabase
accepts it only if it is on the allow-list. If it is missing, the user lands on the Site URL
instead.

The reset-password email template is also one value for the whole project. The app's reset page
reads `?token_hash=...&type=recovery`, so the link in the template must be
`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. Do not use `{{ .SiteURL }}`: it may
still be GlasIntelligence's domain. Agree any template change with whoever runs GlasIntelligence
first.

## 3. Migrations (manual, from `main` only)

The server never changes the schema. A human applies migrations, from a checkout of `main`,
before the release that needs them goes live:

```
git checkout main
git pull
npm ci
# set DIRECT_URL in your shell to the GlasCore session pooler connection string
npm run db:migrate
```

Set `DIRECT_URL`, not `DATABASE_URL`. `drizzle.config.ts` reads `DIRECT_URL` first and also loads
the checkout's `.env`. A `DIRECT_URL` left in that `.env` would beat a `DATABASE_URL` from your
shell, and the migration would run against the wrong database. A value set in the shell beats
`.env`, so a shell `DIRECT_URL` always wins.

Do not use `npm run db:push`, and do not add a migrate step to the image or to start-up.
`drizzle-kit` is a dev dependency, so it is not inside the production image. Each migration
must finish inside the 2-minute statement limit.

### Indexes and constraints on a big table

`db:migrate` runs every pending migration in one transaction, so a migration cannot use
`CREATE INDEX CONCURRENTLY`, and a plain `CREATE INDEX` blocks writes to its table until it is
built. Every table so far is small enough for that (0030 builds its biggest index, on ~70k
speeches, in well under a second). When a table is too big for that (for example `policy_votes`
or `news_articles` once they hold millions of rows):

1. Before the release, build the index by hand on GlasCore, outside any transaction:
   `CREATE INDEX CONCURRENTLY IF NOT EXISTS <name> ON politics.<table> (...);`
   If it fails it leaves an INVALID index: `DROP INDEX CONCURRENTLY <name>;` and run it again.
2. Ship the migration with the same statement as `CREATE INDEX IF NOT EXISTS <name> ...`
   (hand-edit what `db:generate` writes). On GlasCore it is then a no-op; on a fresh database
   it builds the index.

A new constraint on a big table: add it `NOT VALID` (only new rows are checked, no long lock),
then `VALIDATE CONSTRAINT` in the same or a later migration (it reads the rows but does not
block writes). 0027 is an example. If old rows may break the rule, find them first and say in
the migration how to fix them, since a failed `VALIDATE` rolls the whole `db:migrate` back.

## 4. Build and first boot

```
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml up -d --build
```

`SCHEDULER` is `off` unless you set it in `deploy/glasapp.env`, so this first boot runs no
cron. Check it:

```
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml ps
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/api/parliament/status
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml logs app
```

Expect `healthy`, a 200 from `/health`, JSON from the status call, and the log line
`SCHEDULER is not "on": no scheduled jobs will run`. Always pass `--env-file` too. Compose reads
`deploy/glasapp.env` for the build arguments and for `SCHEDULER`, and `env_file` in the
compose file hands the same variables to the container.

Profile pictures are saved in the `uploads` volume (`/app/public/uploads`). Back it up. The
GeoJSON under `public/assets` is part of the image.

## 5. HTTPS

```
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml --profile proxy up -d
```

This starts Caddy, which gets and renews the certificate for `SITE_DOMAIN` and proxies to the
app. Ports 80 and 443 must reach the host. The app itself listens on `127.0.0.1:5000` only.

The app trusts **exactly one proxy hop** (`trust proxy` is `1`). Caddy is that hop. Do not put
a second proxy in front of it, such as an orange-cloud CDN. If you do, rate limits see the
proxy's address instead of the visitor's. If you use a CDN, set the DNS record to DNS-only.

## 6. Turning the crons on

Turn them on only when all of these are true:

- The first boot checks above pass.
- Migrations are applied and `LLM_API_KEY`, `JEV_API_KEY` and `CLOUDFLARE_ACCOUNT_ID` are set.
- No other copy of the app (a laptop, an old host) runs crons against the same database. A
  scoring run changes real TD scores, and two writers at once have deadlocked before.

Set `SCHEDULER=on` in `deploy/glasapp.env` and run the same `up -d` command. The jobs are:
news ingest every two hours at :30 past odd hours, news to TD links every two hours, the
parliament sync at 04:45 and the leave watch on Mondays at 06:15 (all Europe/Dublin).
`DIVISION_STANCES=on`, `DEBATE_ITEMS=on` and `QUESTION_ITEMS=on` each add a model-calling step to
the 04:45 run. Leave them off until you want that cost. `DIVISION_STANCES` only reads new divisions
into the database: nothing becomes a public TD stance until someone runs `npm run stances --
--divisions --audit`, checks the matches by hand, and then runs `--divisions --sync`.

- `DEBATE_ITEMS=on` reads at most 30 argued debates a night. Every argued debate on GlasCore
  (454, checked 2026-10-10) already has a finished v3 read, so this reads only new or changed
  debates. It is not a backfill.
- `QUESTION_ITEMS=on` reads at most 100 question exchanges a night. All 5,573 exchanges on
  GlasCore were read on 2026-10-10, so this too reads only new or changed ones. The first sync with
  the 2026-10-12 splitter makes 5,593 exchanges and resets 81 reads; read those by hand straight
  after that sync (`docs/plans/question-sessions.md`, "review fixes").
- These counts are for GlasCore. A different database may still hold unread debates or exchanges,
  and a flag there would read them, at most 30 or 100 a night.

`SCHEDULER` must be exactly `on`. Any other value, or none, leaves every cron off.

The start-up log line `Scheduler initialized` says which of the three flags are on. Every run is
recorded in `politics.job_runs` (started, finished, `ok`, the job's own counts) and logged as JSON
with `job` and `ok` fields. To see the latest runs of each job:

```
curl -H "x-admin-secret: $ADMIN_API_SECRET" http://127.0.0.1:5000/api/admin/jobs
```

`ok: false` means the job threw, or finished with part of its work failed (a sync day, a feed,
a disclosure file, items held back, a run stopped because the model account is out of credit).
A run with no `finished_at` is still going, or the process died during it.

To turn the crons off again, set `SCHEDULER=off` (or remove the line) and run `up -d` again.

## Updating

```
git pull
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml up -d --build
```

Apply any new migrations first (section 3). The update restarts the one container, so expect a
short gap.
