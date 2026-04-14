import { useEffect } from "react";

import type { ReviewOutcome, StudyQueueItem } from "./studyExplorerTypes";

type UseStudyReviewModalKeyboardArgs = {
  selectedItem: StudyQueueItem | null;
  studyMode: boolean;
  viewerMode: "detail" | "flash";
  flashRevealed: boolean;
  currentFlashKey: string;
  canUseFlashCycleNext: boolean;
  isAnswerRevealed: boolean;
  reviewOutcomeByAssignmentId: Record<number, ReviewOutcome>;
  onCloseModal: () => void;
  onGoPrev: () => void;
  onGoNextItem: () => void;
  onAdvanceFlashOrNext: () => void;
  onReveal: (assignmentId: number) => void;
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => void;
  onSetFlashRevealKey: (value: string) => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function useStudyReviewModalKeyboard({
  selectedItem,
  studyMode,
  viewerMode,
  flashRevealed,
  currentFlashKey,
  canUseFlashCycleNext,
  isAnswerRevealed,
  reviewOutcomeByAssignmentId,
  onCloseModal,
  onGoPrev,
  onGoNextItem,
  onAdvanceFlashOrNext,
  onReveal,
  onSubmit,
  onSetFlashRevealKey,
  hasPrev,
  hasNext,
}: UseStudyReviewModalKeyboardArgs) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedItem) return;

      const requiresReveal = studyMode && selectedItem.queueType === "review";
      const selectedOutcome = reviewOutcomeByAssignmentId[selectedItem.assignmentId];
      const isOutcomeFinal = selectedOutcome === "correct" || selectedOutcome === "wrong";
      const key = event.key;
      const lowerKey = key.toLowerCase();

      if (!studyMode && viewerMode === "flash" && !flashRevealed && key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        onSetFlashRevealKey(currentFlashKey);
        return;
      }

      if (
        key === "Escape" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === " " ||
        key === "Enter" ||
        lowerKey === "a" ||
        lowerKey === "w" ||
        lowerKey === "s" ||
        lowerKey === "d" ||
        lowerKey === "j" ||
        lowerKey === "k" ||
        key === "1" ||
        key === "2"
      ) {
        event.preventDefault();
      }

      if (key === "Escape") return onCloseModal();
      if ((key === "ArrowLeft" || key === "a" || key === "A" || key === "ArrowUp" || key === "w" || key === "W" || (key === "Enter" && event.shiftKey)) && hasPrev) return onGoPrev();
      if ((key === "ArrowRight" || key === "ArrowDown" || key === "d" || key === "D" || (key === "Enter" && !event.shiftKey)) && (hasNext || canUseFlashCycleNext)) return onAdvanceFlashOrNext();
      if ((key === "s" || key === "S") && hasNext) return onGoNextItem();

      if (key === " ") {
        if (!studyMode && viewerMode === "flash" && !flashRevealed && !event.shiftKey) {
          onSetFlashRevealKey(currentFlashKey);
          return;
        }
        if (requiresReveal && !isAnswerRevealed && selectedItem.queueType === "review") {
          onReveal(selectedItem.assignmentId);
          return;
        }
        if (event.shiftKey && hasPrev) return onGoPrev();
        if (hasNext || canUseFlashCycleNext) return onAdvanceFlashOrNext();
      }

      if ((key === "1" || key === "2" || key === "j" || key === "J" || key === "k" || key === "K") && selectedItem.queueType === "review") {
        if (!studyMode || isOutcomeFinal) return;
        const canSubmit = !requiresReveal || isAnswerRevealed;
        if (!canSubmit) return;
        const isWrong = key === "1" || key.toLowerCase() === "j";
        onSubmit(selectedItem.assignmentId, isWrong ? "wrong" : "correct");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUseFlashCycleNext,
    currentFlashKey,
    flashRevealed,
    hasNext,
    hasPrev,
    isAnswerRevealed,
    onAdvanceFlashOrNext,
    onCloseModal,
    onGoNextItem,
    onGoPrev,
    onReveal,
    onSetFlashRevealKey,
    onSubmit,
    reviewOutcomeByAssignmentId,
    selectedItem,
    studyMode,
    viewerMode,
  ]);
}
