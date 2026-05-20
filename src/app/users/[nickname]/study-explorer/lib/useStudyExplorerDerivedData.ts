import { useMemo } from "react";

import type {
  QueueResponse,
  StudyQueueMode,
  StudyQueueItem,
  StudySrsFilter,
  StudySrsStageFilter,
  StudyTypeFilter,
} from "./studyExplorerTypes";
import {
  isAllStudySrsFilter,
  isAllStudyTypeFilter,
  isKanjiSubjectType,
  isLessonQueueItem,
  STUDY_QUEUE_TYPES,
  STUDY_WK_STATUSES,
  STUDY_SUBJECT_TYPES,
} from "./studyExplorerDomain";
import { filterStudyItems, isRecentStudyItem } from "./studyExplorerUtils";

type Args = {
  maxLevel: number;
  loadedItems: StudyQueueItem[];
  queueMode: StudyQueueMode;
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

function normalizePositiveLevelCounts(raw: Record<number, number> | Record<string, number> | undefined): Record<number, number> {
  if (!raw) {
    return {};
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
}

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

  const reviewLevelCounts = useMemo(() => {
    const countsByLevel: Record<number, number> = {};
    for (const item of loadedItems) {
      if (item.queueType !== STUDY_QUEUE_TYPES.review) {
        continue;
      }
      if (effectiveRecentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (!isAllStudyTypeFilter(typeFilter) && item.subjectType !== typeFilter) {
        continue;
      }
      if (!isAllStudySrsFilter(effectiveSrsFilter) && item.status !== effectiveSrsFilter) {
        continue;
      }
      if (effectiveSrsStageFilter !== null && item.srsStage !== effectiveSrsStageFilter) {
        continue;
      }
      if (!effectiveShowLocked && item.status === STUDY_WK_STATUSES.locked) {
        continue;
      }
      if (typeof item.wkLevel !== "number") {
        continue;
      }

      countsByLevel[item.wkLevel] = (countsByLevel[item.wkLevel] ?? 0) + 1;
    }

    return countsByLevel;
  }, [
    loadedItems,
    effectiveRecentOnly,
    typeFilter,
    effectiveSrsFilter,
    effectiveSrsStageFilter,
    effectiveShowLocked,
  ]);

  const reviewLevelCountsFromServer = useMemo(
    () => {
      const levelCounts = normalizePositiveLevelCounts(data?.levelCounts ?? cachedQueueData?.levelCounts);
      if (isAllStudyTypeFilter(typeFilter)) {
        return levelCounts;
      }

      const typeCountsByLevel = data?.typeCountsByLevel ?? cachedQueueData?.typeCountsByLevel;
      if (!typeCountsByLevel) {
        return {};
      }

      const byType: Record<number, number> = {};
      for (const [levelRaw, counts] of Object.entries(typeCountsByLevel)) {
        const level = Number(levelRaw);
        if (!Number.isInteger(level) || level <= 0) {
          continue;
        }

        const count = counts?.[typeFilter] ?? 0;
        if (count > 0) {
          byType[level] = count;
        }
      }

      return byType;
    },
    [cachedQueueData?.levelCounts, cachedQueueData?.typeCountsByLevel, data?.levelCounts, data?.typeCountsByLevel, typeFilter],
  );

  const canUseServerReviewLevelCounts =
    queueMode === STUDY_QUEUE_TYPES.review &&
    viewedLevel === null &&
    isAllStudySrsFilter(effectiveSrsFilter) &&
    effectiveSrsStageFilter === null &&
    !effectiveRecentOnly &&
    effectiveShowLocked;

  const hasReliableReviewLevelAvailability =
    queueMode === STUDY_QUEUE_TYPES.review &&
    viewedLevel === null &&
    isAllStudySrsFilter(effectiveSrsFilter) &&
    effectiveSrsStageFilter === null &&
    !effectiveRecentOnly &&
    effectiveShowLocked &&
    Object.keys(reviewLevelCountsFromServer).length > 0;

  const effectiveReviewLevelCounts =
    canUseServerReviewLevelCounts && Object.keys(reviewLevelCountsFromServer).length > 0
      ? reviewLevelCountsFromServer
      : reviewLevelCounts;

  const availableLevels = useMemo(() => {
    const output = new Set<number>();
    if (queueMode === STUDY_QUEUE_TYPES.review) {
      for (const [levelRaw, count] of Object.entries(effectiveReviewLevelCounts)) {
        const level = Number(levelRaw);
        if (Number.isInteger(level) && count > 0) {
          output.add(level);
        }
      }
      return output;
    }

    for (const item of loadedItems) {
      if (effectiveRecentOnly && !isRecentStudyItem(item)) continue;
      if (item.queueType === queueMode && typeof item.wkLevel === "number") output.add(item.wkLevel);
    }

    return output;
  }, [effectiveRecentOnly, effectiveReviewLevelCounts, loadedItems, queueMode]);

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
      if (!isLessonQueueItem(item)) {
        continue;
      }
      if (effectiveRecentOnly && !isRecentStudyItem(item)) {
        continue;
      }
      if (!isAllStudyTypeFilter(typeFilter) && item.subjectType !== typeFilter) {
        continue;
      }
      if (!effectiveShowLocked && item.status === STUDY_WK_STATUSES.locked) {
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
    return normalizePositiveLevelCounts(data?.levelCounts ?? cachedQueueData?.levelCounts);
  }, [cachedQueueData?.levelCounts, data?.levelCounts]);

  const lessonLevelCounts = useMemo(() => {
    if (queueMode !== STUDY_QUEUE_TYPES.lesson) {
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
      if (!isAllStudySrsFilter(effectiveSrsFilter) && item.status !== effectiveSrsFilter) continue;
      if (effectiveSrsStageFilter !== null && item.srsStage !== effectiveSrsStageFilter) continue;
      if (!effectiveShowLocked && item.status === STUDY_WK_STATUSES.locked) continue;

      out.all += 1;
      if (item.subjectType === STUDY_SUBJECT_TYPES.radical) out.radical += 1;
      else if (isKanjiSubjectType(item.subjectType)) out.kanji += 1;
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

  const canUseServerTypeCounts =
    queueMode === STUDY_QUEUE_TYPES.review &&
    isAllStudySrsFilter(effectiveSrsFilter) &&
    effectiveSrsStageFilter === null &&
    !effectiveRecentOnly &&
    effectiveShowLocked;

  const typeCounts =
    queueMode === STUDY_QUEUE_TYPES.lesson
      ? (lessonTypeCountsFromServer ?? loadedTypeCounts)
      : canUseServerTypeCounts && lessonTypeCountsFromServer
        ? lessonTypeCountsFromServer
        : loadedTypeCounts;

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
      if (!isAllStudyTypeFilter(typeFilter) && item.subjectType !== typeFilter) continue;
      if (!effectiveShowLocked && item.status === STUDY_WK_STATUSES.locked) continue;

      out.all += 1;
      if (item.status === STUDY_WK_STATUSES.locked) out.locked += 1;
      if (item.status === STUDY_WK_STATUSES.apprentice) out.apprentice += 1;
      if (item.status === STUDY_WK_STATUSES.guru) out.guru += 1;
      if (item.status === STUDY_WK_STATUSES.master) out.master += 1;
      if (item.status === STUDY_WK_STATUSES.enlightened) out.enlightened += 1;
      if (item.status === STUDY_WK_STATUSES.burned) out.burned += 1;
    }
    return out;
  }, [loadedItems, queueMode, effectiveRecentOnly, viewedLevel, typeFilter, effectiveShowLocked]);

  const canUseServerSrsCounts =
    queueMode === STUDY_QUEUE_TYPES.review &&
    viewedLevel === null &&
    isAllStudyTypeFilter(typeFilter) &&
    !effectiveRecentOnly &&
    effectiveShowLocked;

  const srsCounts = canUseServerSrsCounts ? (srsCountsFromServer ?? srsCountsFromLoaded) : srsCountsFromLoaded;

  const srsStageCounts = useMemo(() => {
    const fromServer = data?.srsStageCounts ?? cachedQueueData?.srsStageCounts;
    if (
      fromServer &&
      queueMode === STUDY_QUEUE_TYPES.review &&
      viewedLevel === null &&
      isAllStudyTypeFilter(typeFilter) &&
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
      if (!isAllStudyTypeFilter(typeFilter) && item.subjectType !== typeFilter) continue;
      if (!effectiveShowLocked && item.status === STUDY_WK_STATUSES.locked) continue;

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
    hasReliableReviewLevelAvailability,
    reviewLevelCounts: effectiveReviewLevelCounts,
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
