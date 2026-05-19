import { useCallback, useEffect, useRef } from "react";

import type { QueueResponse, StudyCounts, StudyQueueMode, StudyQueueItem, StudySrsFilter, StudySrsStageFilter, StudyTypeFilter } from "./studyExplorerTypes";
import { isAllStudySrsFilter, isAllStudyTypeFilter, isStudySrsFilterValue, isStudyTypeFilterValue, STUDY_SRS_FILTERS, STUDY_TYPE_FILTERS } from "./studyExplorerDomain";
import { sameAssignmentList, sameCounts, sameLevelCounts, sameTypeCounts, sameTypeCountsByLevel } from "./studyExplorerEffectsComparators";
import { persistQueue, readStoredQueue } from "./studyExplorerUtils";
import { resolveEffectiveSrsStageFilter, resolveEffectiveTypeFilter, resolveEffectiveViewedLevelFilter } from "./studyExplorerState";

type Args = {
  accountId: string;
  queueMode: StudyQueueMode;
  countsStorageKey: string;
  selectedSubjectStorageKey: string;
  typeFilterStorageKey: string;
  viewedLevelStorageKey: string;
  srsStageFilterStorageKey: string;
  recentOnlyStorageKey: string;
  showLockedStorageKey: string;
  viewedLevel: number | null;
  effectiveViewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  srsFilter: StudySrsFilter;
  srsStageFilter: StudySrsStageFilter | null;
  recentOnly: boolean;
  showLocked: boolean;
  hasData: boolean;
  hasHydratedTypeFilter: boolean;
  setHasHydratedTypeFilter: React.Dispatch<React.SetStateAction<boolean>>;
  hasHydratedViewedLevel: boolean;
  setHasHydratedViewedLevel: React.Dispatch<React.SetStateAction<boolean>>;
  hiddenSubmittedAssignmentIds: Set<number>;
  loadedItems: StudyQueueItem[];
  totalItems: number;
  counts: StudyCounts | null;
  levelCounts: Record<number, number>;
  typeCounts: NonNullable<QueueResponse["typeCounts"]>;
  typeCountsByLevel: NonNullable<QueueResponse["typeCountsByLevel"]>;
  srsCounts: QueueResponse["srsCounts"];
  srsStageCounts: Record<number, number> | undefined;
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
  setSrsFilter: React.Dispatch<React.SetStateAction<StudySrsFilter>>;
  setSrsStageFilter: React.Dispatch<React.SetStateAction<StudySrsStageFilter | null>>;
  setShowLocked: React.Dispatch<React.SetStateAction<boolean>>;
  lastHandledStudyQueryRef: React.MutableRefObject<string>;
};

export function useStudyExplorerEffects({
  accountId,
  queueMode,
  countsStorageKey,
  selectedSubjectStorageKey,
  typeFilterStorageKey,
  viewedLevelStorageKey,
  srsStageFilterStorageKey,
  recentOnlyStorageKey,
  showLockedStorageKey,
  viewedLevel,
  effectiveViewedLevel,
  typeFilter,
  srsFilter,
  srsStageFilter,
  recentOnly,
  showLocked,
  hasData,
  hasHydratedTypeFilter,
  setHasHydratedTypeFilter,
  hasHydratedViewedLevel,
  setHasHydratedViewedLevel,
  hiddenSubmittedAssignmentIds,
  loadedItems,
  totalItems,
  counts,
  levelCounts,
  typeCounts,
  typeCountsByLevel,
  srsCounts,
  srsStageCounts,
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
  setSrsStageFilter,
  setShowLocked,
  lastHandledStudyQueryRef,
}: Args) {
  const hasHydratedSrsStageFilterRef = useRef(false);
  const hiddenSubmittedCountRef = useRef(hiddenSubmittedAssignmentIds.size);

  useEffect(() => {
    hiddenSubmittedCountRef.current = hiddenSubmittedAssignmentIds.size;
  }, [hiddenSubmittedAssignmentIds]);

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
    if (isStudyTypeFilterValue(urlType) && !isAllStudyTypeFilter(urlType)) {
      setTypeFilter(urlType);
      setHasHydratedTypeFilter(true);
      return;
    }

    const raw = window.localStorage.getItem(typeFilterStorageKey);
    if (!raw) {
      setHasHydratedTypeFilter(true);
      return;
    }

    if (isStudyTypeFilterValue(raw)) {
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
        setHasHydratedViewedLevel(true);
        return;
      }
    }

    const raw = window.localStorage.getItem(viewedLevelStorageKey);
    if (!raw) {
      setViewedLevel(null);
      setHasHydratedViewedLevel(true);
      return;
    }

    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      setViewedLevel(parsed);
      setHasHydratedViewedLevel(true);
      return;
    }

    window.localStorage.removeItem(viewedLevelStorageKey);
    setViewedLevel(null);
    setHasHydratedViewedLevel(true);
  }, [setHasHydratedViewedLevel, setViewedLevel, viewedLevelStorageKey]);

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
    if (isStudySrsFilterValue(urlSrs) && !isAllStudySrsFilter(urlSrs)) {
      setSrsFilter(urlSrs);
      return;
    }

    setSrsFilter(STUDY_SRS_FILTERS.all);
  }, [setSrsFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = Number(params.get("srsStage"));
    if (Number.isInteger(fromUrl) && fromUrl >= 1 && fromUrl <= 9) {
      hasHydratedSrsStageFilterRef.current = true;
      setSrsStageFilter(fromUrl as StudySrsStageFilter);
      return;
    }

    const stored = Number(window.localStorage.getItem(srsStageFilterStorageKey));
    if (Number.isInteger(stored) && stored >= 1 && stored <= 9) {
      hasHydratedSrsStageFilterRef.current = true;
      setSrsStageFilter(stored as StudySrsStageFilter);
      return;
    }

    hasHydratedSrsStageFilterRef.current = true;
    setSrsStageFilter(null);
  }, [setSrsStageFilter, srsStageFilterStorageKey]);

  useEffect(() => {
    if (!hasHydratedTypeFilter) return;
    window.localStorage.setItem(typeFilterStorageKey, typeFilter);
  }, [hasHydratedTypeFilter, typeFilter, typeFilterStorageKey]);

  useEffect(() => {
    if (!hasData) return;

    const nextViewedLevel = resolveEffectiveViewedLevelFilter(viewedLevel, effectiveViewedLevel, typeCounts.all);
    if (nextViewedLevel !== viewedLevel) setViewedLevel(nextViewedLevel);

    const nextTypeFilter = resolveEffectiveTypeFilter(typeFilter, typeCounts);
    if (nextTypeFilter !== typeFilter) setTypeFilter(nextTypeFilter);

    const nextSrsStageFilter = resolveEffectiveSrsStageFilter(srsStageFilter, srsStageCounts);
    if (nextSrsStageFilter !== srsStageFilter) setSrsStageFilter(nextSrsStageFilter);
  }, [effectiveViewedLevel, hasData, srsStageCounts, srsStageFilter, setSrsStageFilter, setTypeFilter, setViewedLevel, typeCounts, typeFilter, viewedLevel]);

  useEffect(() => {
    if (!hasHydratedViewedLevel) return;
    if (viewedLevel === null) {
      window.localStorage.removeItem(viewedLevelStorageKey);
      return;
    }

    window.localStorage.setItem(viewedLevelStorageKey, String(viewedLevel));
  }, [hasHydratedViewedLevel, viewedLevel, viewedLevelStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(recentOnlyStorageKey, recentOnly ? "1" : "0");
  }, [recentOnly, recentOnlyStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(showLockedStorageKey, showLocked ? "1" : "0");
  }, [showLocked, showLockedStorageKey]);

  useEffect(() => {
    if (srsStageFilter === null) {
      window.localStorage.removeItem(srsStageFilterStorageKey);
      return;
    }

    window.localStorage.setItem(srsStageFilterStorageKey, String(srsStageFilter));
  }, [srsStageFilter, srsStageFilterStorageKey]);

  useEffect(() => {
    if (!hasHydratedTypeFilter || !hasHydratedViewedLevel || !hasHydratedSrsStageFilterRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (viewedLevel !== null) params.set("level", String(viewedLevel));
    else params.delete("level");
    if (!isAllStudyTypeFilter(typeFilter)) params.set("type", typeFilter);
    else params.delete("type");
    if (!isAllStudySrsFilter(srsFilter)) params.set("srs", srsFilter);
    else params.delete("srs");
    if (srsStageFilter !== null) params.set("srsStage", String(srsStageFilter));
    else params.delete("srsStage");
    if (recentOnly) params.set("recent", "1");
    else params.delete("recent");
    if (!showLocked) params.set("hideLocked", "1");
    else params.delete("hideLocked");
    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }, [hasHydratedTypeFilter, hasHydratedViewedLevel, viewedLevel, typeFilter, srsFilter, srsStageFilter, recentOnly, showLocked]);

  useEffect(() => {
    if (!dataCounts) return;
    if (hiddenSubmittedCountRef.current > 0) return;
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
      srsCounts,
      srsStageCounts,
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
      srsCounts,
      srsStageCounts,
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
    srsCounts,
    srsStageCounts,
  ]);

  useEffect(() => {
    setCachedQueueData(readStoredQueue(accountId, queueMode));
    setLoadMoreError(null);

    try {
      const fromUrl = Number(new URLSearchParams(window.location.search).get("subject"));
      if (Number.isInteger(fromUrl) && fromUrl > 0) {
        setSelectedId(fromUrl);
        return;
      }

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
    setTypeFilter(STUDY_TYPE_FILTERS.all);
    setSrsFilter(STUDY_SRS_FILTERS.all);
    setSrsStageFilter(null);
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
    params.delete("srsStage");
    params.delete("recent");
    params.delete("hideLocked");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}#explorer`;
    window.history.pushState(null, "", next);
    window.dispatchEvent(new CustomEvent("wr:explorer-search-clear", { detail: { scope: STUDY_TYPE_FILTERS.all } }));
  }, [
    setRecentOnly,
    setSearchQuery,
    setSelectedId,
    setShowLocked,
    setSrsFilter,
    setSrsStageFilter,
    setTypeFilter,
    setViewedLevel,
  ]);

  return { clearAllFilters };
}
