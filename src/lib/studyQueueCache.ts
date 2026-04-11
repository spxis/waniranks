type CachedStudyQueue = {
  items: unknown[];
  counts: {
    all: number;
    reviews: number;
    lessons: number;
  };
  cachedAtMs: number;
};

const STUDY_QUEUE_TTL_MS = 60_000;
const cache = new Map<string, CachedStudyQueue>();

function cacheKey(accountId: string, mode: string): string {
  return `${accountId}:${mode}`;
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
): void {
  cache.set(cacheKey(accountId, mode), {
    items,
    counts,
    cachedAtMs: Date.now(),
  });
}

export function clearStudyQueueCache(accountId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      cache.delete(key);
    }
  }
}
