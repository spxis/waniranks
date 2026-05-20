"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import StudyExplorerModal from "./StudyExplorerModal";
import StudyExplorerPanel from "./StudyExplorerPanel";
import {
  isAllStudySrsFilter,
  isAllStudyTypeFilter,
  STUDY_EXPLORER_EMPTY_TYPE_COUNTS_BY_LEVEL,
  STUDY_EXPLORER_LESSON_API_PAGE_SIZE,
  STUDY_EXPLORER_REVIEW_API_PAGE_SIZE,
  STUDY_QUEUE_TYPES,
  STUDY_SRS_FILTERS,
  STUDY_TYPE_FILTERS,
} from "./StudyExplorer.constants";
import type {
  QueueResponse,
  ReviewOutcome,
  StudyCounts,
  StudyExplorerProps,
  StudyQueueItem,
  StudyViewerMode,
  ReviewSrsTransition,
  StudySrsFilter,
  StudySrsStageFilter,
  StudyTypeFilter,
  StudyWaitSortOrder,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";
import { fetchStudyQueue, readStoredQueue, sortStudyItemsByWait } from "../lib/studyExplorerUtils";
import { normalizeSrsStageFilter } from "../lib/studyExplorerSrs";
import { resolveEffectiveViewedLevel } from "../lib/studyExplorerLevelBounds";
import { buildStudyExplorerStorageKeys, deriveInitialQueueState, readStoredStudyCounts } from "../lib/studyExplorerState";
import { useStudyReviewSubmission } from "../lib/useStudyReviewSubmission";
import { useStudyExplorerEffects } from "../lib/useStudyExplorerEffects";
import { useStudyExplorerDerivedData } from "../lib/useStudyExplorerDerivedData";
import { useStudyQueuePagination } from "../lib/useStudyQueuePagination";
import { useStudyQueueInfiniteLoad } from "../lib/useStudyQueueInfiniteLoad";
import {
  useStudyCloseOnExplorerPageChange,
  useStudyModalSessionSync,
  useStudyToggleEnglishHotkey,
  useStudyViewerModeSync,
} from "../lib/useStudyExplorerUiEffects";

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
  const storageKeys = useMemo(() => buildStudyExplorerStorageKeys(accountId, queueMode), [accountId, queueMode]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastHandledStudyQueryRef = useRef("");

  const [cachedQueueData, setCachedQueueData] = useState<QueueResponse | undefined>(() =>
    readStoredQueue(accountId, queueMode),
  );
  const [persistedCounts, setPersistedCounts] = useState<StudyCounts | null>(() =>
    readStoredStudyCounts(storageKeys.counts),
  );
  const [loadedItems, setLoadedItems] = useState<StudyQueueItem[]>(() => deriveInitialQueueState(cachedQueueData).loadedItems);
  const [totalItems, setTotalItems] = useState<number>(() => deriveInitialQueueState(cachedQueueData).totalItems);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [viewedLevel, setViewedLevel] = useState<number | null>(initialFilters?.viewedLevel ?? null);
  const [hasHydratedViewedLevel, setHasHydratedViewedLevel] = useState(false);
  const [typeFilter, setTypeFilter] = useState<StudyTypeFilter>(
    initialFilters?.typeFilter ?? STUDY_TYPE_FILTERS.all,
  );
  const [srsFilter, setSrsFilter] = useState<StudySrsFilter>(
    initialFilters?.srsFilter ?? STUDY_SRS_FILTERS.all,
  );
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
  const [waitSortOrder, setWaitSortOrder] = useState<StudyWaitSortOrder>("oldest_wait");
  const [searchQuery, setSearchQuery] = useState("");
  const [forcedViewerMode, setForcedViewerMode] = useState<StudyViewerMode | null>(initialViewerMode);
  const [hasHydratedTypeFilter, setHasHydratedTypeFilter] = useState(false);
  const isModalOpen = selectedId !== null;
  const effectiveSrsFilter: StudySrsFilter =
    queueMode === STUDY_QUEUE_TYPES.lesson ? STUDY_SRS_FILTERS.all : srsFilter;
  const effectiveRecentOnly = queueMode === STUDY_QUEUE_TYPES.lesson ? false : recentOnly;
  const effectiveShowLocked = queueMode === STUDY_QUEUE_TYPES.lesson ? true : showLocked;
  const effectiveSrsStageFilter: StudySrsStageFilter | null =
    queueMode === STUDY_QUEUE_TYPES.lesson ? null : normalizeSrsStageFilter(srsFilter, srsStageFilter);
  const initialPageSize =
    queueMode === STUDY_QUEUE_TYPES.lesson
      ? STUDY_EXPLORER_LESSON_API_PAGE_SIZE
      : STUDY_EXPLORER_REVIEW_API_PAGE_SIZE;

  useLayoutEffect(() => {
    const cached = readStoredQueue(accountId, queueMode);
    const initialQueueState = deriveInitialQueueState(cached);
    queueMicrotask(() => {
      setCachedQueueData(cached);
      setLoadedItems(initialQueueState.loadedItems);
      setTotalItems(initialQueueState.totalItems);
      setPersistedCounts(readStoredStudyCounts(storageKeys.counts));
      setLoadMoreError(null);
    });
  }, [accountId, queueMode, storageKeys.counts]);

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
  const effectiveViewedLevel = useMemo(
    () =>
      resolveEffectiveViewedLevel({
        queueMode,
        viewedLevel,
        maxLevel,
        loadedItems,
        rawLevelCounts: data?.levelCounts ?? cachedQueueData?.levelCounts,
      }),
    [cachedQueueData?.levelCounts, data?.levelCounts, loadedItems, maxLevel, queueMode, viewedLevel],
  );

  const counts = persistedCounts ?? data?.counts ?? null;
  const liveCounts = data?.counts ?? null;
  const hasMorePages = loadedItems.length < totalItems;
  const typeCountsByLevelForEffects =
    data?.typeCountsByLevel ?? cachedQueueData?.typeCountsByLevel ?? STUDY_EXPLORER_EMPTY_TYPE_COUNTS_BY_LEVEL;

  useEffect(() => {
    if (!liveCounts || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(storageKeys.counts, JSON.stringify(liveCounts));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    window.dispatchEvent(
      new CustomEvent("wr:study-counts-updated", {
        detail: {
          accountId,
          reviews: liveCounts.reviews,
          lessons: liveCounts.lessons,
        },
      }),
    );
  }, [accountId, liveCounts, storageKeys]);

  useStudyToggleEnglishHotkey(canToggleEnglish, onToggleShowEnglish);
  useStudyCloseOnExplorerPageChange(setSelectedId);
  useStudyViewerModeSync(setForcedViewerMode);

  const {
    levelOptions,
    availableLevels,
    hasReliableReviewLevelAvailability,
    reviewLevelCounts,
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
    viewedLevel: effectiveViewedLevel,
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

  const sortedFilteredItems = useMemo(
    () => sortStudyItemsByWait(filteredItems, waitSortOrder),
    [filteredItems, waitSortOrder],
  );

  useStudyModalSessionSync({
    selectedId,
    filteredItems: sortedFilteredItems,
    setModalSessionOrderByAssignmentId,
    setModalSessionItemByAssignmentId,
  });

  const { clearAllFilters } = useStudyExplorerEffects({
    accountId,
    queueMode,
    countsStorageKey: storageKeys.counts,
    selectedSubjectStorageKey: storageKeys.selectedSubject,
    typeFilterStorageKey: storageKeys.typeFilter,
    viewedLevelStorageKey: storageKeys.viewedLevel,
    srsStageFilterStorageKey: storageKeys.srsStageFilter,
    recentOnlyStorageKey: storageKeys.recentOnly,
    showLockedStorageKey: storageKeys.showLocked,
    viewedLevel,
    effectiveViewedLevel,
    typeFilter,
    srsFilter,
    srsStageFilter: effectiveSrsStageFilter,
    recentOnly,
    showLocked,
    hasData: Boolean(data),
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
        window.localStorage.removeItem(storageKeys.selectedSubject);
      } else {
        window.localStorage.setItem(storageKeys.selectedSubject, String(selectedId));
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedId, storageKeys]);
  const hasActiveFilterConstraints =
    effectiveViewedLevel !== null ||
    !isAllStudyTypeFilter(typeFilter) ||
    !isAllStudySrsFilter(effectiveSrsFilter) ||
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
    viewedLevel: effectiveViewedLevel,
    typeFilter,
    lessonLevelCounts,
    filteredItemsLength: filteredItems.length,
  });

  const { submitReview, submitLessonStart, submitResetToLessons, closeReviewSession } = useStudyReviewSubmission({
    accountId,
    queueMode,
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
        hasReliableReviewLevelAvailability={hasReliableReviewLevelAvailability}
        reviewLevelCounts={reviewLevelCounts}
        viewedLevel={effectiveViewedLevel}
        typeFilter={typeFilter}
        srsFilter={effectiveSrsFilter}
        srsStageFilter={effectiveSrsStageFilter}
        queueMode={queueMode}
        lessonLevelCounts={lessonLevelCounts}
        typeCounts={typeCounts}
        srsCounts={srsCounts}
        srsStageCounts={srsStageCounts}
        filteredItems={sortedFilteredItems}
        waitSortOrder={waitSortOrder}
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
        onSetWaitSortOrder={setWaitSortOrder}
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
        filteredItems={sortedFilteredItems}
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
