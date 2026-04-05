"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toRomaji } from "wanakana";

import jlptReadings from "@/data/jlptReadings.json";

type JlptItem = {
  kanji: string;
  nLevel: number;
};

type Props = {
  items: JlptItem[];
  showEnglish?: boolean;
  userKanjiItems?: Array<{
    characters: string;
    primaryReadings?: string[];
    readings?: string[];
    status?: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
    srsStage?: number;
    wkLevel?: number | null;
  }>;
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

function normalizeSearch(input: string): string {
  return input.trim().toLowerCase();
}

type JlptReadingsMap = Record<string, { nLevel: number; readings: string[] }>;

export default function JlptExplorer({
  items,
  showEnglish = false,
  userKanjiItems = [],
}: Props) {
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [stickyLevels, setStickyLevels] = useState(false);
  const [query, setQuery] = useState("");
  const lastHandledFindQueryRef = useRef<string>("");

  const userKanjiByChar = useMemo(() => {
    const map = new Map<string, {
      characters: string;
      primaryReadings?: string[];
      readings?: string[];
      status?: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
      srsStage?: number;
      wkLevel?: number | null;
    }>();

    for (const item of userKanjiItems) {
      const current = map.get(item.characters);
      if (!current || (item.srsStage ?? 0) >= (current.srsStage ?? 0)) {
        map.set(item.characters, item);
      }
    }

    return map;
  }, [userKanjiItems]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      n5: items.filter((item) => item.nLevel === 5).length,
      n4: items.filter((item) => item.nLevel === 4).length,
      n3: items.filter((item) => item.nLevel === 3).length,
      n2: items.filter((item) => item.nLevel === 2).length,
      n1: items.filter((item) => item.nLevel === 1).length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return items.filter((item) => {
      const levelPass = selectedLevels.has(item.nLevel);

      if (!levelPass) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
      return (
        item.kanji.includes(query.trim()) ||
        normalizeSearch(item.kanji).includes(normalizedQuery) ||
        romaji.includes(normalizedQuery)
      );
    });
  }, [items, query, selectedLevels]);

  function badgeClass(active: boolean): string {
    return active
      ? "border-accent bg-accent text-white"
      : "border-line bg-white text-slate-700 hover:bg-surface-muted";
  }

  function statusClass(
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | undefined,
  ): string {
    if (status === "locked") return "bg-slate-100 text-slate-600";
    if (status === "apprentice") return "bg-pink-100 text-pink-700";
    if (status === "guru") return "bg-violet-100 text-violet-700";
    if (status === "master") return "bg-sky-100 text-sky-700";
    if (status === "enlightened") return "bg-amber-100 text-amber-700";
    if (status === "burned") return "bg-slate-200 text-slate-700";
    return "bg-slate-100 text-slate-500";
  }

  function readingLabel(reading: string | null): string {
    if (!reading) {
      return "-";
    }

    if (!showEnglish) {
      return reading;
    }

    const romaji = toRomaji(reading, { upcaseKatakana: false }).trim();
    return romaji && romaji !== reading ? `${reading} / ${romaji}` : reading;
  }

  function readingLabelFromList(readings: string[]): string {
    if (readings.length === 0) {
      return "-";
    }

    const primary = readings[0] ?? null;
    return readingLabel(primary);
  }

  function toggleNLevel(level: number) {
    if (!stickyLevels) {
      setSelectedLevels(new Set([level]));
      return;
    }

    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size === 1) {
          return next;
        }
        next.delete(level);
        return next;
      }

      next.add(level);
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findJlpt");
      const trimmed = fromUrl?.trim() ?? "";

      if (!trimmed) {
        setQuery("");
        return;
      }

      if (lastHandledFindQueryRef.current === trimmed) {
        return;
      }

      lastHandledFindQueryRef.current = trimmed;
      setQuery(trimmed);
    };

    runFromUrl();

    const onSearch = (event: Event) => {
      const custom = event as CustomEvent<{ query?: string; requestId?: string; scope?: "level" | "jlpt" }>;
      if (custom.detail?.scope !== "jlpt") {
        return;
      }

      const nextQuery = custom.detail?.query?.trim() ?? "";
      const requestId = custom.detail?.requestId;
      lastHandledFindQueryRef.current = nextQuery;
      setQuery(nextQuery);

      const normalizedQuery = normalizeSearch(nextQuery);
      const matchedCount = items.filter((item) => {
        const levelPass =
          selectedLevels.has(item.nLevel);

        if (!levelPass) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
        return (
          item.kanji.includes(nextQuery) ||
          normalizeSearch(item.kanji).includes(normalizedQuery) ||
          romaji.includes(normalizedQuery)
        );
      }).length;

      if (requestId) {
        window.dispatchEvent(
          new CustomEvent("wr:explorer-search-complete", {
            detail: {
              requestId,
              ok: true,
              message: `Found ${matchedCount} JLPT result${matchedCount === 1 ? "" : "s"}.`,
            },
          }),
        );
      }
    };

    const onPopState = () => {
      runFromUrl();
    };

    window.addEventListener("wr:explorer-search", onSearch as EventListener);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("wr:explorer-search", onSearch as EventListener);
      window.removeEventListener("popstate", onPopState);
    };
  }, [items, selectedLevels]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div>
          <h2 className="text-xl font-black text-foreground">JLPT Explorer</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-600">
            Browse all N1-N5 kanji ({formatNumber(items.length)} total)
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedLevels(new Set([1, 2, 3, 4, 5]))}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                selectedLevels.size === 5,
              )}`}
            >
              JLPT All ({formatNumber(counts.all)})
            </button>
            {([
              [5, counts.n5],
              [4, counts.n4],
              [3, counts.n3],
              [2, counts.n2],
              [1, counts.n1],
            ] as const).map(([level, count]) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleNLevel(level)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                  selectedLevels.has(level),
                )}`}
              >
                N{level} ({formatNumber(count)})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStickyLevels((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              stickyLevels
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-slate-700"
            }`}
          >
            Sticky {stickyLevels ? "On" : "Off"}
          </button>
        </div>
      </header>

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
          Showing {formatNumber(filteredItems.length)} results
        </p>
        <p className="mt-1 text-xs text-slate-500">
          WaniKani-specific SRS stats are shown only where subject mappings exist.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const userMatch = userKanjiByChar.get(item.kanji);
            const preload = (jlptReadings as JlptReadingsMap)[item.kanji];
            const primaryReading = userMatch
              ? (userMatch.primaryReadings ?? [])[0] ?? (userMatch.readings ?? [])[0] ?? null
              : null;
            const fallbackReadings = preload?.readings ?? [];

            return (
              <article
                key={`${item.nLevel}-${item.kanji}`}
                className={`rounded-2xl border p-3 text-center ${
                  userMatch
                    ? "border-kanji/50 bg-kanji/10"
                    : "border-line bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="subject-pill border-line bg-white text-slate-700">N{item.nLevel}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(userMatch?.status)}`}>
                    {userMatch?.status ?? "untracked"}
                  </span>
                </div>
                <p className={`mt-2 text-5xl font-black ${userMatch ? "text-kanji" : "text-foreground"}`}>{item.kanji}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {primaryReading ? readingLabel(primaryReading) : readingLabelFromList(fallbackReadings)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {userMatch ? `WK L${userMatch.wkLevel ?? "?"} / SRS ${userMatch.srsStage ?? 0}` : "No WK match"}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
