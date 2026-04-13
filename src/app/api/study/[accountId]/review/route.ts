import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { recordStudyReviewAttempt, recordSubmissionSnapshot } from "@/lib/studyHistory";
import { clearStudyQueueCache } from "@/lib/studyQueueCache";
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
  };
  resources_updated?: {
    assignment?: {
      data?: {
        subject_type?: string;
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
        clearStudyQueueCache(accountId);
        return NextResponse.json({ ok: true, skipped: true, reason: "already-reviewed-or-unavailable" });
      }

      if (message.includes("429")) {
        return NextResponse.json({ error: "Rate limited by WaniKani. Please retry in a moment." }, { status: 429 });
      }

      return NextResponse.json({ error: message }, { status: 502 });
    }

    try {
      const subjectId =
        submissionResponse?.resources_updated?.review_statistic?.data?.subject_id ??
        submissionResponse?.data?.subject_id;

      const subjectType =
        submissionResponse?.resources_updated?.review_statistic?.data?.subject_type ??
        submissionResponse?.resources_updated?.assignment?.data?.subject_type ??
        "unknown";

      if (typeof subjectId === "number" && Number.isInteger(subjectId) && subjectId > 0) {
        await recordStudyReviewAttempt({
          accountId,
          assignmentId: parsed.data.assignmentId,
          subjectId,
          subjectType,
          result: parsed.data.result,
        });
      }

      await recordSubmissionSnapshot({
        accountId,
        data: submissionResponse?.resources_updated?.review_statistic?.data,
      });
    } catch (historyError) {
      console.error("Failed to persist local study history", historyError);
    }

    clearStudyQueueCache(accountId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not submit review result." }, { status: 500 });
  }
}
