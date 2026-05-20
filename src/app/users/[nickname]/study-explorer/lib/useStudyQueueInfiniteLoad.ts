import { useEffect } from "react";

import type { StudyQueueItem } from "./studyExplorerTypes";

type Args = {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  selectedItem: StudyQueueItem | null;
  hasMorePages: boolean;
  isLoadingMore: boolean;
  loadMorePage: () => Promise<void>;
};

export function useStudyQueueInfiniteLoad({
  sentinelRef,
  selectedItem,
  hasMorePages,
  isLoadingMore,
  loadMorePage,
}: Args) {
  useEffect(() => {
    if (!sentinelRef.current || selectedItem || !hasMorePages || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingMore) {
          void loadMorePage();
        }
      },
      { rootMargin: "300px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMorePages, isLoadingMore, loadMorePage, selectedItem, sentinelRef]);
}
