import { useMemo } from "react";

import type {
  QueueResponse,
  StudyQueueItem,
  StudySrsFilter,
  StudySrsStageFilter,
  StudyTypeFilter,
} from "./studyExplorerTypes";
import { filterStudyItems, isRecentStudyItem } from "./studyExplorerUtils";

type Args = {
  maxLevel: number;
  loadedItems: StudyQueueItem[];
  queueMode: "review" | "lesson";
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  effectiveSrsFilter: StudySrsFilter;
  effectiveSrsStageFilter: StudySrsStageFilter | null;
  effectiveShowLocked: boolean;
  effectiveRecentOnly: boolean;
  searchQuery: string;
  data: QueueResponse | undefined;
  cachedQueueData: QueueResponse | undefined;
  modalSessionOrderByAssignmentId: number[] | null;
  modalSessionItemByAssignmentId: Record<number, StudyQueueItem>;
  selectedId: number | null;
  hiddenSubmittedAssignmentIds: Set<number>;
  submittingByAssignmentId: Set<number>;
  revealedAssignmentIds: Set<number>;
};

export function useStudyExplorerDerivedData({
  maxLevel,
  loadedItems,
  queueMode,
  viewedLevel,
  typeFilter,
  effectiveSrsFilter,
  effectiveSrsStageFilter,
  effectiveShowLocked,
  effectiveRecentOnly,
  searchQuery,
  data,
  cachedQueueData,
  modalSessionOrderByAssignmentId,
  modalSessionItemByAssignmentId,
  selectedId,
  hiddenSubmittedAssignmentIds,
  submittingByAssignmentId,
  revealedAssignmentIds,
}: Args) {
  const levelOptions = useMemo(
    () => Array.from({ length: Math.max(1, maxLevel) }, (_, index) => index + 1),
    [maxLevel],
  );

  const availableLevels = useMemo(() => {
    const output = new Set<number>();
    for (const item of loadedItems) {
      if (effectiveRecentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (item.queueType === queueMode && typeof item.wkLevel === "number") {
        output.add(item.wkLevel);
      }
    }
    return output;
  }, [loadedItems, queueMode, effectiveRecentOnly]);

  const filteredItems = useMemo(
    () =>
      filterStudyItems(
        loadedItems,
        queueMode,
        viewedLevel,
        typeFilter,
        effectiveSrsFilter,
        effectiveSrsStageFilter,
        effectiveShowLocked,
        effectiveRecentOnly,
        searchQuery,
      ),
    [
      loadedItems,
      queueMode,
      viewedLevel,
      typeFilter,
      effectiveSrsFilter,
      effectiveSrsStageFilter,
      effectiveShowLocked,
      effectiveRecentOnly,
      searchQuery,
    ],
  );

  const lessonLevelCountsFromLoaded = useMemo(() => {
    const countsByLevel: Record<number, number> = {};

    for (const item of loadedItems) {
      if (item.queueType !== "lesson") {
        continue;
      }
      if (effectiveRecentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (typeFilter !== "all" && item.subjectType !== typeFilter) {
        continue;
      }
      if (!effectiveShowLocked && item.status === "locked") {
        continue;
      }
      if (typeof item.wkLevel !== "number") {
        continue;
      }

      countsByLevel[item.wkLevel] = (countsByLevel[item.wkLevel] ?? 0) + 1;
    }

    return countsByLevel;
  }, [loadedItems, effectiveRecentOnly, effectiveShowLocked, typeFilter]);

  const lessonLevelCountsFromServer = useMemo(() => {
    const raw = data?.levelCounts ?? cachedQueueData?.levelCounts;
    if (!raw) {
      return {} as Record<number, number>;
    }

    const normalized: Record<number, number> = {};
    for (const [levelRaw, count] of Object.entries(raw)) {
      const level = Number(levelRaw);
      if (!Number.isInteger(level) || level <= 0 || typeof count !== "number" || count <= 0) {
        continue;
      }
      normalized[level] = count;
    }

    return normalized;
  }, [cachedQueueData?.levelCounts, data?.levelCounts]);

  const lessonLevelCounts = useMemo(() => {
    if (queueMode !== "lesson") {
      return lessonLevelCountsFromLoaded;
    }

    return Object.keys(lessonLevelCountsFromServer).length > 0
      ? lessonLevelCountsFromServer
      : lessonLevelCountsFromLoaded;
  }, [lessonLevelCountsFromLoaded, lessonLevelCountsFromServer, queueMode]);

  const lessonTypeCountsFromServer = useMemo(() => {
    const typeCounts = data?.typeCounts ?? cachedQueueData?.typeCounts;
    const typeCountsByLevel = data?.typeCountsByLevel ?? cachedQueueData?.typeCountsByLevel;
    if (!typeCounts) {
      return null;
    }

    if (viewedLevel !== null && typeCountsByLevel?.[viewedLevel]) {
      return typeCountsByLevel[viewedLevel];
    }

    return typeCounts;
  }, [
    cachedQueueData?.typeCounts,
    cachedQueueData?.typeCountsByLevel,
    data?.typeCounts,
    data?.typeCountsByLevel,
    viewedLevel,
  ]);

  const filteredItemByAssignmentId = useMemo(() => {
    const map = new Map<number, StudyQueueItem>();
    for (const item of filteredItems) {
      map.set(item.assignmentId, item);
    }
    return map;
  }, [filteredItems]);

  const loadedTypeCounts = useMemo(() => {
    const out = { all: 0, radical: 0, kanji: 0, vocabulary: 0 };
    for (const item of loadedItems) {
      if (effectiveRecentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (effectiveSrsFilter !== "all" && item.status !== effectiveSrsFilter) continue;
      if (effectiveSrsStageFilter !== null && item.srsStage !== effectiveSrsStageFilter) continue;
      if (!effectiveShowLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.subjectType === "radical") out.radical += 1;
      else if (item.subjectType === "kanji") out.kanji += 1;
      else out.vocabulary += 1;
    }
    return out;
  }, [
    loadedItems,
    queueMode,
    effectiveRecentOnly,
    viewedLevel,
    effectiveSrsFilter,
    effectiveSrsStageFilter,
    effectiveShowLocked,
  ]);

  const typeCounts =
    queueMode === "lesson" && lessonTypeCountsFromServer ? lessonTypeCountsFromServer : loadedTypeCounts;

  const srsCountsFromServer = useMemo(() => {
    return data?.srsCounts ?? cachedQueueData?.srsCounts ?? null;
  }, [cachedQueueData?.srsCounts, data?.srsCounts]);

  const srsCountsFromLoaded = useMemo(() => {
    const out = {
      all: 0,
      locked: 0,
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 0,
      burned: 0,
    };
    for (const item of loadedItems) {
      if (effectiveRecentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (typeFilter !== "all" && item.subjectType !== typeFilter) continue;
      if (!effectiveShowLocked && item.status === "locked") continue;

      out.all += 1;
      if (item.status === "locked") out.locked += 1;
      if (item.status === "apprentice") out.apprentice += 1;
      if (item.status === "guru") out.guru += 1;
      if (item.status === "master") out.master += 1;
      if (item.status === "enlightened") out.enlightened += 1;
      if (item.status === "burned") out.burned += 1;
    }
    return out;
  }, [loadedItems, queueMode, effectiveRecentOnly, viewedLevel, typeFilter, effectiveShowLocked]);

  const canUseServerSrsCounts =
    queueMode === "review" && viewedLevel === null && typeFilter === "all" && !effectiveRecentOnly && effectiveShowLocked;

  const srsCounts = canUseServerSrsCounts ? (srsCountsFromServer ?? srsCountsFromLoaded) : srsCountsFromLoaded;

  const srsStageCounts = useMemo(() => {
    const fromServer = data?.srsStageCounts ?? cachedQueueData?.srsStageCounts;
    if (
      fromServer &&
      queueMode === "review" &&
      viewedLevel === null &&
      typeFilter === "all" &&
      !effectiveRecentOnly &&
      effectiveShowLocked
    ) {
      return fromServer;
    }

    const fromLoaded: Record<number, number> = {};
    for (const item of loadedItems) {
      if (effectiveRecentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType !== queueMode) continue;
      if (viewedLevel !== null && item.wkLevel !== viewedLevel) continue;
      if (typeFilter !== "all" && item.subjectType !== typeFilter) continue;
      if (!effectiveShowLocked && item.status === "locked") continue;

      if (!Number.isInteger(item.srsStage) || item.srsStage <= 0) {
        continue;
      }

      fromLoaded[item.srsStage] = (fromLoaded[item.srsStage] ?? 0) + 1;
    }

    return fromLoaded;
  }, [
    cachedQueueData?.srsStageCounts,
    data?.srsStageCounts,
    loadedItems,
    queueMode,
    effectiveRecentOnly,
    viewedLevel,
    typeFilter,
    effectiveShowLocked,
  ]);

  const modalItems = useMemo(() => {
    if (!modalSessionOrderByAssignmentId || selectedId === null) {
      return filteredItems;
    }

    return modalSessionOrderByAssignmentId
      .map(
        (assignmentId) =>
          filteredItemByAssignmentId.get(assignmentId) ?? modalSessionItemByAssignmentId[assignmentId] ?? null,
      )
      .filter((item): item is StudyQueueItem => item !== null);
  }, [
    filteredItems,
    filteredItemByAssignmentId,
    modalSessionItemByAssignmentId,
    modalSessionOrderByAssignmentId,
    selectedId,
  ]);

  const selectedItem = modalItems.find((item) => item.subjectId === selectedId) ?? null;
  const isSelectedSubmitted = selectedItem
    ? hiddenSubmittedAssignmentIds.has(selectedItem.assignmentId)
    : false;
  const selectedIndex = selectedItem
    ? modalItems.findIndex((item) => item.assignmentId === selectedItem.assignmentId)
    : -1;
  const prevItem = selectedIndex > 0 ? modalItems[selectedIndex - 1] : null;
  const nextItem =
    selectedIndex >= 0 && selectedIndex < modalItems.length - 1 ? modalItems[selectedIndex + 1] : null;
  const isAnswerRevealed = selectedItem ? revealedAssignmentIds.has(selectedItem.assignmentId) : false;
  const isSubmittingSelected = selectedItem
    ? submittingByAssignmentId.has(selectedItem.assignmentId)
    : false;

  return {
    levelOptions,
    availableLevels,
    filteredItems,
    lessonLevelCountsFromServer,
    lessonLevelCounts,
    loadedTypeCounts,
    typeCounts,
    srsCounts,
    srsStageCounts,
    modalItems,
    selectedItem,
    isSelectedSubmitted,
    selectedIndex,
    prevItem,
    nextItem,
    isAnswerRevealed,
    isSubmittingSelected,
  };
}
