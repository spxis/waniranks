import { useCallback, useEffect, useRef, useState } from "react";

import { badgeClass, disabledBadgeClass, formatNumber, srsFilterButtonLabel } from "../lib/levelExplorerDisplay";
import { useLevelExplorerResetSelection } from "../lib/useLevelExplorerResetSelection";
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
    if (!selectedItem) {
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

      const key = event.key.toLowerCase();
      if (key === "e" && canToggleEnglish) {
        event.preventDefault();
        onToggleShowEnglish();
        return;
      }

      if (key === " " || event.code === "Space") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onMarkHistoryPush();
        onSetSelectedSubjectId(null);
        setPeekSubjectId(null);
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onMarkHistoryPush();
        onSetSelectedSubjectId(null);
        setPeekSubjectId(null);
        return;
      }

      const columns = Math.max(1, gridColumns);
      const delta =
        key === "l" || key === "a" || event.key === "ArrowLeft"
          ? -1
          : key === "r" || key === "d" || event.key === "ArrowRight"
            ? 1
            : key === "w" || event.key === "ArrowUp"
              ? -columns
              : key === "s" || event.key === "ArrowDown"
                ? columns
                : null;
      if (delta === null) {
        return;
      }

      const currentIndex = filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId);
      if (currentIndex < 0) {
        return;
      }

      const nextIndex = currentIndex + delta;
      if (nextIndex < 0 || nextIndex >= filteredItems.length) {
        return;
      }
      if (nextIndex === currentIndex) {
        return;
      }

      const nextItem = filteredItems[nextIndex];
      if (!nextItem) {
        return;
      }

      const currentRow = Math.floor(currentIndex / columns);
      const nextRow = Math.floor(nextIndex / columns);
      const movedToDifferentRow = currentRow !== nextRow;

      event.preventDefault();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onMarkHistoryPush();
      onSetSelectedSubjectId(nextItem.subjectId);
      setPeekSubjectId(null);

      if (movedToDifferentRow) {
        window.requestAnimationFrame(() => {
          const nextCard = document.querySelector<HTMLElement>(
            `[data-explorer-card-subject-id="${nextItem.subjectId}"]`,
          );
          if (!nextCard) {
            return;
          }

          const topOffset = 112;
          const targetTop = window.scrollY + nextCard.getBoundingClientRect().top - topOffset;
          window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filteredItems, gridColumns, onMarkHistoryPush, onSetSelectedSubjectId, selectedItem]);

  useEffect(() => {
    if (!studyMode || !selectedItem) {
      setPeekSubjectId(null);
      return;
    }

    if (peekSubjectId !== selectedItem.subjectId) {
      setPeekSubjectId(null);
    }
  }, [peekSubjectId, selectedItem, studyMode]);

  const {
    selectedSubjectIds,
    isResetting,
    resetFeedback,
    toggleSubjectSelection,
    selectSubjectIds,
    selectVisibleSubjects,
    clearSelection,
    resetSelected,
    resetSingle,
  } = useLevelExplorerResetSelection({ accountId, filteredItems, visibleItems });

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
    onSetSrsFilter("all");
    onSetJlptFilter("all");
    onSetReviewTimingFilter("all");
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
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleShowEnglish}
              disabled={!canToggleEnglish}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
            </button>
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
            {(["all", "apprentice", "guru", "master", "enlightened", "burned", "locked"] as const).map((status) => {
              const count = counts[status];
              const disabled = status !== "all" && count === 0;

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
                {(["all", "none", "n5", "n4", "n3", "n2", "n1"] as const).map((level) => {
                  const count = level === "all" ? counts.all : jlptCounts[level];
                  const disabled = level !== "all" && count === 0;
                  const isJlptLevel = level !== "all" && level !== "none";
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
                      {level === "all" ? "JLPT All" : level === "none" ? "No JLPT" : level.toUpperCase()} ({formatNumber(count)})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "Review All", counts.all],
                  ["overdue", "Overdue", reviewTimingCounts.overdue],
                  ["next1h", "Starts <= 1h", reviewTimingCounts.next1h],
                  ["next8h", "Starts <= 8h", reviewTimingCounts.next8h],
                  ["next24h", "Starts <= 24h", reviewTimingCounts.next24h],
                  ["next72h", "Starts <= 72h", reviewTimingCounts.next72h],
                ] as const).map(([timing, label, count]) => {
                  const disabled = timing !== "all" && count === 0;

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
              {reviewTimingFilter === "overdue" && overdueOutsideSelectedLevels > 0 ? (
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
          selectedSubjectIds={selectedSubjectIds}
          isResetting={isResetting}
          resetFeedback={resetFeedback}
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
          onToggleSubjectSelection={toggleSubjectSelection}
          onSelectSubjectIds={selectSubjectIds}
          onSelectVisibleSubjects={selectVisibleSubjects}
          onClearSelection={clearSelection}
          onResetSelected={resetSelected}
          onResetSingle={resetSingle}
          onJumpToRelatedSubject={onJumpToRelatedSubject}
          onJumpToKanji={onJumpToKanji}
        />
      </div>
    </section>
  );
}
