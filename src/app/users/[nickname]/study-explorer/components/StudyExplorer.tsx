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
  StudySrsFilter,
  StudyTypeFilter,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";
import {
  fetchStudyQueue,
  readStoredQueue,
} from "../lib/studyExplorerUtils";
import { useStudyReviewSubmission } from "../lib/useStudyReviewSubmission";
import { useStudyExplorerEffects } from "../lib/useStudyExplorerEffects";
import { useStudyExplorerDerivedData } from "../lib/useStudyExplorerDerivedData";

const REVIEW_API_PAGE_SIZE = 120;
const LESSON_API_PAGE_SIZE = 200;
const EMPTY_TYPE_COUNTS_BY_LEVEL: Record<number, { all: number; radical: number; kanji: number; vocabulary: number }> = {};

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

export default function StudyExplorer({
  accountId,
  maxLevel,
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

  const [viewedLevel, setViewedLevel] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<StudyTypeFilter>("all");
  const [srsFilter, setSrsFilter] = useState<StudySrsFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submittingByAssignmentId, setSubmittingByAssignmentId] = useState<Set<number>>(new Set());
  const [revealedAssignmentIds, setRevealedAssignmentIds] = useState<Set<number>>(new Set());
  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback | null>(null);
  const [submitInFlight, setSubmitInFlight] = useState<SubmitInFlight | null>(null);
  const [reviewOutcomeByAssignmentId, setReviewOutcomeByAssignmentId] = useState<Record<number, ReviewOutcome>>({});
  const [modalSessionOrderByAssignmentId, setModalSessionOrderByAssignmentId] = useState<number[] | null>(null);
  const [modalSessionItemByAssignmentId, setModalSessionItemByAssignmentId] = useState<Record<number, StudyQueueItem>>({});
  const [hiddenSubmittedAssignmentIds, setHiddenSubmittedAssignmentIds] = useState<Set<number>>(new Set());
  const [hasPendingStudySubmissions, setHasPendingStudySubmissions] = useState(false);
  const [showLocked, setShowLocked] = useState(true);
  const [recentOnly, setRecentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasHydratedTypeFilter, setHasHydratedTypeFilter] = useState(false);
  const isModalOpen = selectedId !== null;
  const effectiveSrsFilter: StudySrsFilter = queueMode === "lesson" ? "all" : srsFilter;
  const effectiveRecentOnly = queueMode === "lesson" ? false : recentOnly;
  const effectiveShowLocked = queueMode === "lesson" ? true : showLocked;
  const initialPageSize = queueMode === "lesson" ? LESSON_API_PAGE_SIZE : REVIEW_API_PAGE_SIZE;

  useLayoutEffect(() => {
    const cached = readStoredQueue(accountId, queueMode);
    setCachedQueueData(cached);
    setLoadedItems(cached?.items ?? []);
    setTotalItems(cached?.pagination?.total ?? cached?.items.length ?? 0);
    setPersistedCounts(cached?.counts ?? null);
    setLoadMoreError(null);
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

  const {
    levelOptions,
    availableLevels,
    filteredItems,
    lessonLevelCountsFromServer,
    lessonLevelCounts,
    loadedTypeCounts,
    typeCounts,
    srsCounts,
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
      setModalSessionOrderByAssignmentId(null);
      setModalSessionItemByAssignmentId({});
      return;
    }

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
  }, [filteredItems, selectedId]);

  const { clearAllFilters } = useStudyExplorerEffects({
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
    recentOnly,
    showLocked,
    hasHydratedTypeFilter,
    setHasHydratedTypeFilter,
    hiddenSubmittedAssignmentIds,
    loadedItems,
    totalItems,
    counts,
    levelCounts: lessonLevelCountsFromServer,
    typeCounts: data?.typeCounts ?? cachedQueueData?.typeCounts ?? loadedTypeCounts,
    typeCountsByLevel: typeCountsByLevelForEffects,
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
    setShowLocked,
    lastHandledStudyQueryRef,
  });

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


  const loadMorePage = useCallback(async () => {
    if (isLoadingMore || !hasMorePages) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
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

      setLoadedItems((prev) => {
        const existing = new Set(prev.map((item) => item.assignmentId));
        const merged = [...prev, ...payloadVisibleItems.filter((item) => !existing.has(item.assignmentId))];
        return sameAssignmentList(prev, merged) ? prev : merged;
      });
      const nextTotalRaw = payload.pagination?.total ?? totalItems;
      setTotalItems(Math.max(nextTotalRaw, mergedVisibleCount));
      if (payload.counts) setPersistedCounts(payload.counts);
    } catch (loadError) {
      setLoadMoreError(loadError instanceof Error ? loadError.message : "Could not load more study items.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    accountId,
    queueMode,
    loadedItems.length,
    hasMorePages,
    hiddenSubmittedAssignmentIds,
    initialPageSize,
    isLoadingMore,
    totalItems,
  ]);

  useEffect(() => {
    if (!sentinelRef.current || selectedItem || !hasMorePages) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadMorePage();
      }
    }, { rootMargin: "600px 0px" });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [selectedItem, hasMorePages, loadMorePage]);

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

    if (filteredItems.length < expectedForLevel) {
      void loadMorePage();
    }
  }, [
    filteredItems.length,
    hasMorePages,
    isLoadingMore,
    lessonLevelCounts,
    loadMorePage,
    queueMode,
    selectedItem,
    typeFilter,
    viewedLevel,
  ]);

  const { submitReview, submitLessonStart, closeReviewSession } = useStudyReviewSubmission({
    accountId,
    modalItems,
    selectedItem,
    hasPendingStudySubmissions,
    mutateQueue,
    onSetLoadedItems: setLoadedItems,
    onSetTotalItems: setTotalItems,
    onSetPersistedCounts: setPersistedCounts,
    onSetSubmitFeedback: setSubmitFeedback,
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
        queueMode={queueMode}
        lessonLevelCounts={lessonLevelCounts}
        typeCounts={typeCounts}
        srsCounts={srsCounts}
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
        onSetSrsFilter={setSrsFilter}
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
        reviewOutcomeByAssignmentId={reviewOutcomeByAssignmentId}
        onSetReviewOutcomeByAssignmentId={setReviewOutcomeByAssignmentId}
        onSetSelectedId={setSelectedId}
        onSetRevealedAssignmentIds={setRevealedAssignmentIds}
        onClose={closeReviewSession}
        onToggleShowEnglish={onToggleShowEnglish}
        onSubmit={submitReview}
        onStartLesson={submitLessonStart}
      />
    </section>
  );
}
