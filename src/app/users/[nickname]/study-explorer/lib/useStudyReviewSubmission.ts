import { useCallback } from "react";

import type {
  ReviewOutcome,
  StudyCounts,
  StudyQueueItem,
  ReviewSrsTransition,
  SubmitFeedback,
  SubmitInFlight,
} from "./studyExplorerTypes";
import { studyItemEnglishTitle } from "./studyExplorerUtils";

const POST_SUBMIT_DELAY_MS = 500;
const REVIEW_SUBMIT_TIMEOUT_MS = 1500;

type Args = {
  accountId: string;
  modalItems: StudyQueueItem[];
  selectedItem: StudyQueueItem | null;
  hasPendingStudySubmissions: boolean;
  mutateQueue: () => Promise<unknown>;
  onSetLoadedItems: React.Dispatch<React.SetStateAction<StudyQueueItem[]>>;
  onSetTotalItems: React.Dispatch<React.SetStateAction<number>>;
  onSetPersistedCounts: React.Dispatch<React.SetStateAction<StudyCounts | null>>;
  onSetSubmitFeedback: React.Dispatch<React.SetStateAction<SubmitFeedback | null>>;
  onSetLatestReviewTransition: React.Dispatch<React.SetStateAction<ReviewSrsTransition | null>>;
  onSetSubmitInFlight: React.Dispatch<React.SetStateAction<SubmitInFlight | null>>;
  onSetSubmittingByAssignmentId: React.Dispatch<React.SetStateAction<Set<number>>>;
  onSetRevealedAssignmentIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  onSetReviewOutcomeByAssignmentId: React.Dispatch<React.SetStateAction<Record<number, ReviewOutcome>>>;
  onSetHiddenSubmittedAssignmentIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  onSetHasPendingStudySubmissions: React.Dispatch<React.SetStateAction<boolean>>;
  onSetSelectedId: React.Dispatch<React.SetStateAction<number | null>>;
  onSetModalSessionOrderByAssignmentId: React.Dispatch<React.SetStateAction<number[] | null>>;
  onSetModalSessionItemByAssignmentId: React.Dispatch<React.SetStateAction<Record<number, StudyQueueItem>>>;
};

export function useStudyReviewSubmission({
  accountId,
  modalItems,
  selectedItem,
  hasPendingStudySubmissions,
  mutateQueue,
  onSetLoadedItems,
  onSetTotalItems,
  onSetPersistedCounts,
  onSetSubmitFeedback,
  onSetLatestReviewTransition,
  onSetSubmitInFlight,
  onSetSubmittingByAssignmentId,
  onSetRevealedAssignmentIds,
  onSetReviewOutcomeByAssignmentId,
  onSetHiddenSubmittedAssignmentIds,
  onSetHasPendingStudySubmissions,
  onSetSelectedId,
  onSetModalSessionOrderByAssignmentId,
  onSetModalSessionItemByAssignmentId,
}: Args) {
  const removeFromModalSession = useCallback(
    (assignmentId: number) => {
      onSetModalSessionOrderByAssignmentId((prev) =>
        prev ? prev.filter((id) => id !== assignmentId) : prev,
      );
      onSetModalSessionItemByAssignmentId((prev) => {
        if (!(assignmentId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
    },
    [onSetModalSessionItemByAssignmentId, onSetModalSessionOrderByAssignmentId],
  );

  const getSubmissionContext = useCallback(
    (assignmentId: number) => {
      const itemForSubmit =
        modalItems.find((item) => item.assignmentId === assignmentId) ?? selectedItem ?? null;
      const submittedIndex = modalItems.findIndex((item) => item.assignmentId === assignmentId);
      const remainingAfterSubmit = modalItems.filter((item) => item.assignmentId !== assignmentId);
      const nextFocusedItem =
        remainingAfterSubmit[submittedIndex] ??
        remainingAfterSubmit[Math.max(0, submittedIndex - 1)] ??
        null;

      return { itemForSubmit, nextFocusedItem };
    },
    [modalItems, selectedItem],
  );

  const submitReview = useCallback(
    async (assignmentId: number, result: "correct" | "wrong") => {
      const { itemForSubmit, nextFocusedItem } = getSubmissionContext(assignmentId);

      onSetSubmitInFlight({
        assignmentId,
        result,
        itemLabel: itemForSubmit
          ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})`
          : "item",
      });
      onSetSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

      if (itemForSubmit) {
        onSetModalSessionItemByAssignmentId((prev) => ({ ...prev, [assignmentId]: itemForSubmit }));
      }

      try {
        const submitController = new AbortController();
        const submitTimeout = window.setTimeout(() => {
          submitController.abort();
        }, REVIEW_SUBMIT_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(`/api/study/${accountId}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignmentId, result }),
            signal: submitController.signal,
          });
        } catch (networkError) {
          if (networkError instanceof DOMException && networkError.name === "AbortError") {
            throw new Error("Review submission timed out. Please retry.");
          }
          throw networkError;
        } finally {
          window.clearTimeout(submitTimeout);
        }

        const payload = (await response.json()) as {
          error?: string;
          review?: ReviewSrsTransition;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not submit review.");
        }

        if (payload.review && (payload.review.transition === "promoted" || payload.review.transition === "demoted")) {
          onSetLatestReviewTransition(payload.review);
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, POST_SUBMIT_DELAY_MS);
        });

        onSetReviewOutcomeByAssignmentId((prev) => ({ ...prev, [assignmentId]: result }));

        onSetHiddenSubmittedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.add(assignmentId);
          return next;
        });
        onSetLoadedItems((prev) => prev.filter((item) => item.assignmentId !== assignmentId));
        onSetTotalItems((prev) => Math.max(0, prev - 1));
        onSetPersistedCounts((prev) =>
          prev
            ? { ...prev, reviews: Math.max(0, prev.reviews - 1), all: Math.max(0, prev.all - 1) }
            : prev,
        );
        onSetHasPendingStudySubmissions(true);
        onSetSelectedId(nextFocusedItem?.subjectId ?? null);
        onSetRevealedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        removeFromModalSession(assignmentId);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("wr:study-review-submitted", {
              detail: { accountId, subjectId: itemForSubmit?.subjectId },
            }),
          );
        }
      } catch (submitError: unknown) {
        onSetReviewOutcomeByAssignmentId((prev) => {
          const { [assignmentId]: _, ...rest } = prev;
          return rest;
        });
        onSetSubmitFeedback({
          kind: "error",
          message: submitError instanceof Error ? submitError.message : "Could not submit review.",
        });
        console.error("[UmaKuma] Review submission failed for assignment", assignmentId, submitError);
      } finally {
        onSetSubmittingByAssignmentId((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        onSetSubmitInFlight(null);
      }
    },
    [
      accountId,
      getSubmissionContext,
      onSetHasPendingStudySubmissions,
      onSetHiddenSubmittedAssignmentIds,
      onSetLoadedItems,
      onSetModalSessionItemByAssignmentId,
      onSetPersistedCounts,
      onSetRevealedAssignmentIds,
      onSetReviewOutcomeByAssignmentId,
      onSetSelectedId,
      onSetSubmitFeedback,
      onSetLatestReviewTransition,
      onSetSubmitInFlight,
      onSetSubmittingByAssignmentId,
      onSetTotalItems,
      removeFromModalSession,
    ],
  );

  const submitLessonStart = useCallback(
    async (assignmentId: number) => {
      const { itemForSubmit } = getSubmissionContext(assignmentId);

      onSetSubmitInFlight({
        assignmentId,
        result: "start-lesson",
        itemLabel: itemForSubmit
          ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})`
          : "item",
      });
      onSetSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

      try {
        const response = await fetch(`/api/study/${accountId}/lesson/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not start lesson.");

        if (itemForSubmit) {
          onSetModalSessionItemByAssignmentId((prev) => ({ ...prev, [assignmentId]: itemForSubmit }));
        }

        onSetSubmitFeedback({
          kind: "success",
          message: `Added ${
            itemForSubmit ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})` : "item"
          } to reviews.`,
        });

        onSetHiddenSubmittedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.add(assignmentId);
          return next;
        });
        onSetReviewOutcomeByAssignmentId((prev) => ({ ...prev, [assignmentId]: "lesson-started" }));
        onSetHasPendingStudySubmissions(true);
      } catch (submitError) {
        onSetSubmitFeedback({
          kind: "error",
          message: submitError instanceof Error ? submitError.message : "Could not start lesson.",
        });
      } finally {
        onSetSubmittingByAssignmentId((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        onSetRevealedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        onSetSubmitInFlight(null);
      }
    },
    [
      accountId,
      getSubmissionContext,
      onSetHasPendingStudySubmissions,
      onSetHiddenSubmittedAssignmentIds,
      onSetModalSessionItemByAssignmentId,
      onSetRevealedAssignmentIds,
      onSetReviewOutcomeByAssignmentId,
      onSetSubmitFeedback,
      onSetSubmitInFlight,
      onSetSubmittingByAssignmentId,
    ],
  );

  const submitResetToLessons = useCallback(
    async (assignmentId: number) => {
      const { itemForSubmit } = getSubmissionContext(assignmentId);

      onSetSubmitInFlight({
        assignmentId,
        result: "reset-to-lessons",
        itemLabel: itemForSubmit
          ? `${itemForSubmit.characters} (${studyItemEnglishTitle(itemForSubmit)})`
          : "item",
      });
      onSetSubmittingByAssignmentId((prev) => new Set(prev).add(assignmentId));

      try {
        onSetSubmitFeedback({
          kind: "error",
          message:
            "Per-item reset is not available in the official WaniKani API. Use WaniKani account reset for level resets.",
        });
      } catch (submitError) {
        onSetSubmitFeedback({
          kind: "error",
          message: submitError instanceof Error ? submitError.message : "Could not reset item to lessons.",
        });
      } finally {
        onSetSubmittingByAssignmentId((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        onSetRevealedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        onSetSubmitInFlight(null);
      }
    },
    [
      accountId,
      getSubmissionContext,
      onSetRevealedAssignmentIds,
      onSetSubmitFeedback,
      onSetSubmitInFlight,
      onSetSubmittingByAssignmentId,
    ],
  );

  const closeReviewSession = useCallback(() => {
    if (hasPendingStudySubmissions) {
      void fetch(`/api/accounts/${accountId}/refresh`, { method: "POST" }).catch(() => {
        // Non-blocking best-effort refresh after review session closes.
      });
      void mutateQueue();
      onSetHasPendingStudySubmissions(false);
    }

    onSetSelectedId(null);
    onSetReviewOutcomeByAssignmentId({});
    onSetModalSessionOrderByAssignmentId(null);
    onSetModalSessionItemByAssignmentId({});
    onSetSubmitFeedback(null);
    onSetSubmitInFlight(null);
    onSetRevealedAssignmentIds(new Set());
  }, [
    accountId,
    hasPendingStudySubmissions,
    mutateQueue,
    onSetHasPendingStudySubmissions,
    onSetModalSessionItemByAssignmentId,
    onSetModalSessionOrderByAssignmentId,
    onSetReviewOutcomeByAssignmentId,
    onSetRevealedAssignmentIds,
    onSetSelectedId,
    onSetSubmitFeedback,
    onSetSubmitInFlight,
  ]);

  return { submitReview, submitLessonStart, submitResetToLessons, closeReviewSession };
}
