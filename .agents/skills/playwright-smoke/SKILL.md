---
name: playwright-smoke
description: Playwright smoke test workflow for UmaKuma — when to use the local vs build config, the dynamic user discovery pattern in e2e/, and how to add a new page to smoke coverage. Use when modifying or adding e2e specs, or when smoke tests fail.
---

# Playwright smoke skill (UmaKuma)

This repo has **smoke tests only** — no unit-test framework. The goal is
"every public/admin page renders without console errors or 5xx".

## Two configs

| Config | Script | Base URL | When to use |
|---|---|---|---|
| `playwright.smoke.local.config.ts` | `pnpm test:smoke:local` | `http://127.0.0.1:3000` | Iterating against `pnpm dev` |
| `playwright.smoke.build.config.ts` | `pnpm test:smoke:build` | `http://127.0.0.1:3100` | Validates a real prod build (runs `pnpm build` first) |

CI / pre-release should run `:build`. Day-to-day iteration: `:local` while
`pnpm dev` is already running in another terminal.

## Spec conventions (`e2e/smoke-pages.spec.ts`)

- **Dynamic user discovery**: the suite calls the leaderboard API and
  extracts a few real usernames (with a `fallbackUsers` constant) so user
  drilldown pages get smoke coverage without hard-coded fixtures.
- **assertPageLoads helper**: wraps each page with checks for non-2xx
  responses and uncaught page errors. Reuse it for new pages — don't
  reinvent.
- Tabs / sub-views are enumerated in a typed `tabs` array. Add new tabs there
  rather than writing per-tab tests.

## Adding a new page to smoke

1. Add a call to `assertPageLoads(browser, "/new-path", async (page) => { … })`
   in `e2e/smoke-pages.spec.ts`.
2. Inside the callback, assert ONE stable thing — a heading, a known
   `data-testid`, or a network response. Keep it minimal.
3. If the page requires auth, set up the session via the same helpers used by
   existing admin / user tests — do not log in through the UI in smoke.
4. Run `pnpm test:smoke:local` while `pnpm dev` is up.

## Triage when smoke fails

- Check `test-results/<spec>-<browser>/error-context.md` first — Playwright
  writes a captured DOM/console snapshot there.
- If the failure is "non-2xx response", inspect the API route. Most smoke
  failures are real bugs in route handlers (Zod, auth, DB).
- If the failure is "page error", open the dev server and reload the path —
  the same console error will reproduce.

## Don't

- Don't add long click-flow tests to smoke. Keep specs fast.
- Don't depend on a specific user existing — always go through the API to
  discover users.
- Don't run `:build` for tight-loop iteration — it rebuilds every time.
