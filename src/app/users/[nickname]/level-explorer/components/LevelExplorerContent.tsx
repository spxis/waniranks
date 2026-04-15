import { useCallback, useEffect, useRef, useState } from "react";

import {
  badgeClass,
  disabledBadgeClass,
  formatNumber,
  srsFilterButtonLabel,
} from "../lib/levelExplorerDisplay";
import {
  LEVEL_FILTER_ALL,
  LEVEL_JLPT_FILTER_ALLOWED,
  LEVEL_JLPT_NONE,
  LEVEL_REVIEW_OVERDUE,
  LEVEL_REVIEW_TIMING_ALLOWED,
  LEVEL_SRS_FILTER_ALLOWED,
} from "../lib/levelExplorerState";
import SubjectTypeFilterGroup from "../../shared/SubjectTypeFilterGroup";
import ExplorerSearchBar from "../../ExplorerSearchBar";
import LevelExplorerItemsGrid from "./LevelExplorerItemsGrid";
import type { LevelExplorerContentProps as Props } from "./LevelExplorerContent.types";

export default function LevelExplorerContent({
  accountId,
  levelOptions,
  selectedLevels,
  searchAvailableLevels,
  visibleTypes,
  counts,
  jlptCounts,
  reviewTimingCounts,
  accountPendingReviews,
  overdueOutsideSelectedLevels,
  selectedLevelList,
  filtersCollapsed,
  srsFilter,
  jlptFilter,
  reviewTimingFilter,
  recentOnly,
  showLocked,
  showEnglish,
  canToggleEnglish,
  studyMode,
  loading,
  gridColumns,
  searchMatchedSubjectIds,
  error,
  filteredItems,
  selectedItem,
  selectedMeaningExplanation,
  selectedReadingExplanationRaw,
  showReadingExplanation,
  hasPrimaryRelatedPanel,
  hasVisuallySimilarPanel,
  hasUsedInVocabularyPanel,
  vocabularyKanjiLinks,
  subjectById,
  onSelectAllLevelsAndClearSearch,
  onToggleLevel,
  onEnableAllTypes,
  onToggleTypeVisibility,
  onSetFiltersCollapsed,
  onSetSrsFilter,
  onSetJlptFilter,
  onSetReviewTimingFilter,
  onSetRecentOnly,
  onSetShowLocked,
  onToggleShowEnglish,
  onSetSelectedSubjectId,
  onJumpToRelatedSubject,
  onJumpToKanji,
  onMarkHistoryPush,
}: Props) {
  const PAGE_SIZE = 40;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [peekSubjectId, setPeekSubjectId] = useState<number | null>(null);

  const selectedItemIndex = selectedItem
    ? filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const effectiveVisibleCount = Math.min(
    filteredItems.length,
    Math.max(PAGE_SIZE, visibleCount, selectedItemIndex + 1),
  );

  useEffect(() => {
    if (!sentinelRef.current) {
      return;
    }

    if (effectiveVisibleCount >= filteredItems.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((prev) => Math.min(filteredItems.length, prev + PAGE_SIZE));
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [effectiveVisibleCount, filteredItems.length]);

  const visibleItems = filteredItems.slice(0, effectiveVisibleCount);
  const selectedVisibleIndex = selectedItem
    ? visibleItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const isPeekRevealed = studyMode && selectedItem !== null && peekSubjectId === selectedItem.subjectId;

  useEffect(() => {
    if (!studyMode || !selectedItem) {
      setPeekSubjectId(null);
      return;
    }

    if (peekSubjectId !== selectedItem.subjectId) {
      setPeekSubjectId(null);
    }
  }, [peekSubjectId, selectedItem, studyMode]);
  const visibleDetailInsertIndex =
    selectedVisibleIndex >= 0
      ? Math.min(
          visibleItems.length - 1,
          Math.floor(selectedVisibleIndex / gridColumns) * gridColumns + (gridColumns - 1),
        )
      : -1;

  const clearAllFilters = useCallback(() => {
    void onSelectAllLevelsAndClearSearch();
    onEnableAllTypes();
    onSetSrsFilter(LEVEL_FILTER_ALL);
    onSetJlptFilter(LEVEL_FILTER_ALL);
    onSetReviewTimingFilter(LEVEL_FILTER_ALL);
    onSetRecentOnly(false);
    onSetShowLocked(false);
    onSetSelectedSubjectId(null);
  }, [
    onEnableAllTypes,
    onSelectAllLevelsAndClearSearch,
    onSetJlptFilter,
    onSetRecentOnly,
    onSetReviewTimingFilter,
    onSetShowLocked,
    onSetSelectedSubjectId,
    onSetSrsFilter,
  ]);

  return (
    <section
      id="explorer"
      className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]"
    >
      <header className="flex flex-col gap-3 border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">WaniKani Explorer</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">Select one level at a time</p>
          </div>
          <div className="w-full lg:max-w-[38rem]">
            <ExplorerSearchBar scope="level" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {levelOptions.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  void onToggleLevel(level);
                }}
                disabled={searchAvailableLevels !== null && !searchAvailableLevels.has(level)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                  selectedLevels.has(level),
                )}`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <SubjectTypeFilterGroup
            counts={counts}
            allLabel={selectedLevelList.length === 1 ? `All L${selectedLevelList[0]}` : "All"}
            allActive={visibleTypes.radical && visibleTypes.kanji && visibleTypes.vocabulary}
            activeTypes={visibleTypes}
            onClickAll={onEnableAllTypes}
            onClickType={onToggleTypeVisibility}
          />
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            {LEVEL_SRS_FILTER_ALLOWED.map((status) => {
              const count = counts[status];
              const disabled = status !== LEVEL_FILTER_ALL && count === 0;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onSetSrsFilter(status)}
                  disabled={disabled}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                    disabled ? disabledBadgeClass() : badgeClass(srsFilter === status)
                  }`}
                >
                  {srsFilterButtonLabel(status)} ({formatNumber(count)})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">JLPT mix (kanji in selected levels)</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {([
            ["N5", jlptCounts.n5],
            ["N4", jlptCounts.n4],
            ["N3", jlptCounts.n3],
            ["N2", jlptCounts.n2],
            ["N1", jlptCounts.n1],
          ] as const).map(([label, count]) => (
            <div key={label} className="rounded-xl border border-line bg-surface-muted p-2 text-center">
              <p className="text-[10px] font-bold uppercase text-foreground/70">{label}</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(count)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-line px-5 py-4">
        <section className="rounded-2xl border border-line bg-surface-muted/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">Filters</p>
            <button
              type="button"
              onClick={() => onSetFiltersCollapsed(!filtersCollapsed)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground"
              aria-expanded={!filtersCollapsed}
            >
              {filtersCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
          {!filtersCollapsed ? (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {LEVEL_JLPT_FILTER_ALLOWED.map((level) => {
                  const count = level === LEVEL_FILTER_ALL ? counts.all : jlptCounts[level];
                  const disabled = level !== LEVEL_FILTER_ALL && count === 0;
                  const isJlptLevel = level !== LEVEL_FILTER_ALL && level !== LEVEL_JLPT_NONE;
                  const active = jlptFilter === level;
                  const jlptStyle = active
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-teal-300 bg-teal-100 text-teal-800 hover:bg-teal-200";

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onSetJlptFilter(level)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                        disabled ? disabledBadgeClass() : isJlptLevel ? jlptStyle : badgeClass(active)
                      }`}
                    >
                      {level === LEVEL_FILTER_ALL ? "JLPT All" : level === LEVEL_JLPT_NONE ? "No JLPT" : level.toUpperCase()} ({formatNumber(count)})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {LEVEL_REVIEW_TIMING_ALLOWED.map((timing) => {
                  const count = timing === LEVEL_FILTER_ALL ? counts.all : reviewTimingCounts[timing];
                  const label =
                    timing === LEVEL_FILTER_ALL
                      ? "Review All"
                      : timing === LEVEL_REVIEW_OVERDUE
                        ? "Overdue"
                        : timing === "next1h"
                          ? "Starts <= 1h"
                          : timing === "next8h"
                            ? "Starts <= 8h"
                            : timing === "next24h"
                              ? "Starts <= 24h"
                              : "Starts <= 72h";
                  const disabled = timing !== LEVEL_FILTER_ALL && count === 0;

                  return (
                    <button
                      key={timing}
                      type="button"
                      onClick={() => onSetReviewTimingFilter(timing)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                        disabled ? disabledBadgeClass() : badgeClass(reviewTimingFilter === timing)
                      }`}
                    >
                      {label} ({formatNumber(count)})
                    </button>
                  );
                })}
              </div>
              {reviewTimingFilter === LEVEL_REVIEW_OVERDUE && overdueOutsideSelectedLevels > 0 ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/55">
                  Showing {formatNumber(reviewTimingCounts.overdue)} overdue in selected levels, with {formatNumber(overdueOutsideSelectedLevels)} more overdue in other levels
                  ({formatNumber(accountPendingReviews)} total pending reviews).
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {loading ? <p className="px-5 py-4 text-sm text-foreground/70">Loading level data...</p> : null}
      {searchMatchedSubjectIds ? (
        <p className="px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/70">
          Showing {formatNumber(searchMatchedSubjectIds.size)} search result{searchMatchedSubjectIds.size === 1 ? "" : "s"}
        </p>
      ) : null}
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error}</p> : null}

      <div className="p-5">
        <LevelExplorerItemsGrid
          accountId={accountId}
          filteredItems={filteredItems}
          visibleItems={visibleItems}
          selectedItem={selectedItem}
          visibleDetailInsertIndex={visibleDetailInsertIndex}
          selectedLevelList={selectedLevelList}
          studyMode={studyMode}
          showEnglish={showEnglish}
          canToggleEnglish={canToggleEnglish}
          isPeekRevealed={isPeekRevealed}
          selectedMeaningExplanation={selectedMeaningExplanation}
          selectedReadingExplanationRaw={selectedReadingExplanationRaw}
          showReadingExplanation={showReadingExplanation}
          hasPrimaryRelatedPanel={hasPrimaryRelatedPanel}
          hasVisuallySimilarPanel={hasVisuallySimilarPanel}
          hasUsedInVocabularyPanel={hasUsedInVocabularyPanel}
          vocabularyKanjiLinks={vocabularyKanjiLinks}
          subjectById={subjectById}
          recentOnly={recentOnly}
          showLocked={showLocked}
          sentinelRef={sentinelRef}
          onClearFilters={clearAllFilters}
          onSelectItem={(subjectId) => {
            onMarkHistoryPush();
            onSetSelectedSubjectId((prev) => (prev === subjectId ? null : subjectId));
            setPeekSubjectId(null);
          }}
          onTogglePeek={(subjectId) => {
            setPeekSubjectId((prev) => (prev === subjectId ? null : subjectId));
          }}
          onSetRecentOnly={onSetRecentOnly}
          onSetShowLocked={onSetShowLocked}
          onToggleShowEnglish={onToggleShowEnglish}
          onJumpToRelatedSubject={onJumpToRelatedSubject}
          onJumpToKanji={onJumpToKanji}
        />
      </div>
    </section>
  );
}
