"use client";

import { getStoredJson, setStoredJson } from "@/lib/clientStorage";

const LEVEL_CACHE_KEY = "uk:news-enrichment-levels:v1";
const READING_CACHE_KEY = "uk:news-enrichment-readings:v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_DELAY_MS = 20;
const LEVEL_BATCH_MAX = 120;
const READING_BATCH_MAX = 80;

type LevelEntry = {
  wkLevel: number | null;
  grade: number | null;
  updatedAt: number;
};

type ReadingEntry = {
  reading: string | null;
  updatedAt: number;
};

const levelStore: Record<string, LevelEntry> = getStoredJson<Record<string, LevelEntry>>(LEVEL_CACHE_KEY, {});
const readingStore: Record<string, ReadingEntry> = getStoredJson<Record<string, ReadingEntry>>(
  READING_CACHE_KEY,
  {},
);

const loadingLevelChars = new Set<string>();
const queuedLevelChars = new Set<string>();
const loadingReadingRuns = new Set<string>();
const queuedReadingRuns = new Set<string>();

let persistLevelsTimer: ReturnType<typeof setTimeout> | null = null;
let persistReadingsTimer: ReturnType<typeof setTimeout> | null = null;
let levelBatchTimer: ReturnType<typeof setTimeout> | null = null;
let readingBatchTimer: ReturnType<typeof setTimeout> | null = null;
let levelBatchPromise: Promise<void> | null = null;
let readingBatchPromise: Promise<void> | null = null;
let resolveLevelBatchPromise: (() => void) | null = null;
let resolveReadingBatchPromise: (() => void) | null = null;

pruneExpiredLevelStore();
pruneExpiredReadingStore();

export function hasFreshKanjiLevel(char: string): boolean {
  const entry = levelStore[char];
  if (!entry) {
    return false;
  }
  return isFresh(entry.updatedAt);
}

export function hasFreshRunReading(run: string): boolean {
  const entry = readingStore[run];
  if (!entry) {
    return false;
  }
  return isFresh(entry.updatedAt);
}

export function shouldRefreshKanjiLevel(char: string): boolean {
  const entry = levelStore[char];
  if (!entry) {
    return false;
  }
  return isFreshButNearExpiry(entry.updatedAt);
}

export function shouldRefreshRunReading(run: string): boolean {
  const entry = readingStore[run];
  if (!entry) {
    return false;
  }
  return isFreshButNearExpiry(entry.updatedAt);
}

export function isKanjiLevelPending(char: string): boolean {
  return loadingLevelChars.has(char) || queuedLevelChars.has(char);
}

export function isRunReadingPending(run: string): boolean {
  return loadingReadingRuns.has(run) || queuedReadingRuns.has(run);
}

export function getCachedKanjiLevels(chars: string[]): {
  levels: Record<string, number | null>;
  grades: Record<string, number | null>;
} {
  const levels: Record<string, number | null> = {};
  const grades: Record<string, number | null> = {};

  for (const char of chars) {
    if (!hasFreshKanjiLevel(char)) {
      continue;
    }
    levels[char] = levelStore[char]?.wkLevel ?? null;
    grades[char] = levelStore[char]?.grade ?? null;
  }

  return { levels, grades };
}

export function getCachedRunReadings(runs: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};

  for (const run of runs) {
    if (!hasFreshRunReading(run)) {
      continue;
    }
    out[run] = readingStore[run]?.reading ?? null;
  }

  return out;
}

export async function ensureKanjiLevels(
  chars: string[],
  options?: { allowFreshRefresh?: boolean },
): Promise<void> {
  let added = false;
  const allowFreshRefresh = options?.allowFreshRefresh === true;

  for (const char of chars) {
    const canSkip =
      hasFreshKanjiLevel(char) &&
      (!allowFreshRefresh || !shouldRefreshKanjiLevel(char));
    if (canSkip || loadingLevelChars.has(char)) {
      continue;
    }
    queuedLevelChars.add(char);
    added = true;
  }

  if (added) {
    scheduleLevelBatch();
  }
  if (levelBatchPromise) {
    await levelBatchPromise;
  }
}

export async function ensureRunReadings(
  runs: string[],
  options?: { allowFreshRefresh?: boolean },
): Promise<void> {
  let added = false;
  const allowFreshRefresh = options?.allowFreshRefresh === true;

  for (const run of runs) {
    const canSkip =
      hasFreshRunReading(run) &&
      (!allowFreshRefresh || !shouldRefreshRunReading(run));
    if (canSkip || loadingReadingRuns.has(run)) {
      continue;
    }
    queuedReadingRuns.add(run);
    added = true;
  }

  if (added) {
    scheduleReadingBatch();
  }
  if (readingBatchPromise) {
    await readingBatchPromise;
  }
}

function scheduleLevelBatch(): void {
  if (!levelBatchPromise) {
    levelBatchPromise = new Promise<void>((resolve) => {
      resolveLevelBatchPromise = resolve;
    });
  }
  if (levelBatchTimer !== null) {
    return;
  }

  levelBatchTimer = setTimeout(() => {
    void flushLevelBatch();
  }, BATCH_DELAY_MS);
}

async function flushLevelBatch(): Promise<void> {
  const batch = Array.from(queuedLevelChars);
  queuedLevelChars.clear();

  if (batch.length > 0) {
    while (batch.length > 0) {
      const chunk = batch.splice(0, LEVEL_BATCH_MAX);
      const now = Date.now();
      for (const char of chunk) {
        loadingLevelChars.add(char);
      }

      let payload: { levels?: Record<string, number | null>; grades?: Record<string, number | null> } | null = null;
      let ok = false;
      try {
        const response = await fetch("/api/news/kanji-levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chars: chunk }),
        });
        payload = (await response.json().catch(() => null)) as
          | { levels?: Record<string, number | null>; grades?: Record<string, number | null> }
          | null;
        ok = response.ok;
      } catch {
        ok = false;
      }

      for (const char of chunk) {
        levelStore[char] = {
          wkLevel: ok ? payload?.levels?.[char] ?? null : null,
          grade: ok ? payload?.grades?.[char] ?? null : null,
          updatedAt: now,
        };
        loadingLevelChars.delete(char);
      }
    }

    schedulePersistLevels();
  }

  levelBatchTimer = null;
  const resolve = resolveLevelBatchPromise;
  levelBatchPromise = null;
  resolveLevelBatchPromise = null;
  resolve?.();

  if (queuedLevelChars.size > 0) {
    scheduleLevelBatch();
  }
}

function scheduleReadingBatch(): void {
  if (!readingBatchPromise) {
    readingBatchPromise = new Promise<void>((resolve) => {
      resolveReadingBatchPromise = resolve;
    });
  }
  if (readingBatchTimer !== null) {
    return;
  }

  readingBatchTimer = setTimeout(() => {
    void flushReadingBatch();
  }, BATCH_DELAY_MS);
}

async function flushReadingBatch(): Promise<void> {
  const batch = Array.from(queuedReadingRuns);
  queuedReadingRuns.clear();

  if (batch.length > 0) {
    while (batch.length > 0) {
      const chunk = batch.splice(0, READING_BATCH_MAX);
      const now = Date.now();
      for (const run of chunk) {
        loadingReadingRuns.add(run);
      }

      let payload: { readings?: Record<string, string | null> } | null = null;
      let ok = false;
      try {
        const response = await fetch("/api/news/readings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runs: chunk }),
        });
        payload = (await response.json().catch(() => null)) as
          | { readings?: Record<string, string | null> }
          | null;
        ok = response.ok;
      } catch {
        ok = false;
      }

      for (const run of chunk) {
        readingStore[run] = {
          reading: ok ? payload?.readings?.[run] ?? null : null,
          updatedAt: now,
        };
        loadingReadingRuns.delete(run);
      }
    }

    schedulePersistReadings();
  }

  readingBatchTimer = null;
  const resolve = resolveReadingBatchPromise;
  readingBatchPromise = null;
  resolveReadingBatchPromise = null;
  resolve?.();

  if (queuedReadingRuns.size > 0) {
    scheduleReadingBatch();
  }
}

function pruneExpiredLevelStore(): void {
  const now = Date.now();
  let mutated = false;
  for (const [key, entry] of Object.entries(levelStore)) {
    if (now - entry.updatedAt > TTL_MS) {
      delete levelStore[key];
      mutated = true;
    }
  }

  if (mutated) {
    setStoredJson(LEVEL_CACHE_KEY, levelStore);
  }
}

function pruneExpiredReadingStore(): void {
  const now = Date.now();
  let mutated = false;
  for (const [key, entry] of Object.entries(readingStore)) {
    if (now - entry.updatedAt > TTL_MS) {
      delete readingStore[key];
      mutated = true;
    }
  }

  if (mutated) {
    setStoredJson(READING_CACHE_KEY, readingStore);
  }
}

function schedulePersistLevels(): void {
  if (persistLevelsTimer !== null) {
    return;
  }

  persistLevelsTimer = setTimeout(() => {
    setStoredJson(LEVEL_CACHE_KEY, levelStore);
    persistLevelsTimer = null;
  }, 150);
}

function schedulePersistReadings(): void {
  if (persistReadingsTimer !== null) {
    return;
  }

  persistReadingsTimer = setTimeout(() => {
    setStoredJson(READING_CACHE_KEY, readingStore);
    persistReadingsTimer = null;
  }, 150);
}

function isFresh(updatedAt: number): boolean {
  return Date.now() - updatedAt <= TTL_MS;
}

function isFreshButNearExpiry(updatedAt: number): boolean {
  const age = Date.now() - updatedAt;
  return age > TTL_MS - STALE_REFRESH_WINDOW_MS && age <= TTL_MS;
}
