import type { StudyQueueItem, StudyQueueMode } from "./studyExplorerTypes";
import { isLessonQueueItem, isReviewQueueItem, STUDY_QUEUE_TYPES } from "./studyExplorerDomain";

type Params = {
  queueMode: StudyQueueMode;
  viewedLevel: number | null;
  maxLevel: number;
  loadedItems: StudyQueueItem[];
  rawLevelCounts?: Record<number, number> | Record<string, number>;
};

function normalizeLevelCounts(rawLevelCounts?: Record<number, number> | Record<string, number>): Record<number, number> {
  if (!rawLevelCounts) {
    return {};
  }

  const normalized: Record<number, number> = {};
  for (const [levelRaw, count] of Object.entries(rawLevelCounts)) {
    const level = Number(levelRaw);
    if (!Number.isInteger(level) || level <= 0 || typeof count !== "number" || count <= 0) {
      continue;
    }

    normalized[level] = count;
  }

  return normalized;
}

export function resolveEffectiveViewedLevel({
  queueMode,
  viewedLevel,
  maxLevel,
  loadedItems,
  rawLevelCounts,
}: Params): number | null {
  if (queueMode === STUDY_QUEUE_TYPES.review) {
    if (viewedLevel === null) {
      return null;
    }

    if (viewedLevel < 1 || viewedLevel > maxLevel) {
      return null;
    }

    const reviewLevelFromLoaded = loadedItems.some(
      (item) => isReviewQueueItem(item) && item.wkLevel === viewedLevel,
    );
    if (!reviewLevelFromLoaded) {
      return null;
    }

    return viewedLevel;
  }

  if (queueMode !== STUDY_QUEUE_TYPES.lesson || viewedLevel === null) {
    return viewedLevel;
  }

  const lessonLevelCounts = normalizeLevelCounts(rawLevelCounts);
  const lessonLevelFromCounts = (lessonLevelCounts[viewedLevel] ?? 0) > 0;
  const lessonLevelFromLoaded = loadedItems.some(
    (item) => isLessonQueueItem(item) && item.wkLevel === viewedLevel,
  );
  if (!lessonLevelFromCounts && !lessonLevelFromLoaded) {
    return null;
  }

  return viewedLevel;
}