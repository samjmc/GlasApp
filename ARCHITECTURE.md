# Architecture

GlasApp is one Node process in one Docker container. It serves the JSON API and the built React
client, talks to one Postgres database, and runs a few scheduled jobs. The runbook is
[docs/deploy.md](docs/deploy.md); this page is the shape of the system.

```
Browser (React SPA) --HTTPS--> Caddy (optional, one proxy hop)
                                  |
                                  v
                    Express process (server/index.ts, port 5000)
                      /api/*       routes -> services -> Drizzle -> Postgres
                      /health      answers before any middleware
                      /uploads     profile pictures (a volume)
                      /geo         two map files (public/assets)
                      everything else: the built client (dist/public), SPA fallback
                      node-cron    scheduled jobs (server/services/scheduler.ts)
                                  |
              Postgres (GlasCore Supabase project, schema `politics`)
              Supabase Auth (sign-in, token check) / DeepSeek or OpenAI / Cloudflare Workers AI
```

## Rules that shape everything

- **One instance only.** Rate limits, the cache (unless `REDIS_URL` is set) and the parliament-sync
  lock live in process memory. A second copy would not share them, so it does not run serverless,
  scaled out, or behind a second proxy or CDN. `app.set('trust proxy', 1)` trusts exactly one hop.
- **Migrations are manual and never run at boot.** `npm run db:migrate` from a checkout of `main`
  (docs/deploy.md section 3). CI's `migration-guard` job rejects an edited merged migration.
- **The server never trusts the client for identity.** See below.

## Server (`server/`)

| Folder | What it does |
|---|---|
| `routes/` | HTTP routes, registered by `registerRoutes` |
| `auth/` | Guards (`requireAuth`, `optionalAuth`, `requireAdmin`, `requireJob`): [docs/auth.md](docs/auth.md) |
| `middleware/` | Security headers (CSP is report-only for now), rate limits, error handler, region |
| `account/` | Consent, data export, account deletion, profile pictures |
| `parliament/` | The Oireachtas record: members, votes, questions, debates, committees |
| `scoring/` | TD scores from that record: [docs/scoring.md](docs/scoring.md) |
| `news/`, `stances/` | News ingest, news linked to TDs, stances with evidence |
| `quiz/`, `ideology/`, `voting/`, `pledges/`, `partyQuiz/` | The quiz and everything built on it |
| `jobs/` | The command line entry points behind `npm run sync-tds`, `stances`, ... |
| `services/` | The scheduler and the model-calling service |
| `db.ts` | The `pg` pool and the Drizzle client |

Scheduled jobs (Europe/Dublin): news ingest every two hours at :30 past odd hours, news to TD links
every two hours, the parliament sync at 04:45 and the leave watch on Mondays at 06:15.
`SCHEDULER=off` stops all of them. Three more model-calling steps are opt-in
(`DIVISION_STANCES`, `DEBATE_ITEMS`, `QUESTION_ITEMS`; see docs/deploy.md section 6).

## Identity

The client signs in with Supabase and sends the access token as `Authorization: Bearer`. The server
verifies it on each request and puts the caller on `req.user`. There is no server-side session and no
cookie identity. Admin comes from `app_metadata.role` or the `ADMIN_EMAILS` allow-list (confirmed
emails only), never from anything the user can edit. Machine callers send the job secret in
`x-admin-secret` or `x-cron-secret`. Full detail: [docs/auth.md](docs/auth.md).

## Data

All tables are in the `politics` schema, defined in `shared/schema/` with Drizzle and changed only
through the SQL migrations in `drizzle/`. Row level security is on for every table with no policy,
and `anon` and `authenticated` have no grant on the schema: the browser never reads the database,
only the server does (migration 0026). Political opinions are special-category data, so saving
a vote or quiz result needs recorded consent (`server/account/consent.ts`, `shared/consent.ts`).

## Quiz and ideology

One model for users, TDs and parties. Full design: `docs/architecture/ideology-matching.md`.

1. The client shows the one question bank (`shared/quiz.ts`) and sends answer choices only:
   `POST /api/quiz`. Anyone can take it.
2. The server scores it (`server/quiz`). A signed-in result is saved to `politics.quiz_results`
   and the user's profile is recomputed; an anonymous result is returned and not saved.
3. A user's profile = their latest quiz plus every policy vote (`server/voting`).
   A TD's profile = party baseline plus stance evidence from articles (and later debates) in
   `politics.td_ideology_evidence`. A party = the mean of its TDs. All live in
   `politics.ideology_profiles` and rebuild with `npm run ideology -- --recalculate`.
4. Matches (`/api/ideology/me/matches`, public `POST /api/ideology/matches`) use one alignment formula.

## Client (`client/src/`)

React 18 with Vite, Wouter for routing (routes load lazily), TanStack Query for server state,
Radix UI primitives with Tailwind. `pages/` are the screens, `components/` the pieces, `services/` the
API calls, `lib/` the helpers. The constituency map is Leaflet over one GeoJSON file served from
`/geo`. The production client is built into `dist/public` and served by the same Express process.

## Build, test and ship

- `npm run build` writes `dist/public` (Vite) and `dist/index.js` (esbuild, with `node_modules`
  left external). The Dockerfile builds both, then installs production dependencies only.
- CI (`.github/workflows/ci.yml`): `typecheck`, `test` (against a real Postgres), `build`, `e2e`
  (Playwright), `migration-guard`, and `image` (the production image boots and stops cleanly).
- Nothing deploys automatically: an operator builds and runs the image (docs/deploy.md).
