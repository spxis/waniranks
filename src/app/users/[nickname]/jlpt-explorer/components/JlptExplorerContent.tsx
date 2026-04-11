import { Fragment, useEffect, useRef, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import {
  formatDate,
  formatNumber,
  jlptHeading,
  readingLabel,
  readingLabelFromList,
  stripReadingSeparators,
} from "../lib/jlptDisplay";
import ExplorerSearchBar from "../../ExplorerSearchBar";
import type { JlptItem, UserKanjiItem } from "../../explorerTypes";

type JlptWordExample = {
  written: string;
  pronounced: string;
  gloss: string;
};

type JlptReadingsRecord = Record<string, { nLevel: number; readings: string[]; meanings?: string[] }>;

type JlptFilter = "all" | "kanji" | "none";

type Props = {
  items: JlptItem[];
  showEnglish: boolean;
  studyMode: boolean;
  counts: {
    all: number;
    kanji: number;
    none: number;
    n1: number;
    n2: number;
    n3: number;
    n4: number;
    n5: number;
  };
  selectedLevels: Set<number>;
  stickyLevels: boolean;
  wkFilter: JlptFilter;
  filteredItems: JlptItem[];
  selectedKanji: string | null;
  selectedItem: JlptItem | null;
  gridColumns: number;
  userKanjiByChar: Map<string, UserKanjiItem>;
  onSetSelectedLevels: (next: Set<number>) => void;
  onToggleNLevel: (level: number) => void;
  onSetWkFilter: (next: JlptFilter) => void;
  onSetStickyLevels: (next: boolean) => void;
  onSetSelectedKanji: (next: string | null | ((prev: string | null) => string | null)) => void;
};

function parseWordExamples(input: unknown): JlptWordExample[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const rows: JlptWordExample[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const record = value as Record<string, unknown>;
    const written = typeof record.written === "string" ? record.written.trim() : "";
    const pronounced = typeof record.pronounced === "string" ? record.pronounced.trim() : "";
    const gloss = typeof record.gloss === "string" ? record.gloss.trim() : "";

    if (!written && !pronounced) {
      continue;
    }

    rows.push({ written, pronounced, gloss });
  }

  return rows;
}

function badgeClass(active: boolean): string {
  return active
    ? "border-accent bg-accent text-white"
    : "border-line bg-surface text-foreground hover:bg-surface-muted";
}

function wkFilterBadgeClass(filter: JlptFilter, active: boolean): string {
  if (filter === "kanji") {
    return active
      ? "border-kanji bg-kanji text-white"
      : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
  }

  return badgeClass(active);
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

export default function JlptExplorerContent({
  items,
  showEnglish,
  studyMode,
  counts,
  selectedLevels,
  stickyLevels,
  wkFilter,
  filteredItems,
  selectedKanji,
  selectedItem,
  gridColumns,
  userKanjiByChar,
  onSetSelectedLevels,
  onToggleNLevel,
  onSetWkFilter,
  onSetStickyLevels,
  onSetSelectedKanji,
}: Props) {
  const PAGE_SIZE = 40;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const selectedIndex = selectedItem
    ? filteredItems.findIndex((item) => item.kanji === selectedItem.kanji)
    : -1;
  const effectiveVisibleCount = Math.min(
    filteredItems.length,
    Math.max(PAGE_SIZE, visibleCount, selectedIndex + 1),
  );

  useEffect(() => {
    if (!sentinelRef.current) {
      return;
    }

    if (effectiveVisibleCount >= filteredItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((prev) => Math.min(filteredItems.length, prev + PAGE_SIZE));
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [effectiveVisibleCount, filteredItems.length]);

  const visibleItems = filteredItems.slice(0, effectiveVisibleCount);
  const selectedVisibleIndex = selectedItem
    ? visibleItems.findIndex((item) => item.kanji === selectedItem.kanji)
    : -1;
  const visibleDetailInsertIndex =
    selectedVisibleIndex >= 0
      ? Math.min(
          visibleItems.length - 1,
          Math.floor(selectedVisibleIndex / gridColumns) * gridColumns + (gridColumns - 1),
        )
      : -1;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">JLPT Explorer</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">
              Browse all N1-N5 kanji ({formatNumber(items.length)} total)
            </p>
          </div>
          <div className="w-full lg:max-w-[38rem]">
            <ExplorerSearchBar scope="jlpt" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSetSelectedLevels(new Set([1, 2, 3, 4, 5]))}
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
                onClick={() => onToggleNLevel(level)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                  selectedLevels.has(level),
                )}`}
              >
                N{level} ({formatNumber(count)})
              </button>
            ))}

            <button
              type="button"
              onClick={() => onSetWkFilter("all")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                wkFilter === "all",
              )}`}
            >
              All ({formatNumber(counts.all)})
            </button>
            <button
              type="button"
              onClick={() => onSetWkFilter("kanji")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${wkFilterBadgeClass(
                "kanji",
                wkFilter === "kanji",
              )}`}
            >
              Kanji ({formatNumber(counts.kanji)})
            </button>
            <button
              type="button"
              onClick={() => onSetWkFilter("none")}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                wkFilter === "none",
              )}`}
            >
              None ({formatNumber(counts.none)})
            </button>
          </div>
          <button
            type="button"
            onClick={() => onSetStickyLevels(!stickyLevels)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              stickyLevels ? "border-accent bg-accent text-white" : "border-line bg-surface text-foreground"
            }`}
          >
            Sticky {stickyLevels ? "On" : "Off"}
          </button>
        </div>
      </header>

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">
          Showing {formatNumber(visibleItems.length)} of {formatNumber(filteredItems.length)} results
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          WaniKani-specific SRS stats are shown only where subject mappings exist.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleItems.map((item, index) => {
            const userMatch = userKanjiByChar.get(item.kanji);
            const preload = (jlptReadings as JlptReadingsRecord)[item.kanji];
            const dbReadings = [...item.kunReadings, ...item.onReadings, ...item.nanoriReadings];
            const primaryReading = userMatch
              ? (userMatch.primaryReadings ?? [])[0] ?? (userMatch.readings ?? [])[0] ?? null
              : dbReadings[0] ?? null;
            const fallbackReadings = dbReadings.length > 0 ? dbReadings : (preload?.readings ?? []);
            const fallbackMeanings = item.meanings.length > 0 ? item.meanings : (preload?.meanings ?? []);
            const heading = jlptHeading(item.primaryMeaning, userMatch?.meanings, fallbackMeanings, item.kanji);

            return (
              <Fragment key={`${item.nLevel}-${item.kanji}`}>
                <UnifiedExplorerCard
                  onClick={() => onSetSelectedKanji((prev) => (prev === item.kanji ? null : item.kanji))}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${
                    userMatch ? "border-kanji/50 bg-surface text-foreground" : "border-line bg-surface text-foreground"
                  } ${selectedKanji === item.kanji ? "ring-2 ring-accent" : ""}`}
                  indexLabel={`#${index + 1}`}
                  topRight={
                    <>
                      <span className="subject-pill subject-pill--kanji">kanji</span>
                      {typeof userMatch?.wkLevel === "number" ? (
                        <span className="subject-pill border-line bg-surface text-foreground">L{userMatch.wkLevel}</span>
                      ) : null}
                      <span className="subject-pill border-line bg-surface text-foreground">N{item.nLevel}</span>
                    </>
                  }
                  title={studyMode ? "Kanji" : heading}
                  glyphClassName={`border-kanji/50 bg-kanji/10 ${userMatch ? "text-kanji" : "text-foreground"}`}
                  glyphText={item.kanji}
                  glyphTextClassName="text-6xl"
                  glyphSubtitle={
                    !studyMode
                      ? primaryReading
                        ? readingLabel(primaryReading, showEnglish)
                        : readingLabelFromList(fallbackReadings, showEnglish)
                      : undefined
                  }
                  statusChip={
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(userMatch?.status)}`}>
                      {userMatch?.status ?? "untracked"}
                    </span>
                  }
                  rightChip={
                    <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      {userMatch ? `SRS ${userMatch.srsStage ?? 0}` : "-"}
                    </span>
                  }
                />

                {selectedItem && index === visibleDetailInsertIndex ? (
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
                        : (selectedDbReadings.length > 0 ? selectedDbReadings : (selectedPreload?.readings ?? [])).filter(
                            (reading) => reading !== primary,
                          );
                      const jsonMeanings = (selectedPreload?.meanings ?? []).filter((meaning) => meaning.trim().length > 0);
                      const wordExamples = parseWordExamples(selectedItem.wordExamples);

                      return (
                        <>
                          <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-3">
                            <div className="inline-flex rounded-2xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-kanji">
                              <h3 className="text-4xl font-black leading-none">{selectedItem.kanji}</h3>
                            </div>
                            <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
                              <span className="subject-pill subject-pill--kanji">kanji</span>
                              {typeof selectedUserMatch?.wkLevel === "number" ? (
                                <span className="subject-pill border-line bg-surface text-foreground">L{selectedUserMatch.wkLevel}</span>
                              ) : null}
                              <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.nLevel}</span>
                              <span className={`subject-pill ${statusClass(selectedUserMatch?.status)}`}>
                                {selectedUserMatch?.status ?? "untracked"}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-3xl font-black leading-tight text-foreground">
                                {studyMode
                                  ? "Kanji"
                                  : jlptHeading(
                                      selectedItem.primaryMeaning,
                                      selectedUserMatch?.meanings,
                                      selectedItem.meanings.length > 0
                                        ? selectedItem.meanings
                                        : (selectedPreload?.meanings ?? []),
                                      selectedItem.kanji,
                                    )}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
                            {!studyMode ? (
                              <>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Primary reading</p>
                              <p className="mt-1 font-semibold text-foreground/90">{readingLabel(primary, showEnglish)}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Secondary readings</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {secondary.length > 0
                                  ? secondary.map((reading) => readingLabel(reading, showEnglish)).join(", ")
                                  : "-"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Kunyomi</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {selectedItem.kunReadings.length > 0
                                  ? selectedItem.kunReadings.map((reading) => stripReadingSeparators(reading)).join(", ")
                                  : "-"}
                              </p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Onyomi</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {selectedItem.onReadings.length > 0
                                  ? selectedItem.onReadings.map((reading) => stripReadingSeparators(reading)).join(", ")
                                  : "-"}
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
                              </>
                            ) : null}
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Frequency rank</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.frequencyRank ?? "-"}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">School grade</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.schoolGrade ?? "-"}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Heisig keyword</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.heisigKeyword ?? "-"}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Unicode</p>
                              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.unicodeHex ?? "-"}</p>
                            </div>
                            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                              <p className="text-xs font-bold uppercase text-foreground/70">Source JLPT</p>
                              <p className="mt-1 font-semibold text-foreground/90">
                                {selectedItem.sourceJlpt ? `N${selectedItem.sourceJlpt}` : "-"}
                              </p>
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

                          {!studyMode ? (
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
                          ) : null}

                          {!studyMode && selectedItem.notes.length > 0 ? (
                            <div className="mt-4">
                              <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                                <p className="text-xs font-bold uppercase text-foreground/70">Dictionary notes</p>
                                <ul className="mt-2 space-y-1 text-foreground/90">
                                  {selectedItem.notes.map((note) => (
                                    <li key={note}>- {note}</li>
                                  ))}
                                </ul>
                              </article>
                            </div>
                          ) : null}

                          {!studyMode && wordExamples.length > 0 ? (
                            <div className="mt-4">
                              <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                                <p className="text-xs font-bold uppercase text-foreground/70">Used in words</p>
                                <ul className="mt-2 space-y-2 text-foreground/90">
                                  {wordExamples.map((example, index) => (
                                    <li
                                      key={`${selectedItem.kanji}-${example.written}-${example.pronounced}-${index}`}
                                      className="rounded-lg border border-line bg-surface px-3 py-2"
                                    >
                                      <p className="text-base font-bold text-foreground">{example.written || "-"}</p>
                                      <p className="text-xs font-semibold text-foreground/70">{example.pronounced || "-"}</p>
                                      <p className="mt-1 text-sm text-foreground/85">{example.gloss || "-"}</p>
                                    </li>
                                  ))}
                                </ul>
                              </article>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                  </section>
                ) : null}
              </Fragment>
            );
          })}
        </div>
        {visibleItems.length < filteredItems.length ? (
          <div ref={sentinelRef} className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
            Loading more...
          </div>
        ) : null}
      </div>
    </section>
  );
}
