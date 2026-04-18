import { useCallback, useEffect, useRef, useState } from "react";
import { toHiragana, toKatakana } from "wanakana";
import { getStoredEnum, setStoredEnum } from "@/lib/clientStorage";
import { usePersistedBoolean } from "@/lib/usePersistedBoolean";

import type { RelatedReference, StudyReviewModalProps as Props } from "./StudyReviewModal.types";
import StudyReviewModalSection from "./StudyReviewModalSection";
import { hasRenderableRelatedItems } from "./StudyReviewModalHelpers";
import { useStudyReviewModalKeyboard } from "../lib/useStudyReviewModalKeyboard";

export default function StudyReviewModal({
  accountId,
  showEnglish,
  canToggleEnglish,
  studyMode,
  selectedItem,
  selectedIndex,
  filteredTotal,
  prevLabel,
  nextLabel,
  isSelectedSubmitted,
  isAnswerRevealed,
  isSubmittingSelected,
  submitInFlight,
  submitFeedback,
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
  onResetToLessons,
}: Props) {
  const usedInWordsStorageKey = "wr:study-modal:used-in-words-collapsed";
  const usedKanjiStorageKey = "wr:study-modal:used-kanji-collapsed";
  const viewerModeStorageKey = "wr:study-modal:viewer-mode";

  const [usedInWordsCollapsed, setUsedInWordsCollapsed] = usePersistedBoolean(usedInWordsStorageKey, {
    defaultValue: false,
    mode: "one-is-true",
  });

  const [usedKanjiCollapsed, setUsedKanjiCollapsed] = usePersistedBoolean(usedKanjiStorageKey, {
    defaultValue: false,
    mode: "one-is-true",
  });

  const [viewerMode, setViewerMode] = useState<"detail" | "flash">(() => {
    return getStoredEnum(viewerModeStorageKey, ["detail", "flash"] as const, "detail");
  });

  const [flashRevealKey, setFlashRevealKey] = useState<string | null>(null);
  const [flashCycleDoneKey, setFlashCycleDoneKey] = useState<string | null>(null);
  const flashTouchStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);

  const currentFlashKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}`;
  const flashRevealed = flashRevealKey === currentFlashKey;
  const currentFlashCycleKey = `${viewerMode}:${selectedItem?.assignmentId ?? "none"}:${selectedIndex}:${filteredTotal}`;
  const flashCycleDone = flashCycleDoneKey === currentFlashCycleKey;
  const canUseFlashCycleNext = !studyMode && viewerMode === "flash" && filteredTotal > 0;
  const displayIndex = filteredTotal > 0 ? Math.min(selectedIndex + 1, filteredTotal) : 0;
  const displayTotal = filteredTotal;

  const markCurrentAsSkippedIfUnresolved = useCallback(() => {
    if (!studyMode || !selectedItem || selectedItem.queueType !== "review") return;
    const currentOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
    if (currentOutcome === "correct" || currentOutcome === "wrong" || currentOutcome === "skipped") return;
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
    const isHorizontalSwipe = absDx >= 56 && absDx > absDy * 1.25 && dt <= 750;
    const isVerticalSwipe = absDy >= 56 && absDy > absDx * 1.25 && dt <= 750;

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

  let correct = 0;
  let skipped = 0;
  let wrong = 0;
  for (const outcome of Object.values(reviewOutcomeByAssignmentId)) {
    if (outcome === "correct") correct += 1;
    else if (outcome === "wrong") wrong += 1;
    else if (outcome === "skipped") skipped += 1;
  }

  const allMeanings = Array.from(
    new Set(
      [
        ...selectedItem.meanings,
        ...(selectedItem.jlptMeta?.meanings ?? []),
        ...(selectedItem.jlptMeta?.primaryMeaning ? [selectedItem.jlptMeta.primaryMeaning] : []),
      ].filter((value) => value.trim().length > 0),
    ),
  );

  const primaryReadings = selectedItem.primaryReadings ?? [];
  const secondaryReadings = (selectedItem.readings ?? []).filter((reading) => !primaryReadings.includes(reading));
  const requiresReveal = studyMode && selectedItem.queueType === "review";
  const isLessonItem = selectedItem.queueType === "lesson";
  const selectedOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
  const lessonAlreadySubmitted = isLessonItem && (isSelectedSubmitted || selectedOutcome === "lesson-started");
  const isOutcomeFinal =
    selectedOutcome === "correct" ||
    selectedOutcome === "wrong" ||
    lessonAlreadySubmitted;
  const detailsRevealed = isOutcomeFinal || !requiresReveal || isAnswerRevealed;
  const useStudyFlashLayout = studyMode && selectedItem.queueType === "review";

  const hasRadicals = hasRenderableRelatedItems(selectedItem.radicals as RelatedReference[] | undefined);
  const hasVisuallySimilar = hasRenderableRelatedItems(selectedItem.visuallySimilar as RelatedReference[] | undefined);
  const hasUsedInVocabulary =
    hasRenderableRelatedItems(selectedItem.usedInVocabulary as RelatedReference[] | undefined) ||
    (selectedItem.subjectType === "radical" &&
      hasRenderableRelatedItems(selectedItem.componentKanji as RelatedReference[] | undefined));
  const hasComponentKanji = hasRenderableRelatedItems(selectedItem.componentKanji as RelatedReference[] | undefined);

  const jlptOnReadings = selectedItem.jlptMeta?.onReadings ?? [];
  const jlptKunReadings = selectedItem.jlptMeta?.kunReadings ?? [];
  const primaryReadingHiraganaCandidate =
    primaryReadings.find((reading) => reading.trim().length > 0) ??
    (jlptOnReadings[0] ? toHiragana(jlptOnReadings[0]) : null);
  const matchedPrimaryOn =
    primaryReadingHiraganaCandidate
      ? (jlptOnReadings.find((reading) => toHiragana(reading) === primaryReadingHiraganaCandidate) ??
        toKatakana(primaryReadingHiraganaCandidate))
      : null;

  const primaryReadingHiragana = primaryReadingHiraganaCandidate ?? "-";
  const primaryReadingKatakana = matchedPrimaryOn ?? "-";
  const remainingOnReadings = jlptOnReadings.filter((reading) => reading !== matchedPrimaryOn);
  const secondaryReadingParts = Array.from(
    new Set(
      [
        ...remainingOnReadings,
        ...jlptKunReadings,
        ...(jlptOnReadings.length === 0 && jlptKunReadings.length === 0 ? secondaryReadings : []),
      ].filter((reading) => reading.trim().length > 0),
    ),
  );
  const secondaryReadingValue = secondaryReadingParts.length > 0 ? secondaryReadingParts.join(", ") : "-";
  const usedKanjiItems = (selectedItem.componentKanji as RelatedReference[] | undefined)?.filter(
    (item) => item.label.trim().length > 0 && item.label.trim() !== "-",
  ) ?? [];
  const jlptGradeLabel = typeof selectedItem.jlptMeta?.schoolGrade === "number" ? `Grade ${selectedItem.jlptMeta.schoolGrade}` : "-";

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(8,16,36,0.72)] p-3 backdrop-blur-[2px] sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-line bg-surface shadow-[0_26px_75px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-2 border-b border-line bg-surface-muted px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-6">
          <button type="button" onClick={closeModal} className="self-start rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted sm:justify-self-start">Back To List</button>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-self-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/70 sm:text-xs">#{displayIndex} of {displayTotal}</p>
            {!studyMode ? (
              <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode("detail");
                    setStoredEnum(viewerModeStorageKey, "detail");
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${viewerMode === "detail" ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"}`}
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewerMode("flash");
                    setStoredEnum(viewerModeStorageKey, "flash");
                  }}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${viewerMode === "flash" ? "bg-accent text-white" : "text-foreground hover:bg-surface-muted"}`}
                >
                  Flash
                </button>
              </div>
            ) : null}
            {viewerMode === "detail" ? (
              <button
                type="button"
                onClick={onToggleShowEnglish}
                disabled={!canToggleEnglish}
                className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canToggleEnglish ? (showEnglish ? "Hide English" : "Show English") : "Hints Hidden"}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:justify-self-end">
            <button type="button" onClick={goPrev} disabled={!onPrev || !prevLabel} className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">Prev {prevLabel ?? "-"}</button>
            <button type="button" onClick={advanceFlashOrNext} disabled={!(onNext || canUseFlashCycleNext)} className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50">
              {!onNext && canUseFlashCycleNext ? (flashCycleDone ? "Restart" : "Next") : `Next ${nextLabel ?? "-"}`}
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <StudyReviewModalSection
            accountId={accountId}
            studyMode={studyMode}
            showEnglish={showEnglish}
            canToggleEnglish={canToggleEnglish}
            viewerMode={viewerMode}
            selectedItem={selectedItem}
            selectedOutcome={selectedOutcome}
            isSubmittingSelected={isSubmittingSelected}
            submitInFlight={submitInFlight}
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
            onReveal={onReveal}
            onSubmit={onSubmit}
            onStartLesson={onStartLesson}
            onResetToLessons={onResetToLessons}
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

        <div className="border-t border-line/70 bg-surface px-4 py-3 sm:px-6">
          <p className="rounded-xl border border-line/70 bg-surface-muted px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-[11px]">
            {studyMode
              ? isLessonItem
                ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev"
                : "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev • Space reveal (study) • 1/J wrong • 2/K correct • Skip counts once per item on leave"
              : viewerMode === "flash"
                ? "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter/Space reveal • Enter next (revealed) • Shift+Enter prev • Shift+Space prev • Swipe ←/→ nav • Swipe ↑ reveal"
                : "Keys: Esc close • A/W/↑ prev • D/S/↓ next • Enter next • Shift+Enter prev • Space next • Shift+Space prev"}
          </p>
        </div>
      </div>
    </div>
  );
}
