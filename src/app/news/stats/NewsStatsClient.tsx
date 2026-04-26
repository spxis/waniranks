"use client";

import { useEffect, useMemo, useState } from "react";

import { formatRelativeFromNow } from "@/lib/timeFormat";

import { newsGlyphButtonClass } from "../newsGlyphBoxStyle";
import { openNewsGlyphRun } from "../newsGlyphRunner";
import {
  NEWS_GLYPH_STATS_EVENT,
  clearNewsGlyphStats,
  readNewsGlyphEvents,
  readNewsGlyphStats,
  type NewsGlyphStatEntry,
} from "../newsGlyphStats";

type WindowRange = "7d" | "30d" | "all";

export default function NewsStatsClient() {
  const [range, setRange] = useState<WindowRange>("30d");
  const [stats, setStats] = useState<NewsGlyphStatEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      setStats(readNewsGlyphStats());
    };
    refresh();
    window.addEventListener(NEWS_GLYPH_STATS_EVENT, refresh);
    return () => {
      window.removeEventListener(NEWS_GLYPH_STATS_EVENT, refresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const threshold = range === "all" ? null : Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
    return stats.filter((entry) => {
      if (!threshold) {
        return true;
      }
      return Date.parse(entry.lastViewedAt) >= threshold;
    });
  }, [range, stats]);

  const top = filtered.slice(0, 25);
  const maxViews = Math.max(1, ...top.map((entry) => entry.viewCount));

  const series = useMemo(() => {
    const events = readNewsGlyphEvents();
    const byDay = new Map<string, number>();
    for (const event of events) {
      const day = event.viewedAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + event.glyphs.length);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-30);
  }, [stats]);

  const seriesMax = Math.max(1, ...series.map(([, count]) => count));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-foreground/70">Glyph Stats</h2>
          <div className="inline-flex overflow-hidden rounded-full border border-line bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em]">
            <button type="button" onClick={() => setRange("7d")} className={`px-3 py-1 ${range === "7d" ? "bg-accent text-surface" : "text-foreground/70"}`}>7d</button>
            <button type="button" onClick={() => setRange("30d")} className={`px-3 py-1 ${range === "30d" ? "bg-accent text-surface" : "text-foreground/70"}`}>30d</button>
            <button type="button" onClick={() => setRange("all")} className={`px-3 py-1 ${range === "all" ? "bg-accent text-surface" : "text-foreground/70"}`}>All</button>
          </div>
        </div>
        <p className="mt-2 text-sm text-foreground/70">
          Tracking how often each kanji/vocabulary is opened from News click flows.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">Top Viewed Glyphs</h3>
          <button
            type="button"
            onClick={() => clearNewsGlyphStats()}
            className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/50 hover:text-hot"
          >
            Reset stats
          </button>
        </div>
        {top.length === 0 ? (
          <p className="text-sm text-foreground/60">No glyph views yet.</p>
        ) : (
          <ul className="space-y-2">
            {top.map((entry) => (
              <li key={entry.key} className="rounded-xl border border-line/80 bg-surface-muted p-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => void openNewsGlyphRun(entry.label)}
                    className={newsGlyphButtonClass({
                      type: entry.type,
                      size: "normal",
                    })}
                    title={`Open ${entry.type} ${entry.label}`}
                  >
                    {entry.label}
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/60">
                    {entry.type} · {entry.viewCount} views
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/50">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(5, (entry.viewCount / maxViews) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-foreground/55">Last viewed {formatRelativeFromNow(entry.lastViewedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">Recent Activity (30 days)</h3>
        {series.length === 0 ? (
          <p className="text-sm text-foreground/60">No events yet.</p>
        ) : (
          <div className="flex items-end gap-1 rounded-xl border border-line/80 bg-surface-muted p-3">
            {series.map(([day, count]) => (
              <div key={day} className="group flex-1">
                <div
                  className="rounded-t bg-accent/75 transition group-hover:bg-accent"
                  style={{ height: `${Math.max(8, (count / seriesMax) * 120)}px` }}
                  title={`${day}: ${count} glyph opens`}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
