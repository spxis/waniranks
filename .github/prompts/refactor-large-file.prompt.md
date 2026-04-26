---
mode: agent
description: Refactor a file under src/ that approaches or exceeds the 500-line LOC gate, following UmaKuma's strict order (types → helpers → subcomponents).
---

# Refactor a large file

Target file: `${file}` (or `${input:filePath}` if not in editor).

Apply the recipe in `.agents/skills/loc-refactor/SKILL.md` in **strict order**:

1. **Extract types and Props** to a sibling `*.types.ts` (UI) or
   `lib/*Types.ts` (domain). Mechanical and risk-free — do this first.
2. **Extract pure helpers / selectors** to a sibling `lib/` folder or
   `src/lib/` if reusable. Before extracting, check shared utilities
   (`timeFormat.ts`, `clientStorage.ts`, `usePersistedBoolean.ts`,
   `wanikani/`) — do not re-implement.
3. **Split JSX into focused subcomponents** only after steps 1–2. Group
   siblings under `components/` if there are several.

## Constraints

- Do not change behavior. Refactor only.
- Do not add flags, deeply nested conditionals, or `eslint-disable` to
  satisfy LOC.
- Each new file must have a clear single responsibility. Splitting just to
  dodge the gate is not allowed.
- Keep imports tidy; remove now-unused ones.

## Verify

```bash
pnpm loc:check
pnpm lint
pnpm build
```

If the file backs a smoke-covered page, also run `pnpm test:smoke:local`.

After verification, commit with a Conventional Commit `refactor:` subject
≤ 50 chars and push.
