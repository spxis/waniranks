"use client";

import { useMemo } from "react";

import StudyReviewModal from "@/app/users/[nickname]/study-explorer/components/StudyReviewModal";
import type { StudyQueueItem } from "@/app/users/[nickname]/study-explorer/lib/studyExplorerTypes";
import {
  isSubjectType,
  WK_STATUSES,
  SUBJECT_TYPES,
} from "@/lib/domainConstants";

import type { StudyHistoryAttempt } from "./studyHistoryTypes";

type Props = {
  attempts: StudyHistoryAttempt[];
  selectedAttemptId: string | null;
  onSelectAttemptId: (attemptId: string) => void;
  onClose: () => void;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function toStudyQueueItem(attempt: StudyHistoryAttempt): StudyQueueItem {
  const subject = attempt.subjectData;

  return {
    assignmentId: attempt.assignmentId,
    queueType: "review",
    subjectId: attempt.subjectId,
    subjectType:
      isSubjectType(subject?.subjectType)
        ? subject.subjectType
        : isSubjectType(attempt.subjectType)
          ? attempt.subjectType
          : SUBJECT_TYPES.kanji,
    wkLevel: typeof subject?.wkLevel === "number" ? subject.wkLevel : attempt.wkLevel ?? undefined,
    characters: subject?.characters ?? attempt.subjectLabel,
    meanings: toStringArray(subject?.meanings).length > 0 ? toStringArray(subject?.meanings) : [attempt.subjectMeaning ?? "-"],
    readings: toStringArray(subject?.readings),
    primaryReadings:
      toStringArray(subject?.primaryReadings).length > 0
        ? toStringArray(subject?.primaryReadings)
        : attempt.subjectReading
          ? [attempt.subjectReading]
          : [],
    radicals: subject?.radicals,
    visuallySimilar: subject?.visuallySimilar,
    usedInVocabulary: subject?.usedInVocabulary,
    componentKanji: subject?.componentKanji,
    meaningExplanation: subject?.meaningExplanation,
    readingExplanation: subject?.readingExplanation,
    jlptLevel: subject?.jlptLevel ?? null,
    jlptMeta: subject?.jlptMeta ?? null,
    srsStage: typeof subject?.srsStage === "number" ? subject.srsStage : attempt.srsStage ?? 1,
    status:
      subject?.status ??
      (attempt.srsBucket === "unknown"
        ? WK_STATUSES.apprentice
        : attempt.srsBucket === WK_STATUSES.burned
          ? WK_STATUSES.burned
          : attempt.srsBucket),
    startedAt: subject?.startedAt ?? null,
    passedAt: subject?.passedAt ?? null,
    availableAt: subject?.availableAt ?? null,
  };
}

export default function HistoryItemDetailModal({
  attempts,
  selectedAttemptId,
  onSelectAttemptId,
  onClose,
}: Props) {
  const selectedIndex = useMemo(() => {
    if (!selectedAttemptId) {
      return -1;
    }

    return attempts.findIndex((row) => row.id === selectedAttemptId);
  }, [attempts, selectedAttemptId]);

  const selectedAttempt = selectedIndex >= 0 ? attempts[selectedIndex] : null;

  const queueItems = useMemo(() => attempts.map(toStudyQueueItem), [attempts]);
  const selectedItem = selectedIndex >= 0 ? queueItems[selectedIndex] : null;

  if (!selectedAttempt || !selectedItem) {
    return null;
  }

  const previousAttempt = selectedIndex > 0 ? attempts[selectedIndex - 1] : null;
  const nextAttempt = selectedIndex >= 0 && selectedIndex < attempts.length - 1 ? attempts[selectedIndex + 1] : null;

  return (
    <StudyReviewModal
      accountId={selectedAttempt.accountId}
      showEnglish
      canToggleEnglish={false}
      forcedViewerMode="detail"
      studyMode={false}
      selectedItem={selectedItem}
      selectedIndex={selectedIndex}
      filteredTotal={attempts.length}
      prevLabel={previousAttempt?.subjectLabel ?? null}
      nextLabel={nextAttempt?.subjectLabel ?? null}
      isSelectedSubmitted={false}
      isAnswerRevealed
      isSubmittingSelected={false}
      submitInFlight={null}
      submitFeedback={null}
      latestReviewTransition={null}
      reviewOutcomeByAssignmentId={{}}
      onMarkSkipped={() => {}}
      onClose={onClose}
      onToggleShowEnglish={() => {}}
      onPrev={
        previousAttempt
          ? () => {
              onSelectAttemptId(previousAttempt.id);
            }
          : null
      }
      onNext={
        nextAttempt
          ? () => {
              onSelectAttemptId(nextAttempt.id);
            }
          : null
      }
      onRestartFromBeginning={
        attempts.length > 0
          ? () => {
              onSelectAttemptId(attempts[0]!.id);
            }
          : null
      }
      onReveal={() => {}}
      onSubmit={() => {}}
      onStartLesson={() => {}}
      onResetToLessons={() => {}}
      glyphViewerItems={queueItems}
    />
  );
}
