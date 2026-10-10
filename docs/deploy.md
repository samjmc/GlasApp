# Deploying GlasApp

GlasApp runs as one container. One Node process serves the API and the built client on
port 5000. The files for this are `Dockerfile`, `deploy/compose.yml`, `deploy/Caddyfile` and
`deploy/glasapp.env.example`.

Rules that do not bend:

- **One instance only.** Rate limits, the cache (unless `REDIS_URL` is set) and the
  parliament-sync lock live in process memory. A second copy would not share them.
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
| Required. The server stops at start-up without them | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Build time, baked into the client | `VITE_SUPABASE_ANON_KEY` (required), `VITE_SUPABASE_URL` (optional) |
| Needed for real use | `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, one admin secret (`ADMIN_API_SECRET`, or `ADMIN_SECRET`, `CRON_SECRET`, `JOB_SECRET`), `LLM_API_KEY`, `JEV_API_KEY`, `CLOUDFLARE_ACCOUNT_ID` |
| Optional | `LLM_BASE_URL`, `LLM_MODEL_NAME`, `OPENAI_API_KEY` (embeddings), `ANTHROPIC_API_KEY`, `REDIS_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `LOG_LEVEL`, `PORT` |
| Scheduled jobs | `SCHEDULER` (`off` stops every cron), `DIVISION_STANCES`, `DEBATE_ITEMS` |
| Only with the proxy profile | `SITE_DOMAIN` |

Leave a line commented out (`# NAME=`) when you have no value. An empty value is not the same
as unset: an empty `SUPABASE_SERVICE_ROLE_KEY` stops the server.

The `VITE_` values are fixed when the image is built. Change one, then rebuild.

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

## 3. Migrations (manual, from `main` only)

The server never changes the schema. A human applies migrations, from a checkout of `main`,
before the release that needs them goes live:

```
git checkout main
git pull
npm ci
# set DATABASE_URL (or DIRECT_URL, which wins) in your shell to the GlasCore session pooler
npm run db:migrate
```

Do not use `npm run db:push`, and do not add a migrate step to the image or to start-up.
`drizzle-kit` is a dev dependency, so it is not inside the production image. Each migration
must finish inside the 2-minute statement limit.

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
`SCHEDULER=off: no scheduled jobs will run`. Always pass `--env-file` too. Compose reads
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
`DIVISION_STANCES=on` and `DEBATE_ITEMS=on` add a model-calling step to the 04:45 run. Leave
them off until you want that cost.

To turn the crons off again, set `SCHEDULER=off` and run `up -d` again.

## Updating

```
git pull
docker compose --env-file deploy/glasapp.env -f deploy/compose.yml up -d --build
```

Apply any new migrations first (section 3). The update restarts the one container, so expect a
short gap.
