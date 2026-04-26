"use client";

import { useEffect, useMemo, useState } from "react";

import { formatRelativeFromNow } from "@/lib/timeFormat";

import { newsGlyphButtonClass } from "../newsGlyphBoxStyle";
import { openNewsGlyphRun } from "../newsGlyphRunner";
import {
  NEWS_GLYPH_STATS_EVENT,
  readNewsGlyphEvents,
  type NewsGlyphViewEvent,
} from "../newsGlyphStats";
import {
  NEWS_KANJI_HISTORY_EVENT,
  clearNewsKanjiHistory,
  readNewsKanjiHistory,
  removeNewsKanjiHistory,
  type NewsKanjiHistoryEntry,
} from "../newsKanjiHistory";

type Filter = "all" | "vocab" | "kanji-only";
type GroupMode = "grouped" | "events";

type ViewerRow = {
  key: string;
  run: string;
  hasVocabulary: boolean;
  knownCount: number;
  totalCount: number;
  opens: number;
  lastClickedAt: string;
};

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

function uniqueKanji(run: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const char of Array.from(run)) {
    if (!KANJI_REGEX.test(char) || seen.has(char)) {
      continue;
    }
    seen.add(char);
    out.push(char);
  }
  return out;
}

export default function NewsHistoryViewerClient() {
  const [entries, setEntries] = useState<NewsKanjiHistoryEntry[]>([]);
  const [events, setEvents] = useState<NewsGlyphViewEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("grouped");

  useEffect(() => {
    const refresh = () => {
      setEntries(readNewsKanjiHistory());
      setEvents(readNewsGlyphEvents());
    };
    refresh();
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    window.addEventListener(NEWS_GLYPH_STATS_EVENT, refresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
      window.removeEventListener(NEWS_GLYPH_STATS_EVENT, refresh);
    };
  }, []);

  const rows = useMemo<ViewerRow[]>(() => {
    if (groupMode === "grouped") {
      return entries.map((entry) => ({
        key: `group-${entry.run}`,
        run: entry.run,
        hasVocabulary: entry.hasVocabulary,
        knownCount: entry.knownCount,
        totalCount: entry.totalCount,
        opens: entry.clickCount,
        lastClickedAt: entry.lastClickedAt,
      }));
    }

    return events.map((event, index) => {
      const hasVocabulary = event.glyphs.some((glyph) => glyph.type === "vocabulary");
      const knownCount = event.glyphs.length;
      const kanjiCount = Array.from(event.run).filter((char) => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char)).length;
      const totalCount = hasVocabulary ? Math.max(knownCount, kanjiCount + 1) : Math.max(knownCount, kanjiCount);
      return {
        key: `event-${event.viewedAt}-${index}`,
        run: event.run,
        hasVocabulary,
        knownCount,
        totalCount,
        opens: 1,
        lastClickedAt: event.viewedAt,
      };
    });
  }, [entries, events, groupMode]);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return rows;
    }
    if (filter === "vocab") {
      return rows.filter((entry) => entry.hasVocabulary);
    }
    return rows.filter((entry) => !entry.hasVocabulary);
  }, [rows, filter]);

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-full border border-line bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em]">
            <button type="button" onClick={() => setFilter("all")} className={`px-3 py-1 ${filter === "all" ? "bg-accent text-surface" : "text-foreground/70"}`}>All</button>
            <button type="button" onClick={() => setFilter("vocab")} className={`px-3 py-1 ${filter === "vocab" ? "bg-accent text-surface" : "text-foreground/70"}`}>Vocab</button>
            <button type="button" onClick={() => setFilter("kanji-only")} className={`px-3 py-1 ${filter === "kanji-only" ? "bg-accent text-surface" : "text-foreground/70"}`}>Kanji only</button>
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-line bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em]">
            <button type="button" onClick={() => setGroupMode("grouped")} className={`px-3 py-1 ${groupMode === "grouped" ? "bg-accent text-surface" : "text-foreground/70"}`}>Grouped</button>
            <button type="button" onClick={() => setGroupMode("events")} className={`px-3 py-1 ${groupMode === "events" ? "bg-accent text-surface" : "text-foreground/70"}`}>Each click</button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            clearNewsKanjiHistory();
            setEntries([]);
          }}
          className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/55 transition hover:text-hot"
        >
          Clear all
        </button>
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-4 text-sm text-foreground/60">
          No clicked glyph history yet.
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((entry) => (
            <li key={entry.key} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.hasVocabulary ? (
                    <button
                      type="button"
                      onClick={() => void openNewsGlyphRun(entry.run)}
                      className={newsGlyphButtonClass({ type: "vocabulary", size: "normal" })}
                      title={`Open vocabulary ${entry.run}`}
                    >
                      {entry.run}
                    </button>
                  ) : null}
                  {uniqueKanji(entry.run).map((char) => (
                    <button
                      key={`${entry.key}-${char}`}
                      type="button"
                      onClick={() => void openNewsGlyphRun(char)}
                      className={newsGlyphButtonClass({ type: "kanji", size: "compact" })}
                      title={`Open kanji ${char}`}
                    >
                      {char}
                    </button>
                  ))}
                </div>
                <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/55">
                  {entry.hasVocabulary ? "vocab" : "kanji only"} · {entry.knownCount}/{entry.totalCount} known · {formatRelativeFromNow(entry.lastClickedAt)}
                </p>
              </div>
              <div className="min-w-[5.5rem] rounded-xl border border-line bg-surface-muted px-2 py-1 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/60">Opens</p>
                <p className="text-2xl font-black leading-none text-foreground">{entry.opens}</p>
              </div>
              {groupMode === "grouped" ? (
                <button
                  type="button"
                  onClick={() => setEntries(removeNewsKanjiHistory(entry.run))}
                  className="rounded-full border border-transparent px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/45 transition hover:border-line hover:text-hot"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
