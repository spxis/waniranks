import type { Dispatch, SetStateAction } from "react";

import type { Snapshot, SrsFilter } from "../../explorerTypes";
import { buildLevelExplorerUrl } from "./levelExplorerState";
import { normalizeSnapshot } from "./levelExplorerSnapshotUtils";
import { persistFlag, persistTypeVisibility, type JlptFilter, type ReviewTimingFilter, type TypeFilter } from "./levelExplorerState";

type VisibleTypes = { radical: boolean; kanji: boolean; vocabulary: boolean };

type Params = {
  accountId: string;
  initialLevel: number;
  storageKeys: { typeVisibility: string; stickyMerge: string; filtersCollapsed: string };
  pendingHistoryMode: "replace" | "push";
  setPendingHistoryMode: Dispatch<SetStateAction<"replace" | "push">>;
  selectedLevels: Set<number>;
  selectedSubjectId: number | null;
  srsFilter: SrsFilter;
  typeFilter: TypeFilter;
  jlptFilter: JlptFilter;
  reviewTimingFilter: ReviewTimingFilter;
  recentOnly: boolean;
  stickyMerge: boolean;
  snapshotsByLevel: Map<number, Snapshot>;
  visibleTypes: VisibleTypes;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setSnapshotsByLevel: Dispatch<SetStateAction<Map<number, Snapshot>>>;
  setVisibleTypes: Dispatch<SetStateAction<VisibleTypes>>;
  setSelectedLevels: Dispatch<SetStateAction<Set<number>>>;
  setSelectedSubjectId: Dispatch<SetStateAction<number | null>>;
  setTypeFilter: Dispatch<SetStateAction<TypeFilter>>;
  setStickyMerge: Dispatch<SetStateAction<boolean>>;
  setFiltersCollapsed: Dispatch<SetStateAction<boolean>>;
  setSrsFilter: Dispatch<SetStateAction<SrsFilter>>;
};

export function buildLevelExplorerControllerHandlers({
  accountId,
  initialLevel,
  storageKeys,
  pendingHistoryMode,
  setPendingHistoryMode,
  selectedLevels,
  selectedSubjectId,
  srsFilter,
  typeFilter,
  jlptFilter,
  reviewTimingFilter,
  recentOnly,
  stickyMerge,
  snapshotsByLevel,
  visibleTypes,
  setLoading,
  setError,
  setSnapshotsByLevel,
  setVisibleTypes,
  setSelectedLevels,
  setSelectedSubjectId,
  setTypeFilter,
  setStickyMerge,
  setFiltersCollapsed,
  setSrsFilter,
}: Params) {
  const markHistoryPush = () => {
    setPendingHistoryMode("push");
  };

  const writeUrlState = () => {
    if (typeof window === "undefined") {
      return;
    }

    const nextSearch = buildLevelExplorerUrl(window.location.search, {
      levels: selectedLevels,
      subjectId: selectedSubjectId,
      srs: srsFilter,
      type: typeFilter,
      jlpt: jlptFilter,
      review: reviewTimingFilter,
      recentOnly,
      stickyMerge,
    });
    const next = `${window.location.pathname}?${nextSearch}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) {
      setPendingHistoryMode("replace");
      return;
    }

    const mode = pendingHistoryMode;
    setPendingHistoryMode("replace");
    if (mode === "push") {
      window.history.pushState(null, "", next);
      return;
    }

    window.history.replaceState(null, "", next);
  };

  const ensureLevelLoaded = async (level: number, forceReload = false): Promise<Snapshot | undefined> => {
    if (!forceReload && snapshotsByLevel.has(level)) {
      return snapshotsByLevel.get(level);
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/levels/${level}`, { cache: "no-store" });
      const data = (await response.json()) as { error?: string; snapshot?: Snapshot };

      if (!response.ok || !data.snapshot) {
        throw new Error(data.error ?? "Could not load level details.");
      }

      const normalized = normalizeSnapshot(data.snapshot);
      setSnapshotsByLevel((prev) => {
        const map = new Map(prev);
        map.set(level, normalized);
        return map;
      });
      return normalized;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load level details.");
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  const setVisibleTypesAndPersist = (next: VisibleTypes) => {
    const hasAtLeastOneVisible = next.radical || next.kanji || next.vocabulary;
    const normalized = hasAtLeastOneVisible ? next : { radical: true, kanji: true, vocabulary: true };

    setVisibleTypes(normalized);
    try {
      persistTypeVisibility(window.localStorage, storageKeys.typeVisibility, normalized);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const setTypeFilterAndEnsureVisible = (nextType: TypeFilter) => {
    markHistoryPush();
    setTypeFilter(nextType);

    if (nextType !== "all" && !visibleTypes[nextType]) {
      setVisibleTypesAndPersist({ ...visibleTypes, [nextType]: true });
    }
  };

  const setStickyMergeAndPersist = (next: boolean) => {
    markHistoryPush();
    setStickyMerge(next);

    try {
      persistFlag(window.localStorage, storageKeys.stickyMerge, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    if (!next) {
      const firstSelected = Array.from(selectedLevels.values()).sort((a, b) => a - b)[0] ?? initialLevel;
      setSelectedLevels(new Set([firstSelected]));
    }
  };

  const setFiltersCollapsedAndPersist = (next: boolean) => {
    setFiltersCollapsed(next);
    try {
      persistFlag(window.localStorage, storageKeys.filtersCollapsed, next);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  };

  const setSrsFilterWithHistory = (nextStatus: SrsFilter) => {
    markHistoryPush();
    setSelectedSubjectId(null);
    setSrsFilter(nextStatus);
  };

  const toggleTypeVisibility = (type: "radical" | "kanji" | "vocabulary") => {
    markHistoryPush();
    setVisibleTypesAndPersist({
      radical: type === "radical",
      kanji: type === "kanji",
      vocabulary: type === "vocabulary",
    });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  };

  const enableAllTypes = () => {
    markHistoryPush();
    setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
    setSelectedSubjectId(null);
    setTypeFilter("all");
  };

  return {
    markHistoryPush,
    writeUrlState,
    ensureLevelLoaded,
    setVisibleTypesAndPersist,
    setTypeFilterAndEnsureVisible,
    setStickyMergeAndPersist,
    setFiltersCollapsedAndPersist,
    setSrsFilterWithHistory,
    toggleTypeVisibility,
    enableAllTypes,
  };
}
