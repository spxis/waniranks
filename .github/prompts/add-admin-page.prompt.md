---
mode: agent
description: Scaffold a new admin-only page under src/app/admin/ that is gated by the x-admin-key admin session.
---

# Add an admin page

Create a new admin page at `src/app/admin/${input:pagePath}/page.tsx`.

Requirements:

1. **Auth gate**: admin pages rely on the admin session established by
   `src/app/api/admin/session/route.ts` and verified via `@/lib/adminSession`.
   The page should redirect or render an unauthorized state when the session
   is missing — match the pattern used by `src/app/admin/page.tsx` and
   `src/app/admin/users/page.tsx`.

2. **Data fetching**:
   - Server-side reads via Prisma (`@/lib/prisma`) when possible.
   - Client-side mutations call admin APIs that verify `x-admin-key` via
     `@/lib/admin`.
   - Use SWR for client-side polling/refetch.

3. **Types**: shared types belong in a sibling `*.types.ts` (e.g.
   `AdminControlRoom.types.ts`). Do not inline large `type`/`Props` blocks.

4. **Layout & copy**:
   - Reuse existing admin building blocks: `AdminStatusBadge`,
     `AdminAccountsSection`, `AdminStudyHistory`, etc., where appropriate.
   - User-facing copy must follow `BRAND_CORE.md` / `BRAND.md` voice.

5. **Loading vs empty**: render an explicit loading indicator while data is in
   flight; only show empty-state copy after the request resolves with no rows
   (see `docs/DRY_LEARNINGS.md` #2).

6. **LOC gate**: keep the page file ≤ 500 lines. If it grows, apply the
   `loc-refactor` skill.

After scaffolding:

- Add a nav entry from `src/app/admin/AdminControlRoom.tsx` (or the relevant
  admin index) if the page should be discoverable.
- Run `pnpm lint`, `pnpm loc:check`, and `pnpm test:smoke:local`.
- Commit with a Conventional Commit subject ≤ 50 chars; push.
