import type { QueueResponse, StudyCounts, StudyQueueMode, StudySrsFilter, StudySrsStageFilter, StudyTypeFilter } from "./studyExplorerTypes";
import { STUDY_QUEUE_TYPES, STUDY_SRS_FILTERS, STUDY_TYPE_FILTERS } from "./studyExplorerDomain";

export type StudyExplorerStorageKeys = {
  counts: string;
  selectedSubject: string;
  typeFilter: string;
  viewedLevel: string;
  srsStageFilter: string;
  recentOnly: string;
  showLocked: string;
  waitSort: string;
};

export function buildStudyExplorerStorageKeys(
  accountId: string,
  queueMode: StudyQueueMode,
): StudyExplorerStorageKeys {
  return {
    counts: `wr:study-queue-counts:${accountId}`,
    selectedSubject: `wr:study-selected-subject:${accountId}:${queueMode}`,
    typeFilter: `wr:study-type-filter:${accountId}:${queueMode}`,
    viewedLevel: `wr:study-viewed-level:${accountId}:${queueMode}`,
    srsStageFilter: `wr:study-srs-stage-filter:${accountId}:${queueMode}`,
    recentOnly: `wr:study-recent-only:${accountId}:${queueMode}`,
    showLocked: `wr:study-show-locked:${accountId}:${queueMode}`,
    waitSort: `wr:study-wait-sort:${accountId}:${queueMode}`,
  };
}

export function deriveInitialQueueState(cachedQueueData: QueueResponse | undefined): {
  loadedItems: QueueResponse["items"];
  totalItems: number;
  persistedCounts: StudyCounts | null;
} {
  return {
    loadedItems: cachedQueueData?.items ?? [],
    totalItems: cachedQueueData?.pagination?.total ?? cachedQueueData?.items.length ?? 0,
    persistedCounts: cachedQueueData?.counts ?? null,
  };
}

export function readStoredStudyCounts(countsStorageKey: string): StudyCounts | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(countsStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudyCounts>;
    if (typeof parsed.all !== "number" || typeof parsed.reviews !== "number" || typeof parsed.lessons !== "number") {
      return null;
    }

    return { all: parsed.all, reviews: parsed.reviews, lessons: parsed.lessons };
  } catch {
    return null;
  }
}

export function resolveEffectiveTypeFilter(
  typeFilter: StudyTypeFilter,
  typeCounts: { all: number; radical: number; kanji: number; vocabulary: number },
): StudyTypeFilter {
  if (typeFilter === STUDY_TYPE_FILTERS.all) {
    return typeFilter;
  }

  return typeCounts[typeFilter] > 0 ? typeFilter : STUDY_TYPE_FILTERS.all;
}

export function resolveEffectiveSrsStageFilter(
  srsStageFilter: StudySrsStageFilter | null,
  srsStageCounts: Record<number, number> | undefined,
): StudySrsStageFilter | null {
  if (srsStageFilter === null) {
    return null;
  }

  return (srsStageCounts?.[srsStageFilter] ?? 0) > 0 ? srsStageFilter : null;
}

export function resolveEffectiveSrsFilter(
  srsFilter: StudySrsFilter,
  srsCounts: {
    all: number;
    locked: number;
    apprentice: number;
    guru: number;
    master: number;
    enlightened: number;
    burned: number;
  } | undefined,
): StudySrsFilter {
  if (srsFilter === STUDY_SRS_FILTERS.all) {
    return srsFilter;
  }

  return (srsCounts?.[srsFilter] ?? 0) > 0 ? srsFilter : STUDY_SRS_FILTERS.all;
}

export function resolveEffectiveViewedLevelFilter(
  viewedLevel: number | null,
  effectiveViewedLevel: number | null,
  levelAllCount: number,
): number | null {
  if (viewedLevel !== null && levelAllCount <= 0) {
    return null;
  }

  return effectiveViewedLevel;
}

export function shouldUseServerReviewAggregateCounts({
  queueMode,
  srsFilter,
  srsStageFilter,
  recentOnly,
  showLocked,
  hiddenSubmittedCount,
}: {
  queueMode: StudyQueueMode;
  srsFilter: StudySrsFilter;
  srsStageFilter: StudySrsStageFilter | null;
  recentOnly: boolean;
  showLocked: boolean;
  hiddenSubmittedCount: number;
}): boolean {
  return (
    queueMode === STUDY_QUEUE_TYPES.review &&
    srsFilter === STUDY_SRS_FILTERS.all &&
    srsStageFilter === null &&
    !recentOnly &&
    showLocked &&
    hiddenSubmittedCount === 0
  );
}