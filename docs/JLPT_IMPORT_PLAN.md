# JLPT Kanji Enrichment Import Plan

## Goals

- Keep JLPT N-level membership in local DB.
- Enrich each JLPT kanji with:
  - stroke count
  - primary English meaning
  - full English meanings list
  - onyomi and kunyomi
  - optional nanori readings
- Use manual, on-demand refresh only.

## Data Sources

- JLPT level membership: `kanjiapi.dev` (`/v1/kanji/jlpt-{n}`)
- Kanji metadata enrichment: `kanjiapi.dev` (`/v1/kanji/{kanji}`)
- Existing local fallback meanings/readings: `src/data/jlptReadings.json`

## Schema Fields (`JlptKanji`)

- `kanji` (unique)
- `nLevel`
- `strokeCount`
- `primaryMeaning`
- `meanings[]`
- `onReadings[]`
- `kunReadings[]`
- `nanoriReadings[]`
- `enrichedAt`

## Manual Refresh Workflow

1. Update JLPT list:
   - `pnpm db:seed:jlpt`
   - or admin endpoint: `POST /api/jlpt/refresh`

2. Enrich metadata:
   - `pnpm db:enrich:jlpt`
   - or admin endpoint: `POST /api/jlpt/enrich` with body:

```json
{ "limit": 250, "onlyMissing": true }
```

3. Repeat step 2 if API response has `remaining > 0`.

## Operational Notes

- Refresh is manual and infrequent by design (no cron schedule).
- `POST /api/jlpt/refresh` preserves enrichment data for unchanged kanji.
- `POST /api/jlpt/enrich` is chunked to avoid long serverless runs/timeouts.
- UI prefers DB-enriched readings/meanings and falls back to local JSON when needed.

## Validation Checklist

- `pnpm db:push` succeeds.
- JLPT explorer detail shows:
  - main meaning
  - stroke count
  - primary/secondary reading
  - kunyomi/onyomi
- Search matches enriched readings/meanings.
- Manual enrich endpoint returns `ok: true` and decreasing `remaining` values.
