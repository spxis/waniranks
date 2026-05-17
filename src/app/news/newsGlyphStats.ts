"use client";

import { getStoredJson, setStoredJson } from "@/lib/clientStorage";
import { SUBJECT_TYPES } from "@/lib/domainConstants";

export const NEWS_GLYPH_STATS_EVENT = "uk:news-glyph-stats-changed";

const GLYPH_STATS_KEY = "uk:news-glyph-stats";
const GLYPH_EVENTS_KEY = "uk:news-glyph-events";
const MAX_EVENTS = 2000;

export type NewsGlyphType = "kanji" | "vocabulary";
const NEWS_GLYPH_TYPES = [SUBJECT_TYPES.kanji, SUBJECT_TYPES.vocabulary] as const;

export type NewsGlyphStatEntry = {
  key: string;
  label: string;
  type: NewsGlyphType;
  viewCount: number;
  lastViewedAt: string;
  firstViewedAt: string;
};

export type NewsGlyphViewEvent = {
  viewedAt: string;
  run: string;
  glyphs: Array<{
    key: string;
    label: string;
    type: NewsGlyphType;
  }>;
};

type StatsStore = Record<string, NewsGlyphStatEntry>;

function isNewsGlyphType(value: unknown): value is NewsGlyphType {
  return typeof value === "string" && (NEWS_GLYPH_TYPES as readonly string[]).includes(value);
}

export function readNewsGlyphStats(): NewsGlyphStatEntry[] {
  const store = getStoredJson<StatsStore>(GLYPH_STATS_KEY, {});
  return Object.values(store)
    .filter((entry) => entry && typeof entry.key === "string")
    .sort((a, b) => b.viewCount - a.viewCount || b.lastViewedAt.localeCompare(a.lastViewedAt));
}

export function readNewsGlyphEvents(): NewsGlyphViewEvent[] {
  const raw = getStoredJson<unknown>(GLYPH_EVENTS_KEY, null);
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: NewsGlyphViewEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as Partial<NewsGlyphViewEvent>;
    if (typeof candidate.viewedAt !== "string" || typeof candidate.run !== "string" || !Array.isArray(candidate.glyphs)) {
      continue;
    }
    const glyphs = candidate.glyphs
      .filter((glyph) => glyph && typeof glyph === "object")
      .map((glyph) => glyph as { key?: string; label?: string; type?: NewsGlyphType })
      .filter((glyph) => typeof glyph.key === "string" && typeof glyph.label === "string" && isNewsGlyphType(glyph.type))
      .map((glyph) => ({
        key: glyph.key as string,
        label: glyph.label as string,
        type: glyph.type as NewsGlyphType,
      }));

    out.push({
      viewedAt: candidate.viewedAt,
      run: candidate.run,
      glyphs,
    });
  }
  return out;
}

export function recordNewsGlyphViews(input: {
  run: string;
  glyphs: Array<{ label: string; type: NewsGlyphType }>;
}): void {
  const run = input.run.trim();
  if (!run || input.glyphs.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const stats = getStoredJson<StatsStore>(GLYPH_STATS_KEY, {});

  const uniqueGlyphs = uniqueByKey(
    input.glyphs.map((glyph) => ({
      key: `${glyph.type}:${glyph.label}`,
      label: glyph.label,
      type: glyph.type,
    })),
  );

  for (const glyph of uniqueGlyphs) {
    const existing = stats[glyph.key];
    if (!existing) {
      stats[glyph.key] = {
        key: glyph.key,
        label: glyph.label,
        type: glyph.type,
        viewCount: 1,
        firstViewedAt: nowIso,
        lastViewedAt: nowIso,
      };
      continue;
    }

    stats[glyph.key] = {
      ...existing,
      viewCount: existing.viewCount + 1,
      lastViewedAt: nowIso,
    };
  }

  setStoredJson(GLYPH_STATS_KEY, stats);

  const events = readNewsGlyphEvents();
  const nextEvents: NewsGlyphViewEvent[] = [
    {
      viewedAt: nowIso,
      run,
      glyphs: uniqueGlyphs,
    },
    ...events,
  ].slice(0, MAX_EVENTS);

  setStoredJson(GLYPH_EVENTS_KEY, nextEvents);
  dispatchStatsChanged();
}

export function clearNewsGlyphStats(): void {
  setStoredJson(GLYPH_STATS_KEY, {});
  setStoredJson(GLYPH_EVENTS_KEY, []);
  dispatchStatsChanged();
}

function uniqueByKey<T extends { key: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.key, item);
  }
  return Array.from(map.values());
}

function dispatchStatsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NEWS_GLYPH_STATS_EVENT));
}
