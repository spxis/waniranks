<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workspace Gates (Single Source)

This file is the single source of truth for agent behavior in this repo.
`CLAUDE.md` must continue to delegate to this file only.

### File Size Gate

- Code files under `src/` must stay at or below 500 lines.
- Gate command: `pnpm loc:check`
- CI must run this gate on pull requests and pushes to `main`.

### Refactor Rule

- If a file approaches the limit, split by feature responsibility (`components/`, `lib/`, domain modules) rather than adding flags or deeply nested conditionals.

### Types And Props Pattern

- Keep component-local logic in component files, but move exported/shared `type` and `Props` declarations into adjacent helper files (for example `*.types.ts` or `lib/*Types.ts`).
- Prefer importing types from those helper files instead of defining large type blocks inline in UI components.
- When refactoring for LOC compliance, extract types/props first, then extract pure helpers/selectors, then split JSX sections into focused subcomponents.

## Stack

- Next.js 16 (App Router), React 19, TypeScript 5.
- Node 24.x, **pnpm 10.33.0** (never npm/yarn).
- Prisma 6 + Neon Postgres (`prisma/schema.prisma`).
- next-auth + invite codes; admin endpoints gated by `x-admin-key` header.
- Zod for API validation. SWR for client fetching. Tailwind v4.
- Playwright smoke tests only — no unit framework.

## Scripts

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Lint (auto-fix) | `pnpm lint:fix` |
| LOC gate | `pnpm loc:check` |
| Quality check (lint + LOC) | `pnpm quality:check` |
| Quality fix then check | `pnpm quality:fix` |
| Smoke (dev server) | `pnpm test:smoke:local` |
| Smoke (prod build) | `pnpm test:smoke:build` |
| Prisma push / studio | `pnpm db:push` / `pnpm db:studio` |
| Seed JLPT | `pnpm db:seed:jlpt` |

Run `pnpm quality:check` after non-trivial `src/` edits. If lint issues are auto-fixable, run `pnpm quality:fix` first.

## Repo map

- `src/app/` — App Router pages + colocated components.
- `src/app/api/*/route.ts` — API endpoints. Pattern: Zod parse → auth check → work → typed JSON.
- `src/app/shared/` — cross-page UI/types (study history, modals).
- `src/lib/` — domain + infra (prisma, crypto, auth, time/storage helpers).
- `src/lib/wanikani/` — WaniKani API surface (http, subjects, leaderboard, types).
- `scripts/` — seed/enrichment scripts and the LOC gate.
- `e2e/` — Playwright smoke specs.
- `docs/` — architecture, DRY learnings. Skim before designing changes.
- `BRAND*.md` — voice/copy rules. Read before writing user-facing strings.

## Shared utilities (do not re-implement)

- Date/time: `src/lib/timeFormat.ts`
- localStorage: `src/lib/clientStorage.ts`, `src/lib/usePersistedBoolean.ts`
- Token crypto: `src/lib/crypto.ts` (AES-256-GCM, needs `TOKEN_ENCRYPTION_KEY`)
- Admin auth: `src/lib/admin.ts`
- Prisma client: `src/lib/prisma.ts` (singleton)

## API conventions

- Validate inputs with Zod at the route boundary.
- Admin routes: verify `x-admin-key` via `src/lib/admin.ts` before any work.
- Never log, echo, or return WaniKani tokens — they are encrypted at rest.
- Return typed JSON; surface errors with appropriate status codes.

## UI conventions

- Distinguish loading from empty (see `docs/DRY_LEARNINGS.md` #2).
- User-facing copy must follow `BRAND_CORE.md` / `BRAND.md` voice.

## Don't touch

- `next-env.d.ts` (generated)
- `prisma/migrations/` history
- `skills-lock.json` unless updating skills

## Workflow

- After implementation: commit and push. Conventional Commits, subject ≤ 50 chars.
- Do not create markdown docs to describe changes unless asked.
- Prefer editing existing files over creating new ones.

## Communication

- Default language for all user-facing responses is English.
- Only switch to another language when the user explicitly requests it.
