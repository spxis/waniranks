UmaKuma is a family WaniKani leaderboard app.

- Public page: everyone can view rankings.
- Admin page: only you can add/update account tokens.

Tokens are encrypted at rest before being stored in the database.

## Architecture

See `docs/ARCHITECTURE.md` for system design, data flow, security, and deployment details.

## Getting Started

0. Use Node.js 24 LTS (matches Vercel).

```bash
nvm install 24
nvm use 24
```

1. Create env vars and fill in your Neon connection strings.

```bash
cp .env.example .env
```

- `DATABASE_URL`: Neon pooled connection string (host usually includes `-pooler`)
- `DIRECT_URL`: Neon direct connection string (non-pooler host)
- `TOKEN_ENCRYPTION_KEY`: generate with `openssl rand -base64 32`
- `ADMIN_GOOGLE_ALLOWED_EMAILS`: comma-separated Google OAuth emails allowed to access `/admin`

2. Push the Prisma schema.

```bash
pnpm db:push
```

3. Run the development server.

```bash
pnpm dev
```

Open [http://localhost:6400](http://localhost:6400) with your browser to see the result.

Use [http://localhost:6400/admin](http://localhost:6400/admin) to add family accounts with an allowlisted Google OAuth account.

## WaniKani Sync Best Practices (Implemented)

- Respect rate limits by serializing API requests with a minimum gap (`LEADERBOARD_REQUEST_GAP_MS`, default 1000).
- Avoid unnecessary full re-fetches by using incremental assignment sync via `updated_after`.
- Use conditional requests (`If-None-Match` / `If-Modified-Since`) for stable endpoints and reuse stored counts when unchanged.
- Persist assignment cache and request metadata in `Account` JSON columns.

After pulling schema changes, run `pnpm db:push` so the new `Account` cache fields exist.

## Deployment (Free)

Deploy on Vercel Hobby and use Neon Postgres Free.

### Current Deployment Workflow (April 2026)

Use this flow for production deploys right now:

1. Commit and push app changes to `main`.

```bash
git push origin main
```

2. Confirm deployment started/completed in Vercel CLI.

```bash
vercel list umakuma
vercel inspect <latest-deployment-url>
```

3. Production is live when status is `Ready`.

Primary alias:

- `https://umakuma.vercel.app`

### Important GitHub Scope Note

If a push includes files in `.github/workflows/*`, GitHub may reject the push when the current OAuth token does not include `workflow` scope.

Error looks like:

- `refusing to allow an OAuth App to create or update workflow ... without workflow scope`

If this happens, use one of these options:

- Push non-workflow app changes first (recommended for fast ship).
- Re-auth with workflow scope (`gh auth refresh -h github.com -s workflow`).
- Use SSH transport/key for git pushes.

### Manual Fallback Deploy

If GitHub-triggered deploys are delayed, deploy directly from local:

```bash
vercel --prod
```

Required Vercel environment variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `TOKEN_ENCRYPTION_KEY`
- `AUTH_SECRET` (required for Google OAuth sessions)
- `AUTH_GOOGLE_ID` (Google OAuth client ID)
- `AUTH_GOOGLE_SECRET` (Google OAuth client secret)
- `ADMIN_GOOGLE_ALLOWED_EMAILS` (comma-separated admin emails, e.g. `you@gmail.com,partner@gmail.com`)
- `LEADERBOARD_REFRESH_INTERVAL_MS` (optional, default `300000`)
- `LEADERBOARD_REQUEST_GAP_MS` (optional, default `1000`)
- `SUMILABU_TELEMETRY_URL` (optional, default `https://api.sumilabu.com/api/v1/telemetry/events`)
- `SUMILABU_INGEST_TOKEN` (required to enable telemetry posting)
- `SUMILABU_PROJECT_KEY` (optional, default `umakuma`)
- `SUMILABU_SOURCE_TYPE` (optional, default `server`)
- `SUMILABU_SOURCE_ID` (optional, default `umakuma-web`)
- `SUMILABU_DISPLAY_NAME` (optional, default `UmaKuma`)
- `SUMILABU_SERVICE` (optional, default `next-api`)

## Admin Auth

Admin access is Google OAuth allowlist only.

1. Create OAuth Client credentials in Google Cloud Console.
2. Add authorized redirect URI(s):
	- `https://<your-custom-domain>/api/auth/callback/google`
	- `https://<your-vercel-deployment-domain>/api/auth/callback/google` (optional fallback)
3. Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, and `ADMIN_GOOGLE_ALLOWED_EMAILS` in Vercel.
4. Set `NEXTAUTH_URL` in Vercel to your canonical public origin (for example `https://<your-custom-domain>`).
4. Open `/admin` and click `Sign in with Google`.

Generate encryption key with:

```bash
openssl rand -base64 32
```

## Scripts

- `pnpm dev`: start app locally
- `pnpm lint`: run ESLint
- `pnpm loc:check`: enforce 500-line max for code files in `src/`
- `pnpm db:push`: sync Prisma schema to the DB
- `pnpm db:studio`: open Prisma Studio
- `pnpm db:seed:jlpt`: refresh JLPT N-level membership list
- `pnpm db:enrich:jlpt`: enrich JLPT kanji metadata (stroke count, meanings, on/kun readings)

## JLPT Data Refresh Strategy (Manual)

JLPT data refresh is intentionally manual and infrequent.

1. Refresh the JLPT membership list.

```bash
pnpm db:seed:jlpt
```

2. Enrich JLPT kanji metadata.

```bash
pnpm db:enrich:jlpt
```

3. Optional admin API triggers (on demand):

- `POST /api/jlpt/refresh` (refresh JLPT N-level list)
- `POST /api/jlpt/enrich` with JSON body like `{ "limit": 250, "onlyMissing": true }`

Both endpoints require admin authorization (allowlisted Google OAuth session).
