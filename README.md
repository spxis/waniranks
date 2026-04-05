WaniRanks is a family WaniKani leaderboard app.

- Public page: everyone can view rankings.
- Admin page: only you can add/update account tokens.

Tokens are encrypted at rest before being stored in the database.

## Architecture

See `docs/ARCHITECTURE.md` for system design, data flow, security, and deployment details.

## Getting Started

1. Create env vars and fill in your Neon connection strings.

```bash
cp .env.example .env
```

- `DATABASE_URL`: Neon pooled connection string (host usually includes `-pooler`)
- `DIRECT_URL`: Neon direct connection string (non-pooler host)
- `TOKEN_ENCRYPTION_KEY`: generate with `openssl rand -base64 32`
- `ADMIN_API_KEY`: your private admin key for `/admin`

2. Push the Prisma schema.

```bash
pnpm db:push
```

3. Run the development server.

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Use [http://localhost:3000/admin](http://localhost:3000/admin) to add family accounts with your admin key.

## Deployment (Free)

Deploy on Vercel Hobby and use Neon Postgres Free.

Required Vercel environment variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_API_KEY`

Generate encryption key with:

```bash
openssl rand -base64 32
```

## Scripts

- `pnpm dev`: start app locally
- `pnpm lint`: run ESLint
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

Both endpoints require admin authorization (`x-admin-key` or admin session cookie).
