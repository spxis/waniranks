import { useState } from "react";

import SubjectTypeFilterGroup from "../../shared/SubjectTypeFilterGroup";
import ExplorerBulkSelectionPanel from "../../shared/ExplorerBulkSelectionPanel";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import ExplorerSearchBar from "../../ExplorerSearchBar";
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
import type {
  StudyQueueItem,
  StudySrsFilter,
  StudyTypeFilter,
} from "../lib/studyExplorerTypes";
import { useStudyBulkReset } from "../lib/useStudyBulkReset";
import { badgeClass, disabledBadgeClass } from "../lib/studyExplorerUtils";

function StudySkeletonCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={`study-skeleton-${index}`} className="rounded-2xl border border-line bg-surface p-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-8 rounded bg-surface-muted" />
            <div className="h-6 w-24 rounded-full bg-surface-muted" />
          </div>
          <div className="mt-3 h-8 w-40 rounded bg-surface-muted" />
          <div className="mt-3 h-[9.75rem] rounded-xl border border-line/50 bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

type Props = {
  canToggleEnglish: boolean;
  showEnglish: boolean;
  studyMode: boolean;
  levelOptions: number[];
  availableLevels: Set<number>;
  viewedLevel: number | null;
  typeFilter: StudyTypeFilter;
  srsFilter: StudySrsFilter;
  queueMode: "review" | "lesson";
  lessonLevelCounts: Record<number, number>;
  typeCounts: { all: number; radical: number; kanji: number; vocabulary: number };
  srsCounts: {
    all: number;
    locked: number;
    apprentice: number;
    guru: number;
    master: number;
    enlightened: number;
  };
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
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onSetViewedLevel: (level: number | null) => void;
  onSetTypeFilter: (filter: StudyTypeFilter) => void;
  onSetSrsFilter: (filter: StudySrsFilter) => void;
  onToggleShowEnglish: () => void;
  onToggleShowLocked: () => void;
  onToggleRecentOnly: () => void;
  onSelectSubject: (subjectId: number) => void;
  onClearAllFilters: () => void;
};

export default function StudyExplorerPanel({
  canToggleEnglish,
  showEnglish,
  studyMode,
  levelOptions,
  availableLevels,
  viewedLevel,
  typeFilter,
  srsFilter,
  queueMode,
  lessonLevelCounts,
  typeCounts,
  srsCounts,
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
  sentinelRef,
  onSetViewedLevel,
  onSetTypeFilter,
  onSetSrsFilter,
  onToggleShowEnglish,
  onToggleShowLocked,
  onToggleRecentOnly,
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

  const showLoadingIndicator = (isLoading || isValidating || !hasData) && filteredItems.length === 0 && !errorMessage;
  const showFilterPagingState =
    queueMode === "lesson" && viewedLevel !== null && hasMorePages && filteredItems.length === 0;
  const srsStatuses =
    queueMode === "lesson"
      ? ([] as const)
      : (["all", "apprentice", "guru", "master", "enlightened"] as const);
  const lessonLevelOptions = Object.entries(lessonLevelCounts)
    .map(([level, count]) => [Number(level), count] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0] - b[0]);
  const totalLessonsInVisibleLevels = lessonLevelOptions.reduce((sum, [, count]) => sum + count, 0);
  const allTypeCount =
    queueMode === "lesson"
      ? viewedLevel === null
        ? totalItems
        : (lessonLevelCounts[viewedLevel] ?? typeCounts.all)
      : typeCounts.all;

  return (
    <>
      <header className="border-b border-line bg-surface-muted px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground">Study</h2>
            <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">Reviews due now and pending lessons across all levels</p>
          </div>
          <div className="w-full lg:max-w-[38rem]"><ExplorerSearchBar scope="study" /></div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {queueMode === "lesson" ? (
            <>
              <button type="button" onClick={() => onSetViewedLevel(null)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(viewedLevel === null)}`}>
                All Levels ({formatNumber(totalLessonsInVisibleLevels)})
              </button>
              {lessonLevelOptions.map(([level, count]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSetViewedLevel(level)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(viewedLevel === level)}`}
                >
                  L{level} ({formatNumber(count)})
                </button>
              ))}
            </>
          ) : (
            <>
              <button type="button" onClick={() => onSetViewedLevel(null)} className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(viewedLevel === null)}`}>
                All Levels
              </button>
              {levelOptions.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSetViewedLevel(level)}
                  disabled={!availableLevels.has(level)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${!availableLevels.has(level) ? disabledBadgeClass() : badgeClass(viewedLevel === level)}`}
                >
                  L{level}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <SubjectTypeFilterGroup
            counts={typeCounts}
            allLabel={viewedLevel === null ? "All Levels" : `All L${viewedLevel}`}
            allCount={allTypeCount}
            allActive={typeFilter === "all"}
            activeTypes={{
              radical: typeFilter === "all" || typeFilter === "radical",
              kanji: typeFilter === "all" || typeFilter === "kanji",
              vocabulary: typeFilter === "all" || typeFilter === "vocabulary",
            }}
            onClickAll={() => onSetTypeFilter("all")}
            onClickType={(type) => onSetTypeFilter(type)}
          />

          {srsStatuses.length > 0 ? (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              {srsStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onSetSrsFilter(status)}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${badgeClass(srsFilter === status)}`}
                >
                  {srsFilterButtonLabel(status)} ({formatNumber(srsCounts[status])})
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {errorMessage ? <p className="px-5 py-4 text-sm text-red-700">{errorMessage}</p> : null}

      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
            Showing {formatNumber(filteredItems.length)} loaded items · {formatNumber(totalItems)} total in queue
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleShowEnglish}
              disabled={!canToggleEnglish}
              className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
            </button>
            {queueMode !== "lesson" ? (
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
            }))}
            showFullList={showAllSelectedInBar}
            onToggleFullList={() => setShowAllSelectedInBar((value) => !value)}
            onSelectVisible={() => setSelectedSubjectIds(new Set(filteredItems.map((item) => item.subjectId)))}
            onClearSelection={() => setSelectedSubjectIds(new Set())}
            onDone={toggleBulkMode}
          />
        ) : null}

        {showLoadingIndicator || showFilterPagingState ? (
          <div className="mb-3 rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/75">
            <div className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              <span>{showFilterPagingState ? "Loading selected level..." : "Loading study queue..."}</span>
            </div>
          </div>
        ) : null}

        {isLoading && !hasData ? <StudySkeletonCards /> : null}

        {filteredItems.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredItems.map((item, index) => {
                const reviewBadge = item.queueType === "review" ? formatNextReviewBadge(item.availableAt) : null;

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
                      item.queueType === "lesson" && item.status === "locked"
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
                  ? "Loading more..."
                  : loadMoreError
                    ? `Load error: ${loadMoreError}`
                    : queueMode === "lesson"
                      ? "Loading remaining lessons..."
                      : "Scroll to load more..."}
              </div>
            ) : null}
          </>
        ) : showLoadingIndicator || showFilterPagingState ? null : (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
            No study items match the current filters.{" "}
            <button
              type="button"
              onClick={onClearAllFilters}
              className="font-bold text-accent underline underline-offset-2 hover:text-accent-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}
