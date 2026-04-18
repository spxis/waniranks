import type {
  ReviewOutcome,
  StudyQueueItem,
  SubmitFeedback,
  SubmitInFlight,
} from "../lib/studyExplorerTypes";

export type RelatedReference = {
  subjectId: number;
  label: string;
  wkLevel?: number | null;
  reading?: string | null;
  meaning?: string | null;
};

export type StudyReviewModalProps = {
  accountId: string;
  showEnglish: boolean;
  canToggleEnglish: boolean;
  studyMode: boolean;
  selectedItem: StudyQueueItem | null;
  selectedIndex: number;
  filteredTotal: number;
  prevLabel: string | null;
  nextLabel: string | null;
  isSelectedSubmitted: boolean;
  isAnswerRevealed: boolean;
  isSubmittingSelected: boolean;
  submitInFlight: SubmitInFlight | null;
  submitFeedback: SubmitFeedback | null;
  reviewOutcomeByAssignmentId: Record<number, ReviewOutcome>;
  onMarkSkipped: (assignmentId: number) => void;
  onClose: () => void;
  onToggleShowEnglish: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onRestartFromBeginning: (() => void) | null;
  onReveal: (assignmentId: number) => void;
  onSubmit: (assignmentId: number, result: "correct" | "wrong") => void;
  onStartLesson: (assignmentId: number) => void;
  onResetToLessons: (assignmentId: number) => void;
};
