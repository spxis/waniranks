import { useCallback, useEffect } from "react";

import type { QueueResponse, StudyCounts, StudyQueueItem, StudyTypeFilter } from "./studyExplorerTypes";
import { persistQueue, readStoredQueue } from "./studyExplorerUtils";

type Args = {
  accountId: string;
  queueMode: "review" | "lesson";
  countsStorageKey: string;
  selectedSubjectStorageKey: string;
  typeFilterStorageKey: string;
  viewedLevelStorageKey: string;
  recentOnlyStorageKey: string;
  showLockedStorageKey: string;
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  srsFilter: "all" | "locked" | "apprentice" | "guru" | "master" | "enlightened";
  recentOnly: boolean;
  showLocked: boolean;
  hasHydratedTypeFilter: boolean;
  setHasHydratedTypeFilter: React.Dispatch<React.SetStateAction<boolean>>;
  hiddenSubmittedAssignmentIds: Set<number>;
  loadedItems: StudyQueueItem[];
  totalItems: number;
  counts: StudyCounts | null;
  levelCounts: Record<number, number>;
  typeCounts: { all: number; radical: number; kanji: number; vocabulary: number };
  typeCountsByLevel: Record<
    number,
    { all: number; radical: number; kanji: number; vocabulary: number }
  >;
  dataItems: StudyQueueItem[] | undefined;
  dataPaginationTotal: number | undefined;
  dataCounts: StudyCounts | undefined;
  setCachedQueueData: React.Dispatch<React.SetStateAction<QueueResponse | undefined>>;
  setPersistedCounts: React.Dispatch<React.SetStateAction<StudyCounts | null>>;
  setLoadedItems: React.Dispatch<React.SetStateAction<StudyQueueItem[]>>;
  setTotalItems: React.Dispatch<React.SetStateAction<number>>;
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>;
  setTypeFilter: React.Dispatch<React.SetStateAction<StudyTypeFilter>>;
  setRecentOnly: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadMoreError: React.Dispatch<React.SetStateAction<string | null>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setViewedLevel: React.Dispatch<React.SetStateAction<number | null>>;
  setSrsFilter: React.Dispatch<
    React.SetStateAction<"all" | "locked" | "apprentice" | "guru" | "master" | "enlightened">
  >;
  setShowLocked: React.Dispatch<React.SetStateAction<boolean>>;
  lastHandledStudyQueryRef: React.MutableRefObject<string>;
};

function sameAssignmentList(a: StudyQueueItem[], b: StudyQueueItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.assignmentId !== b[index]?.assignmentId) {
      return false;
    }
  }

  return true;
}

function sameCounts(a: StudyCounts | null | undefined, b: StudyCounts | null | undefined): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.all === b.all && a.reviews === b.reviews && a.lessons === b.lessons;
}

function sameTypeCounts(
  a: { all: number; radical: number; kanji: number; vocabulary: number } | undefined,
  b: { all: number; radical: number; kanji: number; vocabulary: number } | undefined,
): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.all === b.all &&
    a.radical === b.radical &&
    a.kanji === b.kanji &&
    a.vocabulary === b.vocabulary
  );
}

function sameLevelCounts(a: Record<number, number> | undefined, b: Record<number, number> | undefined): boolean {
  const aEntries = Object.entries(a ?? {});
  const bEntries = Object.entries(b ?? {});

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  const bMap = new Map(bEntries);
  for (const [key, value] of aEntries) {
    if (Number(bMap.get(key)) !== Number(value)) {
      return false;
    }
  }

  return true;
}

function sameTypeCountsByLevel(
  a: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> | undefined,
  b: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> | undefined,
): boolean {
  const aEntries = Object.entries(a ?? {});
  const bEntries = Object.entries(b ?? {});

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  const bMap = new Map(bEntries);
  for (const [key, value] of aEntries) {
    const other = bMap.get(key);
    if (!other || !sameTypeCounts(value, other)) {
      return false;
    }
  }

  return true;
}

export function useStudyExplorerEffects({
  accountId,
  queueMode,
  countsStorageKey,
  selectedSubjectStorageKey,
  typeFilterStorageKey,
  viewedLevelStorageKey,
  recentOnlyStorageKey,
  showLockedStorageKey,
  viewedLevel,
  typeFilter,
  srsFilter,
  recentOnly,
  showLocked,
  hasHydratedTypeFilter,
  setHasHydratedTypeFilter,
  hiddenSubmittedAssignmentIds,
  loadedItems,
  totalItems,
  counts,
  levelCounts,
  typeCounts,
  typeCountsByLevel,
  dataItems,
  dataPaginationTotal,
  dataCounts,
  setCachedQueueData,
  setPersistedCounts,
  setLoadedItems,
  setTotalItems,
  setSelectedId,
  setTypeFilter,
  setRecentOnly,
  setLoadMoreError,
  setSearchQuery,
  setViewedLevel,
  setSrsFilter,
  setShowLocked,
  lastHandledStudyQueryRef,
}: Args) {
  useEffect(() => {
    const raw = window.localStorage.getItem(countsStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<StudyCounts>;
      if (typeof parsed.all === "number" && typeof parsed.reviews === "number" && typeof parsed.lessons === "number") {
        setPersistedCounts({ all: parsed.all, reviews: parsed.reviews, lessons: parsed.lessons });
      }
    } catch {
      window.localStorage.removeItem(countsStorageKey);
    }
  }, [countsStorageKey, setPersistedCounts]);

  useEffect(() => {
    const urlType = new URLSearchParams(window.location.search).get("type");
    if (urlType === "radical" || urlType === "kanji" || urlType === "vocabulary") {
      setTypeFilter(urlType);
      setHasHydratedTypeFilter(true);
      return;
    }

    const raw = window.localStorage.getItem(typeFilterStorageKey);
    if (!raw) {
      setHasHydratedTypeFilter(true);
      return;
    }

    if (raw === "all" || raw === "radical" || raw === "kanji" || raw === "vocabulary") {
      setTypeFilter(raw);
      setHasHydratedTypeFilter(true);
      return;
    }

    window.localStorage.removeItem(typeFilterStorageKey);
    setHasHydratedTypeFilter(true);
  }, [setHasHydratedTypeFilter, setTypeFilter, typeFilterStorageKey]);

  useEffect(() => {
    const urlLevel = new URLSearchParams(window.location.search).get("level");
    if (urlLevel !== null) {
      const parsed = Number(urlLevel);
      if (Number.isInteger(parsed) && parsed > 0) {
        setViewedLevel(parsed);
        return;
      }
    }

    const raw = window.localStorage.getItem(viewedLevelStorageKey);
    if (!raw) {
      setViewedLevel(null);
      return;
    }

    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      setViewedLevel(parsed);
      return;
    }

    window.localStorage.removeItem(viewedLevelStorageKey);
    setViewedLevel(null);
  }, [setViewedLevel, viewedLevelStorageKey]);

  useEffect(() => {
    const urlRecent = new URLSearchParams(window.location.search).get("recent");
    if (urlRecent !== null) {
      setRecentOnly(urlRecent === "1");
      return;
    }

    const raw = window.localStorage.getItem(recentOnlyStorageKey);
    if (!raw) {
      setRecentOnly(false);
      return;
    }

    setRecentOnly(raw === "1");
  }, [recentOnlyStorageKey, setRecentOnly]);

  useEffect(() => {
    const urlHideLocked = new URLSearchParams(window.location.search).get("hideLocked");
    if (urlHideLocked !== null) {
      setShowLocked(urlHideLocked !== "1");
      return;
    }

    const raw = window.localStorage.getItem(showLockedStorageKey);
    if (!raw) {
      return;
    }

    setShowLocked(raw === "1");
  }, [setShowLocked, showLockedStorageKey]);

  useEffect(() => {
    const urlSrs = new URLSearchParams(window.location.search).get("srs");
    const validSrs = ["apprentice", "guru", "master", "enlightened", "locked"];
    if (urlSrs && validSrs.includes(urlSrs)) {
      setSrsFilter(urlSrs as "apprentice" | "guru" | "master" | "enlightened" | "locked");
    }
  }, [setSrsFilter]);

  useEffect(() => {
    if (!hasHydratedTypeFilter) return;
    window.localStorage.setItem(typeFilterStorageKey, typeFilter);
  }, [hasHydratedTypeFilter, typeFilter, typeFilterStorageKey]);

  useEffect(() => {
    if (viewedLevel === null) {
      window.localStorage.removeItem(viewedLevelStorageKey);
      return;
    }

    window.localStorage.setItem(viewedLevelStorageKey, String(viewedLevel));
  }, [viewedLevel, viewedLevelStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(recentOnlyStorageKey, recentOnly ? "1" : "0");
  }, [recentOnly, recentOnlyStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(showLockedStorageKey, showLocked ? "1" : "0");
  }, [showLocked, showLockedStorageKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (viewedLevel !== null) params.set("level", String(viewedLevel));
    else params.delete("level");
    if (typeFilter !== "all") params.set("type", typeFilter);
    else params.delete("type");
    if (srsFilter !== "all") params.set("srs", srsFilter);
    else params.delete("srs");
    if (recentOnly) params.set("recent", "1");
    else params.delete("recent");
    if (!showLocked) params.set("hideLocked", "1");
    else params.delete("hideLocked");
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [viewedLevel, typeFilter, srsFilter, recentOnly, showLocked]);

  useEffect(() => {
    if (!dataCounts) return;
    setPersistedCounts(dataCounts);
    window.localStorage.setItem(countsStorageKey, JSON.stringify(dataCounts));
  }, [countsStorageKey, dataCounts, setPersistedCounts]);

  useEffect(() => {
    if (!dataItems) return;

    const fresh = dataItems.filter((item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId));
    const freshIds = new Set(fresh.map((item) => item.assignmentId));
    const visiblePrev = loadedItems.filter((item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId));
    const mergedVisibleCount =
      visiblePrev.length === 0
        ? fresh.length
        : fresh.length + visiblePrev.filter((item) => !freshIds.has(item.assignmentId)).length;

    setLoadedItems((prev) => {
      const priorVisible = prev.filter((item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId));
      const merged =
        priorVisible.length === 0 ? fresh : [...fresh, ...priorVisible.filter((item) => !freshIds.has(item.assignmentId))];

      return sameAssignmentList(prev, merged) ? prev : merged;
    });

    const nextTotalRaw = dataPaginationTotal ?? fresh.length;
    setTotalItems(Math.max(nextTotalRaw, mergedVisibleCount));
  }, [
    dataItems,
    dataPaginationTotal,
    hiddenSubmittedAssignmentIds,
    loadedItems,
    setLoadedItems,
    setTotalItems,
  ]);

  useEffect(() => {
    const nextCounts = counts ?? { all: loadedItems.length, reviews: 0, lessons: 0 };
    const nextPayload: QueueResponse = {
      items: loadedItems,
      counts: nextCounts,
      levelCounts,
      typeCounts,
      typeCountsByLevel,
      pagination: {
        offset: 0,
        limit: loadedItems.length,
        total: totalItems,
        hasMore: loadedItems.length < totalItems,
      },
    };

    persistQueue(
      accountId,
      queueMode,
      loadedItems,
      totalItems,
      counts ?? null,
      levelCounts,
      typeCounts,
      typeCountsByLevel,
    );
    setCachedQueueData((prev) => {
      if (!prev) {
        return nextPayload;
      }

      const prevPagination = prev.pagination;
      const nextPagination = nextPayload.pagination;
      const samePagination =
        prevPagination?.offset === nextPagination?.offset &&
        prevPagination?.limit === nextPagination?.limit &&
        prevPagination?.total === nextPagination?.total &&
        prevPagination?.hasMore === nextPagination?.hasMore;

      const unchanged =
        sameAssignmentList(prev.items, nextPayload.items) &&
        sameCounts(prev.counts, nextPayload.counts) &&
        sameLevelCounts(prev.levelCounts, nextPayload.levelCounts) &&
        sameTypeCounts(prev.typeCounts, nextPayload.typeCounts) &&
        sameTypeCountsByLevel(prev.typeCountsByLevel, nextPayload.typeCountsByLevel) &&
        samePagination;

      return unchanged ? prev : nextPayload;
    });
  }, [
    accountId,
    counts,
    levelCounts,
    loadedItems,
    queueMode,
    setCachedQueueData,
    totalItems,
    typeCounts,
    typeCountsByLevel,
  ]);

  useEffect(() => {
    setCachedQueueData(readStoredQueue(accountId, queueMode));
    setLoadMoreError(null);

    try {
      const raw = window.localStorage.getItem(selectedSubjectStorageKey);
      const parsed = Number(raw);
      setSelectedId(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
    } catch {
      setSelectedId(null);
    }
  }, [accountId, queueMode, selectedSubjectStorageKey, setCachedQueueData, setLoadMoreError, setSelectedId]);

  useEffect(() => {
    const runFromUrl = () => {
      const fromUrl = new URLSearchParams(window.location.search).get("findStudy")?.trim() ?? "";
      if (fromUrl === lastHandledStudyQueryRef.current) return;
      lastHandledStudyQueryRef.current = fromUrl;
      setSearchQuery(fromUrl);
    };

    runFromUrl();
    const onPopState = () => runFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [lastHandledStudyQueryRef, setSearchQuery]);

  const clearAllFilters = useCallback(() => {
    setViewedLevel(null);
    setTypeFilter("all");
    setSrsFilter("all");
    setShowLocked(true);
    setRecentOnly(false);
    setSelectedId(null);
    setSearchQuery("");

    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete("findStudy");
    params.delete("findLevel");
    params.delete("findJlpt");
    params.delete("level");
    params.delete("type");
    params.delete("srs");
    params.delete("recent");
    params.delete("hideLocked");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}#explorer`;
    window.history.pushState(null, "", next);
    window.dispatchEvent(new CustomEvent("wr:explorer-search-clear", { detail: { scope: "all" } }));
  }, [setRecentOnly, setSearchQuery, setSelectedId, setShowLocked, setSrsFilter, setTypeFilter, setViewedLevel]);

  return { clearAllFilters };
}
