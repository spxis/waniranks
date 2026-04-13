import type { LevelItem, RelatedReference } from "../../explorerTypes";
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
  pronunciationForReading,
  relatedReferenceCardClass,
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

type RelatedEntry = {
  subjectId: number;
  label: string;
  wkLevel: number | null;
  reading: string | null;
  fallbackKey?: string;
};

type VocabularyKanjiLink = {
  char: string;
  subjectId: number;
  reading: string;
  wkLevel: number | null;
};

type Props = {
  accountId: string;
  selectedItem: LevelItem;
  showEnglish: boolean;
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
};

function expandRelatedReferences(items: RelatedReference[]): RelatedEntry[] {
  return items.flatMap((item) => {
    const segments = item.label
      .split(/[、,]/)
      .map((segment) => segment.trim())
      .filter((segment) => Boolean(segment));

    if (segments.length <= 1) {
      return [
        {
          subjectId: item.subjectId,
          label: item.label,
          wkLevel: item.wkLevel ?? null,
          reading: item.reading ?? null,
        },
      ];
    }

    return segments.map((segment, index) => ({
      subjectId: item.subjectId,
      label: segment,
      wkLevel: item.wkLevel ?? null,
      reading: null,
      fallbackKey: `${item.subjectId}-${segment}-${index}`,
    }));
  });
}

function labelClass(label: string, size: "normal" | "large"): string {
  if (size === "normal") return "text-xl";

  const length = Array.from(label).length;
  if (length <= 2) return "text-4xl";
  if (length <= 4) return "text-3xl";
  return "text-2xl";
}

function RelatedReferenceCards({
  items,
  large,
  showEnglish,
  subjectById,
  onJumpToRelatedSubject,
}: {
  items: RelatedReference[];
  large?: boolean;
  showEnglish: boolean;
  subjectById: Map<number, LevelItem>;
  onJumpToRelatedSubject: (subjectId: number, targetLevel?: number | null) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-foreground/60">-</p>;
  }

  const size = large ? "large" : "normal";
  const expandedItems = expandRelatedReferences(items);

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {expandedItems.map((entry, index) => {
        const linked = subjectById.get(entry.subjectId) ?? null;
        const isClickable = linked !== null || typeof entry.wkLevel === "number";
        const relationType = linked?.subjectType;
        const reading = typeof entry.reading === "string" && entry.reading.trim() ? entry.reading : null;
        const subtitle = (() => {
          if (!reading) return null;
          if (!showEnglish) return reading;

          const pronunciation = pronunciationForReading(reading);
          return pronunciation ? `${reading} / ${pronunciation}` : reading;
        })();
        const key = entry.fallbackKey ?? `${entry.subjectId}-${entry.label}-${index}`;

        if (!isClickable) {
          return (
            <span
              key={key}
              className={`${relatedReferenceCardClass(relationType, false, size)} inline-flex flex-col items-center`}
            >
              <span className={`${labelClass(entry.label, size)} font-black leading-none`}>{entry.label}</span>
              {subtitle ? (
                <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                  {subtitle}
                </span>
              ) : null}
            </span>
          );
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              void onJumpToRelatedSubject(entry.subjectId, entry.wkLevel ?? linked?.wkLevel ?? null);
            }}
            className={`${relatedReferenceCardClass(relationType, true, size)} inline-flex flex-col items-center`}
          >
            <span className={`${labelClass(entry.label, size)} font-black leading-none`}>{entry.label}</span>
            {subtitle ? (
              <span className="mt-1 text-center text-sm font-semibold leading-none text-foreground/70">
                {subtitle}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function VocabularyKanjiCards({
  links,
  showEnglish,
  selectedSubjectId,
  onJumpToKanji,
}: {
  links: VocabularyKanjiLink[];
  showEnglish: boolean;
  selectedSubjectId: number;
  onJumpToKanji: (subjectId: number, wkLevel: number | null) => Promise<void>;
}) {
  if (links.length === 0) {
    return <p className="mt-2 text-foreground/60">-</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap justify-center gap-2">
      {links.map((item) => {
        const subtitle = (() => {
          if (!showEnglish) return item.reading;
          const pronunciation = pronunciationForReading(item.reading);
          return pronunciation ? `${item.reading} / ${pronunciation}` : item.reading;
        })();

        return (
          <button
            key={`${selectedSubjectId}-${item.subjectId}`}
            type="button"
            onClick={() => {
              void onJumpToKanji(item.subjectId, item.wkLevel);
            }}
            className="inline-flex cursor-pointer flex-col items-center rounded-xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-center text-kanji transition hover:bg-kanji/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <span className="text-4xl font-black leading-none">{item.char}</span>
            {subtitle ? (
              <span className="mt-1 w-full text-center text-sm font-semibold leading-none text-foreground/70">
                {subtitle}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default function LevelExplorerDetailSection({
  accountId,
  selectedItem,
  showEnglish,
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
}: Props) {
  const isStudyHidden = studyMode && !revealStudyReading;
  const useBlindHeaderLayout = studyMode;
  const canShowReadings = !isStudyHidden;
  const primaryMeaning = selectedItem.meanings.find((entry) => entry.trim().length > 0) ?? "";
  const nextReviewBadge = formatNextReviewBadge(selectedItem.availableAt);
  const revealedStudyTitle =
    primaryMeaning ||
    titleForDisplay(selectedItem, true) ||
    (selectedItem.subjectType === "kanji" ? "Kanji" : selectedItem.subjectType === "radical" ? "Radical" : "Vocabulary");

  return (
    <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-surface p-5 sm:col-span-2 lg:col-span-4">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-x-3">
        <div className="inline-flex sm:self-start">
          <div
            className={`inline-flex rounded-2xl border ${
              glyphHasReading(selectedItem)
                ? useBlindHeaderLayout
                  ? "min-h-[8.5rem] min-w-[8.5rem] flex-col items-center justify-center px-6 py-5"
                  : "min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center px-4 py-3"
                : useBlindHeaderLayout
                  ? "min-h-[8.5rem] min-w-[8.5rem] items-center justify-center px-6 py-5"
                  : "min-h-[5.75rem] min-w-[5.75rem] items-center justify-center px-4 py-3"
            } ${typeGlyphBoxClass(selectedItem.subjectType)}`}
          >
            <div>
              <p className={`text-center font-black leading-none text-current ${useBlindHeaderLayout ? "text-6xl sm:text-7xl" : "text-4xl"}`}>
                {selectedItem.characters}
              </p>
              {!useBlindHeaderLayout ? (
                (() => {
                  const subtitle = showEnglish
                    ? englishSubtitleForDisplay(selectedItem)
                    : glyphSubtitleForDisplay(selectedItem);
                  if (!subtitle) return null;

                  return (
                    <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/85">
                      <ReadingWithPronunciation reading={subtitle} />
                    </p>
                  );
                })()
              ) : null}
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
            {selectedItem.subjectType === "kanji" && selectedItem.jlptLevel ? (
              <span className="subject-pill border-line bg-surface text-foreground">N{selectedItem.jlptLevel}</span>
            ) : null}
            <span className="subject-pill border-line bg-surface text-foreground">SRS {selectedItem.srsStage}</span>
            {isNewGlyphWithinHours(selectedItem) ? (
              <span className="subject-pill border-emerald-300 bg-emerald-100 text-emerald-800">NEW</span>
            ) : null}
            {nextReviewBadge ? <span className={`subject-pill ${nextReviewBadge.className}`}>{nextReviewBadge.label}</span> : null}
          </div>
          {studyMode && onTogglePeek ? (
            <div className="mt-2 flex justify-start sm:justify-end">
              <button
                type="button"
                onClick={onTogglePeek}
                className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
              >
                {isStudyHidden ? "Peek" : "Hide Peek"}
              </button>
            </div>
          ) : null}
          <div className="mt-2 min-w-0">
            {studyMode ? (
              <>
                <p className="text-base font-black uppercase tracking-[0.08em] text-foreground/80">Blind Review</p>
                <p className="mt-1 text-sm font-semibold text-foreground/65">Recall meaning and reading, then reveal answer.</p>
                {!isStudyHidden ? (
                  <>
                    <p className="mt-2 text-2xl font-black leading-tight text-foreground">{revealedStudyTitle}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground/75">{titleForDisplay(selectedItem, false)}</p>
                  </>
                ) : null}
              </>
            ) : (
              <p className="text-3xl font-black leading-tight text-foreground">{titleForDisplay(selectedItem, showEnglish)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canShowReadings ? (
          <>
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
          </>
        ) : null}

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
    </section>
  );
}
