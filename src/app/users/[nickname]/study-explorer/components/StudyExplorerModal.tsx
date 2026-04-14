import StudyReviewModal from "./StudyReviewModal";
import type {
  ReviewOutcome,
  StudyQueueItem,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";

type Props = {
  accountId: string;
  isUnauthorized: boolean;
  studyMode: boolean;
  selectedItem: StudyQueueItem | null;
  selectedIndex: number;
  modalItems: StudyQueueItem[];
  prevItem: StudyQueueItem | null;
  nextItem: StudyQueueItem | null;
  filteredItems: StudyQueueItem[];
  isSelectedSubmitted: boolean;
  isAnswerRevealed: boolean;
  isSubmittingSelected: boolean;
  submitInFlight: SubmitInFlight | null;
  submitFeedback: SubmitFeedback | null;
  reviewOutcomeByAssignmentId: Record<number, ReviewOutcome>;
  onSetReviewOutcomeByAssignmentId: React.Dispatch<React.SetStateAction<Record<number, ReviewOutcome>>>;
  onSetSelectedId: React.Dispatch<React.SetStateAction<number | null>>;
  onSetRevealedAssignmentIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  onClose: () => void;
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => Promise<void>;
  onStartLesson: (assignmentId: number) => Promise<void>;
};

export default function StudyExplorerModal({
  accountId,
  isUnauthorized,
  studyMode,
  selectedItem,
  selectedIndex,
  modalItems,
  prevItem,
  nextItem,
  filteredItems,
  isSelectedSubmitted,
  isAnswerRevealed,
  isSubmittingSelected,
  submitInFlight,
  submitFeedback,
  reviewOutcomeByAssignmentId,
  onSetReviewOutcomeByAssignmentId,
  onSetSelectedId,
  onSetRevealedAssignmentIds,
  onClose,
  onSubmit,
  onStartLesson,
}: Props) {
  if (isUnauthorized) {
    return null;
  }

  return (
    <StudyReviewModal
      accountId={accountId}
      studyMode={studyMode}
      selectedItem={selectedItem}
      selectedIndex={selectedIndex}
      filteredTotal={modalItems.length}
      prevLabel={prevItem?.characters ?? null}
      nextLabel={nextItem?.characters ?? null}
      isSelectedSubmitted={isSelectedSubmitted}
      isAnswerRevealed={isAnswerRevealed}
      isSubmittingSelected={isSubmittingSelected}
      submitInFlight={submitInFlight}
      submitFeedback={submitFeedback}
      reviewOutcomeByAssignmentId={reviewOutcomeByAssignmentId}
      onMarkSkipped={(assignmentId: number) => {
        onSetReviewOutcomeByAssignmentId((prev) => {
          const current = prev[assignmentId];
          if (current === "correct" || current === "wrong" || current === "skipped") {
            return prev;
          }

          return { ...prev, [assignmentId]: "skipped" };
        });
      }}
      onClose={onClose}
      onPrev={
        prevItem
          ? () => {
              onSetSelectedId(prevItem.subjectId);
            }
          : null
      }
      onNext={
        nextItem
          ? () => {
              onSetSelectedId(nextItem.subjectId);
            }
          : null
      }
      onRestartFromBeginning={
        filteredItems.length > 0
          ? () => {
              onSetSelectedId(filteredItems[0]?.subjectId ?? null);
            }
          : null
      }
      onReveal={(assignmentId: number) => {
        onSetRevealedAssignmentIds((prev) => new Set(prev).add(assignmentId));
      }}
      onSubmit={onSubmit}
      onStartLesson={onStartLesson}
    />
  );
}
