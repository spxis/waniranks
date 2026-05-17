import { describe, expect, it } from "vitest";
import { SUBJECT_TYPES } from "@/lib/domainConstants";

import type { LevelItem, Snapshot } from "./explorerTypes";
import { matchesJlptSearch, normalizeReadingForSearch, readingLabel } from "./jlpt-explorer/lib/jlptDisplay";
import {
  buildCombinedSnapshot,
  computeLevelItemCounts,
  computeReviewTimingCounts,
  passesReviewTimingFilter,
} from "./level-explorer/lib/levelExplorerSelectors";
import { resolveInitialReadTab, resolveInitialStudyFilters } from "./userReadConfig";

function makeLevelItem(overrides: Partial<LevelItem> = {}): LevelItem {
  return {
    subjectId: 1,
    subjectType: SUBJECT_TYPES.kanji,
    wkLevel: 10,
    characters: "A",
    meanings: ["alpha"],
    readings: ["a"],
    primaryReadings: ["a"],
    srsStage: 5,
    status: "guru",
    availableAt: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

function makeSnapshot(level: number, items: LevelItem[]): Snapshot {
  return {
    level,
    kanjiTotal: items.filter((item) => item.subjectType === SUBJECT_TYPES.kanji).length,
    kanjiLearned: items.filter((item) => item.subjectType === SUBJECT_TYPES.kanji && item.srsStage > 0).length,
    kanjiGuruPlus: items.filter((item) => item.subjectType === SUBJECT_TYPES.kanji && item.srsStage >= 5).length,
    kanjiLocked: items.filter((item) => item.subjectType === SUBJECT_TYPES.kanji && item.status === "locked").length,
    estimatedHoursRemaining: null,
    items,
    syncedAt: `2026-01-${String(level).padStart(2, "0")}T00:00:00.000Z`,
  };
}

describe("level explorer selectors", () => {
  it("passesReviewTimingFilter handles overdue and upcoming windows", () => {
    const now = Date.UTC(2026, 0, 10, 12, 0, 0);
    const overdue = makeLevelItem({ availableAt: new Date(now - 1_000).toISOString() });
    const soon = makeLevelItem({ availableAt: new Date(now + 30 * 60_000).toISOString() });

    expect(passesReviewTimingFilter(overdue, "overdue", now)).toBe(true);
    expect(passesReviewTimingFilter(soon, "next1h", now)).toBe(true);
    expect(passesReviewTimingFilter(soon, "overdue", now)).toBe(false);
  });

  it("computeReviewTimingCounts and computeLevelItemCounts aggregate correctly", () => {
    const now = Date.UTC(2026, 0, 10, 12, 0, 0);
    const items = [
      makeLevelItem({ subjectId: 1, status: "apprentice", subjectType: SUBJECT_TYPES.radical, availableAt: new Date(now - 1_000).toISOString() }),
      makeLevelItem({ subjectId: 2, status: "guru", subjectType: SUBJECT_TYPES.kanji, availableAt: new Date(now + 30 * 60_000).toISOString() }),
      makeLevelItem({ subjectId: 3, status: "burned", subjectType: SUBJECT_TYPES.vocabulary, availableAt: new Date(now + 30 * 60_000).toISOString() }),
    ];

    expect(computeLevelItemCounts(items)).toMatchObject({
      all: 3,
      apprentice: 1,
      guru: 1,
      burned: 1,
      radical: 1,
      kanji: 1,
      vocabulary: 1,
    });

    expect(computeReviewTimingCounts(items, now)).toMatchObject({
      overdue: 1,
      next1h: 1,
      next8h: 1,
    });
  });

  it("buildCombinedSnapshot merges selected levels in ascending order", () => {
    const l10 = makeSnapshot(10, [makeLevelItem({ subjectId: 10, wkLevel: 10 })]);
    const l11 = makeSnapshot(11, [makeLevelItem({ subjectId: 11, wkLevel: 11 })]);

    const combined = buildCombinedSnapshot(new Set([11, 10]), new Map([[10, l10], [11, l11]]), l10);
    expect(combined.level).toBe(11);
    expect(combined.items.map((item) => item.subjectId)).toEqual([10, 11]);
    expect(combined.syncedAt).toBe("2026-01-11T00:00:00.000Z");
  });
});

describe("jlpt explorer helpers", () => {
  it("normalizes separators and includes romaji in reading labels", () => {
    expect(normalizeReadingForSearch("あ.い・う")).toBe("あいう");
    expect(readingLabel("かな", true)).toContain("kana");
  });

  it("matches jlpt search from readings, preload values and meanings", () => {
    const item = {
      kanji: "学",
      kunReadings: ["まな.ぶ"],
      onReadings: ["ガク"],
      nanoriReadings: [],
      primaryMeaning: "study",
      meanings: ["learning"],
    };

    expect(matchesJlptSearch(item, "gaku", "gaku", undefined)).toBe(true);
    expect(matchesJlptSearch(item, "", "study", undefined)).toBe(true);
    expect(matchesJlptSearch(item, "", "example", { readings: ["れい"], meanings: ["example"] })).toBe(true);
    expect(matchesJlptSearch(item, "x", "nomatch", undefined)).toBe(false);
  });
});

describe("user read/history config", () => {
  it("resolves read tab with history priority", () => {
    expect(resolveInitialReadTab({ read: "history" })).toBe("history");
    expect(resolveInitialReadTab({ read: "stats" })).toBe("stats");
    expect(resolveInitialReadTab({})).toBe("news");
  });

  it("parses study filters from query", () => {
    expect(
      resolveInitialStudyFilters({
        level: "17",
        type: "kanji",
        srs: "guru",
        srsStage: "6",
        recent: "1",
        hideLocked: "1",
      }),
    ).toEqual({
      viewedLevel: 17,
      typeFilter: "kanji",
      srsFilter: "guru",
      srsStageFilter: 6,
      recentOnly: true,
      showLocked: false,
    });
  });
});