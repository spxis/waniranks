import { Fragment } from "react";

import type { LevelItem } from "../../explorerTypes";
import UnifiedExplorerCard from "../../shared/UnifiedExplorerCard";
import {
  ReadingWithPronunciation,
  badgeClass,
  formatNextReviewBadge,
  formatNumber,
  glyphSubtitleForDisplay,
  glyphTextSizeClass,
  isNewGlyphWithinHours,
  jlptLevelPillClass,
  lockedCardStateClass,
  shortSubjectTypeLabel,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  titleForDisplay,
  typeCardClass,
  typeGlyphBoxClass,
} from "../lib/levelExplorerDisplay";
import LevelExplorerDetailSection from "./LevelExplorerDetailSection";

type VocabularyKanjiLink = {
  char: string;
  subjectId: number;
  reading: string;
  wkLevel: number | null;
};

type Props = {
  accountId: string;
  filteredItems: LevelItem[];
  visibleItems: LevelItem[];
  selectedItem: LevelItem | null;
  visibleDetailInsertIndex: number;
  selectedLevelList: number[];
  studyMode: boolean;
  showEnglish: boolean;
  canToggleEnglish: boolean;
  isPeekRevealed: boolean;
  selectedMeaningExplanation: string;
  selectedReadingExplanationRaw: string;
  showReadingExplanation: boolean;
  hasPrimaryRelatedPanel: boolean;
  hasVisuallySimilarPanel: boolean;
  hasUsedInVocabularyPanel: boolean;
  vocabularyKanjiLinks: VocabularyKanjiLink[];
  subjectById: Map<number, LevelItem>;
  selectedSubjectIds: Set<number>;
  isResetting: boolean;
  resetFeedback: { kind: "success" | "error"; message: string } | null;
  recentOnly: boolean;
  showLocked: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onClearFilters: () => void;
  onSelectItem: (subjectId: number) => void;
  onTogglePeek: (subjectId: number) => void;
  onSetRecentOnly: (next: boolean) => void;
  onSetShowLocked: (next: boolean) => void;
  onToggleShowEnglish: () => void;
  onToggleSubjectSelection: (subjectId: number) => void;
  onSelectVisibleSubjects: () => void;
  onClearSelection: () => void;
  onResetSelected: () => void;
  onResetSingle: (subjectId: number) => void;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
};

export default function LevelExplorerItemsGrid({
  accountId,
  filteredItems,
  visibleItems,
  selectedItem,
  visibleDetailInsertIndex,
  selectedLevelList,
  studyMode,
  showEnglish,
  canToggleEnglish,
  isPeekRevealed,
  selectedMeaningExplanation,
  selectedReadingExplanationRaw,
  showReadingExplanation,
  hasPrimaryRelatedPanel,
  hasVisuallySimilarPanel,
  hasUsedInVocabularyPanel,
  vocabularyKanjiLinks,
  subjectById,
  selectedSubjectIds,
  isResetting,
  resetFeedback,
  recentOnly,
  showLocked,
  sentinelRef,
  onClearFilters,
  onSelectItem,
  onTogglePeek,
  onSetRecentOnly,
  onSetShowLocked,
  onToggleShowEnglish,
  onToggleSubjectSelection,
  onSelectVisibleSubjects,
  onClearSelection,
  onResetSelected,
  onResetSingle,
  onJumpToRelatedSubject,
  onJumpToKanji,
}: Props) {
  if (filteredItems.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-foreground/70">
        No items match the current filters.{" "}
        <button
          type="button"
          onClick={onClearFilters}
          className="font-bold text-accent underline underline-offset-2 hover:text-accent-2"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65">
          Showing {formatNumber(visibleItems.length)} of {formatNumber(filteredItems.length)} items
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleShowEnglish}
            disabled={!canToggleEnglish}
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
          </button>
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/75">
          Selected {formatNumber(selectedSubjectIds.size)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSelectVisibleSubjects}
            disabled={visibleItems.length === 0 || isResetting}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Select Visible
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedSubjectIds.size === 0 || isResetting}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onResetSelected}
            disabled={selectedSubjectIds.size === 0 || isResetting}
            className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResetting ? "Resetting..." : "Reset Selected"}
          </button>
        </div>
      </div>
      {resetFeedback ? (
        <p
          className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
            resetFeedback.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {resetFeedback.message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.map((item, index) => (
          <Fragment key={`${item.subjectType}-${item.subjectId}`}>
            <UnifiedExplorerCard
              onClick={() => onSelectItem(item.subjectId)}
              dataSubjectId={item.subjectId}
              className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                item.subjectType,
                selectedItem?.subjectId === item.subjectId,
              )} ${lockedCardStateClass(item)}`}
              indexLabel={
                <span className="inline-flex items-center gap-2">
                  <span
                    role="checkbox"
                    aria-checked={selectedSubjectIds.has(item.subjectId)}
                    tabIndex={0}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleSubjectSelection(item.subjectId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleSubjectSelection(item.subjectId);
                      }
                    }}
                    className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                      selectedSubjectIds.has(item.subjectId)
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-surface text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span>#{formatNumber(index + 1)}</span>
                </span>
              }
              topRight={
                <>
                  <span className={subjectTypePillClass(item.subjectType)}>{shortSubjectTypeLabel(item.subjectType)}</span>
                  {typeof item.wkLevel === "number" ? (
                    <span className="subject-pill border-line bg-surface text-foreground">L{item.wkLevel}</span>
                  ) : typeof selectedLevelList[selectedLevelList.length - 1] === "number" ? (
                    <span className="subject-pill border-line bg-surface text-foreground">
                      L{selectedLevelList[selectedLevelList.length - 1]}
                    </span>
                  ) : null}
                  {item.jlptLevel ? (
                    <span className={jlptLevelPillClass()}>N{item.jlptLevel}</span>
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
                studyMode ? (
                  <span className="text-foreground/45">...</span>
                ) : showEnglish ? (
                  titleForDisplay(item, true)
                ) : (() => {
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
                canToggleEnglish={canToggleEnglish}
                onToggleShowEnglish={onToggleShowEnglish}
                studyMode={studyMode}
                revealStudyReading={isPeekRevealed}
                onTogglePeek={
                  studyMode
                    ? () => {
                        onTogglePeek(selectedItem.subjectId);
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
                onResetToLessons={() => {
                  onResetSingle(selectedItem.subjectId);
                }}
                resetDisabled={isResetting}
                resetBusy={isResetting}
              />
            ) : null}
          </Fragment>
        ))}
      </div>
      {visibleItems.length < filteredItems.length ? (
        <div
          ref={sentinelRef}
          className="mt-3 rounded-xl border border-line bg-surface-muted px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60"
        >
          Loading more...
        </div>
      ) : null}
    </>
  );
}
