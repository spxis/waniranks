import { isItemSpread } from "@/lib/itemSpread";
import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";

import type {
  ALL_SORT_KEYS,
  GuruedItemSummary,
  LeaderboardRow,
  LeaderboardTab,
  SortDirection,
  SortKey,
  SortState,
  SubjectType,
} from "./leaderboardTypes";

export function isLeaderboardTab(value: string | null): value is LeaderboardTab {
  return value !== null && (["overall", "radicals", "kanji", "vocabulary"] as string[]).includes(value);
}

export function isSortKey(value: string | null): value is SortKey {
  return value !== null && (([
    "nickname",
    "wkLevel",
    "reviewCount",
    "score",
    "lastActivityAt",
    "radicalLearned",
    "radicalTotal",
    "radicalPercent",
    "kanjiLearned",
    "kanjiTotal",
    "kanjiPercent",
    "vocabularyLearned",
    "vocabularyTotal",
    "vocabularyPercent",
    "subjectApprentice",
    "subjectGuru",
    "subjectMaster",
    "subjectEnlightened",
    "subjectBurned",
    "subjectLastGuruedAt",
  ] as typeof ALL_SORT_KEYS) as string[]).includes(value);
}

export function isSortDirection(value: string | null): value is SortDirection {
  return value === "asc" || value === "desc";
}

export function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export function formatDate(input: string): string {
  return formatDateTimeShort(input, "-");
}

export function formatSince(input: string | null): string {
  return formatRelativeFromNow(input, {
    style: "short",
    allowFuture: false,
    noValueLabel: "No activity yet",
    invalidLabel: "Just now",
    justNowLabel: "Just now",
  });
}

export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (value > 0) {
    return `+${formatNumber(value)}`;
  }
  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`;
  }
  return "0";
}

export function deltaClass(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "text-foreground/50";
  }
  if (value > 0) {
    return "text-emerald-700";
  }
  if (value < 0) {
    return "text-red-700";
  }
  return "text-foreground/60";
}

export function kanjiCountFromRow(row: LeaderboardRow): number {
  if (isItemSpread(row.itemSpread)) {
    return row.itemSpread.totals.kanji;
  }
  return 0;
}

export function learnedKanjiFromRow(row: LeaderboardRow): number {
  if (!isItemSpread(row.itemSpread)) {
    return 0;
  }
  return row.itemSpread.guru.kanji + row.itemSpread.master.kanji + row.itemSpread.enlightened.kanji + row.itemSpread.burned.kanji;
}

export function learnedRadicalsFromRow(row: LeaderboardRow): number {
  if (!isItemSpread(row.itemSpread)) {
    return 0;
  }
  return row.itemSpread.guru.radical + row.itemSpread.master.radical + row.itemSpread.enlightened.radical + row.itemSpread.burned.radical;
}

export function learnedVocabularyFromRow(row: LeaderboardRow): number {
  if (!isItemSpread(row.itemSpread)) {
    return 0;
  }
  return row.itemSpread.guru.vocabulary + row.itemSpread.master.vocabulary + row.itemSpread.enlightened.vocabulary + row.itemSpread.burned.vocabulary;
}

export function learnedPercent(learned: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((learned / total) * 100);
}

export function subjectTypeForTab(tab: LeaderboardTab): SubjectType | null {
  if (tab === "radicals") return "radical";
  if (tab === "kanji") return "kanji";
  if (tab === "vocabulary") return "vocabulary";
  return null;
}

export function parseGuruedItemSummary(input: unknown): GuruedItemSummary | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const row = input as Record<string, unknown>;
  const subjectId = typeof row.subjectId === "number" ? row.subjectId : null;
  const label = typeof row.label === "string" ? row.label : null;
  const reading = typeof row.reading === "string" ? row.reading : null;
  const passedAt = typeof row.passedAt === "string" ? row.passedAt : null;

  if (!subjectId || !label || !passedAt) {
    return null;
  }

  return { subjectId, label, reading, passedAt };
}

export function stageCountForSubject(
  row: LeaderboardRow,
  subjectType: SubjectType,
  stage: "apprentice" | "guru" | "master" | "enlightened" | "burned",
): number {
  if (!isItemSpread(row.itemSpread)) {
    return 0;
  }
  return row.itemSpread[stage][subjectType];
}

export function subjectTotalsForRow(
  row: LeaderboardRow,
  subjectType: SubjectType,
): { learned: number; total: number; percent: number } {
  if (subjectType === "radical") {
    const learned = learnedRadicalsFromRow(row);
    const total = row.radicalCount;
    return { learned, total, percent: learnedPercent(learned, total) };
  }
  if (subjectType === "kanji") {
    const learned = learnedKanjiFromRow(row);
    const total = kanjiCountFromRow(row);
    return { learned, total, percent: learnedPercent(learned, total) };
  }
  const learned = learnedVocabularyFromRow(row);
  const total = row.vocabularyCount;
  return { learned, total, percent: learnedPercent(learned, total) };
}

export function subjectLastGuruedAtFromRow(row: LeaderboardRow, subjectType: SubjectType): string | null {
  if (subjectType === "radical") return row.lastRadicalGuruedAt;
  if (subjectType === "kanji") return row.lastKanjiGuruedAt;
  return row.lastVocabularyGuruedAt;
}

export function subjectLastGuruedItemFromRow(
  row: LeaderboardRow,
  subjectType: SubjectType,
): GuruedItemSummary | null {
  if (subjectType === "radical") return parseGuruedItemSummary(row.lastRadicalGuruedItem);
  if (subjectType === "kanji") return parseGuruedItemSummary(row.lastKanjiGuruedItem);
  return parseGuruedItemSummary(row.lastVocabularyGuruedItem);
}

export function nextDirection(current: SortState | null, key: SortKey): SortDirection {
  if (!current || current.key !== key) {
    if (key === "nickname") {
      return "asc";
    }
    return "desc";
  }
  return current.direction === "desc" ? "asc" : "desc";
}

export function jlptCountsFromRow(row: LeaderboardRow): {
  n1: { learned: number; total: number; percent: number };
  n2: { learned: number; total: number; percent: number };
  n3: { learned: number; total: number; percent: number };
  n4: { learned: number; total: number; percent: number };
  n5: { learned: number; total: number; percent: number };
} {
  const empty = {
    n1: { learned: 0, total: 0, percent: 0 },
    n2: { learned: 0, total: 0, percent: 0 },
    n3: { learned: 0, total: 0, percent: 0 },
    n4: { learned: 0, total: 0, percent: 0 },
    n5: { learned: 0, total: 0, percent: 0 },
  };

  if (!row.jlptCounts || typeof row.jlptCounts !== "object") {
    return empty;
  }

  const values = row.jlptCounts as Record<string, unknown>;
  const readLevel = (levelKey: "n1" | "n2" | "n3" | "n4" | "n5") => {
    const value = values[levelKey];
    if (typeof value === "number") {
      return { learned: value, total: 0, percent: 0 };
    }

    if (!value || typeof value !== "object") {
      return empty[levelKey];
    }

    const rec = value as Record<string, unknown>;
    const learned = typeof rec.learned === "number" ? rec.learned : 0;
    const total = typeof rec.total === "number" ? rec.total : 0;
    const percent =
      typeof rec.percent === "number"
        ? rec.percent
        : total > 0
          ? Math.round((learned / total) * 100)
          : 0;

    return { learned, total, percent };
  };

  return {
    n1: readLevel("n1"),
    n2: readLevel("n2"),
    n3: readLevel("n3"),
    n4: readLevel("n4"),
    n5: readLevel("n5"),
  };
}

export function jlptCompletionClass(percent: number): string {
  if (percent >= 98) return "border-emerald-600 bg-emerald-500 text-white";
  if (percent >= 85) return "border-emerald-300 bg-emerald-200 text-emerald-900";
  if (percent >= 70) return "border-emerald-200 bg-emerald-100 text-emerald-900";
  if (percent >= 50) return "border-amber-200 bg-amber-100 text-amber-900";
  if (percent >= 25) return "border-orange-200 bg-orange-100 text-orange-900";
  if (percent > 0) return "border-red-200 bg-red-100 text-red-900";
  return "border-red-300 bg-red-200 text-red-900";
}

export function tabClass(activeTab: LeaderboardTab, tab: LeaderboardTab): string {
  if (tab === "overall") {
    return activeTab === tab
      ? "border-accent bg-accent text-white"
      : "border-line bg-surface text-foreground";
  }

  if (tab === "radicals") {
    return activeTab === tab
      ? "border-radical bg-radical text-white"
      : "border-radical/40 bg-radical/10 text-radical";
  }

  if (tab === "kanji") {
    return activeTab === tab
      ? "border-kanji bg-kanji text-white"
      : "border-kanji/40 bg-kanji/10 text-kanji";
  }

  return activeTab === tab
    ? "border-vocabulary bg-vocabulary text-white"
    : "border-vocabulary/40 bg-vocabulary/10 text-vocabulary";
}
