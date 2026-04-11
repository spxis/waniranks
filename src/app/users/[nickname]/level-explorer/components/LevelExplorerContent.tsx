import { Fragment } from "react";

import type { LevelItem } from "../../explorerTypes";
import {
  ReadingWithPronunciation,
  badgeClass,
  disabledBadgeClass,
  formatNextReviewBadge,
  formatNumber,
  glyphHasReading,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  statusClass,
  subjectTypePillClass,
  titleForDisplay,
  typeBadgeClass,
  typeCardClass,
  typeGlyphBoxClass,
} from "../lib/levelExplorerDisplay";
import type { JlptFilter, ReviewTimingFilter, TypeFilter, TypeVisibility } from "../lib/levelExplorerState";
import type { SrsFilter } from "../../explorerTypes";
import type {
  LevelItemCounts,
  LevelJlptCounts,
  ReviewTimingCounts,
} from "../lib/levelExplorerSelectors";
import LevelExplorerDetailSection from "./LevelExplorerDetailSection";

type VocabularyKanjiLink = {
  char: string;
  subjectId: number;
  reading: string;
  wkLevel: number | null;
};

type Props = {
  levelOptions: number[];
  selectedLevels: Set<number>;
  searchAvailableLevels: Set<number> | null;
  stickyMerge: boolean;
  visibleTypes: TypeVisibility;
  counts: LevelItemCounts;
  jlptCounts: LevelJlptCounts;
  reviewTimingCounts: ReviewTimingCounts;
  accountPendingReviews: number;
  overdueOutsideSelectedLevels: number;
  combinedItemLength: number;
  combinedKanjiLearned: number;
  combinedKanjiLocked: number;
  selectedLevelList: number[];
  filtersCollapsed: boolean;
  srsFilter: SrsFilter;
  jlptFilter: JlptFilter;
  reviewTimingFilter: ReviewTimingFilter;
  showEnglish: boolean;
  studyMode: boolean;
  loading: boolean;
  searchMatchedSubjectIds: Set<number> | null;
  error: string;
  filteredItems: LevelItem[];
  selectedItem: LevelItem | null;
  detailInsertIndex: number;
  selectedMeaningExplanation: string;
  selectedReadingExplanationRaw: string;
  showReadingExplanation: boolean;
  hasPrimaryRelatedPanel: boolean;
  hasVisuallySimilarPanel: boolean;
  hasUsedInVocabularyPanel: boolean;
  vocabularyKanjiLinks: VocabularyKanjiLink[];
  subjectById: Map<number, LevelItem>;
  onSelectAllLevelsAndClearSearch: () => Promise<void>;
  onToggleLevel: (level: number) => Promise<void>;
  onSetStickyMerge: (next: boolean) => void;
  onEnableAllTypes: () => void;
  onToggleTypeVisibility: (type: "radical" | "kanji" | "vocabulary") => void;
  onSetFiltersCollapsed: (next: boolean) => void;
  onSetSrsFilter: (next: SrsFilter) => void;
  onSetJlptFilter: (next: JlptFilter) => void;
  onSetReviewTimingFilter: (next: ReviewTimingFilter) => void;
  onSetSelectedSubjectId: (next: number | null | ((prev: number | null) => number | null)) => void;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
  onMarkHistoryPush: () => void;
};

function lockedCardStateClass(item: LevelItem): string {
  if (item.status !== "locked" && item.srsStage > 0) {
    return "";
  }

  return "bg-surface-muted/90 text-foreground/60";
}

export default function LevelExplorerContent({
  levelOptions,
  selectedLevels,
  searchAvailableLevels,
  stickyMerge,
  visibleTypes,
  counts,
  jlptCounts,
  reviewTimingCounts,
  accountPendingReviews,
  overdueOutsideSelectedLevels,
  combinedItemLength,
  combinedKanjiLearned,
  combinedKanjiLocked,
  selectedLevelList,
  filtersCollapsed,
  srsFilter,
  jlptFilter,
  reviewTimingFilter,
  showEnglish,
  studyMode,
  loading,
  searchMatchedSubjectIds,
  error,
  filteredItems,
  selectedItem,
  detailInsertIndex,
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
  onSetStickyMerge,
  onEnableAllTypes,
  onToggleTypeVisibility,
  onSetFiltersCollapsed,
  onSetSrsFilter,
  onSetJlptFilter,
  onSetReviewTimingFilter,
  onSetSelectedSubjectId,
  onJumpToRelatedSubject,
  onJumpToKanji,
  onMarkHistoryPush,
}: Props) {
  return (
    <section
      id="explorer"
      className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]"
    >
      <header className="flex flex-col gap-3 border-b border-line bg-surface-muted px-5 py-4">
        <div>
          <h2 className="text-xl font-black text-foreground">WaniKani Explorer</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-foreground/70">Select one level at a time</p>
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEnableAllTypes}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
              visibleTypes.radical && visibleTypes.kanji && visibleTypes.vocabulary,
            )}`}
          >
            All ({formatNumber(counts.all)})
          </button>
          {([
            ["radical", counts.radical],
            ["kanji", counts.kanji],
            ["vocabulary", counts.vocabulary],
          ] as const).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => onToggleTypeVisibility(type)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${typeBadgeClass(
                type,
                visibleTypes[type],
                false,
              )}`}
            >
              {type} ({formatNumber(count)})
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Selected levels</p>
          <p className="mt-1 text-2xl font-black text-foreground">{selectedLevelList.join(", ")}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Total Items</p>
          <p className="mt-1 text-2xl font-black text-foreground">{formatNumber(combinedItemLength)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Kanji Learned</p>
          <p className="mt-1 text-2xl font-black text-accent">{formatNumber(combinedKanjiLearned)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Kanji Locked</p>
          <p className="mt-1 text-2xl font-black text-hot">{formatNumber(combinedKanjiLocked)}</p>
        </div>
      </div>

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
                      {status} ({formatNumber(count)})
                    </button>
                  );
                })}
              </div>
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
                  ["all", "Review All", combinedItemLength],
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
            No items visible. Expand one or more types above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredItems.map((item, index) => (
              <Fragment key={`${item.subjectType}-${item.subjectId}`}>
                <button
                  type="button"
                  onClick={() => {
                    onMarkHistoryPush();
                    onSetSelectedSubjectId((prev) => (prev === item.subjectId ? null : item.subjectId));
                  }}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    selectedItem?.subjectId === item.subjectId,
                  )} ${lockedCardStateClass(item)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-foreground/45">#{formatNumber(index + 1)}</span>
                      {selectedItem?.subjectId === item.subjectId ? (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent/40 bg-accent/15 text-accent"
                          title="Viewing details. Click this card to close."
                          aria-label="Viewing details"
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                            <path
                              d="M8.5 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Zm0-1.7a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Zm4.6 1.2 3.2 3.2"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                      {item.subjectType === "kanji" && item.jlptLevel ? (
                        <span className="subject-pill border-line bg-surface text-foreground">N{item.jlptLevel}</span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-xl font-black leading-tight ${
                      item.status === "locked" || item.srsStage <= 0 ? "text-foreground/60" : "text-foreground"
                    }`}
                  >
                    {studyMode
                      ? item.subjectType === "kanji"
                        ? "Kanji"
                        : item.subjectType === "radical"
                          ? "Radical"
                          : "Vocabulary"
                      : titleForDisplay(item, showEnglish)}
                  </p>
                  <div
                    className={`mt-3 rounded-xl border ${
                      glyphHasReading(item)
                        ? "flex min-h-[6rem] w-full flex-col items-center justify-center px-3 py-2"
                        : "flex min-h-[6rem] w-full items-center justify-center px-3 py-3"
                    } ${typeGlyphBoxClass(item.subjectType)} ${
                      item.status === "locked" || item.srsStage <= 0 ? "opacity-60" : ""
                    }`}
                  >
                    <p className={`${glyphTextSizeClass(item.characters)} font-black leading-none whitespace-nowrap`}>
                      {item.characters}
                    </p>
                    {!studyMode ? (() => {
                      const subtitle = glyphSubtitleForDisplay(item);
                      if (!subtitle) {
                        return null;
                      }
                      return (
                        <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/70 whitespace-nowrap">
                          <ReadingWithPronunciation reading={subtitle} />
                        </p>
                      );
                    })() : null}
                  </div>
                  <div className="mt-3 grid grid-cols-3 items-center gap-2">
                    <span
                      className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.status !== "burned" ? (
                      (() => {
                        const nextReviewBadge = formatNextReviewBadge(item.availableAt);
                        if (!nextReviewBadge) {
                          return <span />;
                        }
                        return (
                          <span
                            className={`justify-self-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.03em] ${nextReviewBadge.className}`}
                          >
                            {nextReviewBadge.label}
                          </span>
                        );
                      })()
                    ) : (
                      <span />
                    )}
                    <span className="justify-self-end rounded-full border border-line bg-surface px-2 py-1 text-xs font-bold text-foreground">
                      SRS {item.srsStage}
                    </span>
                  </div>
                </button>

                {selectedItem && index === detailInsertIndex ? (
                  <LevelExplorerDetailSection
                    selectedItem={selectedItem}
                    showEnglish={showEnglish}
                    studyMode={studyMode}
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
        )}
      </div>
    </section>
  );
}
