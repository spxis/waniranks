---
name: prisma-schema
description: Prisma 6 schema and Neon Postgres workflow for UmaKuma. Use when adding/changing fields on the Account model, working with JSON columns (assignmentCache, jlptCounts, itemSpread, wkHttpCache, level/last-gurued items), running db:push, or seeding JLPT data.
---

# Prisma schema skill (UmaKuma)

## Workflow: this repo uses `db push`, not migrations

- Schema lives at `prisma/schema.prisma`.
- Apply changes with `pnpm db:push` (no migration files generated).
- `prisma/migrations/` exists as historical record — do NOT add new
  migrations there unless the user explicitly switches workflow.
- After any schema edit:

  ```bash
  pnpm db:push        # syncs schema to Neon
  pnpm postinstall    # runs `prisma generate` (or run it directly)
  pnpm lint
  pnpm build
  ```

## The `Account` model is wide and JSON-heavy

Several fields are `Json?` and store structured WaniKani-derived data:

- `assignmentCache` — recent WK assignments + `assignmentCacheUpdatedAt`.
- `jlptCounts` — per-level JLPT progress derived from WK subjects.
- `itemSpread` — distribution per SRS stage; see `src/lib/itemSpread.ts`.
- `wkHttpCache` — etag/last-modified per WaniKani endpoint for conditional
  requests (paired with `fetchWaniKani` in `src/lib/wanikani/http.ts`).
- `levelKanjiItems`, `last{Radical,Kanji,Vocabulary}GuruedItem` — UI data.

Rules:

- Define a TS type for each JSON shape in `src/lib/*Types.ts` and import it
  at every read/write site. Do not use untyped `Record<string, unknown>`.
- Always update the writer AND every reader when the shape changes — Prisma
  won't catch JSON shape drift.
- Treat `null` and missing keys defensively when reading old rows.

## Sync / lock fields

- `isSyncing`, `syncLockUntil`, `nextSyncAllowedAt`, `lastSyncStatus`,
  `lastSyncError` are managed by `src/lib/sync.ts` and
  `src/lib/refreshPolicy.ts`. Do not hand-toggle them in route handlers —
  use the helpers.

## Token columns

- `tokenEncrypted`, `tokenIv`, `tokenTag` are AES-256-GCM (`src/lib/crypto.ts`).
- Never `select: { tokenEncrypted: true }` and return it in JSON.
- When reading for a WK call, decrypt server-side immediately before the
  request and discard the plaintext after.

## Seeding JLPT

- `pnpm db:seed:jlpt` — base JLPT levels.
- `pnpm db:seed:jlpt:readings` — readings from `src/data/jlptReadings.json`.
- `pnpm db:enrich:jlpt` — enrichment pass.
  Scripts live in `scripts/`. Re-run order matters; check the script header
  before running out-of-band.

## Common pitfalls

- Adding a non-nullable field without a default will break `db push` against
  rows that exist. Add `@default(...)` or make it nullable, then backfill.
- Renaming a column with `db push` is destructive (drop + add). For renames,
  use a temporary additive field, backfill, then remove the old one.
- Forgetting `prisma generate` after a schema edit causes stale TS types.
