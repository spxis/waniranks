import { useEffect } from "react";

import type { StudyQueueItem, StudyTypeFilter } from "./studyExplorerTypes";

type Args = {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  selectedItem: StudyQueueItem | null;
  hasMorePages: boolean;
  isLoadingMore: boolean;
  loadMorePage: () => Promise<void>;
  queueMode: "review" | "lesson";
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  lessonLevelCounts: Record<number, number>;
  filteredItemsLength: number;
};

export function useStudyQueueInfiniteLoad({
  sentinelRef,
  selectedItem,
  hasMorePages,
  isLoadingMore,
  loadMorePage,
  queueMode,
  viewedLevel,
  typeFilter,
  lessonLevelCounts,
  filteredItemsLength,
}: Args) {
  useEffect(() => {
    if (!sentinelRef.current || selectedItem || !hasMorePages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMorePage();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [selectedItem, hasMorePages, loadMorePage, sentinelRef]);

  useEffect(() => {
    if (selectedItem || !hasMorePages || isLoadingMore) {
      return;
    }

    let rafId: number | null = null;
    const maybeLoadMore = () => {
      if (!sentinelRef.current || selectedItem || !hasMorePages || isLoadingMore) {
        return;
      }

      const rect = sentinelRef.current.getBoundingClientRect();
      const nearViewport = rect.top - window.innerHeight <= 320;
      if (nearViewport) {
        void loadMorePage();
      }
    };

    const onScrollOrResize = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        maybeLoadMore();
      });
    };

    maybeLoadMore();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [hasMorePages, isLoadingMore, loadMorePage, selectedItem, sentinelRef]);

  useEffect(() => {
    if (queueMode !== "lesson") {
      return;
    }
    if (selectedItem || isLoadingMore || !hasMorePages) {
      return;
    }

    void loadMorePage();
  }, [hasMorePages, isLoadingMore, loadMorePage, queueMode, selectedItem]);

  useEffect(() => {
    if (queueMode !== "lesson") {
      return;
    }
    if (selectedItem || isLoadingMore || !hasMorePages) {
      return;
    }
    if (viewedLevel === null || typeFilter !== "all") {
      return;
    }

    const expectedForLevel = lessonLevelCounts[viewedLevel] ?? 0;
    if (expectedForLevel <= 0) {
      return;
    }

    if (filteredItemsLength < expectedForLevel) {
      void loadMorePage();
    }
  }, [
    filteredItemsLength,
    hasMorePages,
    isLoadingMore,
    lessonLevelCounts,
    loadMorePage,
    queueMode,
    selectedItem,
    typeFilter,
    viewedLevel,
  ]);
}
