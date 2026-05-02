import { useCallback, useEffect } from "react";

import type { StudyCounts, StudyQueueItem } from "./studyExplorerTypes";
import { sameAssignmentList } from "./studyExplorerEffectsComparators";
import { fetchStudyQueue } from "./studyExplorerUtils";

type Args = {
  accountId: string;
  queueMode: "review" | "lesson";
  initialPageSize: number;
  loadedItems: StudyQueueItem[];
  totalItems: number;
  hasMorePages: boolean;
  isLoadingMore: boolean;
  isLoading: boolean;
  isValidating: boolean;
  hiddenSubmittedAssignmentIds: Set<number>;
  filteredItemsLength: number;
  hasActiveFilterConstraints: boolean;
  onSetIsLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  onSetLoadMoreError: React.Dispatch<React.SetStateAction<string | null>>;
  onSetLoadedItems: React.Dispatch<React.SetStateAction<StudyQueueItem[]>>;
  onSetTotalItems: React.Dispatch<React.SetStateAction<number>>;
  onSetPersistedCounts: React.Dispatch<React.SetStateAction<StudyCounts | null>>;
};

export function useStudyQueuePagination({
  accountId,
  queueMode,
  initialPageSize,
  loadedItems,
  totalItems,
  hasMorePages,
  isLoadingMore,
  isLoading,
  isValidating,
  hiddenSubmittedAssignmentIds,
  filteredItemsLength,
  hasActiveFilterConstraints,
  onSetIsLoadingMore,
  onSetLoadMoreError,
  onSetLoadedItems,
  onSetTotalItems,
  onSetPersistedCounts,
}: Args) {
  const loadMorePage = useCallback(async () => {
    if (isLoadingMore || !hasMorePages) return;

    onSetIsLoadingMore(true);
    onSetLoadMoreError(null);
    try {
      const payload = await fetchStudyQueue(
        `/api/study/${accountId}/queue?mode=${queueMode}&limit=${initialPageSize}&offset=${loadedItems.length}`,
      );
      const payloadVisibleItems = payload.items.filter(
        (item) => !hiddenSubmittedAssignmentIds.has(item.assignmentId),
      );
      const existingIds = new Set(loadedItems.map((item) => item.assignmentId));
      const uniquePayloadItems = payloadVisibleItems.filter((item) => !existingIds.has(item.assignmentId));
      const mergedVisibleCount = loadedItems.length + uniquePayloadItems.length;

      onSetLoadedItems((prev) => {
        const existing = new Set(prev.map((item) => item.assignmentId));
        const merged = [...prev, ...payloadVisibleItems.filter((item) => !existing.has(item.assignmentId))];
        return sameAssignmentList(prev, merged) ? prev : merged;
      });
      const nextTotalRaw = payload.pagination?.total ?? totalItems;
      onSetTotalItems(Math.max(nextTotalRaw, mergedVisibleCount));
      if (payload.counts) onSetPersistedCounts(payload.counts);
    } catch (loadError) {
      onSetLoadMoreError(loadError instanceof Error ? loadError.message : "Could not load more study items.");
    } finally {
      onSetIsLoadingMore(false);
    }
  }, [
    accountId,
    hasMorePages,
    hiddenSubmittedAssignmentIds,
    initialPageSize,
    isLoadingMore,
    loadedItems,
    onSetIsLoadingMore,
    onSetLoadMoreError,
    onSetLoadedItems,
    onSetPersistedCounts,
    onSetTotalItems,
    queueMode,
    totalItems,
  ]);

  useEffect(() => {
    if (!hasActiveFilterConstraints) {
      return;
    }

    if (isLoading || isValidating || isLoadingMore || !hasMorePages) {
      return;
    }

    if (loadedItems.length === 0 || filteredItemsLength > 0) {
      return;
    }

    void loadMorePage();
  }, [
    filteredItemsLength,
    hasActiveFilterConstraints,
    hasMorePages,
    isLoading,
    isLoadingMore,
    isValidating,
    loadMorePage,
    loadedItems.length,
  ]);

  return { loadMorePage };
}
