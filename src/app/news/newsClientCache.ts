import { getStoredJson, setStoredJson } from "@/lib/clientStorage";

import type { DiscoveredLink } from "@/lib/news/newsDiscover";
import type { NewsArticle } from "@/lib/news/newsTypes";

const ARTICLE_CACHE_KEY = "uk:news-article-cache";
const DISCOVER_CACHE_KEY = "uk:news-discover-cache";
const ARTICLE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const DISCOVER_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_ARTICLE_ENTRIES = 30;
const MAX_DISCOVER_ENTRIES = 20;

type ArticleCacheEntry = {
  fetchedAtMs: number;
  article: NewsArticle;
};

type DiscoverCacheEntry = {
  fetchedAtMs: number;
  queryUrl?: string;
  baseUrl: string;
  links: DiscoveredLink[];
};

type ArticleCacheStore = Record<string, ArticleCacheEntry>;
type DiscoverCacheStore = Record<string, DiscoverCacheEntry>;

function normalizeKey(url: string): string {
  return url.trim().toLowerCase();
}

export function readArticleCache(url: string): NewsArticle | null {
  const store = getStoredJson<ArticleCacheStore>(ARTICLE_CACHE_KEY, {});
  const entry = store[normalizeKey(url)];
  if (!entry) {
    return null;
  }
  const ageMs = Date.now() - entry.fetchedAtMs;
  if (ageMs > ARTICLE_TTL_MS) {
    delete store[normalizeKey(url)];
    setStoredJson(ARTICLE_CACHE_KEY, store);
    return null;
  }
  return {
    ...entry.article,
    cached: true,
    cachedAgeMs: ageMs,
  };
}

export function writeArticleCache(url: string, article: NewsArticle): void {
  const store = getStoredJson<ArticleCacheStore>(ARTICLE_CACHE_KEY, {});
  store[normalizeKey(url)] = {
    fetchedAtMs: Date.now(),
    article: { ...article, cached: false, cachedAgeMs: undefined },
  };
  pruneArticleStore(store);
  setStoredJson(ARTICLE_CACHE_KEY, store);
}

function pruneArticleStore(store: ArticleCacheStore): void {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (now - store[key].fetchedAtMs > ARTICLE_TTL_MS) {
      delete store[key];
    }
  }
  const keys = Object.keys(store);
  if (keys.length <= MAX_ARTICLE_ENTRIES) {
    return;
  }
  keys
    .sort((a, b) => store[a].fetchedAtMs - store[b].fetchedAtMs)
    .slice(0, keys.length - MAX_ARTICLE_ENTRIES)
    .forEach((key) => {
      delete store[key];
    });
}

export type DiscoverCacheHit = {
  baseUrl: string;
  links: DiscoveredLink[];
  fetchedAt: string;
  cachedAgeMs: number;
};

export type DiscoverCacheSession = {
  queryUrl: string;
  baseUrl: string;
  links: DiscoveredLink[];
  fetchedAt: string;
  fetchedAtMs: number;
  cachedAgeMs: number;
};

export function readDiscoverCache(url: string): DiscoverCacheHit | null {
  const store = getStoredJson<DiscoverCacheStore>(DISCOVER_CACHE_KEY, {});
  const entry = store[normalizeKey(url)];
  if (!entry) {
    return null;
  }
  const ageMs = Date.now() - entry.fetchedAtMs;
  if (ageMs > DISCOVER_TTL_MS) {
    delete store[normalizeKey(url)];
    setStoredJson(DISCOVER_CACHE_KEY, store);
    return null;
  }
  return {
    baseUrl: entry.baseUrl,
    links: entry.links,
    fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
    cachedAgeMs: ageMs,
  };
}

export function writeDiscoverCache(
  url: string,
  baseUrl: string,
  links: DiscoveredLink[],
): void {
  const store = getStoredJson<DiscoverCacheStore>(DISCOVER_CACHE_KEY, {});
  const queryUrl = url.trim();
  store[normalizeKey(url)] = {
    fetchedAtMs: Date.now(),
    queryUrl,
    baseUrl,
    links,
  };
  pruneDiscoverStore(store);
  setStoredJson(DISCOVER_CACHE_KEY, store);
}

export function listDiscoverCache(): DiscoverCacheSession[] {
  const store = getStoredJson<DiscoverCacheStore>(DISCOVER_CACHE_KEY, {});
  pruneDiscoverStore(store);
  setStoredJson(DISCOVER_CACHE_KEY, store);

  const now = Date.now();
  return Object.entries(store)
    .map(([key, entry]) => ({
      queryUrl: entry.queryUrl?.trim() || key,
      baseUrl: entry.baseUrl,
      links: entry.links,
      fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
      fetchedAtMs: entry.fetchedAtMs,
      cachedAgeMs: now - entry.fetchedAtMs,
    }))
    .sort((a, b) => b.fetchedAtMs - a.fetchedAtMs);
}

export function deleteDiscoverCache(url: string): void {
  const store = getStoredJson<DiscoverCacheStore>(DISCOVER_CACHE_KEY, {});
  delete store[normalizeKey(url)];
  setStoredJson(DISCOVER_CACHE_KEY, store);
}

export function clearDiscoverCache(): void {
  setStoredJson<DiscoverCacheStore>(DISCOVER_CACHE_KEY, {});
}

function pruneDiscoverStore(store: DiscoverCacheStore): void {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (now - store[key].fetchedAtMs > DISCOVER_TTL_MS) {
      delete store[key];
    }
  }
  const keys = Object.keys(store);
  if (keys.length <= MAX_DISCOVER_ENTRIES) {
    return;
  }
  keys
    .sort((a, b) => store[a].fetchedAtMs - store[b].fetchedAtMs)
    .slice(0, keys.length - MAX_DISCOVER_ENTRIES)
    .forEach((key) => {
      delete store[key];
    });
}
