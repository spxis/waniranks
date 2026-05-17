# Copilot Instructions — UmaKuma

This repository uses [AGENTS.md](../AGENTS.md) as the single source of truth for
agent behavior. Read it first. This file adds Copilot-specific orientation that
saves tool calls on every request.

## Stack snapshot

- **Framework**: Next.js 16 (App Router) — APIs and conventions differ from
  pre-15 docs you may have memorized. When unsure, read
  `node_modules/next/dist/docs/` before writing code.
- **Runtime**: Node 24.x, **package manager: pnpm 10.33.0** (never `npm`/`yarn`).
- **DB**: Neon Postgres via Prisma 6 (`prisma/schema.prisma`).
- **Auth**: next-auth + invite codes + admin header (`x-admin-key`). See
  `src/lib/admin.ts`, `src/lib/inviteSession.ts`, `src/lib/auth.ts`.
- **External API**: WaniKani — helpers under `src/lib/wanikani/`.
- **Validation**: Zod at API boundaries.
- **Data fetching (client)**: SWR.
- **Tests**: Playwright smoke only (no unit test framework).
- **Styling**: Tailwind v4 via PostCSS.

## Common scripts

| Task | Command |
|---|---|
| Dev server | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Lint (auto-fix) | `pnpm lint:fix` |
| LOC gate (≤500 lines under `src/`) | `pnpm loc:check` |
| Quality check (lint + LOC) | `pnpm quality:check` |
| Quality fix then check | `pnpm quality:fix` |
| Smoke against dev | `pnpm test:smoke:local` |
| Smoke against prod build | `pnpm test:smoke:build` |
| Prisma push | `pnpm db:push` |
| Prisma studio | `pnpm db:studio` |
| Seed JLPT | `pnpm db:seed:jlpt` |

Always run `pnpm quality:check` after non-trivial edits in `src/`. If lint issues are auto-fixable, run `pnpm quality:fix` first.

## Repo map (where things live)

- `src/app/` — App Router pages + colocated components.
  - `src/app/api/*/route.ts` — API endpoints; pattern: Zod parse → auth check → work → typed JSON.
  - `src/app/admin/` — admin UI, gated by `x-admin-key`.
  - `src/app/shared/` — cross-page UI/types (study history, modals).
- `src/lib/` — domain + infra (prisma, crypto, auth, wanikani, time/storage helpers).
- `src/lib/wanikani/` — split WaniKani API surface (http, subjects, leaderboard, types).
- `prisma/schema.prisma` — single Prisma schema.
- `scripts/` — Node scripts for seeding/enrichment and the LOC gate.
- `e2e/` — Playwright smoke specs.
- `docs/` — architecture, DRY learnings, JLPT plan. **Skim before designing changes.**
- `BRAND*.md` — voice/copy rules. Read before writing user-facing strings.

## Conventions

- **File size**: hard cap 500 lines under `src/`. When approaching, split per
  the recipe in [AGENTS.md](../AGENTS.md): extract types → extract helpers →
  split JSX into focused subcomponents. Never bypass with flags or nesting.
- **Types/Props**: shared types go in adjacent `*.types.ts` (UI) or
  `lib/*Types.ts` (domain), not inline in components.
- **Time/date formatting**: use `src/lib/timeFormat.ts`. Do not re-implement.
- **localStorage**: use `src/lib/clientStorage.ts` and
  `src/lib/usePersistedBoolean.ts`.
- **Secrets**: WaniKani tokens are encrypted with AES-256-GCM via
  `src/lib/crypto.ts` (requires `TOKEN_ENCRYPTION_KEY`). Never log or echo
  tokens.
- **Admin endpoints**: must verify `x-admin-key` via `src/lib/admin.ts`.
- **Async UI**: distinguish loading from empty — see DRY learning #2 in
  `docs/DRY_LEARNINGS.md`.
- **Component constants**: within a component group/folder, use one shared
  constants file (for example `StudyExplorer.constants.ts`) rather than one
  constants file per component file.
- **Domain literals**: avoid inline runtime string comparisons for domain values
  (for example queue type, subject type, status, review outcomes). Put domain
  constants + predicate helpers in `lib/` and consume them from components.
- **Domain type aliases**: for canonical domain values, use shared aliases
  (for example `SubjectType`, `WkStatus`) instead of duplicating inline string
  unions in type declarations. Inline unions are only for adding non-domain
  values (example: `"all" | SubjectType`).
- **Proactive sweep**: when fixing literals/constants drift, run a repo-wide
  sweep for both runtime literals and duplicated inline unions in the same
  domain and fix all hits in one pass before commit.

## Don't touch

- `next-env.d.ts` (generated)
- `node_modules/` (read-only reference for Next docs)
- `prisma/migrations/` (treat as historical; new changes via considered migrations)
- `skills-lock.json` unless updating skills

## Workflow defaults

- After implementing: commit and push (user preference). Use Conventional
  Commits, subject ≤ 50 chars.
- Don't create new markdown docs to describe your changes unless asked.
- Prefer editing existing files over creating new ones.
