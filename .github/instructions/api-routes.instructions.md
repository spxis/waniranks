---
description: Conventions for Next.js App Router API routes in UmaKuma. Auto-applied when editing src/app/api/**.
applyTo: "src/app/api/**/route.ts"
---

# API route conventions

Every route handler in `src/app/api/**/route.ts` MUST follow this pipeline:

1. **Validate** the request payload / query / params with Zod (`safeParse`).
   On failure: `return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })`.
2. **Authorize** before any work:
   - Admin → `isAuthorizedAdmin(request)` from `@/lib/admin` (`x-admin-key`).
   - Invite session → helpers in `@/lib/inviteSession`.
   - User session → next-auth via `@/lib/auth`.
   On failure: `return NextResponse.json({ error: "Unauthorized." }, { status: 401 })`.
3. **Work** using existing helpers:
   - WaniKani only via `@/lib/wanikani/http.ts` (`fetchWaniKani`). Never raw `fetch`.
   - DB via the singleton `prisma` from `@/lib/prisma`.
   - Account writes from a token via `saveAccountFromToken` in `@/lib/accountUpsert`.
   - Sync locks via `@/lib/sync` (`clearExpiredSyncLocks`, etc.).
4. **Respond** with `NextResponse.json(...)` and an explicit status code.
   Wrap the body in `try/catch`, log server errors with `console.error`, and
   return a generic message — never leak token, stack, or internal detail.

## Hard rules

- Never log, echo, or include WaniKani tokens in any response.
- Never bypass admin auth on routes under `src/app/api/admin/**` or routes
  that mutate accounts globally.
- Keep the file ≤ 500 LOC (gate: `pnpm loc:check`). Extract handler types into
  a sibling `*.types.ts` if they grow.
- Validate at the boundary only. Do not re-validate the same payload deeper.

Reference: `src/app/api/accounts/route.ts`.
