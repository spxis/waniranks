import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import type { LevelItem } from "../../explorerTypes";
import {
  ReadingWithPronunciation,
  badgeClass,
  disabledBadgeClass,
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  isNewGlyphWithinHours,
  statusClass,
  statusShortLabel,
  shortSubjectTypeLabel,
  srsFilterButtonLabel,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../lib/levelExplorerDisplay";
import SubjectTypeFilterGroup from "../../shared/SubjectTypeFilterGroup";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import ExplorerSearchBar from "../../ExplorerSearchBar";
import LevelExplorerDetailSection from "./LevelExplorerDetailSection";
import type { LevelExplorerContentProps as Props } from "./LevelExplorerContent.types";

function lockedCardStateClass(item: LevelItem): string {
  if (item.status !== "locked" && item.srsStage > 0) {
    return "";
  }

  return "bg-surface-muted/90 text-foreground/60";
}

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
                {(["all", "n5", "n4", "n3", "n2", "n1"] as const).map((level) => {
                  const count = level === "all" ? counts.kanji : jlptCounts[level];
                  const disabled = level !== "all" && count === 0;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onSetJlptFilter(level)}
                      disabled={disabled}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                        disabled ? disabledBadgeClass() : badgeClass(jlptFilter === level)
                      }`}
                    >
                      {level === "all" ? "JLPT All" : level.toUpperCase()} ({formatNumber(count)})
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
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            No items match the current filters. {" "}
            <button
              type="button"
              onClick={clearAllFilters}
              className="font-bold text-accent underline underline-offset-2 hover:text-accent-2"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
              Showing {formatNumber(visibleItems.length)} of {formatNumber(filteredItems.length)} items
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSetRecentOnly(!recentOnly)}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(recentOnly)}`}
              >
                Recent Only
              </button>
              <button
                type="button"
                onClick={() => onSetShowLocked(!showLocked)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition hover:bg-surface-muted"
              >
                {showLocked ? "Hide Locked" : "Show Locked"}
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item, index) => (
              <Fragment key={`${item.subjectType}-${item.subjectId}`}>
                <UnifiedExplorerCard
                  onClick={() => {
                    onMarkHistoryPush();
                    onSetSelectedSubjectId((prev) => (prev === item.subjectId ? null : item.subjectId));
                    setPeekSubjectId(null);
                  }}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    selectedItem?.subjectId === item.subjectId,
                  )} ${lockedCardStateClass(item)}`}
                  indexLabel={`#${formatNumber(index + 1)}`}
                  topRight={
                    <>
                      <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                      {typeof item.wkLevel === "number" ? (
                        <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span>
                      ) : typeof selectedLevelList[selectedLevelList.length - 1] === "number" ? (
                        <span className="subject-pill border-line bg-surface text-foreground">L{selectedLevelList[selectedLevelList.length - 1]}</span>
                      ) : null}
                      {item.subjectType === "kanji" && item.jlptLevel ? (
                        <span className="subject-pill border-line bg-surface text-foreground">N{item.jlptLevel}</span>
                      ) : null}
                      {isNewGlyphWithinHours(item) ? (
                        <span className="subject-pill border-emerald-300 bg-emerald-100 text-emerald-800">NEW</span>
                      ) : null}
                    </>
                  }
                  glyphClassName={`${typeGlyphBoxClass(item.subjectType)} ${item.status === "locked" || item.srsStage <= 0 ? "opacity-60" : ""}`}
                  glyphText={item.characters}
                  glyphTextClassName={`${glyphTextSizeClass(item.characters)} whitespace-nowrap`}
                  glyphSubtitle={
                      studyMode
                        ? <span className="text-foreground/45">...</span>
                        : item.subjectType === "kanji"
                          ? (showEnglish ? titleForDisplay(item, true) : (glyphSubtitleForDisplay(item) ?? ""))
                          : (() => {
                              const subtitle = glyphSubtitleForDisplay(item);
                              if (!subtitle) {
                                return null;
                              }
                              return <ReadingWithPronunciation reading={subtitle} />;
                            })()
                  }
                  statusChip={
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>
                      {statusShortLabel(item.status)}
                    </span>
                  }
                  middleChip={
                    item.status !== "burned"
                      ? (() => {
                          const nextReviewBadge = formatNextReviewBadge(item.availableAt);
                          if (!nextReviewBadge) {
                            return undefined;
                          }
                          return (
                            <span
                              className={`rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.03em] whitespace-nowrap ${nextReviewBadge.className}`}
                            >
                              {nextReviewBadge.label}
                            </span>
                          );
                        })()
                      : undefined
                  }
                  rightChip={
                    <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      SRS {item.srsStage}
                    </span>
                  }
                />

                {selectedItem && index === visibleDetailInsertIndex ? (
                  <LevelExplorerDetailSection
                    accountId={accountId}
                    selectedItem={selectedItem}
                    showEnglish={showEnglish}
                    studyMode={studyMode}
                    revealStudyReading={isPeekRevealed}
                    onTogglePeek={
                      studyMode
                        ? () => {
                            setPeekSubjectId((prev) => (prev === selectedItem.subjectId ? null : selectedItem.subjectId));
                          }
                        : null
                    }
                    selectedMeaningExplanation={selectedMeaningExplanation}
                    selectedReadingExplanationRaw={selectedReadingExplanationRaw}
                    showReadingExplanation={showReadingExplanation}
                    hasPrimaryRelatedPanel={hasPrimaryRelatedPanel}
                    hasVisuallySimilarPanel={hasVisuallySimilarPanel}
                    hasUsedInVocabularyPanel={hasUsedInVocabularyPanel}
                    vocabularyKanjiLinks={vocabularyKanjiLinks}
                    subjectById={subjectById}
                    onJumpToRelatedSubject={onJumpToRelatedSubject}
                    onJumpToKanji={onJumpToKanji}
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
          {visibleItems.length < filteredItems.length ? (
            <div ref={sentinelRef} className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
              Loading more...
            </div>
          ) : null}
          </>
        )}
      </div>
    </section>
  );
}
