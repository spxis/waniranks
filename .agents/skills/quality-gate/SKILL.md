---
name: quality-gate
description: Auto-fix and enforce lint/LOC checks before commit or deploy in UmaKuma. Use when users say "fix lint", "fix loc", "quality check", "vercel checks failing", "ci checks failing", or ask to auto-fix code quality errors.
---

# Quality gate skill (UmaKuma)

Use this workflow whenever lint or LOC checks are failing, especially before Vercel deploys.

## Commands

Run in this exact order:

```bash
pnpm lint:fix
pnpm quality:check
```

`quality:check` runs:

```bash
pnpm lint && pnpm loc:check
```

## Expected outcomes

- If `pnpm lint:fix` resolves issues and `pnpm quality:check` passes: proceed.
- If lint still fails: fix remaining errors manually, then re-run `pnpm quality:check`.
- If LOC fails: split files using the `loc-refactor` skill recipe (types -> helpers -> subcomponents), then re-run `pnpm quality:check`.

## Guardrails

- Never bypass LOC or lint checks.
- Do not silence rules with broad disables.
- Keep files under `src/` at 500 lines or fewer.
