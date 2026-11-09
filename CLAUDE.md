# CLAUDE.md

Notes for an AI coding agent working in this repo. Humans: start with [README.md](README.md).

## What this is

Glas Politics: an Irish political analysis site (political quiz and party matching, TD scores from
the Oireachtas record, pledges, news linked to TDs, daily policy votes, a constituency map). One
Node process serves the JSON API and the built React client. The shape of the system is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Stack and layout

- `server/`: Express 5 + TypeScript, one folder per area. Postgres through Drizzle (`server/db.ts`).
  Auth is a Supabase access token in `Authorization: Bearer` ([docs/auth.md](docs/auth.md)).
- `client/src/`: React 18, Vite, Wouter, TanStack Query, Radix UI, Tailwind.
- `shared/`: code used by both; the Drizzle schema is in `shared/schema/` (schema `politics`).
- `drizzle/`: SQL migrations. `test/e2e/`: Playwright specs. `scripts/ci/`: CI guards and the
  generated-docs tools. `deploy/`: Compose file, Caddyfile and env template.

Imports: `@/` is `client/src/`, `@shared/` is `shared/`.

## Run it locally

Node 22 (`.nvmrc`). Copy `.env.example` to `.env` and fill in `DATABASE_URL` and the Supabase keys.
Keep `SCHEDULER=off`: with it on, a local run starts the crons against whatever database
`DATABASE_URL` names.

```bash
npm ci
npm run db:migrate   # apply drizzle/ to the database in DATABASE_URL
npm run dev          # http://localhost:5000
```

A job (`npm run sync-tds`, `stances`, `parliament:sync`, ...) that writes to a database not on this
machine prints its target and stops unless you pass `-- --yes`.

## Before you open a pull request

CI (`.github/workflows/ci.yml`) runs these, and every one must pass:

```bash
npm run check        # tsc for the app, then for tests and configs
npm run lint         # every ESLint rule is an error
npm test             # vitest; integration suites need TEST_DATABASE_URL
npm run facts:check  # docs/generated/ is up to date (fix: npm run facts, commit the result)
npm run docs:check   # doc links resolve, `npm run` names exist, server env vars are in .env.example
npm run build
```

- Integration tests run only with `TEST_DATABASE_URL` set to a throwaway Postgres; locally they
  skip, in CI a skipped test fails the job. Never point it at a shared or production database.
- `npm run test:e2e` (Playwright) needs the same variable.
- The client has little component test setup: page wiring is often tested by reading the source as
  text next to a pure-function test (see `client/src/lib/quizSaveStatus.test.ts`).

## Database changes

Change `shared/schema/`, then `npm run db:generate` and review the SQL it writes in `drizzle/`.
Never edit a merged migration (CI's `migration-guard` rejects it) and never use `db:push`.
Migrations are applied by hand from `main` ([docs/deploy.md](docs/deploy.md), section 3); nothing
runs them at boot.

## Rules worth knowing

- One instance only: rate limits and locks live in process memory, and `trust proxy` is one hop.
- Political opinions are special-category data: saving a quiz result or vote needs recorded consent
  (`server/account/consent.ts`, `shared/consent.ts`).
- Fetching a URL a third party chose (news pages, images) goes through `server/news/safeFetch.ts`.
- Environment variables: the table in [docs/deploy.md](docs/deploy.md) is the list;
  [docs/generated/env.md](docs/generated/env.md) shows every reader.
- Coding, planning and git habits: [.claude/rules/](.claude/rules/).

## Docs

| Document | What is in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | The system in one page |
| [docs/deploy.md](docs/deploy.md) | Docker host runbook: variables, migrations, first boot, HTTPS, crons |
| [docs/auth.md](docs/auth.md) | Authentication and the four guards |
| [docs/scoring.md](docs/scoring.md) | How a TD's score is built |
| [docs/generated/](docs/generated/) | Routes, jobs and env vars, generated from the code |
| [docs/plans/](docs/plans/) | Design plans, one per area |
