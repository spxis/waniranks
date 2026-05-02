"use client";

import { useEffect, useMemo, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import type { NewsArticleBlock } from "@/lib/news/newsTypes";

import {
  ensureKanjiLevels,
  getCachedKanjiLevels,
  hasFreshKanjiLevel,
  shouldRefreshKanjiLevel,
} from "./newsEnrichmentCache";
import { NEWS_KANJI_HISTORY_EVENT } from "./newsKanjiHistory";
import { readAllRunLookupCache } from "./newsKanjiCache";
import type {
  AllCountFilter,
  AllCoverageFilter,
  EntrySortMode,
  GroupMode,
  JlptRecord,
} from "./NewsKanjiOverviewPanel.types";
import {
  buildGroups,
  GroupColumn,
  matchesAllFilters,
  matchesCountFilter,
  SegmentButton,
  sortGroupsForDisplay,
} from "./newsKanjiOverviewHelpers";

type Props = {
  blocks: NewsArticleBlock[];
};

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const GROUP_MODE_STORAGE_KEY = "news:kanji-group-mode";
const ENTRY_SORT_STORAGE_KEY = "news:kanji-sort-mode";
const ALL_COUNT_FILTER_STORAGE_KEY = "news:kanji-all-count-filter";
const ALL_COVERAGE_FILTER_STORAGE_KEY = "news:kanji-all-coverage-filter";
const GROUP_MODE_OPTIONS = ["all", "jlpt", "wk", "grade"] as const;
const ENTRY_SORT_OPTIONS = ["article", "count", "jp"] as const;
const ALL_COUNT_FILTER_OPTIONS = ["all", "2+", "5+", "10+", "25+", "50+"] as const;
const ALL_COVERAGE_FILTER_OPTIONS = ["all", "wk-known", "wk-unknown", "no-level-data"] as const;

export function countUniqueArticleKanji(blocks: NewsArticleBlock[]): number {
  return extractArticleKanjiData(blocks).orderedChars.length;
}

export default function NewsKanjiOverviewPanel({ blocks }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [levelVersion, setLevelVersion] = useState(0);
  const [groupMode, setGroupMode] = useState<GroupMode>(() =>
    getStoredEnum<GroupMode>(GROUP_MODE_STORAGE_KEY, GROUP_MODE_OPTIONS, "all"),
  );
  const [entrySortMode, setEntrySortMode] = useState<EntrySortMode>(() =>
    getStoredEnum<EntrySortMode>(ENTRY_SORT_STORAGE_KEY, ENTRY_SORT_OPTIONS, "article"),
  );
  const [allCountFilter, setAllCountFilter] = useState<AllCountFilter>(() =>
    getStoredEnum<AllCountFilter>(ALL_COUNT_FILTER_STORAGE_KEY, ALL_COUNT_FILTER_OPTIONS, "all"),
  );
  const [allCoverageFilter, setAllCoverageFilter] = useState<AllCoverageFilter>(() =>
    getStoredEnum<AllCoverageFilter>(ALL_COVERAGE_FILTER_STORAGE_KEY, ALL_COVERAGE_FILTER_OPTIONS, "all"),
  );

  const { orderedChars, countsByChar } = useMemo(() => extractArticleKanjiData(blocks), [blocks]);
  const charsKey = useMemo(() => orderedChars.join(""), [orderedChars]);

  useEffect(() => {
    const onRefresh = () => {
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, onRefresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, onRefresh);
    };
  }, []);

  useEffect(() => {
    if (orderedChars.length === 0) {
      return;
    }

    const toEnsure = orderedChars.filter(
      (char) => !hasFreshKanjiLevel(char) || shouldRefreshKanjiLevel(char),
    );
    if (toEnsure.length === 0) {
      return;
    }

    let cancelled = false;
    void ensureKanjiLevels(toEnsure, { allowFreshRefresh: true }).then(() => {
      if (cancelled) {
        return;
      }

      setLevelVersion((prev) => prev + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [charsKey, orderedChars, refreshKey]);

  const cachedLevels = useMemo(
    () => {
      void levelVersion;
      return getCachedKanjiLevels(orderedChars);
    },
    [levelVersion, orderedChars],
  );

  const entries = useMemo(() => {
    void refreshKey;
    const wkByChar = buildWkLevelByChar();
    const jlptByChar = jlptReadings as JlptRecord;

    return orderedChars.map((char) => ({
      char,
      jlptLevel:
        typeof jlptByChar[char]?.nLevel === "number"
          ? (jlptByChar[char]?.nLevel as number)
          : null,
      wkLevel: wkByChar.get(char) ?? cachedLevels.levels[char] ?? null,
      schoolGrade: cachedLevels.grades[char] ?? null,
      schoolGradePending: !hasFreshKanjiLevel(char),
      occurrenceCount: countsByChar.get(char) ?? 1,
    }));
  }, [cachedLevels.grades, cachedLevels.levels, countsByChar, orderedChars, refreshKey]);

  if (entries.length === 0) {
    return null;
  }

  const knownJlpt = entries.filter((entry) => entry.jlptLevel !== null).length;
  const knownWk = entries.filter((entry) => entry.wkLevel !== null).length;
  const knownGrade = entries.filter((entry) => entry.schoolGrade !== null).length;

  const filteredByCountEntries = entries.filter((entry) =>
    matchesCountFilter(entry.occurrenceCount, allCountFilter),
  );

  const jlptGroups = buildGroups(filteredByCountEntries, (entry) =>
    entry.jlptLevel === null ? "Unknown" : `N${entry.jlptLevel}`,
  );
  const wkGroups = buildGroups(filteredByCountEntries, (entry) =>
    entry.wkLevel === null ? "Unknown" : `WK ${entry.wkLevel}`,
  );
  const gradeGroups = buildGroups(filteredByCountEntries, (entry) =>
    entry.schoolGradePending
      ? "Loading"
      : entry.schoolGrade === null
        ? "Unknown"
        : `Grade ${entry.schoolGrade}`,
  );
  const filteredAllEntries = filteredByCountEntries.filter((entry) =>
    matchesAllFilters(entry, allCountFilter, allCoverageFilter),
  );
  const allGroups = buildGroups(filteredAllEntries, () => "All");

  const activeGroup =
    groupMode === "all"
      ? { title: "All Kanji", groups: allGroups }
      : groupMode === "jlpt"
      ? { title: "By JLPT", groups: jlptGroups }
      : groupMode === "wk"
        ? { title: "By WaniKani", groups: wkGroups }
        : { title: "By School Grade", groups: gradeGroups };

  const visibleGroups = sortGroupsForDisplay(activeGroup.groups, entrySortMode);

  const updateGroupMode = (nextMode: GroupMode) => {
    setGroupMode(nextMode);
    setStoredEnum(GROUP_MODE_STORAGE_KEY, nextMode);
  };

  const updateEntrySortMode = (nextMode: EntrySortMode) => {
    setEntrySortMode(nextMode);
    setStoredEnum(ENTRY_SORT_STORAGE_KEY, nextMode);
  };

  const updateAllCountFilter = (nextFilter: AllCountFilter) => {
    setAllCountFilter(nextFilter);
    setStoredEnum(ALL_COUNT_FILTER_STORAGE_KEY, nextFilter);
  };

  const updateAllCoverageFilter = (nextFilter: AllCoverageFilter) => {
    setAllCoverageFilter(nextFilter);
    setStoredEnum(ALL_COVERAGE_FILTER_STORAGE_KEY, nextFilter);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface-muted/70 p-3 sm:p-4">
      <header className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          Kanji In This Article
        </p>
        <p className="mt-1 text-xs text-foreground/65">
          {entries.length} unique kanji • JLPT {knownJlpt} • WK {knownWk} • Grade {knownGrade}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-surface-muted p-1">
            <SegmentButton
              label="All"
              selected={groupMode === "all"}
              onClick={() => {
                updateGroupMode("all");
              }}
            />
            <SegmentButton
              label="JLPT"
              selected={groupMode === "jlpt"}
              onClick={() => {
                updateGroupMode("jlpt");
              }}
            />
            <SegmentButton
              label="WK"
              selected={groupMode === "wk"}
              onClick={() => {
                updateGroupMode("wk");
              }}
            />
            <SegmentButton
              label="Grade"
              selected={groupMode === "grade"}
              onClick={() => {
                updateGroupMode("grade");
              }}
            />
          </div>

          <div className="inline-flex rounded-lg border border-line bg-surface-muted p-1">
            <SegmentButton
              label="Article"
              selected={entrySortMode === "article"}
              onClick={() => {
                updateEntrySortMode("article");
              }}
            />
            <SegmentButton
              label="Count"
              selected={entrySortMode === "count"}
              onClick={() => {
                updateEntrySortMode("count");
              }}
            />
            <SegmentButton
              label="Japanese"
              selected={entrySortMode === "jp"}
              onClick={() => {
                updateEntrySortMode("jp");
              }}
            />
          </div>

          <div className="inline-flex rounded-lg border border-line bg-surface-muted p-1">
            <SegmentButton
              label="Count All"
              selected={allCountFilter === "all"}
              onClick={() => {
                updateAllCountFilter("all");
              }}
            />
            <SegmentButton
              label="2+"
              selected={allCountFilter === "2+"}
              onClick={() => {
                updateAllCountFilter("2+");
              }}
            />
            <SegmentButton
              label="5+"
              selected={allCountFilter === "5+"}
              onClick={() => {
                updateAllCountFilter("5+");
              }}
            />
            <SegmentButton
              label="10+"
              selected={allCountFilter === "10+"}
              onClick={() => {
                updateAllCountFilter("10+");
              }}
            />
            <SegmentButton
              label="25+"
              selected={allCountFilter === "25+"}
              onClick={() => {
                updateAllCountFilter("25+");
              }}
            />
            <SegmentButton
              label="50+"
              selected={allCountFilter === "50+"}
              onClick={() => {
                updateAllCountFilter("50+");
              }}
            />
          </div>

          {groupMode === "all" ? (
            <>
              <div className="inline-flex rounded-lg border border-line bg-surface-muted p-1">
                <SegmentButton
                  label="Focus All"
                  selected={allCoverageFilter === "all"}
                  onClick={() => {
                    updateAllCoverageFilter("all");
                  }}
                />
                <SegmentButton
                  label="WK Known"
                  selected={allCoverageFilter === "wk-known"}
                  onClick={() => {
                    updateAllCoverageFilter("wk-known");
                  }}
                />
                <SegmentButton
                  label="WK Unknown"
                  selected={allCoverageFilter === "wk-unknown"}
                  onClick={() => {
                    updateAllCoverageFilter("wk-unknown");
                  }}
                />
                <SegmentButton
                  label="No Level"
                  selected={allCoverageFilter === "no-level-data"}
                  onClick={() => {
                    updateAllCoverageFilter("no-level-data");
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      </header>

      <GroupColumn
        title={activeGroup.title}
        groups={visibleGroups}
        emptyMessage={
          groupMode === "all"
            ? "No kanji match these filters. Try Count All or a lower count threshold."
            : "No kanji match the current count filter. Try Count All or a lower threshold."
        }
      />
    </section>
  );
}

function extractArticleKanjiData(blocks: NewsArticleBlock[]): {
  orderedChars: string[];
  countsByChar: Map<string, number>;
} {
  const seen = new Set<string>();
  const orderedChars: string[] = [];
  const countsByChar = new Map<string, number>();

  for (const block of blocks) {
    for (const char of Array.from(block.text)) {
      if (!KANJI_REGEX.test(char)) {
        continue;
      }

      countsByChar.set(char, (countsByChar.get(char) ?? 0) + 1);
      if (seen.has(char)) {
        continue;
      }

      seen.add(char);
      orderedChars.push(char);
    }
  }

  return { orderedChars, countsByChar };
}

function buildWkLevelByChar(): Map<string, number> {
  const map = new Map<string, number>();

  for (const hit of readAllRunLookupCache()) {
    for (const item of hit.result.kanjiItems) {
      if (item.subjectId === null || typeof item.wkLevel !== "number") {
        continue;
      }
      map.set(item.text, item.wkLevel);
    }
  }

  return map;
}
