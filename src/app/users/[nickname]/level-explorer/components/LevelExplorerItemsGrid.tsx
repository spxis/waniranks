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
  recentOnly: boolean;
  showLocked: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onClearFilters: () => void;
  onSelectItem: (subjectId: number) => void;
  onTogglePeek: (subjectId: number) => void;
  onSetRecentOnly: (next: boolean) => void;
  onSetShowLocked: (next: boolean) => void;
  onToggleShowEnglish: () => void;
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
  recentOnly,
  showLocked,
  sentinelRef,
  onClearFilters,
  onSelectItem,
  onTogglePeek,
  onSetRecentOnly,
  onSetShowLocked,
  onToggleShowEnglish,
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleItems.map((item, index) => (
          <Fragment key={`${item.subjectType}-${item.subjectId}`}>
            <UnifiedExplorerCard
              onClick={() => onSelectItem(item.subjectId)}
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
                    <span className="subject-pill border-line bg-surface text-foreground">
                      L{selectedLevelList[selectedLevelList.length - 1]}
                    </span>
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
