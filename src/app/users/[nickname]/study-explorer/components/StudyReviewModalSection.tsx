import type { ReviewOutcome, StudyQueueItem, SubmitInFlight } from "../lib/studyExplorerTypes";

import type { RelatedReference } from "./StudyReviewModal.types";
import type { LevelItem } from "../../explorerTypes";
import LevelExplorerReviewStatsCard from "../../level-explorer/components/LevelExplorerReviewStatsCard";
import LevelExplorerDetailSection from "../../level-explorer/components/LevelExplorerDetailSection";
import {
  glyphTextSizeClass,
  jlptLevelPillClass,
  shortSubjectTypeLabel,
  stripHtml,
  statusClass,
  statusShortLabel,
  subjectTypePillClass,
  typeGlyphBoxClass,
} from "../../level-explorer/lib/levelExplorerDisplay";
import StudyReviewModalMetaPanels from "./StudyReviewModalMetaPanels";

type Props = {
  accountId: string;
  studyMode: boolean;
  showEnglish: boolean;
  canToggleEnglish: boolean;
  viewerMode: "detail" | "flash";
  selectedItem: StudyQueueItem;
  selectedOutcome: ReviewOutcome | undefined;
  isSubmittingSelected: boolean;
  submitInFlight: SubmitInFlight | null;
  submitFeedback: { kind: "success" | "error"; message: string } | null;
  requiresReveal: boolean;
  isAnswerRevealed: boolean;
  isOutcomeFinal: boolean;
  detailsRevealed: boolean;
  useStudyFlashLayout: boolean;
  flashCycleDone: boolean;
  flashRevealed: boolean;
  currentFlashKey: string;
  allMeanings: string[];
  primaryReadingHiragana: string;
  primaryReadingKatakana: string;
  secondaryReadingValue: string;
  hasRadicals: boolean;
  hasVisuallySimilar: boolean;
  hasUsedInVocabulary: boolean;
  hasComponentKanji: boolean;
  usedKanjiItems: RelatedReference[];
  usedKanjiCollapsed: boolean;
  usedInWordsCollapsed: boolean;
  jlptGradeLabel: string;
  wrong: number;
  skipped: number;
  correct: number;
  onReveal: (assignmentId: number) => void;
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => void;
  onSkipCurrent: () => void;
  onStartLesson: (assignmentId: number) => void;
  onResetToLessons: (assignmentId: number) => void;
  onAdvanceFlashOrNext: () => void;
  onFlashTouchStart: (event: React.TouchEvent) => void;
  onFlashTouchEnd: (event: React.TouchEvent) => void;
  onSetFlashRevealKey: (value: string) => void;
  onToggleUsedKanjiCollapsed: () => void;
  onToggleUsedInWordsCollapsed: () => void;
  onToggleShowEnglish: () => void;
};

export default function StudyReviewModalSection({
  accountId,
  studyMode,
  showEnglish,
  canToggleEnglish,
  viewerMode,
  selectedItem,
  selectedOutcome,
  isSubmittingSelected,
  submitInFlight,
  submitFeedback,
  requiresReveal,
  isAnswerRevealed,
  isOutcomeFinal,
  detailsRevealed,
  useStudyFlashLayout,
  flashCycleDone,
  flashRevealed,
  currentFlashKey,
  allMeanings,
  primaryReadingHiragana,
  primaryReadingKatakana,
  secondaryReadingValue,
  hasRadicals,
  hasVisuallySimilar,
  hasUsedInVocabulary,
  hasComponentKanji,
  usedKanjiItems,
  usedKanjiCollapsed,
  usedInWordsCollapsed,
  jlptGradeLabel,
  wrong,
  skipped,
  correct,
  onReveal,
  onSubmit,
  onSkipCurrent,
  onStartLesson,
  onResetToLessons,
  onAdvanceFlashOrNext,
  onFlashTouchStart,
  onFlashTouchEnd,
  onSetFlashRevealKey,
  onToggleUsedKanjiCollapsed,
  onToggleUsedInWordsCollapsed,
  onToggleShowEnglish,
}: Props) {
  const showStatusChip = !(selectedItem.queueType === "lesson" && selectedItem.status === "locked");
  const shouldUseUnifiedLessonDetail =
    selectedItem.queueType === "lesson" &&
    viewerMode === "detail" &&
    !useStudyFlashLayout &&
    detailsRevealed;

  const selectedMeaningExplanation = stripHtml(selectedItem.meaningExplanation) || "-";
  const selectedReadingExplanationRaw = stripHtml(selectedItem.readingExplanation);
  const showReadingExplanation = selectedReadingExplanationRaw.length > 0;

  const sanitizedRelatedItems = (items: RelatedReference[] | undefined) =>
    (items ?? []).map((item) => ({ ...item, wkLevel: null }));

  const unifiedDetailItem: StudyQueueItem = shouldUseUnifiedLessonDetail
    ? {
        ...selectedItem,
        radicals: sanitizedRelatedItems(selectedItem.radicals as RelatedReference[] | undefined),
        visuallySimilar: sanitizedRelatedItems(selectedItem.visuallySimilar as RelatedReference[] | undefined),
        usedInVocabulary: sanitizedRelatedItems(
          (selectedItem.usedInVocabulary as RelatedReference[] | undefined)?.length
            ? (selectedItem.usedInVocabulary as RelatedReference[] | undefined)
            : selectedItem.subjectType === "radical"
              ? (selectedItem.componentKanji as RelatedReference[] | undefined)
              : (selectedItem.usedInVocabulary as RelatedReference[] | undefined),
        ),
        componentKanji: sanitizedRelatedItems(selectedItem.componentKanji as RelatedReference[] | undefined),
      }
    : selectedItem;

  return (
    <>
      <section className="rounded-2xl border-2 border-accent/35 bg-surface p-3 sm:p-5">
        {!studyMode && viewerMode === "flash" ? (
          flashCycleDone ? (
            <button
              type="button"
              onClick={onAdvanceFlashOrNext}
              onTouchStart={onFlashTouchStart}
              onTouchEnd={onFlashTouchEnd}
              className="flex min-h-[68vh] w-full select-none flex-col items-center justify-center rounded-2xl border border-line bg-surface-muted px-6 py-8 text-center hover:bg-surface"
            >
              <p className="text-2xl font-black uppercase tracking-[0.12em] text-foreground/80 sm:text-3xl">
                Cards Are Done
              </p>
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.1em] text-foreground/60 sm:text-base">
                Click Or Press Next Again To Restart
              </p>
            </button>
          ) : (
            <div className="grid min-h-[68vh] gap-3 lg:grid-cols-2 lg:items-stretch">
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAdvanceFlashOrNext();
                }}
                onTouchStart={onFlashTouchStart}
                onTouchEnd={onFlashTouchEnd}
                className={`relative flex min-h-[20rem] select-none items-center justify-center rounded-2xl border p-6 ${typeGlyphBoxClass(
                  selectedItem.subjectType,
                )}`}
              >
                <div className="absolute left-1/2 top-4 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-1 overflow-x-auto px-1">
                  <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                  {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                  {typeof selectedItem.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{selectedItem.jlptMeta.schoolGrade}</span> : null}
                  {selectedItem.jlptLevel ? <span className={jlptLevelPillClass()}>N{selectedItem.jlptLevel}</span> : null}
                  {showStatusChip ? (
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(selectedItem.status)}`}>
                      {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                    </span>
                  ) : null}
                </div>
                <p className="text-center text-[clamp(5rem,14vw,11rem)] font-black leading-none text-current">
                  {selectedItem.characters}
                </p>
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!flashRevealed) {
                    onSetFlashRevealKey(currentFlashKey);
                  }
                }}
                onTouchStart={onFlashTouchStart}
                onTouchEnd={onFlashTouchEnd}
                className="flex min-h-[20rem] w-full select-none flex-col justify-center rounded-2xl border border-line bg-surface px-6 py-6 text-left hover:bg-surface-muted lg:h-full lg:min-h-0"
              >
                {!flashRevealed ? (
                  <div className="mx-auto text-center">
                    <p className="text-base font-black uppercase tracking-[0.12em] text-foreground/70">
                      Tap / Click To Reveal
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">
                      Enter Or Space
                    </p>
                  </div>
                ) : (
                  <div className="grid h-full gap-4 lg:grid-rows-2">
                    <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Reading</p>
                      <p className="mt-2 text-5xl font-black leading-tight text-foreground">
                        {primaryReadingHiragana === "-" && secondaryReadingValue !== "-"
                          ? secondaryReadingValue
                          : primaryReadingHiragana}
                      </p>
                      {primaryReadingKatakana !== "-" ? (
                        <p className="mt-2 text-4xl font-black leading-tight text-foreground/75">
                          {primaryReadingKatakana}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-line bg-surface-muted px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning</p>
                      <p className="mt-2 text-4xl font-black leading-tight text-foreground">
                        {allMeanings[0] ?? selectedItem.characters}
                      </p>
                      {allMeanings.length > 1 ? (
                        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/70">
                          {allMeanings.slice(1).join(" • ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </button>
            </div>
          )
        ) : useStudyFlashLayout ? (
          <>
            <div className="grid min-h-[calc(100dvh-20rem)] gap-2 lg:min-h-[68vh] lg:grid-cols-2 lg:items-stretch">
              <div className="flex min-h-[10rem] flex-col max-[380px]:min-h-[9rem] lg:h-full lg:min-h-0">
                {!detailsRevealed ? (
                  <div
                    className={`relative flex min-h-[10rem] flex-1 select-none items-center justify-center rounded-2xl border p-3 max-[380px]:min-h-[9rem] max-[380px]:p-2 sm:p-6 lg:h-full ${typeGlyphBoxClass(
                      selectedItem.subjectType,
                    )}`}
                  >
                    <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-1 overflow-hidden px-1 max-[380px]:top-2 sm:top-4">
                      <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                      {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                      {typeof selectedItem.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{selectedItem.jlptMeta.schoolGrade}</span> : null}
                      {selectedItem.jlptLevel ? <span className={jlptLevelPillClass()}>N{selectedItem.jlptLevel}</span> : null}
                      {showStatusChip ? (
                    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase max-[380px]:hidden sm:px-3 sm:py-1 sm:text-xs ${statusClass(selectedItem.status)}`}>
                          {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-center text-[clamp(2.8rem,9.4vw,6rem)] font-black leading-none text-current sm:text-[clamp(3.8rem,12vw,10rem)] lg:text-[clamp(3.8rem,6vw,7rem)] max-[380px]:text-[clamp(2.5rem,9.8vw,5.6rem)]">
                      {selectedItem.characters}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={`relative flex min-h-[10rem] items-center justify-center rounded-2xl border p-4 max-[380px]:min-h-[9rem] max-[380px]:p-2 sm:p-6 ${typeGlyphBoxClass(selectedItem.subjectType)}`}>
                      <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-1 overflow-hidden px-1 max-[380px]:top-2 sm:top-4">
                        <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                        {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                        {typeof selectedItem.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{selectedItem.jlptMeta.schoolGrade}</span> : null}
                        {selectedItem.jlptLevel ? <span className={jlptLevelPillClass()}>N{selectedItem.jlptLevel}</span> : null}
                        {showStatusChip ? (
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase max-[380px]:hidden sm:px-3 sm:py-1 sm:text-xs ${statusClass(selectedItem.status)}`}>
                            {statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-center text-[clamp(3rem,9.8vw,6.2rem)] font-black leading-none text-current sm:text-[clamp(3.6rem,11vw,8rem)] lg:text-[clamp(3.6rem,5.8vw,6.8rem)] max-[380px]:text-[clamp(2.6rem,9.8vw,5.8rem)]">{selectedItem.characters}</p>
                    </div>

                    <div className="mt-2 grid flex-1 gap-2 lg:mt-3 lg:gap-3 lg:grid-rows-2">
                      <div className="max-h-[8.7rem] overflow-hidden rounded-xl border border-line bg-surface-muted px-3 py-3 max-[380px]:max-h-[7.8rem] max-[380px]:px-2.5 max-[380px]:py-2.5 sm:max-h-none sm:px-4 sm:py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Reading</p>
                        <p className="mt-1 line-clamp-2 text-3xl font-black leading-tight text-foreground max-[380px]:text-[2.25rem] sm:mt-2 sm:text-5xl">
                          {primaryReadingHiragana === "-" && secondaryReadingValue !== "-" ? secondaryReadingValue : primaryReadingHiragana}
                        </p>
                        {primaryReadingKatakana !== "-" ? <p className="mt-1 line-clamp-1 text-sm font-semibold leading-tight text-foreground/70">{primaryReadingKatakana}</p> : null}
                      </div>
                      <div className="max-h-[8.7rem] overflow-hidden rounded-xl border border-line bg-surface-muted px-3 py-3 max-[380px]:max-h-[7.8rem] max-[380px]:px-2.5 max-[380px]:py-2.5 sm:max-h-none sm:px-4 sm:py-4">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Meaning</p>
                        <p className="mt-1 line-clamp-2 text-[2rem] font-black leading-tight text-foreground max-[380px]:text-[1.65rem] sm:mt-2 sm:text-4xl">{allMeanings[0] ?? selectedItem.characters}</p>
                        {allMeanings.length > 1 ? <p className="mt-1.5 line-clamp-2 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/70">{allMeanings.slice(1).join(" • ")}</p> : null}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid min-h-[9rem] gap-2 lg:h-full lg:min-h-0 lg:grid-rows-2 lg:gap-3">
                {!detailsRevealed ? (
                  <button type="button" onClick={() => onReveal(selectedItem.assignmentId)} className="h-full w-full rounded-2xl border border-line bg-surface-muted px-3 py-3 text-center hover:bg-surface sm:px-6 sm:py-6 lg:row-span-2">
                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.12em] text-foreground/70 sm:text-base">Show Answer</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">Space To Reveal</p>
                    </div>
                  </button>
                ) : isOutcomeFinal ? (
                  <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-line bg-surface px-3 py-3 text-center sm:px-4 sm:py-4 lg:row-span-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/65">Answer locked</p>
                      <p className={`mt-2 text-2xl font-black uppercase ${selectedOutcome === "correct" ? "text-emerald-700" : "text-red-700"}`}>{selectedOutcome}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/60">Review submitted. This item is now read-only.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-full grid-cols-2 gap-2 lg:row-span-2 lg:grid-cols-1 lg:grid-rows-[1fr_1fr_auto] lg:gap-3">
                    <button type="button" onClick={() => onSubmit(selectedItem.assignmentId, "wrong")} aria-keyshortcuts="1" title="Wrong (Key: 1)" className="h-full w-full rounded-2xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-red-800 sm:px-4 sm:py-4">
                      <span className="block">Wrong</span>
                      <span className="mt-1 block text-xl leading-none">{wrong}</span>
                    </button>
                    <button type="button" onClick={() => onSubmit(selectedItem.assignmentId, "correct")} aria-keyshortcuts="2" title="Correct (Key: 2)" className="h-full w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-emerald-800 sm:px-4 sm:py-4">
                      <span className="block">Correct</span>
                      <span className="mt-1 block text-xl leading-none">{correct}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onSkipCurrent}
                      className="col-span-2 h-full w-full rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-amber-800 sm:px-4 sm:py-4 lg:col-span-1"
                    >
                      <span className="block">Skipped</span>
                      <span className="mt-1 block text-xl leading-none">{skipped}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 hidden sm:block">
              <LevelExplorerReviewStatsCard accountId={accountId} subjectId={selectedItem.subjectId} currentSrsStage={selectedItem.srsStage} startedAt={selectedItem.startedAt} />
            </div>
          </>
        ) : requiresReveal && !isAnswerRevealed ? (
          <div className="grid min-h-[68vh] gap-3 lg:grid-cols-2 lg:items-stretch">
            <div className={`flex min-h-[20rem] items-center justify-center rounded-2xl border p-6 ${typeGlyphBoxClass(selectedItem.subjectType)}`}>
              <p className="text-center text-[clamp(5rem,14vw,11rem)] font-black leading-none text-current">{selectedItem.characters}</p>
            </div>
            <button type="button" onClick={() => onReveal(selectedItem.assignmentId)} className="flex min-h-[20rem] w-full flex-col justify-center rounded-2xl border border-line bg-surface px-6 py-6 text-left hover:bg-surface-muted lg:h-full lg:min-h-0">
              <div className="mx-auto text-center">
                <p className="text-base font-black uppercase tracking-[0.12em] text-foreground/70">Show Answer</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground/55">Space To Reveal</p>
              </div>
            </button>
          </div>
        ) : (
          shouldUseUnifiedLessonDetail ? (
            <LevelExplorerDetailSection
              accountId={accountId}
              selectedItem={unifiedDetailItem}
              showEnglish={showEnglish}
              canToggleEnglish={canToggleEnglish}
              onToggleShowEnglish={onToggleShowEnglish}
              hideTimeStats
              studyMode={false}
              selectedMeaningExplanation={selectedMeaningExplanation}
              selectedReadingExplanationRaw={selectedReadingExplanationRaw}
              showReadingExplanation={showReadingExplanation}
              hasPrimaryRelatedPanel={hasRadicals}
              hasVisuallySimilarPanel={hasVisuallySimilar}
              hasUsedInVocabularyPanel={hasUsedInVocabulary}
              vocabularyKanjiLinks={[]}
              subjectById={new Map<number, LevelItem>()}
              onJumpToRelatedSubject={async () => {}}
              onJumpToKanji={async () => {}}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div className={`inline-flex min-h-[5.75rem] min-w-[5.75rem] items-center justify-center rounded-2xl border px-4 py-3 ${typeGlyphBoxClass(selectedItem.subjectType)}`}>
                <p className={`text-center font-black leading-none ${glyphTextSizeClass(selectedItem.characters)}`}>{selectedItem.characters}</p>
              </div>
              <div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl font-black text-foreground">{detailsRevealed ? (allMeanings[0] ?? selectedItem.characters) : "???"}</p>
                    {detailsRevealed && allMeanings.length > 1 ? <p className="mt-1 hidden text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:block">Alt meanings: {allMeanings.slice(1).join(" • ")}</p> : null}
                  </div>
                  <div className="flex flex-nowrap justify-self-end gap-1">
                    <span className={subjectTypePillClass(selectedItem.subjectType)}>{shortSubjectTypeLabel(selectedItem.subjectType)}</span>
                    {typeof selectedItem.wkLevel === "number" ? <span className="subject-pill border-line bg-surface text-foreground">L{selectedItem.wkLevel}</span> : null}
                    {typeof selectedItem.jlptMeta?.schoolGrade === "number" ? <span className="subject-pill border-line bg-surface text-foreground">G{selectedItem.jlptMeta.schoolGrade}</span> : null}
                    {selectedItem.jlptLevel ? <span className={jlptLevelPillClass()}>N{selectedItem.jlptLevel}</span> : null}
                    {showStatusChip ? <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(selectedItem.status)}`}>{statusShortLabel(selectedItem.status)} · SRS {selectedItem.srsStage}</span> : null}
                  </div>
                </div>
                {detailsRevealed && allMeanings.length > 1 ? (
                  <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2 sm:hidden">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Alt meanings</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/80">{allMeanings.slice(1).join(" • ")}</p>
                  </div>
                ) : null}
              </div>
            </div>
          )
        )}
      </section>

      <StudyReviewModalMetaPanels
        accountId={accountId}
        studyMode={studyMode}
        viewerMode={viewerMode}
        selectedItem={selectedItem}
        submitFeedback={submitFeedback}
        submitInFlight={submitInFlight}
        isSubmittingSelected={isSubmittingSelected}
        detailsRevealed={detailsRevealed}
        useStudyFlashLayout={useStudyFlashLayout}
        suppressDetails={shouldUseUnifiedLessonDetail}
        requiresReveal={requiresReveal}
        isAnswerRevealed={isAnswerRevealed}
        isOutcomeFinal={isOutcomeFinal}
        allMeanings={allMeanings}
        showEnglish={showEnglish}
        primaryReadingHiragana={primaryReadingHiragana}
        primaryReadingKatakana={primaryReadingKatakana}
        secondaryReadingValue={secondaryReadingValue}
        hasRadicals={hasRadicals}
        hasVisuallySimilar={hasVisuallySimilar}
        hasUsedInVocabulary={hasUsedInVocabulary}
        hasComponentKanji={hasComponentKanji}
        usedKanjiItems={usedKanjiItems}
        usedKanjiCollapsed={usedKanjiCollapsed}
        usedInWordsCollapsed={usedInWordsCollapsed}
        jlptGradeLabel={jlptGradeLabel}
        wrong={wrong}
        skipped={skipped}
        correct={correct}
        onSubmit={onSubmit}
        onSkipCurrent={onSkipCurrent}
        onStartLesson={onStartLesson}
        onResetToLessons={onResetToLessons}
        onToggleUsedKanjiCollapsed={onToggleUsedKanjiCollapsed}
        onToggleUsedInWordsCollapsed={onToggleUsedInWordsCollapsed}
      />
    </>
  );
}
