"use client";

import { useEffect, useMemo, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import type { NewsArticleBlock } from "@/lib/news/newsTypes";

import { openNewsGlyphRun } from "./newsGlyphRunner";
import { newsGlyphButtonClass } from "./newsGlyphBoxStyle";
import {
  ensureKanjiLevels,
  getCachedKanjiLevels,
  hasFreshKanjiLevel,
  shouldRefreshKanjiLevel,
} from "./newsEnrichmentCache";
import { NEWS_KANJI_HISTORY_EVENT } from "./newsKanjiHistory";
import { readAllRunLookupCache } from "./newsKanjiCache";

type Props = {
  blocks: NewsArticleBlock[];
};

type KanjiEntry = {
  char: string;
  jlptLevel: number | null;
  wkLevel: number | null;
  schoolGrade: number | null;
  schoolGradePending: boolean;
  occurrenceCount: number;
};

type GroupMode = "all" | "jlpt" | "wk" | "grade";
type EntrySortMode = "article" | "count" | "jp";

type JlptRecord = Record<string, { nLevel?: number }>;

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const japaneseCollator = new Intl.Collator("ja");
const GROUP_MODE_STORAGE_KEY = "news:kanji-group-mode";
const ENTRY_SORT_STORAGE_KEY = "news:kanji-sort-mode";
const GROUP_MODE_OPTIONS = ["all", "jlpt", "wk", "grade"] as const;
const ENTRY_SORT_OPTIONS = ["article", "count", "jp"] as const;

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

  const jlptGroups = buildGroups(entries, (entry) =>
    entry.jlptLevel === null ? "Unknown" : `N${entry.jlptLevel}`,
  );
  const wkGroups = buildGroups(entries, (entry) =>
    entry.wkLevel === null ? "Unknown" : `WK ${entry.wkLevel}`,
  );
  const gradeGroups = buildGroups(entries, (entry) =>
    entry.schoolGradePending
      ? "Loading"
      : entry.schoolGrade === null
        ? "Unknown"
        : `Grade ${entry.schoolGrade}`,
  );
  const allGroups = buildGroups(entries, () => "All");

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
        </div>
      </header>

      <GroupColumn title={activeGroup.title} groups={visibleGroups} />
    </section>
  );
}

function SegmentButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] transition",
        selected
          ? "bg-accent text-white shadow-sm"
          : "text-foreground/70 hover:bg-surface hover:text-foreground",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function sortGroupsForDisplay(
  groups: Array<{ label: string; entries: KanjiEntry[] }>,
  mode: EntrySortMode,
): Array<{ label: string; entries: KanjiEntry[] }> {
  if (mode === "article") {
    return groups;
  }

  return groups.map((group) => ({
    ...group,
    entries: sortEntries(group.entries, mode),
  }));
}

function sortEntries(entries: KanjiEntry[], mode: EntrySortMode): KanjiEntry[] {
  const sorted = [...entries];

  if (mode === "count") {
    return sorted.sort((a, b) => {
      if (a.occurrenceCount !== b.occurrenceCount) {
        return b.occurrenceCount - a.occurrenceCount;
      }
      return japaneseCollator.compare(a.char, b.char);
    });
  }

  return sorted.sort((a, b) => japaneseCollator.compare(a.char, b.char));
}

function GroupColumn({
  title,
  groups,
}: {
  title: string;
  groups: Array<{ label: string; entries: KanjiEntry[] }>;
}) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground/70">{title}</p>
      <div className="mt-2 space-y-2">
        {groups.map((group) => (
          <div key={group.label} className="rounded-lg border border-line/70 bg-surface-muted/60 p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
              {group.label} ({group.entries.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.entries.map((entry) => (
                <div key={`${group.label}-${entry.char}`} className="relative inline-flex">
                  {entry.occurrenceCount > 1 ? (
                    <span className="pointer-events-none absolute right-0 top-0 z-10 min-w-4 -translate-y-1/3 translate-x-1/3 rounded-full border border-line bg-surface px-1 py-0.5 text-center text-[9px] font-bold leading-none text-foreground/75 shadow-sm">
                      {entry.occurrenceCount}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void openNewsGlyphRun(entry.char);
                    }}
                    className={newsGlyphButtonClass({
                      type: "kanji",
                      clickable: true,
                    })}
                    title={`Look up ${entry.char}`}
                  >
                    {entry.char}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
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

function buildGroups(
  entries: KanjiEntry[],
  labelOf: (entry: KanjiEntry) => string,
): Array<{ label: string; entries: KanjiEntry[] }> {
  const grouped = new Map<string, KanjiEntry[]>();

  for (const entry of entries) {
    const label = labelOf(entry);
    const existingEntries = grouped.get(label) ?? [];
    existingEntries.push(entry);
    grouped.set(label, existingEntries);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => compareLabels(a[0], b[0]))
    .map(([label, groupedEntries]) => ({ label, entries: groupedEntries }));
}

function compareLabels(a: string, b: string): number {
  const rank = (value: string) => {
    if (value === "Loading") {
      return Number.NEGATIVE_INFINITY;
    }

    if (value === "Unknown") {
      return Number.POSITIVE_INFINITY;
    }

    const numeric = Number(value.replace(/[^0-9]/g, ""));
    if (Number.isFinite(numeric)) {
      if (value.startsWith("N")) {
        // JLPT should display from easiest to hardest: N5 -> N1.
        return -numeric;
      }
      return numeric;
    }

    return Number.POSITIVE_INFINITY - 1;
  };

  return rank(a) - rank(b);
}
