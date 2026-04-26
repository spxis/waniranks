import type { NewsArticle } from "./newsTypes";

const TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheEntry = {
  article: NewsArticle;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

export function getCachedArticle(key: string): NewsArticle | null {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return { ...entry.article, cached: true };
}

export function setCachedArticle(key: string, article: NewsArticle): void {
  store.set(key, {
    article: { ...article, cached: false },
    expiresAt: Date.now() + TTL_MS,
  });

  if (store.size > 200) {
    pruneExpired();
  }
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(key);
    }
  }
}

export function newsCacheKey(url: string): string {
  return url.trim().toLowerCase();
}
