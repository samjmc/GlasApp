# Glas Politics

An Irish political analysis site: a political quiz and party matching, TD scores built from the
Oireachtas record, party pledges, news linked to TDs, daily policy votes and a constituency map.

[MIT licence](LICENSE). CI runs on every pull request (`.github/workflows/ci.yml`).

## Quick start

You need Node 22 (see `.nvmrc`), npm and a Postgres database for the `politics` schema (the
GlasCore Supabase project, or any Postgres you can throw away).

```bash
git clone https://github.com/samjmc/GlasApp.git
cd GlasApp
npm ci
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
# Edit .env: DATABASE_URL and the Supabase keys. SCHEDULER=off is already set; keep it.
npm run db:migrate       # creates the `politics` schema
npm run sync-tds         # loads the TDs from the Oireachtas roster (scoring needs them)
npm run dev
```

Open http://localhost:5000.

`SCHEDULER=off` matters: `DATABASE_URL` in `.env.example` points at the shared GlasCore database,
and with the scheduler on, a local run starts the crons (news ingest, scoring, parliament sync)
against it. Two writers at once have deadlocked before.

Environment variables: the table in [docs/deploy.md](docs/deploy.md#1-create-the-variables-file)
is the list. `.env.example` is the local-development subset.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Server with reload (`tsx watch`) and Vite for the client |
| `npm run check` | TypeScript type check (`tsc`) |
| `npm run lint` | ESLint (`eslint.config.js`). Every rule is a warning for now, and CI does not fail on them |
| `npm test` | Vitest unit and integration tests |
| `npm run test:e2e` | Playwright browser tests (needs `TEST_DATABASE_URL`, see below) |
| `npm run build` | Client bundle in `dist/public`, server bundle in `dist/index.js` |
| `npm run start` | Run the production build |
| `npm run db:generate` | Write a migration from a change in `shared/schema/` |
| `npm run db:migrate` | Apply the migrations in `drizzle/` |
| `npm run db:studio` | Drizzle Studio |

The scheduled jobs also run by hand (`npm run sync-tds`, `news:tds`, `scores:recalculate`,
`stances`, `parliament:sync`, ...): see `scripts` in `package.json`.

Do not use `npm run db:push`: migrations are generated, reviewed and applied with `db:migrate`
([docs/deploy.md](docs/deploy.md#3-migrations-manual-from-main-only)).

## Tests

- `npm test` runs without a database. The integration suites need a disposable Postgres in
  `TEST_DATABASE_URL` and are skipped without it. CI runs them against a real Postgres and fails
  if any is skipped. Never point `TEST_DATABASE_URL` at GlasCore.
- Tests run in Node. A React component test (`*.test.tsx`, Testing Library) starts with
  `// @vitest-environment jsdom`; `client/src/contexts/AuthContext.test.tsx` is an example.
- `npm run test:e2e` needs the same variable, plus `npx playwright install chromium` once. It builds
  the app, creates a throwaway `<db>_e2e` database and starts the built server on it.
- CI (`.github/workflows/ci.yml`) has six jobs: `typecheck`, `test`, `build`, `e2e`,
  `migration-guard` (a merged migration is never edited, a new one is always newer) and `image` (the
  production Docker image builds, boots, answers `/health` and stops cleanly).

## How it is laid out

```
client/src/    React 18, Vite, Wouter, TanStack Query, Radix UI, Tailwind
server/        Express API, one folder per area (routes, auth, parliament, scoring,
               news, ideology, quiz, voting, pledges, jobs, ...)
shared/        Code and Drizzle schema (shared/schema/) used by both
drizzle/       SQL migrations
deploy/        Compose file, Caddyfile and env template for one Docker host
scripts/       CI helpers and one-off tools
test/e2e/      Playwright specs
docs/          Runbooks and design notes
```

One Node process serves the API and the built client. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Documentation

| Document | What is in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | The shape of the system in one page |
| [docs/deploy.md](docs/deploy.md) | Run it on a Docker host: variables, migrations, first boot, HTTPS, crons |
| [docs/launch-checklist.md](docs/launch-checklist.md) | What stands between the container and a public launch |
| [docs/auth.md](docs/auth.md) | Authentication: the one mechanism, the guards |
| [docs/scoring.md](docs/scoring.md) | How a TD's score is built |
| [docs/architecture/](docs/architecture/) | Ideology matching and the party quiz |
| [docs/plans/](docs/plans/) | Design plans, one per area |
| [docs/security/](docs/security/) | Security audits |

## Deployment

GlasApp ships as one Docker image (`Dockerfile`) with a Compose file and an optional Caddy HTTPS
proxy in `deploy/`. Run a single instance only: rate limits, caches and locks live in process
memory, so it does not run on serverless platforms or behind a CDN that adds a second proxy hop.
The runbook is [docs/deploy.md](docs/deploy.md).

## Contributing

Branch off `main`, open a pull request, and let CI pass. Never commit straight to `main`.
Match the code around your change, and update the docs it makes wrong.
