---
mode: agent
description: Scaffold a new Next.js App Router API route in src/app/api/ that follows UmaKuma's Zod → auth → work → typed JSON pattern.
---

# Add a new API route

Create a new route at `src/app/api/${input:routePath}/route.ts`.

Requirements:

1. **Validation**: define a Zod schema at the top of the file for the request
   payload (or query/params). Use `safeParse` and return 400 on failure with
   `{ error: "Invalid request payload." }`.

2. **Auth**: pick the correct gate and check it BEFORE any work:
   - Admin-only → `isAuthorizedAdmin(request)` from `@/lib/admin`
   - Invite session → helpers in `@/lib/inviteSession`
   - User session → next-auth via `@/lib/auth`
   On failure return 401 with `{ error: "Unauthorized." }`.

3. **Work**: perform the operation. Use existing helpers — never call WaniKani
   outside `@/lib/wanikani/http.ts`. Use the singleton `prisma` from
   `@/lib/prisma`.

4. **Response**: return typed JSON via `NextResponse.json(...)`. Surface errors
   with appropriate status codes. Wrap the handler body in try/catch and log
   server-side errors with `console.error` — never echo tokens or secrets.

5. **Conventions**:
   - File must stay under 500 LOC (gate: `pnpm loc:check`).
   - Extract handler-specific types into a sibling `*.types.ts` if non-trivial.
   - If the route mutates account data, consider rate / lock implications via
     `@/lib/sync`.

After scaffolding:

- Run `pnpm lint` and `pnpm loc:check`.
- If the route is reachable from a page covered by smoke tests, run
  `pnpm test:smoke:local`.
- Commit with a Conventional Commit subject ≤ 50 chars.

Reference template route: `src/app/api/accounts/route.ts`.
