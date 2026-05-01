type CachedStudyQueue = {
  items: unknown[];
  counts: {
    all: number;
    reviews: number;
    lessons: number;
  };
  levelCounts?: Record<number, number>;
  typeCounts?: {
    all: number;
    radical: number;
    kanji: number;
    vocabulary: number;
  };
  typeCountsByLevel?: Record<
    number,
    {
      all: number;
      radical: number;
      kanji: number;
      vocabulary: number;
    }
  >;
  srsCounts?: {
    all: number;
    locked: number;
    apprentice: number;
    guru: number;
    master: number;
    enlightened: number;
    burned: number;
  };
  srsStageCounts?: Record<number, number>;
  cachedAtMs: number;
};

type CachedStudyQueueSyncState = {
  assignmentById: Map<number, unknown>;
  subjectById: Map<number, unknown>;
  assignmentCheckpoint: string | null;
  modeSignature?: string;
  cachedAtMs: number;
  lastFullSyncAtMs: number;
};

const STUDY_QUEUE_TTL_MS = 60_000;
const STUDY_QUEUE_SYNC_TTL_MS = 30 * 60_000;
const MAX_QUEUE_CACHE_KEYS = 200;
const MAX_SYNC_CACHE_KEYS = 200;
const cache = new Map<string, CachedStudyQueue>();
const syncStateCache = new Map<string, CachedStudyQueueSyncState>();

function cacheKey(accountId: string, mode: string): string {
  return `${accountId}:${mode}`;
}

function trimOldestEntries<T extends { cachedAtMs: number }>(
  input: Map<string, T>,
  maxEntries: number,
): void {
  if (input.size <= maxEntries) {
    return;
  }

  const sortedKeys = Array.from(input.entries())
    .sort((a, b) => a[1].cachedAtMs - b[1].cachedAtMs)
    .map(([key]) => key);
  const toRemove = sortedKeys.slice(0, Math.max(0, sortedKeys.length - maxEntries));
  for (const key of toRemove) {
    input.delete(key);
  }
}

export function getCachedStudyQueue(accountId: string, mode: string): CachedStudyQueue | null {
  const key = cacheKey(accountId, mode);
  const value = cache.get(key);
  if (!value) {
    return null;
  }

  if (Date.now() - value.cachedAtMs > STUDY_QUEUE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return value;
}

export function setCachedStudyQueue(
  accountId: string,
  mode: string,
  items: unknown[],
  counts: { all: number; reviews: number; lessons: number },
  levelCounts?: Record<number, number>,
  typeCounts?: { all: number; radical: number; kanji: number; vocabulary: number },
  typeCountsByLevel?: Record<
    number,
    { all: number; radical: number; kanji: number; vocabulary: number }
  >,
  srsCounts?: {
    all: number;
    locked: number;
    apprentice: number;
    guru: number;
    master: number;
    enlightened: number;
    burned: number;
  },
  srsStageCounts?: Record<number, number>,
): void {
  cache.set(cacheKey(accountId, mode), {
    items,
    counts,
    levelCounts,
    typeCounts,
    typeCountsByLevel,
    srsCounts,
    srsStageCounts,
    cachedAtMs: Date.now(),
  });
  trimOldestEntries(cache, MAX_QUEUE_CACHE_KEYS);
}

export function getCachedStudyQueueSyncState(
  accountId: string,
  mode: string,
): CachedStudyQueueSyncState | null {
  const key = cacheKey(accountId, mode);
  const state = syncStateCache.get(key);
  if (!state) {
    return null;
  }

  if (Date.now() - state.cachedAtMs > STUDY_QUEUE_SYNC_TTL_MS) {
    syncStateCache.delete(key);
    return null;
  }

  return state;
}

export function setCachedStudyQueueSyncState(
  accountId: string,
  mode: string,
  state: {
    assignmentById: Map<number, unknown>;
    subjectById: Map<number, unknown>;
    assignmentCheckpoint: string | null;
    modeSignature?: string;
    lastFullSyncAtMs: number;
  },
): void {
  syncStateCache.set(cacheKey(accountId, mode), {
    assignmentById: state.assignmentById,
    subjectById: state.subjectById,
    assignmentCheckpoint: state.assignmentCheckpoint,
    modeSignature: state.modeSignature,
    lastFullSyncAtMs: state.lastFullSyncAtMs,
    cachedAtMs: Date.now(),
  });
  trimOldestEntries(syncStateCache, MAX_SYNC_CACHE_KEYS);
}

export function clearStudyQueueCache(accountId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      cache.delete(key);
    }
  }

  for (const key of syncStateCache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      syncStateCache.delete(key);
    }
  }
}
