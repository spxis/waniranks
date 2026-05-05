"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import useSWR from "swr";

import StudyExplorerModal from "./StudyExplorerModal";
import StudyExplorerPanel from "./StudyExplorerPanel";
import type {
  QueueResponse,
  ReviewOutcome,
  StudyCounts,
  StudyExplorerProps,
  StudyQueueItem,
  ReviewSrsTransition,
  StudySrsFilter,
  StudySrsStageFilter,
  StudyTypeFilter,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";
import {
  fetchStudyQueue,
  readStoredQueue,
} from "../lib/studyExplorerUtils";
import { normalizeSrsStageFilter } from "../lib/studyExplorerSrs";
import { useStudyReviewSubmission } from "../lib/useStudyReviewSubmission";
import { useStudyExplorerEffects } from "../lib/useStudyExplorerEffects";
import { useStudyExplorerDerivedData } from "../lib/useStudyExplorerDerivedData";
import { useStudyQueuePagination } from "../lib/useStudyQueuePagination";
import { useStudyQueueInfiniteLoad } from "../lib/useStudyQueueInfiniteLoad";

const REVIEW_API_PAGE_SIZE = 120;
const LESSON_API_PAGE_SIZE = 200;
const EMPTY_TYPE_COUNTS_BY_LEVEL: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> = {};

export default function StudyExplorer({
  accountId,
  maxLevel,
  initialViewerMode = null,
  initialFilters,
  showEnglish,
  onToggleShowEnglish,
  canToggleEnglish,
  studyMode,
  queueMode,
}: StudyExplorerProps) {
  const countsStorageKey = `wr:study-queue-counts:${accountId}`;
  const selectedSubjectStorageKey = `wr:study-selected-subject:${accountId}:${queueMode}`;
  const typeFilterStorageKey = `wr:study-type-filter:${accountId}:${queueMode}`;
  const viewedLevelStorageKey = `wr:study-viewed-level:${accountId}:${queueMode}`;
  const srsStageFilterStorageKey = `wr:study-srs-stage-filter:${accountId}:${queueMode}`;
  const recentOnlyStorageKey = `wr:study-recent-only:${accountId}:${queueMode}`;
  const showLockedStorageKey = `wr:study-show-locked:${accountId}:${queueMode}`;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastHandledStudyQueryRef = useRef("");

  const [cachedQueueData, setCachedQueueData] = useState<QueueResponse | undefined>(() =>
    readStoredQueue(accountId, queueMode),
  );
  const [persistedCounts, setPersistedCounts] = useState<StudyCounts | null>(null);
  const [loadedItems, setLoadedItems] = useState<StudyQueueItem[]>(() => cachedQueueData?.items ?? []);
  const [totalItems, setTotalItems] = useState<number>(
    () => cachedQueueData?.pagination?.total ?? cachedQueueData?.items.length ?? 0,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [viewedLevel, setViewedLevel] = useState<number | null>(initialFilters?.viewedLevel ?? null);
  const [hasHydratedViewedLevel, setHasHydratedViewedLevel] = useState(false);
  const [typeFilter, setTypeFilter] = useState<StudyTypeFilter>(initialFilters?.typeFilter ?? "all");
  const [srsFilter, setSrsFilter] = useState<StudySrsFilter>(initialFilters?.srsFilter ?? "all");
  const [srsStageFilter, setSrsStageFilter] = useState<StudySrsStageFilter | null>(initialFilters?.srsStageFilter ?? null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());
  const [revealedAssignmentIds, setRevealedAssignmentIds] = useState<Set<number>>(new Set());
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [latestReviewTransition, setLatestReviewTransition] = useState<ReviewSrsTransition | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<SubmitInFlight | null>(null);
  const [reviewOutcomeByAssignmentId, setReviewOutcomeByAssignmentId] = useState<Record<number, ReviewOutcome>>({});
  const [modalSessionOrderByAssignmentId, setModalSessionOrderByAssignmentId] = useState<number[] | null>(null);
  const [modalSessionItemByAssignmentId, setModalSessionItemByAssignmentId] = useState<Record<number, StudyQueueItem>>({});
  const [hiddenSubmittedAssignmentIds, setHiddenSubmittedAssignmentIds] = useState<Set<number>>(new Set());
  const [hasPendingStudySubmissions, setHasPendingStudySubmissions] = useState(false);
  const [showLocked, setShowLocked] = useState(initialFilters?.showLocked ?? true);
  const [recentOnly, setRecentOnly] = useState(initialFilters?.recentOnly ?? false);
  const [searchQuery, setSearchQuery] = useState("");
  const [forcedViewerMode, setForcedViewerMode] = useState<"detail" | "flash" | null>(
    initialViewerMode,
  );
  const [hasHydratedTypeFilter, setHasHydratedTypeFilter] = useState(false);
  const isModalOpen = selectedId !== null;
  const effectiveSrsFilter: StudySrsFilter = queueMode === "lesson" ? "all" : srsFilter;
  const effectiveRecentOnly = queueMode === "lesson" ? false : recentOnly;
  const effectiveShowLocked = queueMode === "lesson" ? true : showLocked;
  const effectiveSrsStageFilter: StudySrsStageFilter | null =
    queueMode === "lesson" ? null : srsStageFilter;
  const initialPageSize = queueMode === "lesson" ? LESSON_API_PAGE_SIZE : REVIEW_API_PAGE_SIZE;

  useLayoutEffect(() => {
    const cached = readStoredQueue(accountId, queueMode);
    queueMicrotask(() => {
      setCachedQueueData(cached);
      setLoadedItems(cached?.items ?? []);
      setTotalItems(cached?.pagination?.total ?? cached?.items.length ?? 0);
      setPersistedCounts(cached?.counts ?? null);
      setLoadMoreError(null);
    });
  }, [accountId, queueMode]);

  const { data, error, isLoading, isValidating, mutate: mutateQueue } = useSWR(
    `/api/study/${accountId}/queue?mode=${queueMode}&limit=${initialPageSize}&offset=0`,
    fetchStudyQueue,
    {
      fallbackData: cachedQueueData,
      keepPreviousData: false,
      refreshInterval: isModalOpen ? 0 : 30_000,
      revalidateOnFocus: !isModalOpen,
    },
  );
  const isUnauthorized = Boolean(error && /unauthorized/i.test(error.message));

  const counts = data?.counts ?? persistedCounts;
  const hasMorePages = loadedItems.length < totalItems;
  const typeCountsByLevelForEffects = data?.typeCountsByLevel ?? cachedQueueData?.typeCountsByLevel ?? EMPTY_TYPE_COUNTS_BY_LEVEL;

  useEffect(() => {
    if (!counts || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(countsStorageKey, JSON.stringify(counts));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    window.dispatchEvent(
      new CustomEvent("wr:study-counts-updated", {
        detail: {
          accountId,
          reviews: counts.reviews,
          lessons: counts.lessons,
        },
      }),
    );
  }, [accountId, counts, countsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key.toLowerCase() !== "e" || !canToggleEnglish) {
        return;
      }

      event.preventDefault();
      onToggleShowEnglish();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canToggleEnglish, onToggleShowEnglish]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onExplorerPageChange = () => {
      setSelectedId(null);
    };

    window.addEventListener("wr:explorer-page-change", onExplorerPageChange as EventListener);
    return () => {
      window.removeEventListener("wr:explorer-page-change", onExplorerPageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromUrl = () => {
      const viewer = new URLSearchParams(window.location.search).get("viewer");
      setForcedViewerMode(viewer === "detail" || viewer === "flash" ? viewer : null);
    };

    syncFromUrl();
    const onPopState = () => syncFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const {
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
  } = useStudyExplorerDerivedData({
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
  });

  useEffect(() => {
    if (selectedId === null) {
      queueMicrotask(() => {
        setModalSessionOrderByAssignmentId(null);
        setModalSessionItemByAssignmentId({});
      });
      return;
    }

    queueMicrotask(() => {
      setModalSessionOrderByAssignmentId((prev) => {
        if (prev && prev.length > 0) {
          return prev;
        }
        if (filteredItems.length === 0) {
          return prev;
        }
        return filteredItems.map((item) => item.assignmentId);
      });

      setModalSessionItemByAssignmentId((prev) => {
        if (filteredItems.length === 0) {
          return prev;
        }

        const next = { ...prev };
        for (const item of filteredItems) {
          next[item.assignmentId] = item;
        }
        return next;
      });
    });
  }, [filteredItems, selectedId]);

  const { clearAllFilters } = useStudyExplorerEffects({
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
    typeFilter,
    srsFilter,
    srsStageFilter,
    recentOnly,
    showLocked,
    hasHydratedTypeFilter,
    setHasHydratedTypeFilter,
    hasHydratedViewedLevel,
    setHasHydratedViewedLevel,
    hiddenSubmittedAssignmentIds,
    loadedItems,
    totalItems,
    counts,
    levelCounts: lessonLevelCountsFromServer,
    typeCounts: data?.typeCounts ?? cachedQueueData?.typeCounts ?? loadedTypeCounts,
    typeCountsByLevel: typeCountsByLevelForEffects,
    srsCounts: data?.srsCounts ?? cachedQueueData?.srsCounts,
    srsStageCounts: data?.srsStageCounts ?? cachedQueueData?.srsStageCounts,
    dataItems: data?.items,
    dataPaginationTotal: data?.pagination?.total,
    dataCounts: data?.counts,
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
  });

  const handleSetSrsFilter = useCallback(
    (nextFilter: StudySrsFilter) => {
      setSrsFilter(nextFilter);

      setSrsStageFilter((current) => normalizeSrsStageFilter(nextFilter, current));
    },
    [setSrsFilter],
  );

  useEffect(() => {
    try {
      if (selectedId === null) {
        window.localStorage.removeItem(selectedSubjectStorageKey);
      } else {
        window.localStorage.setItem(selectedSubjectStorageKey, String(selectedId));
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedId, selectedSubjectStorageKey]);
  const hasActiveFilterConstraints =
    viewedLevel !== null ||
    typeFilter !== "all" ||
    effectiveSrsFilter !== "all" ||
    effectiveSrsStageFilter !== null ||
    !effectiveShowLocked ||
    effectiveRecentOnly ||
    searchQuery.trim().length > 0;

  const { loadMorePage } = useStudyQueuePagination({
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
    filteredItemsLength: filteredItems.length,
    hasActiveFilterConstraints,
    onSetIsLoadingMore: setIsLoadingMore,
    onSetLoadMoreError: setLoadMoreError,
    onSetLoadedItems: setLoadedItems,
    onSetTotalItems: setTotalItems,
    onSetPersistedCounts: setPersistedCounts,
  });

  useStudyQueueInfiniteLoad({
    sentinelRef,
    selectedItem,
    hasMorePages,
    isLoadingMore,
    loadMorePage,
    queueMode,
    viewedLevel,
    typeFilter,
    lessonLevelCounts,
    filteredItemsLength: filteredItems.length,
  });

  const { submitReview, submitLessonStart, submitResetToLessons, closeReviewSession } = useStudyReviewSubmission({
    accountId,
    modalItems,
    selectedItem,
    hasPendingStudySubmissions,
    mutateQueue,
    onSetLoadedItems: setLoadedItems,
    onSetTotalItems: setTotalItems,
    onSetPersistedCounts: setPersistedCounts,
    onSetSubmitFeedback: setSubmitFeedback,
    onSetLatestReviewTransition: setLatestReviewTransition,
    onSetSubmitInFlight: setSubmitInFlight,
    onSetSubmittingByAssignmentId: setSubmittingByAssignmentId,
    onSetRevealedAssignmentIds: setRevealedAssignmentIds,
    onSetReviewOutcomeByAssignmentId: setReviewOutcomeByAssignmentId,
    onSetHiddenSubmittedAssignmentIds: setHiddenSubmittedAssignmentIds,
    onSetHasPendingStudySubmissions: setHasPendingStudySubmissions,
    onSetSelectedId: setSelectedId,
    onSetModalSessionOrderByAssignmentId: setModalSessionOrderByAssignmentId,
    onSetModalSessionItemByAssignmentId: setModalSessionItemByAssignmentId,
  });

  return (
    <section className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <StudyExplorerPanel
        canToggleEnglish={canToggleEnglish}
        showEnglish={showEnglish}
        studyMode={studyMode}
        levelOptions={levelOptions}
        availableLevels={availableLevels}
        viewedLevel={viewedLevel}
        typeFilter={typeFilter}
        srsFilter={effectiveSrsFilter}
        srsStageFilter={effectiveSrsStageFilter}
        queueMode={queueMode}
        lessonLevelCounts={lessonLevelCounts}
        typeCounts={typeCounts}
        srsCounts={srsCounts}
        srsStageCounts={srsStageCounts}
        filteredItems={filteredItems}
        totalItems={totalItems}
        hasMorePages={hasMorePages}
        isLoadingMore={isLoadingMore}
        loadMoreError={loadMoreError}
        isLoading={isLoading}
        isValidating={isValidating}
        hasData={Boolean(data)}
        isUnauthorized={isUnauthorized}
        errorMessage={error?.message ?? null}
        recentOnly={effectiveRecentOnly}
        showLocked={effectiveShowLocked}
        sentinelRef={sentinelRef}
        onSetViewedLevel={setViewedLevel}
        onSetTypeFilter={setTypeFilter}
        onSetSrsFilter={handleSetSrsFilter}
        onSetSrsStageFilter={setSrsStageFilter}
        onToggleShowEnglish={onToggleShowEnglish}
        onToggleShowLocked={() => setShowLocked((prev) => !prev)}
        onToggleRecentOnly={() => setRecentOnly((prev) => !prev)}
        onSelectSubject={setSelectedId}
        onClearAllFilters={clearAllFilters}
      />

      <StudyExplorerModal
        accountId={accountId}
        showEnglish={showEnglish}
        canToggleEnglish={canToggleEnglish}
        forcedViewerMode={forcedViewerMode}
        isUnauthorized={isUnauthorized}
        studyMode={studyMode}
        selectedItem={selectedItem}
        selectedIndex={selectedIndex}
        modalItems={modalItems}
        prevItem={prevItem}
        nextItem={nextItem}
        filteredItems={filteredItems}
        isSelectedSubmitted={isSelectedSubmitted}
        isAnswerRevealed={isAnswerRevealed}
        isSubmittingSelected={isSubmittingSelected}
        submitInFlight={submitInFlight}
        submitFeedback={submitFeedback}
        latestReviewTransition={latestReviewTransition}
        reviewOutcomeByAssignmentId={reviewOutcomeByAssignmentId}
        onSetReviewOutcomeByAssignmentId={setReviewOutcomeByAssignmentId}
        onSetSelectedId={setSelectedId}
        onSetRevealedAssignmentIds={setRevealedAssignmentIds}
        onClose={closeReviewSession}
        onToggleShowEnglish={onToggleShowEnglish}
        onSubmit={submitReview}
        onStartLesson={submitLessonStart}
        onResetToLessons={submitResetToLessons}
      />
    </section>
  );
}
