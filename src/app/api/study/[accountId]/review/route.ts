import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { recordStudyReviewAttempt, recordSubmissionSnapshot } from "@/lib/studyHistory";
import { clearStudyQueueCache } from "@/lib/studyQueueCache";
import { srsLabel } from "@/lib/wanikani/helpers";
import { postWaniKani } from "@/lib/wanikani/http";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

const reviewSchema = z.object({
  assignmentId: z.number().int().positive(),
  result: z.enum(["correct", "wrong"]),
});

type ReviewSubmissionResponse = {
  data?: {
    subject_id?: number;
    starting_srs_stage?: number;
    ending_srs_stage?: number;
  };
  resources_updated?: {
    assignment?: {
      data?: {
        subject_id?: number;
        subject_type?: string;
        srs_stage?: number;
      };
    };
    review_statistic?: {
      data?: {
        subject_id?: number;
        subject_type?: string;
        meaning_correct?: number;
        meaning_incorrect?: number;
        meaning_current_streak?: number;
        meaning_max_streak?: number;
        reading_correct?: number;
        reading_incorrect?: number;
        reading_current_streak?: number;
        reading_max_streak?: number;
        percentage_correct?: number;
      };
    };
  };
};

type ReviewSrsGrouping = "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";

function toStageOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const stage = Math.trunc(value);
  return stage >= 0 ? stage : null;
}

function toGrouping(stage: number | null): ReviewSrsGrouping | null {
  if (stage === null) {
    return null;
  }

  return srsLabel(stage, stage <= 0);
}

function transitionDirection(params: {
  previousGrouping: ReviewSrsGrouping | null;
  newGrouping: ReviewSrsGrouping | null;
}): "promoted" | "demoted" | "unchanged" | "unknown" {
  const { previousGrouping, newGrouping } = params;
  if (!previousGrouping || !newGrouping) {
    return "unknown";
  }

  if (previousGrouping === newGrouping) {
    return "unchanged";
  }

  const groupingOrder: ReviewSrsGrouping[] = [
    "locked",
    "apprentice",
    "guru",
    "master",
    "enlightened",
    "burned",
  ];
  const previousIndex = groupingOrder.indexOf(previousGrouping);
  const nextIndex = groupingOrder.indexOf(newGrouping);

  if (previousIndex < 0 || nextIndex < 0) {
    return "unknown";
  }

  return nextIndex > previousIndex ? "promoted" : "demoted";
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = reviewSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        tokenEncrypted: true,
        tokenIv: true,
        tokenTag: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const token = decryptToken({
      encrypted: account.tokenEncrypted,
      iv: account.tokenIv,
      tag: account.tokenTag,
    });

    const incorrect = parsed.data.result === "wrong" ? 1 : 0;

    let submissionResponse: ReviewSubmissionResponse | null = null;

    try {
      submissionResponse = await postWaniKani<ReviewSubmissionResponse>("/reviews", token, {
        review: {
          assignment_id: parsed.data.assignmentId,
          incorrect_meaning_answers: incorrect,
          incorrect_reading_answers: incorrect,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "WaniKani API error";

      // Treat stale/unavailable submissions as already handled so study flow can continue.
      if (message.includes("422") || message.includes("409") || message.includes("404")) {
        console.warn(`[review] Assignment ${parsed.data.assignmentId} skipped (${message.slice(0, 80)})`);
        clearStudyQueueCache(accountId);
        return NextResponse.json({ ok: true, skipped: true, reason: "already-reviewed-or-unavailable" });
      }

      if (message.includes("429")) {
        return NextResponse.json({ error: "Rate limited by WaniKani. Please retry in a moment." }, { status: 429 });
      }

      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Fire-and-forget: persist history without blocking the response
    const subjectId =
      submissionResponse?.resources_updated?.review_statistic?.data?.subject_id ??
      submissionResponse?.data?.subject_id;

    const subjectType =
      submissionResponse?.resources_updated?.review_statistic?.data?.subject_type ??
      submissionResponse?.resources_updated?.assignment?.data?.subject_type ??
      "unknown";

    const historyWork = Promise.allSettled([
      typeof subjectId === "number" && Number.isInteger(subjectId) && subjectId > 0
        ? recordStudyReviewAttempt({
            accountId,
            assignmentId: parsed.data.assignmentId,
            subjectId,
            subjectType,
            result: parsed.data.result,
          })
        : Promise.resolve(),
      recordSubmissionSnapshot({
        accountId,
        data: submissionResponse?.resources_updated?.review_statistic?.data,
      }),
    ]);
    historyWork.catch((historyError) => {
      console.error("Failed to persist local study history", historyError);
    });

    const previousSrsStage = toStageOrNull(submissionResponse?.data?.starting_srs_stage);
    const newSrsStage =
      toStageOrNull(submissionResponse?.data?.ending_srs_stage) ??
      toStageOrNull(submissionResponse?.resources_updated?.assignment?.data?.srs_stage);
    const previousGrouping = toGrouping(previousSrsStage);
    const newGrouping = toGrouping(newSrsStage);
    const transition = transitionDirection({ previousGrouping, newGrouping });

    clearStudyQueueCache(accountId);

    return NextResponse.json({
      ok: true,
      review: {
        assignmentId: parsed.data.assignmentId,
        subjectId:
          typeof subjectId === "number" && Number.isInteger(subjectId) && subjectId > 0
            ? subjectId
            : null,
        subjectType,
        previousSrsStage,
        newSrsStage,
        previousGrouping,
        newGrouping,
        transition,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not submit review result." }, { status: 500 });
  }
}
