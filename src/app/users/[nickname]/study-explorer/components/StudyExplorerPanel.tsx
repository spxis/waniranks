import { useState } from "react";

import SubjectTypeFilterGroup from "../../shared/SubjectTypeFilterGroup";
import ExplorerBulkSelectionPanel from "../../shared/ExplorerBulkSelectionPanel";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import ExplorerSearchBar from "../../ExplorerSearchBar";
import {
  getSrsStageOptions,
  isAllStudyTypeFilter,
  isLessonLockedQueueItem,
  isReviewQueueItem,
  STUDY_PANEL_SRS_STATUSES,
  STUDY_PANEL_TEXT,
  STUDY_QUEUE_TYPES,
  STUDY_SRS_FILTERS,
  STUDY_SUBJECT_TYPES,
  STUDY_TYPE_FILTERS,
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
import { useStudyBulkReset } from "../lib/useStudyBulkReset";
import { badgeClass, disabledBadgeClass, groupStudyReviewLevelChips } from "../lib/studyExplorerUtils";

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
  recentOnly: boolean;
  showLocked: boolean;
  waitSortOrder: StudyWaitSortOrder;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onSetViewedLevel: (level: number | null) => void;
  onSetTypeFilter: (filter: StudyTypeFilter) => void;
  onSetSrsFilter: (filter: StudySrsFilter) => void;
  onSetSrsStageFilter: (filter: StudySrsStageFilter | null) => void;
  onToggleShowEnglish: () => void;
  onToggleShowLocked: () => void;
  onToggleRecentOnly: () => void;
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
  recentOnly,
  showLocked,
  waitSortOrder,
  sentinelRef,
  onSetViewedLevel,
  onSetTypeFilter,
  onSetSrsFilter,
  onSetSrsStageFilter,
  onToggleShowEnglish,
  onToggleShowLocked,
  onToggleRecentOnly,
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
  const filtersLoading = !hasData;
  const showLoadingIndicator = (isLoading || isValidating || !hasData) && filteredItems.length === 0 && !errorMessage;
  const showTypeCountPlaceholders = !hasData && typeCounts.all === 0 && filteredItems.length === 0 && !errorMessage;
  const showFilterPagingState = queueMode === STUDY_QUEUE_TYPES.lesson && viewedLevel !== null && hasMorePages && filteredItems.length === 0;
  const showLoadingOverlay = (showLoadingIndicator || showFilterPagingState) && filteredItems.length === 0;
  const displayErrorMessage = errorMessage === "Failed to fetch" ? STUDY_PANEL_TEXT.queueRefreshError : errorMessage;
  const srsStageOptions = getSrsStageOptions(srsFilter);
  const hasSrsStageOptions = srsStageOptions.length > 0;
  const allSrsStagesSelected = srsStageFilter === null || !hasSrsStageOptions;
  const lessonLevelOptions = Object.entries(lessonLevelCounts)
    .map(([level, count]) => [Number(level), count] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0] - b[0]);
  const totalReviewsInVisibleLevels = Object.values(reviewLevelCounts).reduce((sum, count) => sum + count, 0);
  const totalLessonsInVisibleLevels = lessonLevelOptions.reduce((sum, [, count]) => sum + count, 0);
  const allTypeCount = queueMode === STUDY_QUEUE_TYPES.lesson ? (viewedLevel === null ? totalItems : (lessonLevelCounts[viewedLevel] ?? typeCounts.all)) : typeCounts.all;
  const reviewLevelChips = groupStudyReviewLevelChips(levelOptions, availableLevels, viewedLevel, hasData && !hasMorePages);

  return (
    <>
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">{STUDY_PANEL_TEXT.heading}</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">{STUDY_PANEL_TEXT.subtitle}</p>
          </div>
          <div className="w-full lg:max-w-[38rem]"><ExplorerSearchBar scope={STUDY_PANEL_TEXT.searchScope} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {queueMode === STUDY_QUEUE_TYPES.lesson ? (
            <>
              <button
                type="button"
                onClick={() => onSetViewedLevel(null)}
                disabled={filtersLoading}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${filtersLoading && viewedLevel !== null ? disabledBadgeClass() : badgeClass(viewedLevel === null)}`}
              >
                {STUDY_PANEL_TEXT.allLevelsLabel} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(totalLessonsInVisibleLevels)})</span>
              </button>
              {lessonLevelOptions.map(([level, count]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSetViewedLevel(level)}
                  disabled={filtersLoading}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${filtersLoading && viewedLevel !== level ? disabledBadgeClass() : badgeClass(viewedLevel === level)}`}
                >
                  L{level} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(count)})</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSetViewedLevel(null)}
                disabled={filtersLoading}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${filtersLoading && viewedLevel !== null ? disabledBadgeClass() : badgeClass(viewedLevel === null)}`}
              >
                {STUDY_PANEL_TEXT.allLevelsLabel} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(totalReviewsInVisibleLevels)})</span>
              </button>
              {reviewLevelChips.map((chip) => {
                if (chip.kind === "range") {
                  return (
                    <button
                      key={`range-${chip.startLevel}-${chip.endLevel}`}
                      type="button"
                      disabled
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${disabledBadgeClass()}`}
                    >
                      {chip.startLevel === chip.endLevel ? `L${chip.startLevel}` : `L${chip.startLevel}-L${chip.endLevel}`}
                    </button>
                  );
                }
                const isSelected = viewedLevel === chip.level;
                const disabled = filtersLoading && !isSelected;
                const levelCount = reviewLevelCounts[chip.level] ?? 0;
                return (
                  <button
                    key={chip.level}
                    type="button"
                    onClick={() => onSetViewedLevel(chip.level)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${disabled && !isSelected ? disabledBadgeClass() : badgeClass(isSelected)}`}
                  >
                    L{chip.level} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(levelCount)})</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <SubjectTypeFilterGroup
            counts={typeCounts}
            allLabel={viewedLevel === null ? STUDY_PANEL_TEXT.allLevelsLabel : `All L${viewedLevel}`}
            allCount={allTypeCount}
            allActive={isAllStudyTypeFilter(typeFilter)}
            activeTypes={{
              radical: isAllStudyTypeFilter(typeFilter) || typeFilter === STUDY_SUBJECT_TYPES.radical,
              kanji: isAllStudyTypeFilter(typeFilter) || typeFilter === STUDY_SUBJECT_TYPES.kanji,
              vocabulary: isAllStudyTypeFilter(typeFilter) || typeFilter === STUDY_SUBJECT_TYPES.vocabulary,
            }}
            showPlaceholderCounts={showTypeCountPlaceholders}
            disabled={filtersLoading}
            onClickAll={() => onSetTypeFilter(STUDY_TYPE_FILTERS.all)}
            onClickType={(type) => onSetTypeFilter(type)}
          />

          {queueMode !== STUDY_QUEUE_TYPES.lesson ? (
            <div className="ml-auto grid gap-2 justify-items-end">
              <div className="flex flex-wrap justify-end gap-2">
                {STUDY_PANEL_SRS_STATUSES.map((status) => {
                  const count = srsCounts[status];
                  const isSelected = srsFilter === status;
                  const unavailable = hasData && !isSelected && status !== STUDY_SRS_FILTERS.all && count === 0;
                  const disabled = (filtersLoading && !isSelected) || unavailable;
                  const statusLabel = status === STUDY_SRS_FILTERS.all && viewedLevel !== null ? `All L${viewedLevel}` : srsFilterButtonLabel(status);

                  return (
                    <button key={status} type="button" onClick={() => onSetSrsFilter(status)} disabled={disabled} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${disabled && !isSelected ? disabledBadgeClass() : badgeClass(isSelected)}`}>
                      {statusLabel} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(count)})</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSetSrsStageFilter(null)}
                  disabled={filtersLoading}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${filtersLoading && !allSrsStagesSelected ? disabledBadgeClass() : badgeClass(allSrsStagesSelected)}`}
                >
                  {viewedLevel === null ? "All SRS" : `All L${viewedLevel} SRS`}
                </button>
                {srsStageOptions.map((stage) => {
                  const count = srsStageCounts[stage] ?? 0;
                  const isSelected = srsStageFilter === stage;
                  const unavailable = hasData && !isSelected && count === 0;
                  const disabled = (filtersLoading && !isSelected) || unavailable;

                  return (
                    <button key={stage} type="button" onClick={() => onSetSrsStageFilter(stage)} disabled={disabled} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${disabled && !isSelected ? disabledBadgeClass() : badgeClass(isSelected)}`}>
                      SRS {stage} <span className="ml-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(count)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {showLoadingOverlay ? (
            <p aria-hidden="true" className="text-xs font-semibold uppercase tracking-[0.08em] opacity-0 select-none">
              Loading
            </p>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
              Showing {formatNumber(filteredItems.length)} matching items · {formatNumber(totalItems)} total in queue
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => onSetWaitSortOrder("oldest_wait")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(waitSortOrder === "oldest_wait")}`}>Oldest Wait</button>
            <button type="button" onClick={() => onSetWaitSortOrder("newest_wait")} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(waitSortOrder === "newest_wait")}`}>Newest Wait</button>
            <button
              type="button"
              onClick={onToggleShowEnglish}
              disabled={!canToggleEnglish}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
            </button>
            {queueMode !== STUDY_QUEUE_TYPES.lesson ? (
              <>
                <button
                  type="button"
                  onClick={onToggleShowLocked}
                  className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
                >
                  {showLocked ? "Hide Locked" : "Show Locked"}
                </button>
                <button
                  type="button"
                  onClick={onToggleRecentOnly}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(recentOnly)}`}
                >
                  Recent Only
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={toggleBulkMode}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(bulkModeEnabled)}`}
            >
              {bulkModeEnabled ? "Bulk Ops Active" : "Bulk Operations"}
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
            </div>

            {hasMorePages ? (
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
      </div>
    </>
  );
}
