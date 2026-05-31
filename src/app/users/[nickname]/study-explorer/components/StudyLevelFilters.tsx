import { useMemo, useState } from "react";
import { formatNumber } from "../../level-explorer/lib/levelExplorerDisplay";
import { STUDY_QUEUE_TYPES } from "./StudyExplorer.constants";
import type { StudyQueueMode } from "../lib/studyExplorerTypes";
import { badgeClass, disabledBadgeClass, groupStudyReviewLevelChips, type StudyReviewLevelChip } from "../lib/studyExplorerUtils";

type Props = {
  queueMode: StudyQueueMode;
  filtersLoading: boolean;
  viewedLevel: number | null;
  levelOptions: number[];
  lessonLevelOptions: Array<readonly [number, number]>;
  availableLevels: Set<number>;
  reviewLevelCounts: Record<number, number>;
  totalLessonsInVisibleLevels: number;
  totalReviewsInVisibleLevels: number;
  mobileShowAllOptions: boolean;
  onToggleMobileShowAllOptions: () => void;
  onSetViewedLevel: (level: number | null) => void;
};

const groupedLevelBadgeClass = (active: boolean): string =>
  active
    ? "border-amber-400 bg-amber-100 text-amber-900"
    : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200";

function boundaryLevelForGroup(
  viewedLevel: number | null,
  startLevel: number,
  endLevel: number,
): number {
  if (viewedLevel === null) {
    return endLevel;
  }
  if (viewedLevel < startLevel) {
    return startLevel;
  }
  if (viewedLevel > endLevel) {
    return endLevel;
  }
  return viewedLevel;
}

export default function StudyLevelFilters({
  queueMode,
  filtersLoading,
  viewedLevel,
  levelOptions,
  lessonLevelOptions,
  availableLevels,
  reviewLevelCounts,
  totalLessonsInVisibleLevels,
  totalReviewsInVisibleLevels,
  mobileShowAllOptions,
  onToggleMobileShowAllOptions,
  onSetViewedLevel,
}: Props) {
  const activeReviewLevels = useMemo(
    () => levelOptions.filter((level) => viewedLevel === level || availableLevels.has(level)),
    [availableLevels, levelOptions, viewedLevel],
  );
  const highestActiveReviewLevel = activeReviewLevels[activeReviewLevels.length - 1] ?? levelOptions[levelOptions.length - 1] ?? 1;
  const recentStartLevel = Math.max(1, highestActiveReviewLevel - 9);
  const [olderLevelsExpanded, setOlderLevelsExpanded] = useState(
    () => viewedLevel !== null && viewedLevel < recentStartLevel,
  );

  const reviewLevelChips = useMemo(
    () => groupStudyReviewLevelChips(levelOptions, availableLevels, viewedLevel, true, recentStartLevel, olderLevelsExpanded),
    [availableLevels, levelOptions, olderLevelsExpanded, recentStartLevel, viewedLevel],
  );

  const selectLevel = (level: number | null) => {
    if (level === null) {
      setOlderLevelsExpanded(false);
      onSetViewedLevel(null);
      return;
    }

    setOlderLevelsExpanded(level < recentStartLevel);
    onSetViewedLevel(level);
  };

  const countForChip = (chip: StudyReviewLevelChip): number => {
    if (chip.kind === "single") {
      return reviewLevelCounts[chip.level] ?? 0;
    }
    let total = 0;
    for (let level = chip.startLevel; level <= chip.endLevel; level += 1) {
      total += reviewLevelCounts[level] ?? 0;
    }
    return total;
  };

  const mobileVisibilityClass = (selected: boolean) =>
    mobileShowAllOptions || selected ? "" : "hidden sm:inline-flex";
  const isCollapsedOnMobile = !mobileShowAllOptions;

  return (
    <div className="flex w-full max-w-full items-start gap-1 rounded-xl border border-line bg-surface px-1.5 py-1" role="tablist" aria-label="Level filters">
      <button
        type="button"
        onClick={onToggleMobileShowAllOptions}
        aria-pressed={!mobileShowAllOptions}
        className="inline-flex h-7 items-center px-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/70"
        title={mobileShowAllOptions ? "Compact Level" : "Expand Level"}
      >
        Level
        <span className={`ml-1 text-[11px] leading-none ${isCollapsedOnMobile ? "opacity-70" : "opacity-0"}`}>+</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => selectLevel(null)}
          disabled={filtersLoading}
          role="tab"
          aria-selected={viewedLevel === null}
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileVisibilityClass(viewedLevel === null)} ${filtersLoading && viewedLevel !== null ? disabledBadgeClass() : badgeClass(viewedLevel === null)}`}
        >
          All <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(queueMode === STUDY_QUEUE_TYPES.lesson ? totalLessonsInVisibleLevels : totalReviewsInVisibleLevels)})</span>
        </button>
        {queueMode === STUDY_QUEUE_TYPES.lesson
          ? lessonLevelOptions.map(([level, count]) => (
              <button
                key={level}
                type="button"
                onClick={() => selectLevel(level)}
                disabled={filtersLoading}
                role="tab"
                aria-selected={viewedLevel === level}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileVisibilityClass(viewedLevel === level)} ${filtersLoading && viewedLevel !== level ? disabledBadgeClass() : badgeClass(viewedLevel === level)}`}
              >
                {level} <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(count)})</span>
              </button>
            ))
          : reviewLevelChips.map((chip) => {
              if (chip.kind === "range") {
                const isOlderGroupChip = chip.group === "older";
                const isRecentGroupChip = chip.group === "recent";
                const isGroupedChip = isOlderGroupChip || isRecentGroupChip;
                const viewedLevelInsideChip =
                  viewedLevel !== null && viewedLevel >= chip.startLevel && viewedLevel <= chip.endLevel;
                const groupedChipSelected = isGroupedChip && viewedLevelInsideChip;
                const count = countForChip(chip);
                return (
                  <button
                    key={`range-${chip.startLevel}-${chip.endLevel}-${chip.group ?? "disabled"}`}
                    type="button"
                    onClick={
                      isOlderGroupChip
                        ? () => {
                            setOlderLevelsExpanded(true);
                            onSetViewedLevel(boundaryLevelForGroup(viewedLevel, chip.startLevel, chip.endLevel));
                          }
                        : isRecentGroupChip
                          ? () => {
                              setOlderLevelsExpanded(false);
                              onSetViewedLevel(boundaryLevelForGroup(viewedLevel, chip.startLevel, chip.endLevel));
                            }
                          : undefined
                    }
                    disabled={!isGroupedChip || filtersLoading}
                    role="tab"
                    aria-selected={groupedChipSelected}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${
                      mobileVisibilityClass(groupedChipSelected)
                    } ${
                      !isGroupedChip || filtersLoading
                        ? disabledBadgeClass()
                        : groupedLevelBadgeClass(groupedChipSelected)
                    }`}
                  >
                    {chip.startLevel === chip.endLevel ? chip.startLevel : `${chip.startLevel}-${chip.endLevel}`}
                    {isGroupedChip ? (
                      <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70"> ({formatNumber(count)})</span>
                    ) : null}
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
                  onClick={() => selectLevel(chip.level)}
                  disabled={disabled}
                  role="tab"
                  aria-selected={isSelected}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] whitespace-nowrap ${mobileVisibilityClass(isSelected)} ${disabled && !isSelected ? disabledBadgeClass() : badgeClass(isSelected)}`}
                >
                  {chip.level} <span className="ml-0 -mr-px align-baseline text-[10px] font-semibold tracking-normal opacity-70">({formatNumber(levelCount)})</span>
                </button>
              );
            })}
        {isCollapsedOnMobile ? (
          <button
            type="button"
            onClick={onToggleMobileShowAllOptions}
            aria-label="Expand level filters"
            className="ml-auto inline-flex h-7 items-center px-1 text-[12px] font-semibold tracking-[0.2em] text-foreground/35 sm:hidden"
          >
            ...
          </button>
        ) : null}
      </div>
    </div>
  );
}
