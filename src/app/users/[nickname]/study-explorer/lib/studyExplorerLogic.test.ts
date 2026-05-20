import { describe, expect, it, vi } from "vitest";

import { resolveEffectiveViewedLevel } from "./studyExplorerLevelBounds";
import { normalizeSrsStageFilter } from "./studyExplorerSrs";
import {
  buildStudyExplorerStorageKeys,
  deriveInitialQueueState,
  readStoredStudyCounts,
  resolveEffectiveSrsFilter,
  resolveEffectiveSrsStageFilter,
  resolveEffectiveTypeFilter,
  resolveEffectiveViewedLevelFilter,
} from "./studyExplorerState";
import {
  filterStudyItems,
  groupStudyReviewLevelChips,
  isRecentStudyItem,
  readStoredQueueMeta,
  STUDY_RECENT_WINDOW_MS,
} from "./studyExplorerUtils";
import { buildStudyCacheTelemetry } from "./studyExplorerView";
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

  it("resets review level when it has no loaded review items", () => {
    expect(
      resolveEffectiveViewedLevel({
        queueMode: "review",
        viewedLevel: 10,
        maxLevel: 60,
        loadedItems: [makeItem({ queueType: "review", wkLevel: 9 })],
      }),
    ).toBeNull();
  });

  it("keeps review level when server counts include selected level", () => {
    expect(
      resolveEffectiveViewedLevel({
        queueMode: "review",
        viewedLevel: 17,
        maxLevel: 60,
        loadedItems: [makeItem({ queueType: "review", wkLevel: 9 })],
        rawLevelCounts: { 17: 3 },
      }),
    ).toBe(17);
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

  it("groups consecutive disabled review levels into range chips", () => {
    expect(
      groupStudyReviewLevelChips([1, 2, 3, 4, 5, 6, 7], new Set([5, 6]), null, true),
    ).toEqual([
      { kind: "range", startLevel: 1, endLevel: 4 },
      { kind: "single", level: 5 },
      { kind: "single", level: 6 },
      { kind: "range", startLevel: 7, endLevel: 7 },
    ]);
  });

  it("keeps selected review level as a selectable single chip", () => {
    expect(
      groupStudyReviewLevelChips([1, 2, 3, 4], new Set([4]), 2, true),
    ).toEqual([
      { kind: "range", startLevel: 1, endLevel: 1 },
      { kind: "single", level: 2 },
      { kind: "range", startLevel: 3, endLevel: 3 },
      { kind: "single", level: 4 },
    ]);
  });
});

describe("study explorer state helpers", () => {
  it("builds queue-mode scoped storage keys", () => {
    const keys = buildStudyExplorerStorageKeys("acct-1", "review");
    expect(keys.counts).toBe("wr:study-queue-counts:acct-1");
    expect(keys.selectedSubject).toBe("wr:study-selected-subject:acct-1:review");
    expect(keys.typeFilter).toBe("wr:study-type-filter:acct-1:review");
    expect(keys.waitSort).toBe("wr:study-wait-sort:acct-1:review");
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

  it("falls back selected srs filter to all when selected bucket is zero", () => {
    expect(
      resolveEffectiveSrsFilter("master", {
        all: 3,
        locked: 0,
        apprentice: 0,
        guru: 3,
        master: 0,
        enlightened: 0,
        burned: 0,
      }),
    ).toBe("all");
  });

  it("keeps selected srs filter when selected bucket is non-zero", () => {
    expect(
      resolveEffectiveSrsFilter("guru", {
        all: 3,
        locked: 0,
        apprentice: 0,
        guru: 3,
        master: 0,
        enlightened: 0,
        burned: 0,
      }),
    ).toBe("guru");
  });

  it("falls back selected viewed level to all when selected level count is zero", () => {
    expect(resolveEffectiveViewedLevelFilter(5, 5, 0)).toBeNull();
    expect(resolveEffectiveViewedLevelFilter(5, 5, -1)).toBeNull();
  });

  it("keeps effective viewed level when selected level still has items", () => {
    expect(resolveEffectiveViewedLevelFilter(5, 5, 1)).toBe(5);
    expect(resolveEffectiveViewedLevelFilter(null, null, 0)).toBeNull();
  });

  it("reads valid persisted study counts from localStorage", () => {
    const localStorageGetItem = vi.fn().mockReturnValue('{"all":541,"reviews":360,"lessons":181}');
    vi.stubGlobal("window", {
      localStorage: { getItem: localStorageGetItem },
    });

    expect(readStoredStudyCounts("wr:study-queue-counts:acct-1")).toEqual({
      all: 541,
      reviews: 360,
      lessons: 181,
    });
    expect(localStorageGetItem).toHaveBeenCalledWith("wr:study-queue-counts:acct-1");
  });

  it("returns null for missing or malformed persisted study counts", () => {
    vi.stubGlobal("window", {
      localStorage: { getItem: vi.fn().mockReturnValue("{\"reviews\":360}") },
    });

    expect(readStoredStudyCounts("wr:study-queue-counts:acct-1")).toBeNull();
  });

  it("reads queue cache metadata from localStorage", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn().mockReturnValue(
          JSON.stringify({
            cachedAtMs: 123456,
            data: {
              items: [{ assignmentId: 1 }],
              pagination: { total: 9 },
            },
          }),
        ),
      },
    });

    expect(readStoredQueueMeta("acct-1", "review")).toEqual({
      cachedAtMs: 123456,
      restoredCount: 1,
      totalCount: 9,
    });
  });

  it("formats live cache telemetry text and title", () => {
    expect(
      buildStudyCacheTelemetry({
        cachedAtMs: null,
        restoredCount: 0,
        loadedCount: 96,
        totalCount: 356,
        requestLimit: 96,
      }),
    ).toEqual({
      text: "Live data · 96/356 loaded",
      title: "No warm cache was used. Initial request size: 96. Loaded now: 96/356.",
    });
  });

  it("formats cache-hit telemetry with age and new-count details", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(200_000);

    expect(
      buildStudyCacheTelemetry({
        cachedAtMs: 170_000,
        restoredCount: 120,
        loadedCount: 156,
        totalCount: 356,
        requestLimit: 96,
      }),
    ).toEqual({
      text: "Cache 30s old · 120 restored · 156/356 loaded · +36 new",
      title: "Cache hit. Restored from cache: 120. Newly fetched after restore: 36. Initial request size: 96. Currently loaded: 156/356.",
    });

    nowSpy.mockRestore();
  });
});