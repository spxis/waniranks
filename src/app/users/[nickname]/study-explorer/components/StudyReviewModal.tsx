import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import { usePersistedBoolean } from "@/lib/usePersistedBoolean";

import type { RelatedReference, StudyReviewModalProps as Props } from "./StudyReviewModal.types";
import {
  isRadicalSubjectType,
  isReviewQueueItem,
  isLessonQueueItem,
  isTerminalReviewOutcome,
  STUDY_QUEUE_TYPES,
  STUDY_REVIEW_OUTCOMES,
  STUDY_REVIEW_MODAL_STORAGE_KEYS,
  STUDY_REVIEW_MODAL_TOUCH,
  STUDY_REVIEW_MODAL_TRANSITION_CUE_DURATION_MS,
  STUDY_REVIEW_MODAL_VIEWER_MODES,
  STUDY_PANEL_TEXT,
  STUDY_VIEWER_MODES,
} from "./StudyExplorer.constants";
import StudyReviewModalSection from "./StudyReviewModalSection";
import { hasRenderableRelatedItems } from "./StudyReviewModalHelpers";
import { useStudyReviewModalKeyboard } from "../lib/useStudyReviewModalKeyboard";
import {
  buildStudyReviewAllMeanings,
  collectUsedKanjiItems,
  countReviewOutcomes,
  deriveJlptGradeLabel,
  deriveStudyReviewReadings,
} from "../lib/studyReviewModalDerivations";

export default function StudyReviewModal({
  accountId,
  showEnglish,
  canToggleEnglish,
  forcedViewerMode,
  studyMode,
  selectedItem,
  selectedIndex,
  filteredTotal,
  prevLabel,
  nextLabel,
  isSelectedSubmitted,
  isAnswerRevealed,
  isSubmittingSelected,
  submitFeedback,
  latestReviewTransition,
  reviewOutcomeByAssignmentId,
  onMarkSkipped,
  onClose,
  onToggleShowEnglish,
  onPrev,
  onNext,
  onRestartFromBeginning,
  onReveal,
  onSubmit,
  onStartLesson,
  glyphViewerItems,
}: Props) {
  const usedInWordsStorageKey = STUDY_REVIEW_MODAL_STORAGE_KEYS.usedInWordsCollapsed;
  const usedKanjiStorageKey = STUDY_REVIEW_MODAL_STORAGE_KEYS.usedKanjiCollapsed;
  const viewerModeStorageKey = STUDY_REVIEW_MODAL_STORAGE_KEYS.viewerMode;

  const [usedInWordsCollapsed, setUsedInWordsCollapsed] = usePersistedBoolean(usedInWordsStorageKey, {
    defaultValue: false,
    mode: "one-is-true",
  });

  const [usedKanjiCollapsed, setUsedKanjiCollapsed] = usePersistedBoolean(usedKanjiStorageKey, {
    defaultValue: false,
    mode: "one-is-true",
  });

  const [viewerMode, setViewerMode] = useState(() => {
    return getStoredEnum(
      viewerModeStorageKey,
      STUDY_REVIEW_MODAL_VIEWER_MODES,
      STUDY_VIEWER_MODES.detail,
    );
  });

  useEffect(() => {
    if (!forcedViewerMode) {
      return;
    }

    queueMicrotask(() => {
      setViewerMode(forcedViewerMode);
      setStoredEnum(viewerModeStorageKey, forcedViewerMode);
    });
  }, [forcedViewerMode, viewerModeStorageKey]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("wr:study-viewer-mode", {
        detail: { open: true, viewerMode },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("wr:study-viewer-mode", {
          detail: { open: false, viewerMode: null },
        }),
      );
    };
  }, [viewerMode]);

  const [flashRevealKey, setFlashRevealKey] = useState<string | null>(null);
  const [flashCycleDoneKey, setFlashCycleDoneKey] = useState<string | null>(null);
  const [visibleTransitionCue, setVisibleTransitionCue] = useState<{
    assignmentId: number;
    tone: "positive" | "negative";
    message: string;
  } | null>(null);
  const flashTouchStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);

  const currentFlashKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}`;
  const flashRevealed = flashRevealKey === currentFlashKey;
  const currentFlashCycleKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}:${selectedIndex}:${filteredTotal}`;
  const flashCycleDone = flashCycleDoneKey === currentFlashCycleKey;
  const canUseFlashCycleNext = !studyMode && viewerMode === STUDY_VIEWER_MODES.flash && filteredTotal > 0;
  const displayIndex = filteredTotal > 0 ? Math.min(selectedIndex + 1, filteredTotal) : 0;
  const displayTotal = filteredTotal;

  const markCurrentAsSkippedIfUnresolved = useCallback(() => {
    if (!studyMode || !selectedItem || !isReviewQueueItem(selectedItem)) return;
    const currentOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
    if (isTerminalReviewOutcome(currentOutcome)) return;
    onMarkSkipped(selectedItem.assignmentId);
  }, [onMarkSkipped, reviewOutcomeByAssignmentId, selectedItem, studyMode]);

  const closeModal = useCallback(() => {
    markCurrentAsSkippedIfUnresolved();
    onClose();
  }, [markCurrentAsSkippedIfUnresolved, onClose]);

  const goPrev = useCallback(() => {
    if (!onPrev) return;
    markCurrentAsSkippedIfUnresolved();
    setFlashCycleDoneKey(null);
    onPrev();
  }, [markCurrentAsSkippedIfUnresolved, onPrev]);

  const goNextItem = useCallback(() => {
    if (!onNext) return;
    markCurrentAsSkippedIfUnresolved();
    setFlashCycleDoneKey(null);
    onNext();
  }, [markCurrentAsSkippedIfUnresolved, onNext]);

  const advanceFlashOrNext = useCallback(() => {
    if (onNext) {
      goNextItem();
      return;
    }
    if (!canUseFlashCycleNext) return;
    if (!flashCycleDone) {
      setFlashCycleDoneKey(currentFlashCycleKey);
      return;
    }
    setFlashCycleDoneKey(null);
    onRestartFromBeginning?.();
  }, [canUseFlashCycleNext, currentFlashCycleKey, flashCycleDone, goNextItem, onNext, onRestartFromBeginning]);

  const skipCurrentAndAdvance = useCallback(() => {
    if (!selectedItem || selectedItem.queueType !== STUDY_QUEUE_TYPES.review) {
      return;
    }

    const currentOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
    if (!isTerminalReviewOutcome(currentOutcome)) {
      onMarkSkipped(selectedItem.assignmentId);
    }

    advanceFlashOrNext();
  }, [advanceFlashOrNext, onMarkSkipped, reviewOutcomeByAssignmentId, selectedItem]);

  const handleFlashTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    flashTouchStartRef.current = { x: touch.clientX, y: touch.clientY, ts: Date.now() };
  }, []);

  const handleFlashTouchEnd = useCallback((event: React.TouchEvent) => {
    const start = flashTouchStartRef.current;
    flashTouchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dt = Date.now() - start.ts;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isHorizontalSwipe =
      absDx >= STUDY_REVIEW_MODAL_TOUCH.minSwipeDistancePx &&
      absDx > absDy * STUDY_REVIEW_MODAL_TOUCH.axisDominanceRatio &&
      dt <= STUDY_REVIEW_MODAL_TOUCH.maxSwipeDurationMs;
    const isVerticalSwipe =
      absDy >= STUDY_REVIEW_MODAL_TOUCH.minSwipeDistancePx &&
      absDy > absDx * STUDY_REVIEW_MODAL_TOUCH.axisDominanceRatio &&
      dt <= STUDY_REVIEW_MODAL_TOUCH.maxSwipeDurationMs;

    if (isHorizontalSwipe) {
      if (dx < 0) {
        advanceFlashOrNext();
        return;
      }
      goPrev();
      return;
    }

    if (isVerticalSwipe && dy < 0 && !flashCycleDone && !flashRevealed) {
      setFlashRevealKey(currentFlashKey);
    }
  }, [advanceFlashOrNext, currentFlashKey, flashCycleDone, flashRevealed, goPrev]);

  useEffect(() => {
    if (!selectedItem) return;
    const { overflow, overscrollBehavior } = document.body.style;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscrollBehavior;
    };
  }, [selectedItem]);

  useEffect(() => {
    if (!latestReviewTransition) {
      return;
    }

    if (latestReviewTransition.transition !== "promoted" && latestReviewTransition.transition !== "demoted") {
      return;
    }

    const toTitle = (value: string | null): string => {
      if (!value) {
        return "Unknown";
      }
      return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
    };

    const nextGroupingLabel = toTitle(latestReviewTransition.newGrouping);
    const nextStageLabel =
      typeof latestReviewTransition.newSrsStage === "number"
        ? ` (SRS ${latestReviewTransition.newSrsStage})`
        : "";
    const verb = latestReviewTransition.transition === "promoted" ? "Promoted" : "Dropped";

    queueMicrotask(() => {
      setVisibleTransitionCue({
        assignmentId: latestReviewTransition.assignmentId,
        tone: latestReviewTransition.transition === "promoted" ? "positive" : "negative",
        message: `${verb} to ${nextGroupingLabel}${nextStageLabel}`,
      });
    });

    const timeoutId = window.setTimeout(() => {
      setVisibleTransitionCue((current) =>
        current?.assignmentId === latestReviewTransition.assignmentId ? null : current,
      );
    }, STUDY_REVIEW_MODAL_TRANSITION_CUE_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [latestReviewTransition]);

  useStudyReviewModalKeyboard({
    selectedItem,
    studyMode,
    viewerMode,
    flashRevealed,
    currentFlashKey,
    canUseFlashCycleNext,
    isAnswerRevealed,
    reviewOutcomeByAssignmentId,
    onCloseModal: closeModal,
    onGoPrev: goPrev,
    onGoNextItem: goNextItem,
    onAdvanceFlashOrNext: advanceFlashOrNext,
    onReveal,
    onSubmit,
    onSetFlashRevealKey: setFlashRevealKey,
    hasPrev: Boolean(onPrev),
    hasNext: Boolean(onNext),
  });

  if (!selectedItem) {
    return null;
  }

  const { correct, skipped, wrong } = countReviewOutcomes(reviewOutcomeByAssignmentId);
  const allMeanings = buildStudyReviewAllMeanings(selectedItem);
  const requiresReveal = studyMode && isReviewQueueItem(selectedItem);
  const isLessonItem = isLessonQueueItem(selectedItem);
  const selectedOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
  const lessonAlreadySubmitted = isLessonItem && (isSelectedSubmitted || selectedOutcome === "lesson-started");
  const isOutcomeFinal =
    selectedOutcome === STUDY_REVIEW_OUTCOMES.correct ||
    selectedOutcome === STUDY_REVIEW_OUTCOMES.wrong ||
    lessonAlreadySubmitted;
  const detailsRevealed = isOutcomeFinal || !requiresReveal || isAnswerRevealed;
  const useStudyFlashLayout = studyMode && isReviewQueueItem(selectedItem);

  const hasRadicals = hasRenderableRelatedItems(selectedItem.radicals as RelatedReference[] | undefined);
  const hasVisuallySimilar = hasRenderableRelatedItems(selectedItem.visuallySimilar as RelatedReference[] | undefined);
  const hasUsedInVocabulary =
    hasRenderableRelatedItems(selectedItem.usedInVocabulary as RelatedReference[] | undefined) ||
    (isRadicalSubjectType(selectedItem.subjectType) &&
      hasRenderableRelatedItems(selectedItem.componentKanji as RelatedReference[] | undefined));
  const hasComponentKanji = hasRenderableRelatedItems(selectedItem.componentKanji as RelatedReference[] | undefined);
  const { primaryReadingHiragana, primaryReadingKatakana, secondaryReadingValue } =
    deriveStudyReviewReadings(selectedItem);
  const usedKanjiItems = collectUsedKanjiItems(selectedItem);
  const jlptGradeLabel = deriveJlptGradeLabel(selectedItem);

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(8,16,36,0.72)] p-2 backdrop-blur-[2px] sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-line bg-surface shadow-[0_26px_75px_rgba(0,0,0,0.35)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 border-b border-line bg-surface-muted px-2 py-2 sm:gap-2 sm:px-6 sm:py-3">
          <button type="button" onClick={closeModal} className="justify-self-start whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted sm:px-4 sm:py-2 sm:text-xs">Close</button>
          <div className="flex min-w-0 flex-nowrap items-center justify-center gap-1 sm:gap-2">
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70 sm:text-xs sm:tracking-[0.1em]">#{displayIndex} of {displayTotal}</p>
            {studyMode && isReviewQueueItem(selectedItem) ? (
              <div className="flex items-center gap-1">
                <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-800">W {wrong}</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-800">S {skipped}</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">C {correct}</span>
              </div>
            ) : null}
            {!studyMode ? (
              <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode(STUDY_VIEWER_MODES.detail);
                    setStoredEnum(viewerModeStorageKey, STUDY_VIEWER_MODES.detail);
                  }}
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] sm:px-3 ${viewerMode === STUDY_VIEWER_MODES.detail ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"}`}
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode(STUDY_VIEWER_MODES.flash);
                    setStoredEnum(viewerModeStorageKey, STUDY_VIEWER_MODES.flash);
                  }}
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] sm:px-3 ${viewerMode === STUDY_VIEWER_MODES.flash ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"}`}
                >
                  Flash
                </button>
              </div>
            ) : null}
            {viewerMode === STUDY_VIEWER_MODES.detail && canToggleEnglish ? (
              <button
                type="button"
                onClick={onToggleShowEnglish}
                disabled={!canToggleEnglish}
                className="whitespace-nowrap rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
              >
                {showEnglish ? STUDY_PANEL_TEXT.hideEnglish : STUDY_PANEL_TEXT.showEnglish}
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-self-end gap-1 sm:gap-2">
            <button type="button" onClick={goPrev} disabled={!onPrev || !prevLabel} className="whitespace-nowrap rounded-full border border-line bg-surface px-2 py-1 text-[11px] font-bold text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs sm:uppercase sm:tracking-[0.1em]">
              <span className="sm:hidden" aria-hidden>
                Prev
              </span>
              <span className="hidden sm:inline">Prev {prevLabel ?? "-"}</span>
            </button>
            <button type="button" onClick={advanceFlashOrNext} disabled={!(onNext || canUseFlashCycleNext)} className="whitespace-nowrap rounded-full border border-line bg-surface px-2 py-1 text-[11px] font-bold text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs sm:uppercase sm:tracking-[0.1em]">
              <span className="sm:hidden" aria-hidden>
                {!onNext && canUseFlashCycleNext ? (flashCycleDone ? "Restart" : "Next") : "Next"}
              </span>
              <span className="hidden sm:inline">{!onNext && canUseFlashCycleNext ? (flashCycleDone ? "Restart" : "Next") : `Next ${nextLabel ?? "-"}`}</span>
            </button>
          </div>
        </div>

        <div
          className={`relative flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 sm:py-5 ${useStudyFlashLayout ? "overflow-hidden" : "overflow-y-auto"}`}
          onTouchStart={handleFlashTouchStart}
          onTouchEnd={handleFlashTouchEnd}
        >
          {visibleTransitionCue ? (
            <div
              className={`pointer-events-none absolute inset-0 z-10 rounded-[1.25rem] ${
                visibleTransitionCue.tone === "positive"
                  ? "animate-srs-shift-positive"
                  : "animate-srs-shift-negative"
              }`}
            >
              <div className="absolute inset-x-0 top-4 mx-auto w-fit rounded-full border border-line bg-surface/92 px-4 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-foreground shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                {visibleTransitionCue.message}
              </div>
            </div>
          ) : null}

          <StudyReviewModalSection
            accountId={accountId}
            studyMode={studyMode}
            showEnglish={showEnglish}
            canToggleEnglish={canToggleEnglish}
            viewerMode={viewerMode}
            selectedItem={selectedItem}
            selectedOutcome={selectedOutcome}
            isSubmittingSelected={isSubmittingSelected}
            submitFeedback={submitFeedback}
            requiresReveal={requiresReveal}
            isAnswerRevealed={isAnswerRevealed}
            isOutcomeFinal={isOutcomeFinal}
            detailsRevealed={detailsRevealed}
            useStudyFlashLayout={useStudyFlashLayout}
            flashCycleDone={flashCycleDone}
            flashRevealed={flashRevealed}
            currentFlashKey={currentFlashKey}
            allMeanings={allMeanings}
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
            glyphViewerItems={glyphViewerItems}
            glyphViewerIndex={selectedIndex}
            onReveal={onReveal}
            onSubmit={onSubmit}
            onSkipCurrent={skipCurrentAndAdvance}
            onStartLesson={onStartLesson}
            onAdvanceFlashOrNext={advanceFlashOrNext}
            onFlashTouchStart={handleFlashTouchStart}
            onFlashTouchEnd={handleFlashTouchEnd}
            onSetFlashRevealKey={setFlashRevealKey}
            onToggleUsedKanjiCollapsed={() => {
              setUsedKanjiCollapsed((prev) => !prev);
            }}
            onToggleUsedInWordsCollapsed={() => {
              setUsedInWordsCollapsed((prev) => !prev);
            }}
            onToggleShowEnglish={onToggleShowEnglish}
          />
        </div>

        <div className={`border-t border-line/70 bg-surface px-4 py-3 sm:px-6 ${useStudyFlashLayout ? "hidden" : "hidden sm:block"}`}>
          <p className="rounded-xl border border-line/70 bg-surface-muted px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-[11px]">
            {studyMode
              ? isLessonItem
                ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev"
                : "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev • Space reveal (study) • 1/J wrong • 2/K correct • Skip counts once per item on leave"
              : viewerMode === STUDY_VIEWER_MODES.flash
                ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter/Space reveal • Enter next (revealed) • Shift+Enter prev • Shift+Space prev • Swipe ←/→ nav • Swipe ↑ reveal"
                : "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev"}
          </p>
        </div>
      </div>
    </div>
  );
}
