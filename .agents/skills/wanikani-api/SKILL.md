---
name: wanikani-api
description: WaniKani API integration patterns for UmaKuma — auth, rate limiting, conditional requests, encrypted token handling, and where helpers live. Use when adding/modifying any code that calls WaniKani or persists WaniKani data.
---

# WaniKani API skill (UmaKuma)

## Where the code lives

All WaniKani access is funneled through `src/lib/wanikani/`:

- `http.ts` — `fetchWaniKani<T>()` — the **only** function that should hit `api.wanikani.com`. Handles auth header, `Wanikani-Revision`, conditional headers (`If-None-Match`, `If-Modified-Since`), and per-token throttling.
- `subjects.ts` — subject (kanji/vocab/radical) fetchers.
- `kanjiIndex.ts` — kanji lookup index.
- `leaderboardStats.ts` / `leaderboardJlpt.ts` — leaderboard aggregations.
- `levelSnapshot.ts` — per-level progress snapshot.
- `helpers.ts` — small pure helpers shared inside the folder.
- `types.ts` — response/header types. **Always import types from here.**

Do NOT add a new `fetch("https://api.wanikani.com/...")` call elsewhere.

## Rate limiting

`http.ts` serializes requests **per token** with a delay of
`EFFECTIVE_WANIKANI_REQUEST_GAP_MS` from `src/lib/refreshPolicy.ts`. WaniKani's
documented limit is 60 req/min; the effective gap is conservative. If you need
many requests:

1. Reuse the same token argument so throttling chains correctly.
2. Use conditional headers (etag / last-modified) returned in the previous
   response — `headers.etag` and `headers.lastModified` are exposed on
   `WaniKaniResponseHeaders`.
3. Honor a 304 (`status === 304`, `data === null`) by reusing cached data.

## Tokens

- Tokens are encrypted at rest with AES-256-GCM via `src/lib/crypto.ts`
  (`TOKEN_ENCRYPTION_KEY` env, base64 32 bytes).
- Decrypt only inside server code immediately before the API call. Never log,
  echo, or return tokens in API responses.
- When persisting a new token use `saveAccountFromToken()` in
  `src/lib/accountUpsert.ts`.

## API route pattern (Zod → auth → work → JSON)

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedAdmin } from "@/lib/admin";

const schema = z.object({ /* ... */ });

export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
  // ... work ...
  return NextResponse.json({ /* typed */ }, { status: 200 });
}
```

Non-admin routes still validate inputs with Zod; auth gating depends on the
route (invite session / next-auth / admin header).

## Refresh policy

- Per-account refresh logic in `src/lib/sync.ts` and
  `src/app/api/leaderboard/refresh/route.ts`.
- Use `clearExpiredSyncLocks()` before reading lock state.
- Don't refresh more often than `refreshPolicy.ts` allows — it exists to
  prevent rate-limit bans.

## Common mistakes to avoid

- Adding a raw `fetch` to WaniKani outside `http.ts` (breaks throttling).
- Logging the decrypted token or echoing it in JSON.
- Forgetting `Wanikani-Revision` header (handled by `fetchWaniKani`, so use it).
- Treating 304 as an error — it means "use cached data".
