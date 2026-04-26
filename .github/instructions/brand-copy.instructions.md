---
description: UmaKuma brand voice and copy rules. Load before writing any user-facing string (UI, error messages, emails, marketing).
---

# Brand & copy rules

The full brand spec lives in `BRAND_CORE.md` and `BRAND.md` at repo root —
read those for visual identity. This file is the short list for *copy*.

## Voice

- Warm, playful, smart, encouraging, family-friendly.
- Speak with the user, not at them. Avoid corporate / clinical tone.
- Mascots: **Uma** (horse, left in pairs) and **Kuma** (bear, right in pairs).
  Don't anthropomorphize them in error messages — just be friendly.

## Copy mechanics

- Sentence case for headings and buttons (e.g. "Add account", not "Add Account").
- Short sentences. Prefer verbs over nouns.
- No exclamation points in error messages. Save them for celebrations.
- Avoid jargon ("API token" is fine; "OAuth bearer credential" is not).
- Numbers: use digits ("3 reviews"), not words.
- Time: use `src/lib/timeFormat.ts` helpers. Never hand-format.

## Loading vs empty

- **Loading state**: explicit indicator (spinner / "Loading…"). Never an
  empty state during fetch.
- **Empty state**: only after the request resolves with zero rows. Suggest a
  next action when possible ("Add your first account").

## Errors

- User-facing: short, blame-free, actionable. "Couldn't reach WaniKani —
  check your token." Not: "Error 500: upstream failure".
- Never expose token values, stack traces, or internal IDs.

## Don't

- Don't invent new mascot names or brand colors.
- Don't write copy that requires reading docs to understand.
- Don't use "simply", "just", "easily" — they minimize the user's effort.
