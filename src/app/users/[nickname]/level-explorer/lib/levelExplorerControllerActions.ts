import type { Dispatch, SetStateAction } from "react";

import type { LevelItem, Snapshot } from "../../explorerTypes";
import type { JlptFilter, ReviewTimingFilter, TypeFilter } from "./levelExplorerState";
import { itemMatchesLevelSearch } from "./levelExplorerSelectors";

type BuildActionsArgs = {
  maxLevel: number;
  initialLevel: number;
  levelOptions: number[];
  stickyMerge: boolean;
  selectedLevels: Set<number>;
  searchAvailableLevels: Set<number> | null;
  snapshotsByLevel: Map<number, Snapshot>;
  subjectById: Map<number, LevelItem>;
  combinedItems: LevelItem[];
  markHistoryPush: () => void;
  ensureLevelLoaded: (level: number) => Promise<Snapshot | undefined>;
  setError: Dispatch<SetStateAction<string>>;
  setSelectedSubjectId: Dispatch<SetStateAction<number | null>>;
  setSelectedLevels: Dispatch<SetStateAction<Set<number>>>;
  setSearchMatchedSubjectIds: Dispatch<SetStateAction<Set<number> | null>>;
  setSearchAvailableLevels: Dispatch<SetStateAction<Set<number> | null>>;
  setVisibleTypesAndPersist: (next: { radical: boolean; kanji: boolean; vocabulary: boolean }) => void;
  setTypeFilterAndEnsureVisible: (next: TypeFilter) => void;
  setRecentOnly: Dispatch<SetStateAction<boolean>>;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  setSrsFilter: (next: "all" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | "locked") => void;
  setJlptFilter: Dispatch<SetStateAction<JlptFilter>>;
  setReviewTimingFilter: Dispatch<SetStateAction<ReviewTimingFilter>>;
};

export function buildLevelExplorerActions({
  maxLevel,
  initialLevel,
  levelOptions,
  stickyMerge,
  selectedLevels,
  searchAvailableLevels,
  snapshotsByLevel,
  subjectById,
  combinedItems,
  markHistoryPush,
  ensureLevelLoaded,
  setError,
  setSelectedSubjectId,
  setSelectedLevels,
  setSearchMatchedSubjectIds,
  setSearchAvailableLevels,
  setVisibleTypesAndPersist,
  setTypeFilterAndEnsureVisible,
  setRecentOnly,
  setTypeFilter,
  setSrsFilter,
  setJlptFilter,
  setReviewTimingFilter,
}: BuildActionsArgs) {
  const toggleLevel = async (level: number) => {
    markHistoryPush();
    setError("");
    setSelectedSubjectId(null);

    if (searchAvailableLevels && !searchAvailableLevels.has(level)) {
      return;
    }

    setSelectedLevels(new Set([level]));
    await ensureLevelLoaded(level);
  };

  const selectAllLevelsAndClearSearch = async () => {
    markHistoryPush();

    setSelectedSubjectId(null);
    setSelectedLevels(new Set([initialLevel]));
    setSearchMatchedSubjectIds(null);
    setSearchAvailableLevels(null);
    setRecentOnly(false);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("findLevel");
      params.delete("findJlpt");
      const next = `${window.location.pathname}?${params.toString()}#explorer`;
      window.history.pushState(null, "", next);
      window.dispatchEvent(new CustomEvent("wr:explorer-search-clear", { detail: { scope: "all" } }));
    }

    await ensureLevelLoaded(initialLevel);
  };

  const jumpToKanji = async (subjectId: number, wkLevel: number | null) => {
    markHistoryPush();

    if (typeof wkLevel === "number") {
      await ensureLevelLoaded(wkLevel);
      setSelectedLevels((prev) => {
        if (stickyMerge) {
          const next = new Set(prev);
          next.add(wkLevel);
          return next;
        }

        return new Set([wkLevel]);
      });
    }

    setTypeFilter("kanji");
    setSrsFilter("all");
    setJlptFilter("all");
    setReviewTimingFilter("all");
    setSelectedSubjectId(subjectId);
  };

  const jumpToRelatedSubject = async (subjectId: number, targetLevel?: number | null) => {
    markHistoryPush();

    if (typeof targetLevel === "number") {
      await ensureLevelLoaded(targetLevel);
      setSelectedLevels((prev) => {
        if (stickyMerge) {
          const next = new Set(prev);
          next.add(targetLevel);
          return next;
        }

        return new Set([targetLevel]);
      });
    }

    const found = subjectById.get(subjectId);
    if (found?.subjectType) {
      setTypeFilterAndEnsureVisible(found.subjectType);
    } else {
      setTypeFilter("all");
    }

    setSrsFilter("all");
    setJlptFilter("all");
    setReviewTimingFilter("all");
    setSelectedSubjectId(subjectId);
  };

  const searchAndReveal = async (rawQuery: string, requestId?: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
      if (typeof window !== "undefined" && requestId) {
        window.dispatchEvent(
          new CustomEvent("wr:explorer-search-complete", {
            detail: { requestId, ok: false, message: "Please enter a search term." },
          }),
        );
      }
      return;
    }

    setError("");
    let ok = false;
    let completionMessage = "";

    const matchesById = new Map<number, LevelItem>();
    const collectMatches = (items: LevelItem[]) => {
      for (const item of items) {
        if (itemMatchesLevelSearch(item, trimmed)) {
          matchesById.set(item.subjectId, item);
        }
      }
    };

    collectMatches(combinedItems);

    for (let level = 1; level <= maxLevel; level += 1) {
      const snapshot = snapshotsByLevel.get(level) ?? (await ensureLevelLoaded(level));
      collectMatches(snapshot?.items ?? []);
    }

    const matchedItems = Array.from(matchesById.values()).sort((a, b) => {
      if ((a.wkLevel ?? 0) !== (b.wkLevel ?? 0)) {
        return (a.wkLevel ?? 0) - (b.wkLevel ?? 0);
      }

      return a.subjectId - b.subjectId;
    });

    if (matchedItems.length === 0) {
      completionMessage = `No item matched "${trimmed}".`;
      setError(completionMessage);
      setSearchMatchedSubjectIds(new Set());
      setSearchAvailableLevels(new Set());
    } else {
      markHistoryPush();

      const levelsWithMatches = new Set<number>();
      for (const item of matchedItems) {
        levelsWithMatches.add(typeof item.wkLevel === "number" ? item.wkLevel : initialLevel);
      }

      setSelectedLevels(levelsWithMatches.size > 0 ? levelsWithMatches : new Set([initialLevel]));
      setSearchAvailableLevels(levelsWithMatches);
      setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
      setTypeFilter("all");
      setSrsFilter("all");
      setJlptFilter("all");
      setReviewTimingFilter("all");
      setSelectedSubjectId(null);
      setSearchMatchedSubjectIds(new Set(matchedItems.map((item) => item.subjectId)));

      ok = true;
      completionMessage = `Found ${matchedItems.length} result${matchedItems.length === 1 ? "" : "s"}.`;
    }

    if (typeof window !== "undefined" && requestId) {
      window.dispatchEvent(
        new CustomEvent("wr:explorer-search-complete", {
          detail: { requestId, ok, message: completionMessage },
        }),
      );
    }
  };

  return {
    toggleLevel,
    selectAllLevelsAndClearSearch,
    jumpToKanji,
    jumpToRelatedSubject,
    searchAndReveal,
  };
}
