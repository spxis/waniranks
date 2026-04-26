"use client";

import { getStoredJson, setStoredJson } from "@/lib/clientStorage";

import type { LookupRunResult } from "@/lib/news/newsKanjiLookup";

const CACHE_KEY = "uk:news-run-lookup:v2";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 500;

type CacheEntry = {
  fetchedAtMs: number;
  accountId: string;
  result: LookupRunResult;
};

type CacheStore = Record<string, CacheEntry>;

export type RunLookupCacheHit = {
  accountId: string;
  result: LookupRunResult;
  cachedAgeMs: number;
};

function normalizeRun(value: string): string {
  return value.trim();
}

export function readRunLookupCache(run: string): RunLookupCacheHit | null {
  const key = normalizeRun(run);
  if (!key) {
    return null;
  }

  const store = getStoredJson<CacheStore>(CACHE_KEY, {});
  const entry = store[key];
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.fetchedAtMs > TTL_MS) {
    delete store[key];
    setStoredJson(CACHE_KEY, store);
    return null;
  }

  return {
    accountId: entry.accountId,
    result: entry.result,
    cachedAgeMs: now - entry.fetchedAtMs,
  };
}

export function writeRunLookupCache(run: string, accountId: string, result: LookupRunResult): void {
  const key = normalizeRun(run);
  if (!key) {
    return;
  }

  const store = getStoredJson<CacheStore>(CACHE_KEY, {});
  store[key] = {
    fetchedAtMs: Date.now(),
    accountId,
    result,
  };
  prune(store);
  setStoredJson(CACHE_KEY, store);
}

export function runAvailabilityFromCache(run: string): "unknown" | "known" | "missing" {
  const hit = readRunLookupCache(run);
  if (!hit) {
    return "unknown";
  }

  if (hit.result.vocabulary?.subjectId) {
    return "known";
  }

  const hasKnownKanji = hit.result.kanjiItems.some((item) => item.subjectId !== null);
  if (hasKnownKanji) {
    return "known";
  }

  return "missing";
}

function prune(store: CacheStore): void {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (now - store[key].fetchedAtMs > TTL_MS) {
      delete store[key];
    }
  }
  const keys = Object.keys(store);
  if (keys.length <= MAX_ENTRIES) {
    return;
  }
  keys
    .sort((a, b) => store[a].fetchedAtMs - store[b].fetchedAtMs)
    .slice(0, keys.length - MAX_ENTRIES)
    .forEach((key) => {
      delete store[key];
    });
}
