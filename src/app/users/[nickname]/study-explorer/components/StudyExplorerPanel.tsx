import { useEffect, useState } from "react";
import ExplorerBulkSelectionPanel from "../../shared/ExplorerBulkSelectionPanel";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import ExplorerSearchBar from "../../ExplorerSearchBar";
import StudyFilterSection from "./StudyFilterSection";
import StudyLevelFilters from "./StudyLevelFilters";
import {
  getSrsStageOptions,
  isAllStudyTypeFilter,
  isLessonLockedQueueItem,
  isReviewQueueItem,
  STUDY_PANEL_SRS_STATUSES,
  STUDY_PANEL_TEXT,
  STUDY_QUEUE_TYPES,
  STUDY_GROUPING_FILTERS,
  STUDY_SRS_FILTERS,
  STUDY_TYPE_FILTERS,
  studyGroupingToneClass,
  studySrsToneClass,
} from "./StudyExplorer.constants";
import {
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  jlptLevelPillClass,
  shortSubjectTypeLabel,
  srsFilterButtonLabel,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";
import type { StudyQueueItem, StudyQueueMode, StudySrsFilter, StudySrsStageFilter, StudyTypeFilter, StudyWaitSortOrder } from "../lib/studyExplorerTypes";
import { useStudyMobileFilterSections } from "./useStudyMobileFilterSections";
import { useStudyBulkReset } from "../lib/useStudyBulkReset";
import { badgeClass, disabledBadgeClass } from "../lib/studyExplorerUtils";

type Props = {
  canToggleEnglish: boolean;
  showEnglish: boolean;
  studyMode: boolean;
  levelOptions: number[];
  availableLevels: Set<number>;
  reviewLevelCounts: Record<number, number>;
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  srsFilter: StudySrsFilter;
  srsStageFilter: StudySrsStageFilter | null;
  queueMode: StudyQueueMode;
  lessonLevelCounts: Record<number, number>;
  typeCounts: { all: number; radical: number; kanji: number; vocabulary: number };
  srsCounts: { all: number; locked: number; apprentice: number; guru: number; master: number; enlightened: number; burned: number };
  srsStageCounts: Record<number, number>;
  filteredItems: StudyQueueItem[];
  totalItems: number;
  hasMorePages: boolean;
  isLoadingMore: boolean;
  loadMoreError: string | null;
  isLoading: boolean;
  isValidating: boolean;
  hasData: boolean;
  isUnauthorized: boolean;
  errorMessage: string | null;
  showLocked: boolean;
  waitSortOrder: StudyWaitSortOrder;
  gridColumns: number;
  cacheFooterText: string;
  cacheFooterTitle: string;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onSetViewedLevel: (level: number | null) => void;
  onSetTypeFilter: (filter: StudyTypeFilter) => void;
  onSetSrsFilter: (filter: StudySrsFilter) => void;
  onSetSrsStageFilter: (filter: StudySrsStageFilter | null) => void;
  onToggleShowEnglish: () => void;
  onToggleShowLocked: () => void;
  onSetWaitSortOrder: (sortOrder: StudyWaitSortOrder) => void;
  onSelectSubject: (subjectId: number) => void;
  onClearAllFilters: () => void;
};
export default function StudyExplorerPanel({
  canToggleEnglish,
  showEnglish,
  studyMode,
  levelOptions,
  availableLevels,
  reviewLevelCounts,
  viewedLevel,
  typeFilter,
  srsFilter,
  srsStageFilter,
  queueMode,
  lessonLevelCounts,
  typeCounts,
  srsCounts,
  srsStageCounts,
  filteredItems,
  totalItems,
  hasMorePages,
  isLoadingMore,
  loadMoreError,
  isLoading,
  isValidating,
  hasData,
  isUnauthorized,
  errorMessage,
  showLocked,
  waitSortOrder,
  gridColumns,
  cacheFooterText,
  cacheFooterTitle,
  sentinelRef,
  onSetViewedLevel,
  onSetTypeFilter,
  onSetSrsFilter,
  onSetSrsStageFilter,
  onToggleShowEnglish,
  onToggleShowLocked,
  onSetWaitSortOrder,
  onSelectSubject,
  onClearAllFilters,
}: Props) {
  const {
    bulkModeEnabled,
    selectedSubjectIds,
    selectedItems,
    selectedPreview,
    applyBulkSelection,
    toggleBulkMode,
    setSelectedSubjectIds,
  } = useStudyBulkReset({ filteredItems });
  const [showAllSelectedInBar, setShowAllSelectedInBar] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      return window.localStorage.getItem("wr:study:mobile-filters-open") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem("wr:study:mobile-filters-open", mobileFiltersOpen ? "1" : "0");
    } catch {
      // Ignore storage access errors in restricted modes.
    }
  }, [mobileFiltersOpen]);
  const { sectionsOpen: mobileFilterSectionsOpen, toggleSection: toggleMobileFilterSection, setSectionOpen: setMobileFilterSectionOpen } = useStudyMobileFilterSections();

  const filtersLoading = !hasData;
  const showLoadingIndicator = (isLoading || isValidating || !hasData) && filteredItems.length === 0 && !errorMessage;
  const showTypeCountPlaceholders = !hasData && typeCounts.all === 0 && filteredItems.length === 0 && !errorMessage;
  const displayErrorMessage = errorMessage === "Failed to fetch" ? STUDY_PANEL_TEXT.queueRefreshError : errorMessage;
  const lessonLevelOptions = Object.entries(lessonLevelCounts)
    .map(([level, count]) => [Number(level), count] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0] - b[0]);
  const totalReviewsInVisibleLevels = Object.values(reviewLevelCounts).reduce((sum, count) => sum + count, 0);
  const totalLessonsInVisibleLevels = lessonLevelOptions.reduce((sum, [, count]) => sum + count, 0);
  const allTypeCount = queueMode === STUDY_QUEUE_TYPES.lesson ? (viewedLevel === null ? totalItems : (lessonLevelCounts[viewedLevel] ?? typeCounts.all)) : typeCounts.all;
  const hasMoreMatchingItems = hasMorePages && filteredItems.length < allTypeCount;
  const showFilterPagingState = queueMode === STUDY_QUEUE_TYPES.lesson && viewedLevel !== null && hasMoreMatchingItems && filteredItems.length === 0;
  const hideControlsDuringInitialLoad = (showLoadingIndicator || showFilterPagingState) && filteredItems.length === 0;
  const showLoadingOverlay = hideControlsDuringInitialLoad;
  const loadingFillCount = hasMoreMatchingItems && isLoadingMore && gridColumns > 1
    ? (gridColumns - (filteredItems.length % gridColumns)) % gridColumns
    : 0;
  const allTypesSelected = isAllStudyTypeFilter(typeFilter);
  const groupingCountLabel = (count: number) => showTypeCountPlaceholders ? "-" : formatNumber(count);
  const mobileFilterSectionClass = hideControlsDuringInitialLoad
    ? "hidden"
    : mobileFiltersOpen
      ? "block"
      : "hidden sm:block";
  return (
    <>
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-foreground">{STUDY_PANEL_TEXT.heading}</h2>
            <p className="hidden text-xs uppercase tracking-[0.08em] text-foreground/70 sm:block">{STUDY_PANEL_TEXT.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-expanded={mobileFiltersOpen}
            aria-controls="study-filters-panel"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold uppercase leading-none tracking-[0.08em] text-foreground sm:hidden"
          >
            {mobileFiltersOpen ? STUDY_PANEL_TEXT.hideFilters : STUDY_PANEL_TEXT.showFilters}
          </button>
        </div>
        <div id="study-filters-panel" className={`mt-3 space-y-2 ${mobileFilterSectionClass}`}>
          <div className="w-full lg:max-w-[38rem]"><ExplorerSearchBar scope={STUDY_PANEL_TEXT.searchScope} /></div>
          <StudyLevelFilters
            queueMode={queueMode}
            filtersLoading={filtersLoading}
            viewedLevel={viewedLevel}
            levelOptions={levelOptions}
            lessonLevelOptions={lessonLevelOptions}
            availableLevels={availableLevels}
            reviewLevelCounts={reviewLevelCounts}
            totalLessonsInVisibleLevels={totalLessonsInVisibleLevels}
            totalReviewsInVisibleLevels={totalReviewsInVisibleLevels}
            mobileShowAllOptions={mobileFilterSectionsOpen.level}
            onToggleMobileShowAllOptions={() => toggleMobileFilterSection("level")}
            onSetViewedLevel={(level) => { setMobileFilterSectionOpen("level", false); onSetViewedLevel(level); }}
          />
          <StudyFilterSection
            title="Grouping"
            isOpen={mobileFilterSectionsOpen.grouping}
            onToggle={() => toggleMobileFilterSection("grouping")}
            ariaLabel="Grouping filters"
          >
              <button
                type="button"
                onClick={() => { setMobileFilterSectionOpen("grouping", false); onSetTypeFilter(STUDY_TYPE_FILTERS.all); }}
                disabled={filtersLoading}
                role="tab"
                aria-selected={allTypesSelected}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileFilterSectionsOpen.grouping || allTypesSelected ? "" : "hidden sm:inline-flex"} ${filtersLoading && !allTypesSelected ? disabledBadgeClass() : badgeClass(allTypesSelected)}`}
              >
                All <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({groupingCountLabel(allTypeCount)})</span>
              </button>
              {STUDY_GROUPING_FILTERS.map(([type, label]) => {
                const count = typeCounts[type];
                const isSelected = allTypesSelected || typeFilter === type;
                const unavailable = hasData && !isSelected && count === 0;
                const disabled = (filtersLoading && !isSelected) || unavailable;
                if (unavailable) {
                  return null;
                }
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setMobileFilterSectionOpen("grouping", false); onSetTypeFilter(type); }}
                    disabled={disabled}
                    role="tab"
                    aria-selected={isSelected}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileFilterSectionsOpen.grouping || typeFilter === type ? "" : "hidden sm:inline-flex"} ${disabled && !isSelected ? disabledBadgeClass() : studyGroupingToneClass(type, isSelected)}`}
                  >
                    {label} <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({groupingCountLabel(count)})</span>
                  </button>
                );
              })}
          </StudyFilterSection>
          {queueMode !== STUDY_QUEUE_TYPES.lesson ? (
            <StudyFilterSection
              title="Status"
              isOpen={mobileFilterSectionsOpen.status}
              onToggle={() => toggleMobileFilterSection("status")}
              ariaLabel="Status filters"
            >
                {STUDY_PANEL_SRS_STATUSES.map((status) => {
                  const count = srsCounts[status];
                  const isSelected = srsFilter === status;
                  const hiddenInCompactMode = !mobileFilterSectionsOpen.status && !isSelected;
                  const unavailable = hasData && !isSelected && status !== STUDY_SRS_FILTERS.all && count === 0;
                  const disabled = (filtersLoading && !isSelected) || unavailable;
                  const statusLabel = status === STUDY_SRS_FILTERS.all ? "All" : srsFilterButtonLabel(status);
                  const stageOptions = status === STUDY_SRS_FILTERS.all ? [] : getSrsStageOptions(status);
                  const showStageButtons = isSelected && stageOptions.length > 1;
                  const onClickStatus = () => { setMobileFilterSectionOpen("status", false); onSetSrsFilter(status); if (stageOptions.length > 1) onSetSrsStageFilter(null); };
                  if (unavailable || hiddenInCompactMode) return null;
                  return (
                    <div key={status} className="inline-flex items-center gap-1">
                      <button type="button" onClick={onClickStatus} disabled={disabled} role="tab" aria-selected={isSelected} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${disabled && !isSelected ? disabledBadgeClass() : status === STUDY_SRS_FILTERS.all ? badgeClass(isSelected) : studySrsToneClass(status, isSelected)}`}>
                        {statusLabel} <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(count)})</span>
                      </button>
                      {showStageButtons ? stageOptions.map((stage) => {
                        const stageCount = srsStageCounts[stage] ?? 0;
                        const stageSelected = srsStageFilter === stage;
                        const stageUnavailable = hasData && !stageSelected && stageCount === 0;
                        const stageDisabled = (filtersLoading && !stageSelected) || stageUnavailable;
                        if (stageUnavailable) return null;
                        return (
                          <button key={`${status}-${stage}`} type="button" onClick={() => { setMobileFilterSectionOpen("status", false); onSetSrsStageFilter(stage); }} disabled={stageDisabled} role="tab" aria-selected={stageSelected} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileFilterSectionsOpen.status || stageSelected ? "" : "hidden sm:inline-flex"} ${stageDisabled && !stageSelected ? disabledBadgeClass() : studySrsToneClass(status as Exclude<StudySrsFilter, "all">, stageSelected)}`}>
                            {stage} <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(stageCount)})</span>
                          </button>
                        );
                      }) : null}
                    </div>
                  );
                })}
            </StudyFilterSection>
          ) : null}
        </div>
      </header>
      {displayErrorMessage ? (
        <div className="px-5 pt-4">
          <div className="rounded-2xl border border-red-300/70 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
            {displayErrorMessage}
          </div>
        </div>
      ) : null}
      <div className="p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {showLoadingOverlay ? (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
              Loading study queue and filters...
            </p>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
              <span className="sm:hidden">Showing {formatNumber(filteredItems.length)}/{formatNumber(totalItems)} items</span>
              <span className="hidden sm:inline">Showing {formatNumber(filteredItems.length)} matching items · {formatNumber(totalItems)} total in queue</span>
            </p>
          )}
          <div className={`flex w-full items-center gap-1 sm:ml-auto sm:w-auto sm:gap-2 ${hideControlsDuringInitialLoad ? "hidden" : ""}`}>
              <button type="button" onClick={() => onSetWaitSortOrder("oldest_wait")} className={`flex-1 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] sm:flex-none sm:px-3 sm:text-xs sm:tracking-[0.1em] ${badgeClass(waitSortOrder === "oldest_wait")}`}><span className="sm:hidden">{STUDY_PANEL_TEXT.oldestWaitShort}</span><span className="hidden sm:inline">Oldest Wait</span></button>
              <button type="button" onClick={() => onSetWaitSortOrder("newest_wait")} className={`flex-1 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] sm:flex-none sm:px-3 sm:text-xs sm:tracking-[0.1em] ${badgeClass(waitSortOrder === "newest_wait")}`}><span className="sm:hidden">{STUDY_PANEL_TEXT.newestWaitShort}</span><span className="hidden sm:inline">Newest Wait</span></button>
              <button
                type="button"
                onClick={onToggleShowEnglish}
                disabled={!canToggleEnglish}
                className="flex-1 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-3 sm:text-xs sm:tracking-[0.1em]"
              >
                <span className="sm:hidden">{STUDY_PANEL_TEXT.englishShort}</span>
                <span className="hidden sm:inline">{canToggleEnglish ? (showEnglish ? STUDY_PANEL_TEXT.hideEnglish : STUDY_PANEL_TEXT.showEnglish) : STUDY_PANEL_TEXT.hintsHidden}</span>
              </button>
              {queueMode !== STUDY_QUEUE_TYPES.lesson ? (
                <button
                  type="button"
                  onClick={onToggleShowLocked}
                  className="flex-1 whitespace-nowrap rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-foreground hover:bg-surface-muted sm:flex-none sm:px-3 sm:text-xs sm:tracking-[0.1em]"
                >
                  <span className="sm:hidden">{STUDY_PANEL_TEXT.lockedShort}</span>
                  <span className="hidden sm:inline">{showLocked ? STUDY_PANEL_TEXT.hideLocked : STUDY_PANEL_TEXT.showLocked}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={toggleBulkMode}
                className={`flex-1 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] sm:flex-none sm:px-3 sm:text-xs sm:tracking-[0.1em] ${badgeClass(bulkModeEnabled)}`}
              >
                <span className="sm:hidden">{STUDY_PANEL_TEXT.bulkShort}</span>
                <span className="hidden sm:inline">{bulkModeEnabled ? STUDY_PANEL_TEXT.bulkOpsActive : STUDY_PANEL_TEXT.bulkOperations}</span>
              </button>
          </div>
        </div>
        {bulkModeEnabled ? (
          <ExplorerBulkSelectionPanel
            selectedCount={selectedSubjectIds.size}
            preview={selectedPreview}
            rows={selectedItems.map((item) => ({
              subjectId: item.subjectId,
              characters: item.characters,
              subjectTypeLabel: shortSubjectTypeLabel(item.subjectType),
              wkLevel: typeof item.wkLevel === "number" ? item.wkLevel : null,
              srsStage: item.srsStage,
              reading: (item.primaryReadings?.[0] ?? item.readings?.[0]) || null,
              meaning: item.meanings?.[0] || null,
            }))}
            showFullList={showAllSelectedInBar}
            onToggleFullList={() => setShowAllSelectedInBar((value) => !value)}
            onSelectVisible={() => setSelectedSubjectIds(new Set(filteredItems.map((item) => item.subjectId)))}
            onClearSelection={() => setSelectedSubjectIds(new Set())}
            onDone={toggleBulkMode}
          />
        ) : null}
        <div className={`relative ${showLoadingOverlay ? "min-h-[14rem]" : ""}`}>
          {filteredItems.length > 0 ? (
            <>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))] lg:grid-cols-4">
              {filteredItems.map((item, index) => {
                const reviewBadge = isReviewQueueItem(item) ? formatNextReviewBadge(item.availableAt) : null;
                return (
                  <UnifiedExplorerCard
                    key={`${item.queueType}-${item.subjectId}`}
                    onClick={(meta) => {
                      if (!isUnauthorized) {
                        if (applyBulkSelection({
                          subjectId: item.subjectId,
                          sourceIndex: index,
                          shiftKey: Boolean(meta?.shiftKey),
                        })) {
                          return;
                        }
                        onSelectSubject(item.subjectId);
                      }
                    }}
                    className={`rounded-2xl border p-3 text-left transition ${isUnauthorized ? "cursor-not-allowed opacity-65" : "hover:brightness-95"} ${typeCardClass(item.subjectType, false)} ${selectedSubjectIds.has(item.subjectId) ? "ring-2 ring-amber-400" : ""}`}
                    indexLabel={
                      bulkModeEnabled ? (
                        <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-foreground/60">
                          <input
                            type="checkbox"
                            checked={selectedSubjectIds.has(item.subjectId)}
                            readOnly
                            onClick={(event) => {
                              applyBulkSelection({
                                subjectId: item.subjectId,
                                sourceIndex: index,
                                shiftKey: event.shiftKey,
                              });
                              event.stopPropagation();
                            }}
                            className="h-4 w-4 rounded-sm border border-line bg-surface accent-accent"
                            aria-label={`Select ${item.characters}`}
                          />
                          #{index + 1}
                        </span>
                      ) : (
                        `#${index + 1}`
                      )
                    }
                    topRight={
                      <>
                        <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                        {typeof item.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span> : null}
                        {typeof item.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{item.jlptMeta.schoolGrade}</span> : null}
                        {item.jlptLevel ? <span className={jlptLevelPillClass()}>N{item.jlptLevel}</span> : null}
                      </>
                    }
                    glyphClassName={typeGlyphBoxClass(item.subjectType)}
                    glyphText={item.characters}
                    glyphTextClassName={glyphTextSizeClass(item.characters)}
                    glyphSubtitle={
                      studyMode
                        ? <span className="text-foreground/45">...</span>
                        : showEnglish
                          ? titleForDisplay(item, true)
                          : (glyphSubtitleForDisplay(item) ?? "")
                    }
                    statusChip={
                      isLessonLockedQueueItem(item)
                        ? undefined
                        : <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${statusClass(item.status)}`}>{statusShortLabel(item.status)}</span>
                    }
                    middleChip={reviewBadge ? <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ${reviewBadge.className}`}>{reviewBadge.label}</span> : undefined}
                    rightChip={<span className="rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">SRS {item.srsStage}</span>}
                  />
                );
              })}
              {loadingFillCount > 0
                ? Array.from({ length: loadingFillCount }, (_, index) => (
                    <div
                      key={`loading-fill-${index}`}
                      aria-hidden="true"
                      className="rounded-2xl border border-line bg-surface-muted/70 p-4"
                    />
                  ))
                : null}
            </div>
            {hasMoreMatchingItems ? (
              <div ref={sentinelRef} className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">
                {isLoadingMore
                  ? STUDY_PANEL_TEXT.loadingMore
                  : loadMoreError
                    ? `${STUDY_PANEL_TEXT.genericLoadErrorPrefix} ${loadMoreError}`
                    : queueMode === STUDY_QUEUE_TYPES.lesson
                      ? STUDY_PANEL_TEXT.loadingRemainingLessons
                      : STUDY_PANEL_TEXT.scrollToLoadMore}
              </div>
            ) : null}
            </>
          ) : showLoadingOverlay ? null : (
            <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
              {STUDY_PANEL_TEXT.noMatches}{" "}
              <button
                type="button"
                onClick={onClearAllFilters}
                className="font-bold text-accent underline underline-offset-2 hover:text-accent-2"
              >
                {STUDY_PANEL_TEXT.clearFilters}
              </button>
            </div>
          )}
          <div
            aria-hidden={!showLoadingOverlay}
            className={`absolute inset-0 z-10 rounded-2xl border border-line bg-surface/70 backdrop-blur-[1px] transition-opacity duration-200 ${showLoadingOverlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div className="flex h-full items-center justify-center px-4 text-center text-base font-bold text-foreground/85">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                    <span>{showFilterPagingState ? STUDY_PANEL_TEXT.loadingSelectedLevel : STUDY_PANEL_TEXT.loadingQueue}</span>
                </span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-right text-[11px] font-medium text-foreground/55" title={cacheFooterTitle}>{cacheFooterText}</p>
      </div>
    </>
  );
}
