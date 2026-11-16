# Habit Tracker

A personal web app for building habits and managing time: habits that repeat hourly, daily,
weekly or monthly, tasks with time targets, a pomodoro timer per task, a day/week/month
planner, and a dashboard that ties them together.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Prisma on Supabase Postgres, and
Supabase Auth. The full build plan and progress log are in [`Doc/plan.md`](Doc/plan.md).

## Requirements

- Node.js 24 (`.nvmrc` is provided: `nvm use`)
- pnpm (`corepack enable` picks up the pinned version)
- A Supabase project (free tier is enough)

## Setup

1. Install dependencies. This also generates the Prisma client.

   ```bash
   pnpm install
   ```

2. Create `.env` from the example and fill in the four values (see below).

   ```bash
   cp .env.example .env
   ```

3. In the Supabase dashboard, under **Authentication → Sign In / Providers → Email**, make sure
   the email provider is enabled. For local development and for the end-to-end tests, turn
   **Confirm email** off so a new account is signed in immediately.

4. Create the database tables.

   ```bash
   pnpm db:deploy
   ```

5. Start the app and sign up at <http://localhost:3000>.

   ```bash
   pnpm dev
   ```

6. Optional: fill your account with demo data (see [Demo data](#demo-data)).

## Environment variables

`.env` is git-ignored. Never commit it.

| Variable                        | Used by                     | Value                                                                                     |
| ------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | The running app             | Supabase **transaction pooler** connection string, port `6543`, ending `?pgbouncer=true`. |
| `DIRECT_URL`                    | Prisma CLI (migrations)     | Supabase **session pooler** (or direct) connection string, port `5432`.                   |
| `NEXT_PUBLIC_SUPABASE_URL`      | Auth, in browser and server | `https://<project-ref>.supabase.co`                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth, in browser and server | The project's publishable (anon) key.                                                     |

Both connection strings are under **Connect** in the Supabase dashboard. If the database
password contains special characters, URL-encode them (`@` becomes `%40`).

This project uses Prisma 7: the CLI reads `DIRECT_URL` from `prisma.config.ts`, and the app
connects with `DATABASE_URL` through the `pg` driver adapter in `src/lib/prisma.ts`.

## Scripts

| Command              | What it does                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`           | Development server on port 3000.                                         |
| `pnpm build`         | Production build.                                                        |
| `pnpm start`         | Serve the production build.                                              |
| `pnpm lint`          | ESLint.                                                                  |
| `pnpm typecheck`     | Generate route types and run `tsc`.                                      |
| `pnpm format`        | Format with Prettier (`format:check` only checks).                       |
| `pnpm test`          | Unit and component tests (Vitest).                                       |
| `pnpm test:e2e`      | End-to-end tests (Playwright) against the dev server.                    |
| `pnpm test:e2e:prod` | Build, then run the end-to-end tests against `next start` on port 3100.  |
| `pnpm gate`          | Lint, typecheck, unit tests and end-to-end tests against the dev server. |
| `pnpm gate:prod`     | The same, with the end-to-end tests against the production build.        |
| `pnpm db:migrate`    | Create and apply a migration while developing.                           |
| `pnpm db:deploy`     | Apply committed migrations (setup and production).                       |
| `pnpm db:seed`       | Fill one account with demo data.                                         |
| `pnpm db:studio`     | Browse the database with Prisma Studio.                                  |

## Tests

- Unit and component tests live in `tests/unit` and `tests/components` and need no database.
- End-to-end tests live in `tests/e2e`. They run against the database in `.env` and sign up a
  new user for every test (`e2e-<timestamp>@example.com`), so:
  - **Confirm email** must be off in Supabase;
  - test users accumulate in Supabase Auth. Delete them from the dashboard now and then, or
    point `.env` at a separate Supabase project for testing.
- The first run needs a browser: `pnpm exec playwright install chromium`.
- The suite includes an accessibility scan of every screen (axe), a keyboard-only journey, and
  a check of every dashboard number against rows written straight into the database.

## Demo data

Accounts are created by Supabase Auth, so sign up in the app first, then:

```bash
pnpm db:seed you@example.com           # only works on an empty account
pnpm db:seed you@example.com --reset   # deletes that account's data, then seeds
```

This adds five habits with about two months of history, six tasks with focus sessions, and a
few planner blocks, all relative to today in the account's timezone. Only the named account is
touched. The data comes from `prisma/demo-data.ts`.

## Project layout

```
src/app          Routes: (auth) login and signup, (app) dashboard, habits, tasks, planner, settings
src/components   UI by feature
src/actions      Server Actions (all mutations)
src/lib          Date/period maths, streaks, pomodoro state machine, planner and dashboard logic
src/schemas      Zod schemas
prisma           Schema, migrations, seed script
tests            unit, components, e2e
```

All times are stored in UTC. Periods, streaks and due dates are computed in the timezone set
under **Settings**.

## Deploying

See [`Doc/deploy.md`](Doc/deploy.md) for Vercel.
