import type { StudyQueueItem, SubmitInFlight } from "../lib/studyExplorerTypes";

import type { RelatedReference } from "./StudyReviewModal.types";
import LevelExplorerReviewStatsCard from "../../level-explorer/components/LevelExplorerReviewStatsCard";
import { parseWordExamples } from "../../jlpt-explorer/lib/jlptExplorerContentHelpers";
import { openViewGlyphViewer } from "@/lib/viewGlyphViewer";
import {
  formatTimestampWithRelative,
  metricCard,
  readingCard,
  readingDualScriptCard,
  readingWithPronunciation,
  readingsWithPronunciationList,
  relatedTileLabelClass,
  relatedTiles,
  relatedTilesClickable,
} from "./StudyReviewModalHelpers";

type Props = {
  accountId: string;
  studyMode: boolean;
  viewerMode: "detail" | "flash";
  selectedItem: StudyQueueItem;
  submitFeedback: { kind: "success" | "error"; message: string } | null;
  submitInFlight: SubmitInFlight | null;
  isSubmittingSelected: boolean;
  detailsRevealed: boolean;
  useStudyFlashLayout: boolean;
  suppressDetails?: boolean;
  requiresReveal: boolean;
  isAnswerRevealed: boolean;
  isOutcomeFinal: boolean;
  allMeanings: string[];
  showEnglish: boolean;
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
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => void;
  onSkipCurrent: () => void;
  onStartLesson: (assignmentId: number) => void;
  onResetToLessons: (assignmentId: number) => void;
  onToggleUsedKanjiCollapsed: () => void;
  onToggleUsedInWordsCollapsed: () => void;
};

export default function StudyReviewModalMetaPanels({
  accountId,
  studyMode,
  viewerMode,
  selectedItem,
  submitFeedback,
  submitInFlight,
  isSubmittingSelected,
  detailsRevealed,
  useStudyFlashLayout,
  suppressDetails = false,
  requiresReveal,
  isAnswerRevealed,
  isOutcomeFinal,
  allMeanings,
  showEnglish,
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
  onSubmit,
  onSkipCurrent,
  onStartLesson,
  onResetToLessons,
  onToggleUsedKanjiCollapsed,
  onToggleUsedInWordsCollapsed,
}: Props) {
  function openSingleGlyph(params: {
    subjectId: number;
    label: string;
    reading?: string | null;
    meaning?: string | null;
    subjectType?: "kanji" | "radical" | "vocabulary";
  }) {
    openViewGlyphViewer({
      accountId,
      items: [
        {
          assignmentId: -1,
          queueType: "review",
          subjectId: params.subjectId,
          subjectType: params.subjectType ?? "kanji",
          wkLevel: selectedItem.wkLevel,
          characters: params.label,
          meanings: [params.meaning ?? "-"],
          readings: params.reading ? [params.reading] : [],
          primaryReadings: params.reading ? [params.reading] : [],
          radicals: [],
          visuallySimilar: [],
          usedInVocabulary: [],
          componentKanji: [],
          meaningExplanation: undefined,
          readingExplanation: undefined,
          jlptLevel: selectedItem.jlptLevel ?? null,
          jlptMeta: null,
          srsStage: selectedItem.srsStage,
          status: selectedItem.status,
          startedAt: selectedItem.startedAt ?? null,
          passedAt: selectedItem.passedAt ?? null,
          availableAt: selectedItem.availableAt ?? null,
        },
      ],
      startIndex: 0,
    });
  }

  const wordExamples = parseWordExamples(selectedItem.jlptMeta?.wordExamples);
  const submitActionLabel =
    submitInFlight?.result === "correct"
      ? "CORRECT"
      : submitInFlight?.result === "wrong"
        ? "WRONG"
        : submitInFlight?.result === "reset-to-lessons"
          ? "RESET"
        : "LESSON";

  return (
    <>
      {!suppressDetails && ((!studyMode && viewerMode === "flash") || useStudyFlashLayout ? null : detailsRevealed ? (
        <>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {readingDualScriptCard(
              "Primary readings",
              readingWithPronunciation(primaryReadingHiragana, showEnglish),
              readingWithPronunciation(primaryReadingKatakana, showEnglish),
            )}
            {readingCard("Secondary readings", readingsWithPronunciationList(secondaryReadingValue, showEnglish))}
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {metricCard("Started", formatTimestampWithRelative(selectedItem.startedAt))}
            {metricCard("Next review", formatTimestampWithRelative(selectedItem.availableAt))}
            {metricCard("Passed", formatTimestampWithRelative(selectedItem.passedAt))}
          </div>

          {hasRadicals || hasVisuallySimilar || hasUsedInVocabulary ? (
            <div className="mt-2 space-y-2">
              {hasRadicals || hasVisuallySimilar ? (
                <div className={`grid gap-2 ${hasRadicals && hasVisuallySimilar ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                  {hasRadicals ? (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Radicals</p>
                      {relatedTilesClickable(selectedItem.radicals as RelatedReference[] | undefined, (entry) => {
                        openSingleGlyph({ subjectId: entry.subjectId, label: entry.label, reading: entry.reading, subjectType: "radical" });
                      })}
                    </div>
                  ) : null}
                  {hasVisuallySimilar ? (
                    <div className="rounded-xl border border-line bg-surface px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Visually similar</p>
                      {relatedTilesClickable(selectedItem.visuallySimilar as RelatedReference[] | undefined, (entry) => {
                        openSingleGlyph({ subjectId: entry.subjectId, label: entry.label, reading: entry.reading, subjectType: "kanji" });
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasUsedInVocabulary ? (
                <div className="rounded-xl border border-line bg-surface px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">
                    {selectedItem.subjectType === "radical" ? "Used in kanji" : "Used in vocabulary"}
                  </p>
                  {relatedTilesClickable(selectedItem.usedInVocabulary as RelatedReference[] | undefined, (entry) => {
                    openSingleGlyph({
                      subjectId: entry.subjectId,
                      label: entry.label,
                      reading: entry.reading,
                      subjectType: selectedItem.subjectType === "radical" ? "kanji" : "vocabulary",
                    });
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasComponentKanji ? (
            <div className="mt-2">
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Component kanji</p>
                {relatedTilesClickable(selectedItem.componentKanji as RelatedReference[] | undefined, (entry) => {
                  openSingleGlyph({ subjectId: entry.subjectId, label: entry.label, reading: entry.reading, subjectType: "kanji" });
                })}
              </div>
            </div>
          ) : null}

          {selectedItem.subjectType === "vocabulary" && usedKanjiItems.length > 0 ? (
            <div className="mt-2">
              <div className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used kanji</p>
                  <button
                    type="button"
                    onClick={onToggleUsedKanjiCollapsed}
                    className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface"
                  >
                    {usedKanjiCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
                {!usedKanjiCollapsed ? (
                  <ul className="mt-2 space-y-2 text-foreground/90">
                    {usedKanjiItems.map((item, index) => (
                      <li
                        key={`${selectedItem.subjectId}-${item.subjectId}-${item.label}-${index}`}
                        className="rounded-lg border border-line bg-surface-muted px-3 py-2"
                      >
                        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              openSingleGlyph({
                                subjectId: item.subjectId,
                                label: item.label,
                                reading: item.reading ?? null,
                                meaning: item.meaning ?? null,
                                subjectType: "kanji",
                              });
                            }}
                            className={`cursor-pointer text-left font-black leading-none text-foreground hover:opacity-85 ${relatedTileLabelClass(item.label)}`}
                          >
                            {item.label}
                          </button>
                          <p className="text-2xl font-bold leading-none text-foreground/80">{item.reading || "-"}</p>
                        </div>
                        <p className="mt-1 text-sm text-foreground/85">{item.meaning || "-"}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedItem.jlptMeta ? (
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {metricCard("JLPT meanings", selectedItem.jlptMeta.meanings.slice(0, 6).join(" • ") || "-")}
              {metricCard("Stroke/Freq", `${selectedItem.jlptMeta.strokeCount ?? "-"} / ${selectedItem.jlptMeta.frequencyRank ?? "-"}`)}
              {metricCard("Grade/Heisig", `${jlptGradeLabel} / ${selectedItem.jlptMeta.heisigKeyword ?? "-"}`)}
            </div>
          ) : null}

          {wordExamples.length > 0 ? (
            <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">Used in words</p>
                <button
                  type="button"
                  onClick={onToggleUsedInWordsCollapsed}
                  className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface"
                >
                  {usedInWordsCollapsed ? "Expand" : "Collapse"}
                </button>
              </div>
              {!usedInWordsCollapsed ? (
                <ul className="mt-2 space-y-2 text-foreground/90">
                  {wordExamples.map((example, index) => (
                    <li
                      key={`${selectedItem.subjectId}-${example.written}-${example.pronounced}-${index}`}
                      className="rounded-lg border border-line bg-surface-muted px-3 py-2"
                    >
                      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            openSingleGlyph({
                              subjectId: -(index + 1),
                              label: example.written || "-",
                              reading: example.pronounced || null,
                              meaning: example.gloss || null,
                              subjectType: "vocabulary",
                            });
                          }}
                          className={`cursor-pointer text-left font-black leading-none text-foreground hover:opacity-85 ${relatedTileLabelClass(example.written || "-")}`}
                        >
                          {example.written || "-"}
                        </button>
                        <p className="text-2xl font-bold leading-none text-foreground/80">{example.pronounced || "-"}</p>
                      </div>
                      <p className="mt-1 text-sm text-foreground/85">{example.gloss || "-"}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2">
            <LevelExplorerReviewStatsCard
              accountId={accountId}
              subjectId={selectedItem.subjectId}
              currentSrsStage={selectedItem.srsStage}
              startedAt={selectedItem.startedAt}
            />
          </div>
        </>
      ) : null)}

      {selectedItem.queueType === "review" && studyMode && (!requiresReveal || isAnswerRevealed) && !useStudyFlashLayout && !isOutcomeFinal ? (
        <div className="mt-auto grid w-full gap-2 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSubmit(selectedItem.assignmentId, "wrong")}
              aria-keyshortcuts="1"
              title="Wrong (Key: 1)"
              className="min-h-[4.25rem] w-full rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-red-800"
            >
              <span className="block">Wrong</span>
              <span className="mt-1 block text-xl leading-none">{wrong}</span>
            </button>
            <button
              type="button"
              onClick={() => onSubmit(selectedItem.assignmentId, "correct")}
              aria-keyshortcuts="2"
              title="Correct (Key: 2)"
              className="min-h-[4.25rem] w-full rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.1em] text-emerald-800"
            >
              <span className="block">Correct</span>
              <span className="mt-1 block text-xl leading-none">{correct}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onSkipCurrent}
            className="min-h-[4rem] w-full rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-amber-800"
          >
            <span className="block">Skipped</span>
            <span className="mt-1 block text-xl leading-none">{skipped}</span>
          </button>
        </div>
      ) : null}

      {selectedItem.queueType === "lesson" && !isOutcomeFinal ? (
        <div className="mt-auto w-full pt-3">
          <button
            type="button"
            onClick={() => onStartLesson(selectedItem.assignmentId)}
            className="min-h-[4.25rem] w-full rounded-2xl border-2 border-accent/50 bg-accent/10 px-4 py-4 text-base font-black uppercase tracking-[0.1em] text-accent"
          >
            Add To My Reviews
          </button>
        </div>
      ) : null}

      {selectedItem.queueType === "lesson" && isOutcomeFinal ? (
        <div className="mt-auto w-full pt-3">
          <div className="flex min-h-[4.25rem] w-full items-center justify-center rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 text-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.1em] text-emerald-800">Added To Reviews</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700/80">Already submitted in this session</p>
            </div>
          </div>
        </div>
      ) : null}

      {submitFeedback ? (
        <p className={`mt-3 rounded-xl border px-4 py-3 text-sm font-black uppercase tracking-[0.08em] ${submitFeedback.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"}`}>
          {submitFeedback.message}
        </p>
      ) : null}

      {isSubmittingSelected ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] text-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            {submitInFlight ? `Submitting ${submitActionLabel} for ${submitInFlight.itemLabel}...` : "Submitting..."}
          </div>
        </div>
      ) : null}
    </>
  );
}
