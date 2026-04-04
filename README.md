WaniRanks is a family WaniKani leaderboard app.

- Public page: everyone can view rankings.
- Admin page: only you can add/update account tokens.

Tokens are encrypted at rest before being stored in the database.

## Getting Started

1. Create env vars.

```bash
cp .env.example .env
```

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
- `TOKEN_ENCRYPTION_KEY`
- `ADMIN_API_KEY`

Generate encryption key with:

```bash
openssl rand -base64 32
```

For production, switch Prisma datasource to PostgreSQL and set `DATABASE_URL` to your Neon connection string.

## Scripts

- `pnpm dev`: start app locally
- `pnpm lint`: run ESLint
- `pnpm db:push`: sync Prisma schema to the DB
- `pnpm db:studio`: open Prisma Studio
