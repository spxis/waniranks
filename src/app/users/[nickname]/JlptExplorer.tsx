"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toRomaji } from "wanakana";

import jlptReadings from "@/data/jlptReadings.json";

type JlptItem = {
  kanji: string;
  nLevel: number;
  strokeCount: number | null;
  primaryMeaning: string | null;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  nanoriReadings: string[];
};

type Props = {
  items: JlptItem[];
  showEnglish?: boolean;
  userKanjiItems?: Array<{
    subjectId?: number;
    characters: string;
    meanings?: string[];
    primaryReadings?: string[];
    readings?: string[];
    meaningExplanation?: string;
    readingExplanation?: string;
    startedAt?: string | null;
    passedAt?: string | null;
    availableAt?: string | null;
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

type JlptReadingsRecord = Record<string, { nLevel: number; readings: string[]; meanings?: string[] }>;

type JlptFilter = "all" | "kanji" | "none";

function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function JlptExplorer({
  items,
  showEnglish = false,
  userKanjiItems = [],
}: Props) {
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [stickyLevels, setStickyLevels] = useState(false);
  const [wkFilter, setWkFilter] = useState<JlptFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<string | null>(null);
  const [gridColumns, setGridColumns] = useState(1);
  const lastHandledFindQueryRef = useRef<string>("");

  const userKanjiByChar = useMemo(() => {
    const map = new Map<string, {
      subjectId?: number;
      characters: string;
      meanings?: string[];
      primaryReadings?: string[];
      readings?: string[];
      meaningExplanation?: string;
      readingExplanation?: string;
      startedAt?: string | null;
      passedAt?: string | null;
      availableAt?: string | null;
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
    const noneCount = items.filter((item) => !userKanjiByChar.has(item.kanji)).length;
    return {
      all: items.length,
      kanji: items.length - noneCount,
      none: noneCount,
      n5: items.filter((item) => item.nLevel === 5).length,
      n4: items.filter((item) => item.nLevel === 4).length,
      n3: items.filter((item) => item.nLevel === 3).length,
      n2: items.filter((item) => item.nLevel === 2).length,
      n1: items.filter((item) => item.nLevel === 1).length,
    };
  }, [items, userKanjiByChar]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const records = jlptReadings as JlptReadingsRecord;

    return items.filter((item) => {
      const levelPass = selectedLevels.has(item.nLevel);

      if (!levelPass) {
        return false;
      }

      const userMatch = userKanjiByChar.get(item.kanji);
      const wkPass =
        wkFilter === "all"
          ? true
          : wkFilter === "kanji"
            ? Boolean(userMatch)
            : !userMatch;

      if (!wkPass) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const preload = records[item.kanji];
      const readings = [
        ...item.kunReadings,
        ...item.onReadings,
        ...item.nanoriReadings,
        ...(preload?.readings ?? []),
      ];
      const meanings = [
        ...(item.primaryMeaning ? [item.primaryMeaning] : []),
        ...item.meanings,
        ...(preload?.meanings ?? []),
      ];
      const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));
      const readingRomajiMatch = readings.some((reading) =>
        normalizeSearch(toRomaji(reading, { upcaseKatakana: false })).includes(normalizedQuery),
      );
      return (
        item.kanji.includes(query.trim()) ||
        normalizeSearch(item.kanji).includes(normalizedQuery) ||
        romaji.includes(normalizedQuery) ||
        readings.some((reading) => normalizeSearch(reading).includes(normalizedQuery)) ||
        readingRomajiMatch ||
        meanings.some((meaning) => normalizeSearch(meaning).includes(normalizedQuery))
      );
    });
  }, [items, query, selectedLevels, userKanjiByChar, wkFilter]);

  useEffect(() => {
    const computeColumns = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setGridColumns(4);
        return;
      }

      if (window.matchMedia("(min-width: 640px)").matches) {
        setGridColumns(2);
        return;
      }

      setGridColumns(1);
    };

    computeColumns();

    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    sm.addEventListener("change", computeColumns);
    lg.addEventListener("change", computeColumns);

    return () => {
      sm.removeEventListener("change", computeColumns);
      lg.removeEventListener("change", computeColumns);
    };
  }, []);

  function badgeClass(active: boolean): string {
    return active
      ? "border-accent bg-accent text-white"
      : "border-line bg-surface text-foreground hover:bg-surface-muted";
  }

  function statusClass(
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | undefined,
  ): string {
    if (status === "locked") return "bg-surface-muted text-foreground/70";
    if (status === "apprentice") return "bg-pink-100 text-pink-700";
    if (status === "guru") return "bg-violet-100 text-violet-700";
    if (status === "master") return "bg-sky-100 text-sky-700";
    if (status === "enlightened") return "bg-amber-100 text-amber-700";
    if (status === "burned") return "bg-surface-muted text-foreground/80";
    return "bg-surface-muted text-foreground/65";
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

  function meaningLabelFromList(meanings: string[]): string {
    if (meanings.length === 0) {
      return "-";
    }

    if (!showEnglish) {
      return "-";
    }

    return meanings.slice(0, 2).join(", ");
  }

  function jlptTitleForDisplay({
    mainMeaning,
    userMeanings,
    fallbackMeanings,
    primaryReading,
    fallbackReadings,
    kanji,
  }: {
    mainMeaning?: string | null;
    userMeanings?: string[];
    fallbackMeanings?: string[];
    primaryReading: string | null;
    fallbackReadings: string[];
    kanji: string;
  }): string {
    if (showEnglish) {
      if (mainMeaning && mainMeaning.trim()) {
        return mainMeaning;
      }

      const fromUser = userMeanings?.[0];
      if (fromUser) {
        return fromUser;
      }

      const fromFallback = meaningLabelFromList(fallbackMeanings ?? []);
      return fromFallback || "-";
    }

    if (primaryReading) {
      return primaryReading;
    }

    const fallbackReading = fallbackReadings[0] ?? null;
    if (fallbackReading) {
      return fallbackReading;
    }

    return kanji;
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
        const preload = (jlptReadings as JlptReadingsRecord)[item.kanji];
        const readings = [
          ...item.kunReadings,
          ...item.onReadings,
          ...item.nanoriReadings,
          ...(preload?.readings ?? []),
        ];
        const meanings = [
          ...(item.primaryMeaning ? [item.primaryMeaning] : []),
          ...item.meanings,
          ...(preload?.meanings ?? []),
        ];
        const readingRomajiMatch = readings.some((reading) =>
          normalizeSearch(toRomaji(reading, { upcaseKatakana: false })).includes(normalizedQuery),
        );
        return (
          item.kanji.includes(nextQuery) ||
          normalizeSearch(item.kanji).includes(normalizedQuery) ||
          romaji.includes(normalizedQuery) ||
          readings.some((reading) => normalizeSearch(reading).includes(normalizedQuery)) ||
          readingRomajiMatch ||
          meanings.some((meaning) => normalizeSearch(meaning).includes(normalizedQuery))
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

  const selectedItem = selectedKanji
    ? filteredItems.find((item) => item.kanji === selectedKanji) ?? null
    : null;
  const selectedItemIndex = selectedItem
    ? filteredItems.findIndex((item) => item.kanji === selectedItem.kanji)
    : -1;
  const detailInsertIndex =
    selectedItemIndex >= 0
      ? Math.min(
          filteredItems.length - 1,
          Math.floor(selectedItemIndex / gridColumns) * gridColumns + (gridColumns - 1),
        )
      : -1;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div>
          <h2 className="text-xl font-black text-foreground">JLPT Explorer</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
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

            <button
              type="button"
              onClick={() => setWkFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                wkFilter === "all",
              )}`}
            >
              All ({formatNumber(counts.all)})
            </button>
            <button
              type="button"
              onClick={() => setWkFilter("kanji")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                wkFilter === "kanji",
              )}`}
            >
              Kanji ({formatNumber(counts.kanji)})
            </button>
            <button
              type="button"
              onClick={() => setWkFilter("none")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                wkFilter === "none",
              )}`}
            >
              None ({formatNumber(counts.none)})
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStickyLevels((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              stickyLevels
                ? "border-accent bg-accent text-white"
                : "border-line bg-surface text-foreground"
            }`}
          >
            Sticky {stickyLevels ? "On" : "Off"}
          </button>
        </div>
      </header>

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">
          Showing {formatNumber(filteredItems.length)} results
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          WaniKani-specific SRS stats are shown only where subject mappings exist.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredItems.map((item, index) => {
            const userMatch = userKanjiByChar.get(item.kanji);
            const preload = (jlptReadings as JlptReadingsRecord)[item.kanji];
            const dbReadings = [
              ...item.kunReadings,
              ...item.onReadings,
              ...item.nanoriReadings,
            ];
            const primaryReading = userMatch
              ? (userMatch.primaryReadings ?? [])[0] ?? (userMatch.readings ?? [])[0] ?? null
              : dbReadings[0] ?? null;
            const fallbackReadings = dbReadings.length > 0 ? dbReadings : (preload?.readings ?? []);
            const fallbackMeanings = item.meanings.length > 0
              ? item.meanings
              : (preload?.meanings ?? []);
            const heading = jlptTitleForDisplay({
              mainMeaning: item.primaryMeaning,
              userMeanings: userMatch?.meanings,
              fallbackMeanings,
              primaryReading,
              fallbackReadings,
              kanji: item.kanji,
            });

            return (
              <Fragment key={`${item.nLevel}-${item.kanji}`}>
                <button
                  type="button"
                  onClick={() => setSelectedKanji((prev) => (prev === item.kanji ? null : item.kanji))}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${
                    userMatch
                      ? "border-kanji/50 bg-surface text-foreground"
                      : "border-line bg-surface text-foreground"
                  } ${selectedKanji === item.kanji ? "ring-2 ring-accent" : ""}`}
                >
                  <div className="flex items-start justify-end gap-1">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className="subject-pill subject-pill--kanji">kanji</span>
                      <span className="subject-pill border-line bg-surface text-foreground">N{item.nLevel}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xl font-black leading-tight text-foreground">{heading}</p>
                  <div className={`mt-3 rounded-xl border border-kanji/50 bg-kanji/10 px-3 py-2 ${userMatch ? "text-kanji" : "text-foreground"}`}>
                    <p className="text-center text-6xl font-black leading-none">{item.kanji}</p>
                    <p className="mt-1 text-center text-sm font-semibold text-foreground/70">
                      {primaryReading ? readingLabel(primaryReading) : readingLabelFromList(fallbackReadings)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 items-center gap-2">
                    <span className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(userMatch?.status)}`}>
                      {userMatch?.status ?? "untracked"}
                    </span>
                    <span />
                    <span className="justify-self-end rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      {userMatch ? `SRS ${userMatch.srsStage ?? 0}` : "-"}
                    </span>
                  </div>
                </button>

                {selectedItem && index === detailInsertIndex ? (
                  <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-surface p-5 sm:col-span-2 lg:col-span-4">
                    {(() => {
                      const selectedUserMatch = userKanjiByChar.get(selectedItem.kanji);
                      const selectedPreload = (jlptReadings as JlptReadingsRecord)[selectedItem.kanji];
                      const selectedDbReadings = [
                        ...selectedItem.kunReadings,
                        ...selectedItem.onReadings,
                        ...selectedItem.nanoriReadings,
                      ];
                      const primary = selectedUserMatch
                        ? (selectedUserMatch.primaryReadings ?? [])[0] ?? (selectedUserMatch.readings ?? [])[0] ?? null
                        : selectedDbReadings[0] ?? selectedPreload?.readings?.[0] ?? null;
                      const secondary = selectedUserMatch
                        ? (selectedUserMatch.readings ?? []).filter((reading) => reading !== primary)
                        : (selectedDbReadings.length > 0 ? selectedDbReadings : (selectedPreload?.readings ?? []))
                            .filter((reading) => reading !== primary);
                      const meanings = selectedUserMatch?.meanings?.length
                        ? selectedUserMatch.meanings
                        : selectedItem.meanings.length > 0
                          ? selectedItem.meanings
                          : selectedPreload?.meanings ?? [];
                      const jsonMeanings = (selectedPreload?.meanings ?? []).filter((meaning) => meaning.trim().length > 0);

                      return (
                        <>
                          <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-3">
                            <div className="inline-flex rounded-2xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-kanji">
                              <h3 className="text-4xl font-black leading-none">{selectedItem.kanji}</h3>
                            </div>
                            <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
                              <span className="subject-pill subject-pill--kanji">kanji</span>
                              <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.nLevel}</span>
                              <span className={`subject-pill ${statusClass(selectedUserMatch?.status)}`}>{selectedUserMatch?.status ?? "untracked"}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-3xl font-black leading-tight text-foreground">
                                {jlptTitleForDisplay({
                                  mainMeaning: selectedItem.primaryMeaning,
                                  userMeanings: selectedUserMatch?.meanings,
                                  fallbackMeanings: selectedItem.meanings.length > 0
                                    ? selectedItem.meanings
                                    : selectedPreload?.meanings ?? [],
                                  primaryReading: primary,
                                  fallbackReadings: selectedDbReadings.length > 0
                                    ? selectedDbReadings
                                    : selectedPreload?.readings ?? [],
                                  kanji: selectedItem.kanji,
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Primary reading</p>
                              <p className="mt-1 font-semibold text-foreground/90">{readingLabel(primary)}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Secondary readings</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {secondary.length > 0 ? secondary.map((reading) => readingLabel(reading)).join(", ") : "-"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Kunyomi</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {selectedItem.kunReadings.length > 0 ? selectedItem.kunReadings.join(", ") : "-"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Onyomi</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {selectedItem.onReadings.length > 0 ? selectedItem.onReadings.join(", ") : "-"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Stroke count</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.strokeCount ?? "-"}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Main meaning</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.primaryMeaning ?? "-"}</p>
                            </div>
                          </div>

                          {selectedUserMatch ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                                <p className="text-xs font-bold uppercase text-foreground/70">Started</p>
                                <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.startedAt)}</p>
                              </div>
                              <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                                <p className="text-xs font-bold uppercase text-foreground/70">Next review</p>
                                <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.availableAt)}</p>
                              </div>
                              <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                                <p className="text-xs font-bold uppercase text-foreground/70">Passed</p>
                                <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.passedAt)}</p>
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4">
                            <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Meaning explanation</p>
                              {jsonMeanings.length > 0 ? (
                                <ul className="mt-2 space-y-1 text-foreground/90">
                                  {jsonMeanings.map((meaning) => (
                                    <li key={meaning}>- {meaning}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-foreground/90">-</p>
                              )}
                            </article>
                          </div>
                        </>
                      );
                    })()}
                  </section>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
