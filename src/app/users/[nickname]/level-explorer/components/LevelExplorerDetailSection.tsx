import type { LevelItem } from "../../explorerTypes";
import {
  ReadingListWithPronunciation,
  ReadingWithPronunciation,
  englishSubtitleForDisplay,
  formatDate,
  formatNextReviewBadge,
  formatRelativeFromNow,
  glyphHasReading,
  glyphSubtitleForDisplay,
  isNewGlyphWithinHours,
  jlptLevelPillClass,
  secondaryReadingsForDisplay,
  shortSubjectTypeLabel,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  titleForDisplay,
  typeGlyphBoxClass,
} from "../lib/levelExplorerDisplay";
import LevelRelatedPanels from "./LevelRelatedPanels";
import LevelExplorerReviewStatsCard from "./LevelExplorerReviewStatsCard";
import {
  RelatedReferenceCards,
  VocabularyKanjiCards,
  type VocabularyKanjiLink,
} from "./LevelExplorerReferenceCards";

type Props = {
  accountId: string;
  selectedItem: LevelItem;
  showEnglish: boolean;
  canToggleEnglish?: boolean;
  onToggleShowEnglish?: (() => void) | null;
  hideTimeStats?: boolean;
  studyMode: boolean;
  revealStudyReading?: boolean;
  onTogglePeek?: (() => void) | null;
  selectedMeaningExplanation: string;
  selectedReadingExplanationRaw: string;
  showReadingExplanation: boolean;
  hasPrimaryRelatedPanel: boolean;
  hasVisuallySimilarPanel: boolean;
  hasUsedInVocabularyPanel: boolean;
  vocabularyKanjiLinks: VocabularyKanjiLink[];
  subjectById: Map<number, LevelItem>;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
  onResetToLessons?: (() => void) | null;
  resetDisabled?: boolean;
  resetBusy?: boolean;
};

export default function LevelExplorerDetailSection({
  accountId,
  selectedItem,
  showEnglish,
  canToggleEnglish = true,
  onToggleShowEnglish = null,
  hideTimeStats = false,
  studyMode,
  revealStudyReading = false,
  onTogglePeek = null,
  selectedMeaningExplanation,
  selectedReadingExplanationRaw,
  showReadingExplanation,
  hasPrimaryRelatedPanel,
  hasVisuallySimilarPanel,
  hasUsedInVocabularyPanel,
  vocabularyKanjiLinks,
  subjectById,
  onJumpToRelatedSubject,
  onJumpToKanji,
  onResetToLessons = null,
  resetDisabled = false,
  resetBusy = false,
}: Props) {
  const isStudyHidden = studyMode && !revealStudyReading;
  const canShowReadings = !isStudyHidden;
  const primaryMeaning = selectedItem.meanings.find((entry) => entry.trim().length > 0) ?? "";
  const nextReviewBadge = formatNextReviewBadge(selectedItem.availableAt);
  const revealedStudyTitle =
    primaryMeaning ||
    titleForDisplay(selectedItem, true) ||
    (selectedItem.subjectType === "kanji" ? "Kanji" : selectedItem.subjectType === "radical" ? "Radical" : "Vocabulary");
  const headerTitle = studyMode
    ? revealStudyReading
      ? revealedStudyTitle
      : null
    : titleForDisplay(selectedItem, showEnglish);
  const headerSubtitle = studyMode
    ? revealStudyReading
      ? titleForDisplay(selectedItem, false)
      : null
    : null;

  return (
    <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-surface p-5 sm:col-span-2 lg:col-span-4">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-x-3">
        <div className="inline-flex sm:self-start">
          <div
            className={`inline-flex rounded-2xl border ${
              glyphHasReading(selectedItem)
                ? "min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center px-4 py-3"
                : "min-h-[5.75rem] min-w-[5.75rem] items-center justify-center px-4 py-3"
            } ${typeGlyphBoxClass(selectedItem.subjectType)}`}
          >
            <div>
              <p className="text-center text-4xl font-black leading-none text-current">
                {selectedItem.characters}
              </p>
              {(() => {
                if (studyMode && isStudyHidden) {
                  return <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/55">...</p>;
                }

                const subtitle = studyMode
                  ? glyphSubtitleForDisplay(selectedItem)
                  : showEnglish
                    ? englishSubtitleForDisplay(selectedItem)
                    : glyphSubtitleForDisplay(selectedItem);

                if (!subtitle) {
                  return null;
                }

                return (
                  <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/85">
                    <ReadingWithPronunciation reading={subtitle} />
                  </p>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
            <span className={`subject-pill ${statusClass(selectedItem.status)}`}>{statusShortLabel(selectedItem.status)}</span>
            <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
            {typeof selectedItem.wkLevel === "number" ? (
              <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span>
            ) : null}
            {selectedItem.jlptLevel ? (
              <span className={jlptLevelPillClass()}>N{selectedItem.jlptLevel}</span>
            ) : null}
            <span className="subject-pill border-line bg-surface text-foreground">SRS {selectedItem.srsStage}</span>
            {isNewGlyphWithinHours(selectedItem) ? (
              <span className="subject-pill border-emerald-300 bg-emerald-100 text-emerald-800">NEW</span>
            ) : null}
            {nextReviewBadge ? <span className={`subject-pill ${nextReviewBadge.className}`}>{nextReviewBadge.label}</span> : null}
          </div>
          {studyMode && onTogglePeek ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onTogglePeek}
                className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
              >
                {isStudyHidden ? "Peek" : "Hide Peek"}
              </button>
            </div>
          ) : null}
          {onToggleShowEnglish ? (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onToggleShowEnglish}
                disabled={!canToggleEnglish}
                className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
              </button>
            </div>
          ) : null}
          <div className="mt-2 min-w-0">
            {studyMode && isStudyHidden ? (
              <>
                <p className="text-base font-black uppercase tracking-[0.08em] text-foreground/80">Blind Review</p>
                <p className="mt-1 text-sm font-semibold text-foreground/65">Recall meaning and reading, then reveal answer.</p>
              </>
            ) : (
              <>
                {headerTitle ? <p className="text-4xl font-black leading-tight text-foreground">{headerTitle}</p> : null}
                {headerSubtitle ? <p className="mt-1 text-2xl font-semibold text-foreground/85">{headerSubtitle}</p> : null}
              </>
            )}
          </div>
        </div>
      </div>

      {canShowReadings ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Primary reading</p>
            <p className="mt-1 font-semibold text-foreground/90">
              {selectedItem.subjectType === "radical" ? (
                "Not applicable"
              ) : (
                <ReadingListWithPronunciation readings={selectedItem.primaryReadings ?? []} mode={showEnglish ? "inline" : "plain"} />
              )}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Secondary readings</p>
            <p className="mt-1 font-semibold text-foreground/90">
              {selectedItem.subjectType === "radical" ? (
                "Not applicable"
              ) : (
                <ReadingListWithPronunciation readings={secondaryReadingsForDisplay(selectedItem)} mode={showEnglish ? "inline" : "plain"} />
              )}
            </p>
          </div>
        </div>
      ) : null}

      {!hideTimeStats ? (
        <div className={`${canShowReadings ? "mt-3" : "mt-4"} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Started</p>
          <p className="mt-1 font-semibold text-foreground/90">
            {formatDate(selectedItem.startedAt)}
            {formatRelativeFromNow(selectedItem.startedAt) ? ` (${formatRelativeFromNow(selectedItem.startedAt)})` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Next review</p>
          <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedItem.availableAt)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Passed</p>
          <p className="mt-1 font-semibold text-foreground/90">
            {formatDate(selectedItem.passedAt)}
            {formatRelativeFromNow(selectedItem.passedAt) ? ` (${formatRelativeFromNow(selectedItem.passedAt)})` : ""}
          </p>
        </div>
        </div>
      ) : null}

      {!studyMode || revealStudyReading ? (
        <div className={`mt-4 grid gap-3 ${showReadingExplanation ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
          <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Meaning explanation</p>
            <p className="mt-2 text-foreground/90">{selectedMeaningExplanation}</p>
          </article>
          {showReadingExplanation ? (
            <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Reading explanation</p>
              <p className="mt-2 text-foreground/90">{selectedReadingExplanationRaw}</p>
            </article>
          ) : null}
        </div>
      ) : null}

      {!studyMode || revealStudyReading ? (
        <LevelRelatedPanels
          hasPrimary={hasPrimaryRelatedPanel}
          hasVisuallySimilar={hasVisuallySimilarPanel}
          hasUsedInVocabulary={hasUsedInVocabularyPanel}
          primaryTitle={selectedItem.subjectType === "vocabulary" ? "Kanji" : "Radicals"}
          primaryContent={
            selectedItem.subjectType === "vocabulary" ? (
              <VocabularyKanjiCards
                links={vocabularyKanjiLinks}
                showEnglish={showEnglish}
                selectedSubjectId={selectedItem.subjectId}
                onJumpToKanji={onJumpToKanji}
              />
            ) : (
              <RelatedReferenceCards
                items={selectedItem.radicals ?? []}
                large={selectedItem.subjectType === "kanji"}
                showEnglish={showEnglish}
                subjectById={subjectById}
                onJumpToRelatedSubject={onJumpToRelatedSubject}
              />
            )
          }
          visuallySimilarContent={
            <RelatedReferenceCards
              items={selectedItem.visuallySimilar ?? []}
              large={selectedItem.subjectType === "kanji"}
              showEnglish={showEnglish}
              subjectById={subjectById}
              onJumpToRelatedSubject={onJumpToRelatedSubject}
            />
          }
          usedInVocabularyContent={
            <RelatedReferenceCards
              items={selectedItem.usedInVocabulary ?? []}
              large
              showEnglish={showEnglish}
              subjectById={subjectById}
              onJumpToRelatedSubject={onJumpToRelatedSubject}
            />
          }
        />
      ) : null}

      {!studyMode || isStudyHidden || revealStudyReading ? (
        <LevelExplorerReviewStatsCard
          accountId={accountId}
          subjectId={selectedItem.subjectId}
          currentSrsStage={selectedItem.srsStage}
          startedAt={selectedItem.startedAt}
        />
      ) : null}

      {onResetToLessons ? (
        <details className="mt-4 rounded-xl border border-line bg-surface-muted p-3">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
            Advanced Actions
          </summary>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-foreground/70">
              Per-item reset is not supported by the official WaniKani API.
            </p>
            <button
              type="button"
              onClick={onResetToLessons}
              disabled
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unsupported
            </button>
          </div>
        </details>
      ) : null}
    </section>
  );
}
