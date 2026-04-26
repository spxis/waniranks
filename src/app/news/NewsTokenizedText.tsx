"use client";

import { useEffect, useMemo, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";

import type {
  NewsKanjiCapBasis,
  NewsKanjiCapGrade,
  NewsKanjiCapJlpt,
  NewsKanjiCapWk,
} from "./newsReadingPrefs";

import {
  availabilityForRun,
  openNewsGlyphCandidatesWithOptions,
  prefetchNewsGlyphCandidates,
} from "./newsGlyphRunner";
import {
  NEWS_KANJI_HISTORY_EVENT,
  readNewsKanjiHistory,
} from "./newsKanjiHistory";
import {
  buildCandidatesFromSelectedText,
  buildLookupCandidates,
} from "./newsLookupCandidates";
import { tokenizeJapanese } from "./newsTokenize";

type Props = {
  text: string;
  emphasizeKanji: boolean;
  kanjiCapBasis: NewsKanjiCapBasis;
  kanjiCapJlpt: NewsKanjiCapJlpt;
  kanjiCapWk: NewsKanjiCapWk;
  kanjiCapGrade: NewsKanjiCapGrade;
};

const pageSessionSeenGlyphs = new Set<string>();
type JlptRecord = Record<string, { nLevel?: number }>;

const sharedWkLevelsByChar: Record<string, number | null> = {};
const sharedGradesByChar: Record<string, number | null> = {};
const sharedReadingsByRun: Record<string, string | null> = {};
const loadingLevelChars = new Set<string>();
const loadingReadingRuns = new Set<string>();
const queuedLevelChars = new Set<string>();
const queuedReadingRuns = new Set<string>();
let levelBatchTimer: ReturnType<typeof setTimeout> | null = null;
let readingBatchTimer: ReturnType<typeof setTimeout> | null = null;
let levelBatchPromise: Promise<void> | null = null;
let readingBatchPromise: Promise<void> | null = null;
let resolveLevelBatchPromise: (() => void) | null = null;
let resolveReadingBatchPromise: (() => void) | null = null;

export default function NewsTokenizedText({
  text,
  emphasizeKanji,
  kanjiCapBasis,
  kanjiCapJlpt,
  kanjiCapWk,
  kanjiCapGrade,
}: Props) {
  const segments = tokenizeJapanese(text);
  const [dynamicAvailability, setDynamicAvailability] = useState<
    Record<string, "unknown" | "known" | "missing">
  >({});
  const [resolvedWkLevels, setResolvedWkLevels] = useState<Record<string, number | null>>(
    () => ({ ...sharedWkLevelsByChar }),
  );
  const [resolvedGrades, setResolvedGrades] = useState<Record<string, number | null>>(
    () => ({ ...sharedGradesByChar }),
  );
  const [readingsByRun, setReadingsByRun] = useState<Record<string, string | null>>(
    () => ({ ...sharedReadingsByRun }),
  );
  const [loadingRun, setLoadingRun] = useState<string | null>(null);
  const [seenRuns, setSeenRuns] = useState<Set<string>>(() => {
    const next = collectSeenGlyphs();
    for (const token of pageSessionSeenGlyphs) {
      next.add(token);
    }
    return next;
  });

  useEffect(() => {
    const refresh = () => {
      const next = collectSeenGlyphs();
      for (const token of pageSessionSeenGlyphs) {
        next.add(token);
      }
      setSeenRuns(next);
    };
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, refresh);
    };
  }, []);

  const availabilityByRun = useMemo<Record<string, "unknown" | "known" | "missing">>(() => {
    const map = new Map<string, "unknown" | "known" | "missing">();
    for (const segment of segments) {
      if (segment.kind !== "kanji") {
        continue;
      }
      if (!map.has(segment.text)) {
        map.set(segment.text, availabilityForRun(segment.text));
      }
    }
    return Object.fromEntries(map.entries());
  }, [segments]);

  const capEnabled = isCapEnabled(kanjiCapBasis, kanjiCapJlpt, kanjiCapWk, kanjiCapGrade);

  const articleKanjiRuns = useMemo(() => {
    const unique = new Set<string>();
    for (const segment of segments) {
      if (segment.kind === "kanji") {
        unique.add(segment.text);
      }
    }
    return Array.from(unique);
  }, [segments]);

  const articleKanjiChars = useMemo(() => {
    const unique = new Set<string>();
    for (const segment of segments) {
      if (segment.kind !== "kanji") {
        continue;
      }
      for (const char of Array.from(segment.text)) {
        if (KANJI_REGEX.test(char)) {
          unique.add(char);
        }
      }
    }
    return Array.from(unique);
  }, [segments]);

  const articleCharsKey = useMemo(() => articleKanjiChars.join(""), [articleKanjiChars]);

  useEffect(() => {
    if (articleKanjiChars.length === 0) {
      return;
    }

    const unresolved = articleKanjiChars.filter(
      (char) => !(char in resolvedWkLevels) || !(char in resolvedGrades),
    );
    if (unresolved.length === 0) {
      return;
    }

    let cancelled = false;
    void ensureKanjiLevels(unresolved).then(() => {
      if (cancelled) {
        return;
      }

      setResolvedWkLevels((prev) => ({ ...prev, ...pickCharValues(unresolved, sharedWkLevelsByChar) }));
      setResolvedGrades((prev) => ({ ...prev, ...pickCharValues(unresolved, sharedGradesByChar) }));
    });

    return () => {
      cancelled = true;
    };
  }, [articleCharsKey, articleKanjiChars, resolvedGrades, resolvedWkLevels]);

  useEffect(() => {
    if (!capEnabled || articleKanjiRuns.length === 0) {
      return;
    }

    const unresolved = articleKanjiRuns.filter((run) => !(run in readingsByRun));
    if (unresolved.length === 0) {
      return;
    }

    let cancelled = false;
    void ensureRunReadings(unresolved).then(() => {
      if (cancelled) {
        return;
      }
      setReadingsByRun((prev) => ({ ...prev, ...pickRunValues(unresolved, sharedReadingsByRun) }));
    });

    return () => {
      cancelled = true;
    };
  }, [articleKanjiRuns, capEnabled, readingsByRun]);

  if (segments.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind !== "kanji") {
          return <span key={index}>{segment.text}</span>;
        }
        const candidates = buildLookupCandidates(segments, index);
        const primaryRun = candidates[0] ?? segment.text;
        const availability = dynamicAvailability[segment.text] ?? availabilityByRun[segment.text] ?? "unknown";
        const isLoading = loadingRun === segment.text;
        const isDowngraded = shouldDeemphasizeSegment(segment.text, {
          basis: kanjiCapBasis,
          jlptCap: kanjiCapJlpt,
          wkCap: kanjiCapWk,
          gradeCap: kanjiCapGrade,
          wkByChar: resolvedWkLevels,
          gradeByChar: resolvedGrades,
        });
        const resolvedReading = readingsByRun[segment.text];
        const readingPending =
          isDowngraded && (!(segment.text in readingsByRun) || loadingReadingRuns.has(segment.text));
        const levelPending = isSegmentLevelPending(segment.text, {
          basis: kanjiCapBasis,
          wkByChar: resolvedWkLevels,
          gradeByChar: resolvedGrades,
        });
        const displayText =
          isDowngraded && typeof resolvedReading === "string" && resolvedReading.length > 0
            ? resolvedReading
            : segment.text;
        const sizeClass = emphasizeKanji ? "text-[1.2em] leading-none" : "";
        const seenClass = seenRuns.has(segment.text) ? "text-accent/80" : "";
        const downgradedClass = isDowngraded && displayText === segment.text ? "opacity-65" : "";
        const capPendingClass = isDowngraded && (readingPending || levelPending) ? "animate-pulse" : "";
        const missingClass =
          availability === "missing"
            ? "text-hot/80 decoration-hot/70 decoration-wavy underline"
            : "";
        const tryOpen = () => {
          const selectionText = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
          if (isLoading) {
            return;
          }
          const selectionCandidates = selectionText
            ? buildCandidatesFromSelectedText(selectionText)
            : [];
          const lookupCandidates =
            selectionCandidates.length > 0
              ? [...selectionCandidates, ...candidates]
              : candidates;
          const lookupPrimary = lookupCandidates[0] ?? primaryRun;

          setLoadingRun(segment.text);
          void openNewsGlyphCandidatesWithOptions(lookupCandidates, {
            displayRun: segment.text,
          })
            .then((opened) => {
              if (!opened) {
                void prefetchNewsGlyphCandidates(lookupCandidates).then((next) => {
                  setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
                });
                return;
              }

              const clickedChars = extractKanjiTokens(lookupPrimary);
              setSeenRuns((prev) => {
                const next = new Set(prev);
                next.add(lookupPrimary);
                pageSessionSeenGlyphs.add(lookupPrimary);
                for (const token of clickedChars) {
                  next.add(token);
                  pageSessionSeenGlyphs.add(token);
                }
                return next;
              });
            })
            .finally(() => {
              setLoadingRun((prev) => (prev === segment.text ? null : prev));
            });
        };

        return (
          <span
            key={index}
            tabIndex={isLoading ? -1 : 0}
            aria-disabled={isLoading}
            aria-label={`Look up ${segment.text}`}
            onClick={() => {
              tryOpen();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                tryOpen();
              }
            }}
            onMouseEnter={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphCandidates(candidates).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            onFocus={() => {
              if (availability !== "unknown" || isLoading) {
                return;
              }
              void prefetchNewsGlyphCandidates(candidates).then((next) => {
                setDynamicAvailability((prev) => ({ ...prev, [segment.text]: next }));
              });
            }}
            className={`group relative inline cursor-pointer select-text align-baseline text-foreground outline-none transition hover:text-accent focus-visible:text-accent ${isLoading ? "cursor-wait opacity-80" : ""} ${sizeClass} ${seenClass} ${downgradedClass} ${capPendingClass} ${missingClass}`.trim()}
            title={
              isLoading
                ? `Looking up ${segment.text}...`
                : isDowngraded && (readingPending || levelPending)
                ? `Applying cap to ${segment.text}...`
                : availability === "missing"
                ? `${segment.text} is not in your WaniKani data`
                : `Look up ${segment.text}`
            }
          >
            <span className="rounded-sm group-hover:bg-accent/10 group-focus-visible:bg-accent/10">
              {displayText}
            </span>
            {isLoading ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-1 h-3 w-3 animate-spin rounded-full border-2 border-accent/35 border-t-accent"
              />
            ) : null}
            {!isLoading && isDowngraded && (readingPending || levelPending) ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-1 h-3 w-3 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const jlptByChar = jlptReadings as JlptRecord;

async function ensureKanjiLevels(chars: string[]): Promise<void> {
  let added = false;
  for (const char of chars) {
    if (isCharLevelResolved(char) || loadingLevelChars.has(char)) {
      continue;
    }
    queuedLevelChars.add(char);
    added = true;
  }

  if (added) {
    scheduleLevelBatch();
  }

  if (levelBatchPromise) {
    await levelBatchPromise;
  }

  const stillMissing = chars.filter((char) => !isCharLevelResolved(char) && !loadingLevelChars.has(char));
  if (stillMissing.length > 0) {
    await ensureKanjiLevels(stillMissing);
  }
}

async function ensureRunReadings(runs: string[]): Promise<void> {
  let added = false;
  for (const run of runs) {
    if (run in sharedReadingsByRun || loadingReadingRuns.has(run)) {
      continue;
    }
    queuedReadingRuns.add(run);
    added = true;
  }

  if (added) {
    scheduleReadingBatch();
  }

  if (readingBatchPromise) {
    await readingBatchPromise;
  }

  const stillMissing = runs.filter((run) => !(run in sharedReadingsByRun) && !loadingReadingRuns.has(run));
  if (stillMissing.length > 0) {
    await ensureRunReadings(stillMissing);
  }
}

function scheduleLevelBatch(): void {
  if (!levelBatchPromise) {
    levelBatchPromise = new Promise<void>((resolve) => {
      resolveLevelBatchPromise = resolve;
    });
  }
  if (levelBatchTimer !== null) {
    return;
  }

  levelBatchTimer = setTimeout(() => {
    void flushLevelBatch();
  }, 20);
}

async function flushLevelBatch(): Promise<void> {
  const batch = Array.from(queuedLevelChars);
  queuedLevelChars.clear();

  if (batch.length > 0) {
    for (const char of batch) {
      loadingLevelChars.add(char);
    }

    try {
      const response = await fetch("/api/news/kanji-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chars: batch }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { levels?: Record<string, number | null>; grades?: Record<string, number | null> }
        | null;
      if (response.ok) {
        for (const char of batch) {
          sharedWkLevelsByChar[char] = payload?.levels?.[char] ?? null;
          sharedGradesByChar[char] = payload?.grades?.[char] ?? null;
        }
      }
    } catch {
      // Keep rendering functional if enrichment fails.
    } finally {
      for (const char of batch) {
        loadingLevelChars.delete(char);
      }
    }
  }

  levelBatchTimer = null;
  const resolve = resolveLevelBatchPromise;
  levelBatchPromise = null;
  resolveLevelBatchPromise = null;
  resolve?.();

  if (queuedLevelChars.size > 0) {
    scheduleLevelBatch();
  }
}

function scheduleReadingBatch(): void {
  if (!readingBatchPromise) {
    readingBatchPromise = new Promise<void>((resolve) => {
      resolveReadingBatchPromise = resolve;
    });
  }
  if (readingBatchTimer !== null) {
    return;
  }

  readingBatchTimer = setTimeout(() => {
    void flushReadingBatch();
  }, 20);
}

async function flushReadingBatch(): Promise<void> {
  const batch = Array.from(queuedReadingRuns);
  queuedReadingRuns.clear();

  if (batch.length > 0) {
    for (const run of batch) {
      loadingReadingRuns.add(run);
    }

    try {
      const response = await fetch("/api/news/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs: batch }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { readings?: Record<string, string | null> }
        | null;
      if (response.ok) {
        for (const run of batch) {
          sharedReadingsByRun[run] = payload?.readings?.[run] ?? null;
        }
      }
    } catch {
      // Keep original text if reading lookup fails.
    } finally {
      for (const run of batch) {
        loadingReadingRuns.delete(run);
      }
    }
  }

  readingBatchTimer = null;
  const resolve = resolveReadingBatchPromise;
  readingBatchPromise = null;
  resolveReadingBatchPromise = null;
  resolve?.();

  if (queuedReadingRuns.size > 0) {
    scheduleReadingBatch();
  }
}

function isCharLevelResolved(char: string): boolean {
  return char in sharedWkLevelsByChar && char in sharedGradesByChar;
}

function pickCharValues(
  chars: string[],
  source: Record<string, number | null>,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const char of chars) {
    if (char in source) {
      out[char] = source[char] ?? null;
    }
  }
  return out;
}

function pickRunValues(
  runs: string[],
  source: Record<string, string | null>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const run of runs) {
    if (run in source) {
      out[run] = source[run] ?? null;
    }
  }
  return out;
}

function isSegmentLevelPending(
  value: string,
  settings: {
    basis: NewsKanjiCapBasis;
    wkByChar: Record<string, number | null>;
    gradeByChar: Record<string, number | null>;
  },
): boolean {
  if (settings.basis === "jlpt") {
    return false;
  }

  const chars = Array.from(value).filter((char) => KANJI_REGEX.test(char));
  if (settings.basis === "wk") {
    return chars.some((char) => !(char in settings.wkByChar));
  }
  return chars.some((char) => !(char in settings.gradeByChar));
}

function collectSeenGlyphs(): Set<string> {
  const seen = new Set<string>();
  for (const entry of readNewsKanjiHistory()) {
    const run = entry.run.trim();
    if (!run) {
      continue;
    }
    seen.add(run);
    for (const token of extractKanjiTokens(run)) {
      seen.add(token);
    }
  }
  return seen;
}

function extractKanjiTokens(value: string): string[] {
  return Array.from(value).filter((char) => KANJI_REGEX.test(char));
}

function isCapEnabled(
  basis: NewsKanjiCapBasis,
  jlptCap: NewsKanjiCapJlpt,
  wkCap: NewsKanjiCapWk,
  gradeCap: NewsKanjiCapGrade,
): boolean {
  if (basis === "jlpt") {
    return jlptCap !== "all";
  }
  if (basis === "wk") {
    return wkCap !== "all";
  }
  return gradeCap !== "all";
}

function shouldDeemphasizeSegment(
  value: string,
  settings: {
    basis: NewsKanjiCapBasis;
    jlptCap: NewsKanjiCapJlpt;
    wkCap: NewsKanjiCapWk;
    gradeCap: NewsKanjiCapGrade;
    wkByChar: Record<string, number | null>;
    gradeByChar: Record<string, number | null>;
  },
): boolean {
  const chars = Array.from(value).filter((char) => KANJI_REGEX.test(char));
  if (chars.length === 0) {
    return false;
  }

  if (settings.basis === "jlpt") {
    const threshold = jlptThresholdFromMode(settings.jlptCap);
    if (threshold === null) {
      return false;
    }
    return chars.some((char) => isJlptHarderThanThreshold(char, threshold));
  }

  if (settings.basis === "wk") {
    const threshold = wkThresholdFromMode(settings.wkCap);
    if (threshold === null) {
      return false;
    }
    return chars.some((char) => {
      const wkLevel = settings.wkByChar[char];
      return typeof wkLevel === "number" && wkLevel > threshold;
    });
  }

  const threshold = gradeThresholdFromMode(settings.gradeCap);
  if (threshold === null) {
    return false;
  }
  return chars.some((char) => {
    const grade = settings.gradeByChar[char];
    return typeof grade === "number" && grade > threshold;
  });
}

function jlptThresholdFromMode(mode: NewsKanjiCapJlpt): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode.slice(1));
  return Number.isFinite(parsed) ? parsed : null;
}

function wkThresholdFromMode(mode: NewsKanjiCapWk): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode);
  return Number.isFinite(parsed) ? parsed : null;
}

function gradeThresholdFromMode(mode: NewsKanjiCapGrade): number | null {
  if (mode === "all") {
    return null;
  }

  const parsed = Number(mode);
  return Number.isFinite(parsed) ? parsed : null;
}

function isJlptHarderThanThreshold(char: string, threshold: number): boolean {
  if (!KANJI_REGEX.test(char)) {
    return false;
  }

  const nLevel = jlptByChar[char]?.nLevel;
  if (typeof nLevel !== "number") {
    return false;
  }

  return nLevel < threshold;
}

