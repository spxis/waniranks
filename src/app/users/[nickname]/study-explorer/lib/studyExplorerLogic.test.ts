import { describe, expect, it, vi } from "vitest";

import { resolveEffectiveViewedLevel } from "./studyExplorerLevelBounds";
import { normalizeSrsStageFilter } from "./studyExplorerSrs";
import {
  buildStudyExplorerStorageKeys,
  deriveInitialQueueState,
  resolveEffectiveSrsStageFilter,
  resolveEffectiveTypeFilter,
} from "./studyExplorerState";
import { filterStudyItems, isRecentStudyItem, STUDY_RECENT_WINDOW_MS } from "./studyExplorerUtils";
import type { StudyQueueItem } from "./studyExplorerTypes";

function makeItem(overrides: Partial<StudyQueueItem> = {}): StudyQueueItem {
  return {
    assignmentId: 1,
    queueType: "review",
    subjectId: 101,
    subjectType: "radical",
    wkLevel: 1,
    characters: "R",
    meanings: ["radical"],
    readings: [],
    primaryReadings: [],
    srsStage: 1,
    status: "apprentice",
    startedAt: null,
    availableAt: null,
    ...overrides,
  };
}

describe("normalizeSrsStageFilter", () => {
  it("keeps stage when filter is all", () => {
    expect(normalizeSrsStageFilter("all", 6)).toBe(6);
  });

  it("drops stage when not valid for selected grouping", () => {
    expect(normalizeSrsStageFilter("guru", 3)).toBeNull();
    expect(normalizeSrsStageFilter("master", 6)).toBeNull();
  });

  it("keeps stage when valid for selected grouping", () => {
    expect(normalizeSrsStageFilter("apprentice", 4)).toBe(4);
    expect(normalizeSrsStageFilter("guru", 5)).toBe(5);
    expect(normalizeSrsStageFilter("burned", 9)).toBe(9);
  });
});

describe("resolveEffectiveViewedLevel", () => {
  it("resets out-of-range review level to null", () => {
    expect(
      resolveEffectiveViewedLevel({
        queueMode: "review",
        viewedLevel: 50,
        maxLevel: 10,
        loadedItems: [],
      }),
    ).toBeNull();
  });

  it("keeps lesson level when present in levelCounts", () => {
    expect(
      resolveEffectiveViewedLevel({
        queueMode: "lesson",
        viewedLevel: 10,
        maxLevel: 60,
        loadedItems: [],
        rawLevelCounts: { 10: 3 },
      }),
    ).toBe(10);
  });

  it("resets lesson level when missing from both counts and loaded items", () => {
    expect(
      resolveEffectiveViewedLevel({
        queueMode: "lesson",
        viewedLevel: 10,
        maxLevel: 60,
        loadedItems: [makeItem({ queueType: "lesson", wkLevel: 9 })],
        rawLevelCounts: { 9: 2 },
      }),
    ).toBeNull();
  });
});

describe("study filter utils", () => {
  it("isRecentStudyItem returns true only inside recent window", () => {
    const now = Date.UTC(2026, 0, 10, 12, 0, 0);
    const withinWindow = new Date(now - STUDY_RECENT_WINDOW_MS + 60_000).toISOString();
    const outsideWindow = new Date(now - STUDY_RECENT_WINDOW_MS - 60_000).toISOString();

    expect(isRecentStudyItem(makeItem({ startedAt: withinWindow }), now)).toBe(true);
    expect(isRecentStudyItem(makeItem({ startedAt: outsideWindow }), now)).toBe(false);
  });

  it("filterStudyItems respects queue mode, type, srs and stage", () => {
    const items = [
      makeItem({ assignmentId: 1, queueType: "review", subjectType: "radical", status: "guru", srsStage: 5 }),
      makeItem({ assignmentId: 2, queueType: "review", subjectType: "kanji", status: "guru", srsStage: 6 }),
      makeItem({ assignmentId: 3, queueType: "lesson", subjectType: "radical", status: "apprentice", srsStage: 1 }),
    ];

    const filtered = filterStudyItems(
      items,
      "review",
      null,
      "radical",
      "guru",
      5,
      true,
      false,
      "",
    );

    expect(filtered.map((item) => item.assignmentId)).toEqual([1]);
  });

  it("filterStudyItems respects recentOnly", () => {
    const now = Date.UTC(2026, 0, 10, 12, 0, 0);
    const recentIso = new Date(now - 5 * 60_000).toISOString();
    const oldIso = new Date(now - STUDY_RECENT_WINDOW_MS - 5 * 60_000).toISOString();

    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const items = [
      makeItem({ assignmentId: 1, startedAt: recentIso }),
      makeItem({ assignmentId: 2, startedAt: oldIso }),
    ];

    const filtered = filterStudyItems(
      items,
      "review",
      null,
      "all",
      "all",
      null,
      true,
      true,
      "",
    );

    expect(filtered.map((item) => item.assignmentId)).toEqual([1]);
    dateNowSpy.mockRestore();
  });
});

describe("study explorer state helpers", () => {
  it("builds queue-mode scoped storage keys", () => {
    const keys = buildStudyExplorerStorageKeys("acct-1", "review");
    expect(keys.counts).toBe("wr:study-queue-counts:acct-1");
    expect(keys.selectedSubject).toBe("wr:study-selected-subject:acct-1:review");
    expect(keys.typeFilter).toBe("wr:study-type-filter:acct-1:review");
  });

  it("derives initial queue state from cached payload", () => {
    const item = makeItem({ assignmentId: 77 });
    const derived = deriveInitialQueueState({
      items: [item],
      counts: { all: 3, reviews: 2, lessons: 1 },
      pagination: { offset: 0, limit: 1, total: 3, hasMore: true },
    });

    expect(derived.loadedItems.map((entry) => entry.assignmentId)).toEqual([77]);
    expect(derived.totalItems).toBe(3);
    expect(derived.persistedCounts).toEqual({ all: 3, reviews: 2, lessons: 1 });
  });

  it("returns safe empty defaults without cached payload", () => {
    expect(deriveInitialQueueState(undefined)).toEqual({
      loadedItems: [],
      totalItems: 0,
      persistedCounts: null,
    });
  });

  it("keeps non-empty type filter and resets empty type filter to all", () => {
    expect(resolveEffectiveTypeFilter("radical", { all: 90, radical: 10, kanji: 30, vocabulary: 50 })).toBe(
      "radical",
    );
    expect(resolveEffectiveTypeFilter("radical", { all: 90, radical: 0, kanji: 30, vocabulary: 60 })).toBe(
      "all",
    );
  });

  it("keeps non-empty srs stage filter and clears empty stage filter", () => {
    expect(resolveEffectiveSrsStageFilter(4, { 4: 3, 5: 2 })).toBe(4);
    expect(resolveEffectiveSrsStageFilter(4, { 4: 0, 5: 2 })).toBeNull();
    expect(resolveEffectiveSrsStageFilter(4, undefined)).toBeNull();
  });
});