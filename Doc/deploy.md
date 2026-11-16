# Deploying to Vercel

These steps follow from how the app is built. They have not been run against a real Vercel
project yet, so treat the first deployment as the test of them.

## 1. Before you deploy

- Push the repository to GitHub (or GitLab/Bitbucket).
- Decide which Supabase project production will use. The end-to-end tests create real users,
  so a production project separate from the one in your local `.env` is the safer choice.
- Run `pnpm gate:prod` locally. It builds the app and runs every test against the production
  build.

## 2. Create the Vercel project

Import the repository in Vercel. Next.js is detected automatically; no `vercel.json` is needed.

- **Node.js version:** 24 (the project requires `>=24` in `package.json`).
- **Install command:** leave the default. `pnpm install` runs the `postinstall` script, which
  generates the Prisma client into `src/generated` (that folder is git-ignored on purpose).
- **Build command:** override it so production deployments apply migrations first:

  ```bash
  if [ "$VERCEL_ENV" = "production" ]; then pnpm db:deploy; fi && pnpm build
  ```

  `pnpm db:deploy` runs `prisma migrate deploy`, which applies any committed migration that the
  database has not seen and does nothing otherwise. Preview deployments skip it so a branch
  cannot change the production schema.

- **Function region:** pick the region closest to your Supabase project. Every page makes
  several database queries, so distance to the database is the main source of latency.

## 3. Environment variables

Add these under **Settings → Environment Variables** for the Production environment (and
Preview, if you want previews to work):

| Variable                        | Value                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                  | Transaction pooler string, port `6543`, ending `?pgbouncer=true`.  |
| `DIRECT_URL`                    | Session pooler (or direct) string, port `5432`. Used at build time. |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<project-ref>.supabase.co`                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The publishable (anon) key.                                        |

Notes:

- The pooled `DATABASE_URL` matters on Vercel: each function instance opens its own
  connections, and the transaction pooler is what keeps that within Postgres limits.
- URL-encode special characters in the database password.
- The two `NEXT_PUBLIC_` values are compiled into the browser bundle at build time. After
  changing them, redeploy.
- If Preview uses the same variables as Production, previews read and write production data.
  Give Preview its own Supabase project, or leave the variables unset there.

## 4. Supabase settings for production

- **Authentication → URL Configuration:** set **Site URL** to the production URL.
- **Confirm email:** it can be turned on for production. A new user then sees "Check your inbox
  to confirm your email, then sign in" and signs in after confirming. Keep it off in the
  project the end-to-end tests run against.
- The app reads and writes data only through Prisma on the server, always filtered by the
  signed-in user's id. It does not use the Supabase client for table access.

## 5. After the first deployment

Check these by hand:

1. Sign up, land on the empty dashboard.
2. Create a habit and check in; the streak shows 1.
3. Create a task, start a focus session, reload mid-session; the timer continues.
4. Drag a task onto the planner; reload; the block is still there.
5. Under Settings, confirm the timezone matches yours.

Optional: `pnpm db:seed <your email>` from your machine, with `.env` pointing at the production
database, fills that one account with demo data.

## 6. Later changes

- **Schema changes:** create the migration locally with `pnpm db:migrate`, commit the new
  folder under `prisma/migrations`, and deploy. The build command applies it.
- **Rollbacks:** Vercel's instant rollback restores the previous code, not the previous
  schema. Keep migrations backward-compatible (add columns before using them, remove them a
  release after they stop being used) so the previous build still runs.
