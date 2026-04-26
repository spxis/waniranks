"use client";

import { useEffect, useMemo, useState } from "react";

import jlptReadings from "@/data/jlptReadings.json";
import kanjiLevels from "@/data/kanjiLevels.json";
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
};

type JlptRecord = Record<string, { nLevel?: number }>;
type GradeRecord = Record<string, { schoolGrade?: number | null }>;

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

export function countUniqueArticleKanji(blocks: NewsArticleBlock[]): number {
  return extractArticleKanji(blocks).length;
}

export default function NewsKanjiOverviewPanel({ blocks }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onRefresh = () => {
      setRefreshKey((prev) => prev + 1);
    };
    window.addEventListener(NEWS_KANJI_HISTORY_EVENT, onRefresh);
    return () => {
      window.removeEventListener(NEWS_KANJI_HISTORY_EVENT, onRefresh);
    };
  }, []);

  const entries = useMemo(() => {
    const orderedChars = extractArticleKanji(blocks);
    const wkByChar = buildWkLevelByChar();
    const jlptByChar = jlptReadings as JlptRecord;
    const gradeByChar = kanjiLevels as GradeRecord;

    return orderedChars.map((char) => ({
      char,
      jlptLevel:
        typeof jlptByChar[char]?.nLevel === "number"
          ? (jlptByChar[char]?.nLevel as number)
          : null,
      wkLevel: wkByChar.get(char) ?? null,
      schoolGrade:
        typeof gradeByChar[char]?.schoolGrade === "number"
          ? (gradeByChar[char]?.schoolGrade as number)
          : null,
    }));
  }, [blocks, refreshKey]);

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

  return (
    <section className="rounded-2xl border border-line bg-surface-muted/70 p-3 sm:p-4">
      <header className="mb-3 rounded-xl border border-line bg-surface px-3 py-2">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-accent">
          Kanji In This Article
        </p>
        <p className="mt-1 text-xs text-foreground/65">
          {entries.length} unique kanji • JLPT {knownJlpt} • WK {knownWk} • Grade {knownGrade}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-3">
        <GroupColumn title="By JLPT" groups={jlptGroups} />
        <GroupColumn title="By WaniKani" groups={wkGroups} />
        <GroupColumn title="By School Grade" groups={gradeGroups} />
      </div>
    </section>
  );
}

function GroupColumn({
  title,
  groups,
}: {
  title: string;
  groups: Array<{ label: string; chars: string[] }>;
}) {
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground/70">{title}</p>
      <div className="mt-2 space-y-2">
        {groups.map((group) => (
          <div key={group.label} className="rounded-lg border border-line/70 bg-surface-muted/60 p-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
              {group.label} ({group.chars.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {group.chars.slice(0, 14).map((char) => (
                <button
                  key={`${group.label}-${char}`}
                  type="button"
                  onClick={() => {
                    void openNewsGlyphRun(char);
                  }}
                  className={newsGlyphButtonClass({
                    type: "kanji",
                    size: "normal",
                    clickable: true,
                  })}
                  title={`Look up ${char}`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function extractArticleKanji(blocks: NewsArticleBlock[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const block of blocks) {
    for (const char of Array.from(block.text)) {
      if (!KANJI_REGEX.test(char) || seen.has(char)) {
        continue;
      }
      seen.add(char);
      out.push(char);
    }
  }

  return out;
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
): Array<{ label: string; chars: string[] }> {
  const grouped = new Map<string, string[]>();

  for (const entry of entries) {
    const label = labelOf(entry);
    const chars = grouped.get(label) ?? [];
    chars.push(entry.char);
    grouped.set(label, chars);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => compareLabels(a[0], b[0]))
    .map(([label, chars]) => ({ label, chars }));
}

function compareLabels(a: string, b: string): number {
  const rank = (value: string) => {
    if (value === "Unknown") {
      return Number.POSITIVE_INFINITY;
    }

    const numeric = Number(value.replace(/[^0-9]/g, ""));
    if (Number.isFinite(numeric)) {
      if (value.startsWith("N")) {
        return numeric;
      }
      return numeric;
    }

    return Number.POSITIVE_INFINITY - 1;
  };

  return rank(a) - rank(b);
}
