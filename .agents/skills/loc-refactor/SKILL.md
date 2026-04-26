---
name: loc-refactor
description: Recipe for splitting a file under src/ that approaches or exceeds the 500-line LOC gate (pnpm loc:check). Use whenever a component or module is >400 lines, or when loc:check fails.
---

# LOC refactor skill (UmaKuma)

The repo enforces a hard cap of **500 lines per file under `src/`** via
`pnpm loc:check` (script: `scripts/check-max-loc.mjs`). Bypassing the gate is
not allowed. When a file approaches the limit, refactor in this order.

## The recipe (in strict order)

### 1. Extract types and Props first

Move exported / shared `type` and `Props` declarations to a sibling file:

- UI components → `<ComponentName>.types.ts`
- Domain modules → `src/lib/<name>Types.ts`

Import them back. This is mechanical and risk-free.

Example reference: `src/app/admin/AdminControlRoom.tsx` ↔
`src/app/admin/AdminControlRoom.types.ts`.

### 2. Extract pure helpers / selectors

Move pure functions (formatters, derivations, sort comparators) into:

- A sibling `lib/` folder (for page-local helpers), or
- `src/lib/` if reusable cross-page.

Do **not** re-implement existing utilities — check first:

- `src/lib/timeFormat.ts` for date/time
- `src/lib/clientStorage.ts`, `src/lib/usePersistedBoolean.ts` for localStorage
- `src/lib/wanikani/` for WaniKani calls

### 3. Split JSX into focused subcomponents

Only after steps 1–2, identify cohesive JSX regions and extract them as
subcomponents. Group siblings under `components/` if there are several.

Example: `src/app/shared/StudyHistoryTable.tsx`,
`StudyHistoryFilters.tsx`, `HistoryItemDetailModal.tsx` are pieces of one
feature split this way.

## What NOT to do

- Do not add boolean flags or deeply nested conditionals to satisfy LOC.
- Do not move code into a new file just to dodge the gate without a real
  responsibility boundary.
- Do not bypass the gate (no `// eslint-disable`, no flag in
  `check-max-loc.mjs`).
- Do not restructure unrelated code in the same change — keep refactors
  reviewable.

## Verification

After refactor:

```bash
pnpm loc:check
pnpm lint
pnpm build   # if types moved
```

If smoke-relevant pages were touched, run `pnpm test:smoke:local`.

## Reference precedents in this repo

- Admin: `AdminControlRoom.tsx` + `AdminControlRoom.types.ts` + section components.
- Study history: `src/app/shared/studyHistoryTypes.ts` +
  `studyHistoryUi.ts` + multiple component files.
- WaniKani lib: previously one `src/lib/wanikani.ts`, now split across
  `src/lib/wanikani/` (http, subjects, kanjiIndex, leaderboard*, levelSnapshot).
