"use client";

import { useEffect, useMemo, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";
import type { NewsArticleBlock } from "@/lib/news/newsTypes";

import { openNewsGlyphRun } from "./newsGlyphRunner";
import { newsGlyphButtonClass } from "./newsGlyphBoxStyle";
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
  occurrenceCount: number;
};

type GroupMode = "jlpt" | "wk" | "grade";

type JlptRecord = Record<string, { nLevel?: number }>;

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

export function countUniqueArticleKanji(blocks: NewsArticleBlock[]): number {
  return extractArticleKanjiData(blocks).orderedChars.length;
}

export default function NewsKanjiOverviewPanel({ blocks }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [resolvedWkLevels, setResolvedWkLevels] = useState<Record<string, number | null>>({});
  const [resolvedGrades, setResolvedGrades] = useState<Record<string, number | null>>({});
  const [groupMode, setGroupMode] = useState<GroupMode>("jlpt");

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

    const unresolved = orderedChars.filter(
      (char) => !(char in resolvedWkLevels) || !(char in resolvedGrades),
    );
    if (unresolved.length === 0) {
      return;
    }

    let cancelled = false;
    void fetch("/api/news/kanji-levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chars: unresolved }),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { levels?: Record<string, number | null>; grades?: Record<string, number | null> }
          | null;
        if (!response.ok || cancelled) {
          return;
        }

        if (payload?.levels) {
          setResolvedWkLevels((prev) => ({ ...prev, ...payload.levels }));
        }
        if (payload?.grades) {
          setResolvedGrades((prev) => ({ ...prev, ...payload.grades }));
        }
      })
      .catch(() => {
        // Keep panel functional even if this enrichment request fails.
      });

    return () => {
      cancelled = true;
    };
  }, [charsKey, orderedChars, refreshKey, resolvedGrades, resolvedWkLevels]);

  const entries = useMemo(() => {
    const wkByChar = buildWkLevelByChar();
    const jlptByChar = jlptReadings as JlptRecord;

    return orderedChars.map((char) => ({
      char,
      jlptLevel:
        typeof jlptByChar[char]?.nLevel === "number"
          ? (jlptByChar[char]?.nLevel as number)
          : null,
      wkLevel: wkByChar.get(char) ?? resolvedWkLevels[char] ?? null,
      schoolGrade: resolvedGrades[char] ?? null,
      occurrenceCount: countsByChar.get(char) ?? 1,
    }));
  }, [countsByChar, orderedChars, refreshKey, resolvedGrades, resolvedWkLevels]);

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
    entry.schoolGrade === null ? "Unknown" : `Grade ${entry.schoolGrade}`,
  );

  const activeGroup =
    groupMode === "jlpt"
      ? { title: "By JLPT", groups: jlptGroups }
      : groupMode === "wk"
        ? { title: "By WaniKani", groups: wkGroups }
        : { title: "By School Grade", groups: gradeGroups };

  return (
    <section className="rounded-2xl border border-line bg-surface-muted/70 p-3 sm:p-4">
      <header className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          Kanji In This Article
        </p>
        <p className="mt-1 text-xs text-foreground/65">
          {entries.length} unique kanji • JLPT {knownJlpt} • WK {knownWk} • Grade {knownGrade}
        </p>

        <div className="mt-2 inline-flex rounded-lg border border-line bg-surface-muted p-1">
          <GroupModeButton
            label="JLPT"
            selected={groupMode === "jlpt"}
            onClick={() => {
              setGroupMode("jlpt");
            }}
          />
          <GroupModeButton
            label="WK"
            selected={groupMode === "wk"}
            onClick={() => {
              setGroupMode("wk");
            }}
          />
          <GroupModeButton
            label="Grade"
            selected={groupMode === "grade"}
            onClick={() => {
              setGroupMode("grade");
            }}
          />
        </div>
      </header>

      <GroupColumn title={activeGroup.title} groups={activeGroup.groups} />
    </section>
  );
}

function GroupModeButton({
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
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-foreground/70 hover:bg-surface hover:text-foreground",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
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
                <div key={`${group.label}-${entry.char}`} className="inline-flex flex-col items-center gap-1">
                  {entry.occurrenceCount > 1 ? (
                    <span className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[10px] font-bold leading-none text-foreground/70">
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
                      size: "normal",
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
