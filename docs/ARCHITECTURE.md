# WaniRanks Architecture

## Overview

WaniRanks is a Next.js App Router application with:

- Public leaderboard page at `/`
- Private admin page at `/admin`
- API routes under `/api/*` for account management and refreshes
- Neon Postgres as the system of record via Prisma
- Encrypted WaniKani API tokens stored at rest in Postgres

The app is designed so local development and Vercel deployment can use the same cloud database by sharing the same environment variable names.

## Runtime Components

### Next.js app layer

- Server-rendered public page reads leaderboard rows from Prisma.
- Client-side admin page submits admin-authenticated API requests.

Key files:

- `src/app/page.tsx`
- `src/app/admin/page.tsx`

### API layer

- `POST /api/accounts`
  - Validates payload with Zod
  - Verifies `x-admin-key`
  - Calls WaniKani API using provided token
  - Encrypts token before persistence
  - Upserts account by nickname
- `GET /api/leaderboard`
  - Returns sorted leaderboard rows
- `POST /api/leaderboard/refresh`
  - Verifies `x-admin-key`
  - Loads encrypted tokens
  - Decrypts and refreshes stats for all accounts

Key files:

- `src/app/api/accounts/route.ts`
- `src/app/api/leaderboard/route.ts`
- `src/app/api/leaderboard/refresh/route.ts`

### Domain and infrastructure libraries

- `src/lib/prisma.ts`
  - Singleton Prisma client with dev-safe global caching
- `src/lib/wanikani.ts`
  - WaniKani API integration (`/user` and `/reviews`)
  - Score formula: `score = wkLevel * 1000 + reviewCount`
- `src/lib/crypto.ts`
  - AES-256-GCM encryption/decryption for tokens
  - Requires `TOKEN_ENCRYPTION_KEY` (32-byte base64)
- `src/lib/admin.ts`
  - Header-based admin authorization (`x-admin-key`)

## Data Model

Prisma schema in `prisma/schema.prisma` defines one model:

- `Account`
  - Identity: `id`, `nickname` (unique), `wkUserId` (unique)
  - Secret storage: `tokenEncrypted`, `tokenIv`, `tokenTag`
  - Leaderboard metrics: `wkUsername`, `wkLevel`, `reviewCount`, `score`, `lastSyncedAt`
  - Audit timestamps: `createdAt`, `updatedAt`

## Data Flow

### Add or update account

1. Admin submits nickname + token from `/admin`.
2. API validates payload and admin key.
3. API calls WaniKani to fetch user and review counts.
4. API encrypts token and upserts account record.
5. Public leaderboard reflects updated row.

### Refresh leaderboard

1. Admin clicks refresh from `/admin`.
2. API authenticates admin request.
3. API fetches all encrypted tokens.
4. Tokens are decrypted in memory only.
5. For each account, fresh WaniKani stats are fetched and persisted.

## Environment Configuration

Required variables:

- `DATABASE_URL`: Neon pooled connection URL (runtime queries)
- `DIRECT_URL`: Neon direct connection URL (Prisma schema operations)
- `TOKEN_ENCRYPTION_KEY`: 32-byte base64 key for AES-256-GCM
- `ADMIN_API_KEY`: shared secret required by admin endpoints

Notes:

- Local uses `.env`.
- Vercel uses Project Environment Variables with the same names.
- A single Neon database can be shared across local and Vercel for small personal deployments.

## Deployment Architecture

- Source control: GitHub repository
- CI/CD: Vercel deploys from Git pushes
- Database: Neon Postgres (managed)
- ORM: Prisma client generated at install/build time

Typical production flow:

1. Push commit to GitHub main.
2. Vercel builds Next.js app.
3. Runtime reads env vars from Vercel settings.
4. API and pages query Neon through Prisma.

## Security Considerations

- WaniKani tokens are encrypted at rest, not stored plaintext.
- Admin endpoints require `x-admin-key` matching `ADMIN_API_KEY`.
- Keep `.env` out of source control.
- Rotate `ADMIN_API_KEY` and encryption key if exposure is suspected.

## Operational Notes

- `pnpm db:push` applies schema to Neon.
- `pnpm build` verifies production build locally.
- `lastSyncedAt` indicates freshness of each account snapshot.
