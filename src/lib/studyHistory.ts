import { prisma } from "@/lib/prisma";
import { fetchAllCollectionPages } from "@/lib/wanikani/http";
import type { WaniKaniCollectionResponse } from "@/lib/wanikani/types";

type SnapshotSource = "sync" | "ondemand" | "submit";
type ReviewResult = "correct" | "wrong" | "skipped";

type ParsedReviewStatistic = {
  subjectId: number;
  subjectType: string;
  meaningCorrect: number;
  meaningIncorrect: number;
  meaningCurrentStreak: number;
  meaningMaxStreak: number;
  readingCorrect: number;
  readingIncorrect: number;
  readingCurrentStreak: number;
  readingMaxStreak: number;
  percentageCorrect: number;
};

type SubmissionReviewStatisticData = {
  subject_id?: unknown;
  subject_type?: unknown;
  meaning_correct?: unknown;
  meaning_incorrect?: unknown;
  meaning_current_streak?: unknown;
  meaning_max_streak?: unknown;
  reading_correct?: unknown;
  reading_incorrect?: unknown;
  reading_current_streak?: unknown;
  reading_max_streak?: unknown;
  percentage_correct?: unknown;
};

function toInt(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.trunc(num);
}

function parseReviewStatisticRow(row: WaniKaniCollectionResponse["data"][number]): ParsedReviewStatistic | null {
  const data = row.data as Record<string, unknown>;
  const subjectId = toInt(data.subject_id, -1);
  if (subjectId <= 0) {
    return null;
  }

  const subjectType = typeof data.subject_type === "string" ? data.subject_type : "unknown";

  return {
    subjectId,
    subjectType,
    meaningCorrect: toInt(data.meaning_correct),
    meaningIncorrect: toInt(data.meaning_incorrect),
    meaningCurrentStreak: toInt(data.meaning_current_streak),
    meaningMaxStreak: toInt(data.meaning_max_streak),
    readingCorrect: toInt(data.reading_correct),
    readingIncorrect: toInt(data.reading_incorrect),
    readingCurrentStreak: toInt(data.reading_current_streak),
    readingMaxStreak: toInt(data.reading_max_streak),
    percentageCorrect: toInt(data.percentage_correct),
  };
}

async function insertSnapshot(
  accountId: string,
  source: SnapshotSource,
  input: ParsedReviewStatistic,
): Promise<void> {
  await prisma.subjectReviewStatsSnapshot.create({
    data: {
      accountId,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      meaningCorrect: input.meaningCorrect,
      meaningIncorrect: input.meaningIncorrect,
      meaningCurrentStreak: input.meaningCurrentStreak,
      meaningMaxStreak: input.meaningMaxStreak,
      readingCorrect: input.readingCorrect,
      readingIncorrect: input.readingIncorrect,
      readingCurrentStreak: input.readingCurrentStreak,
      readingMaxStreak: input.readingMaxStreak,
      percentageCorrect: input.percentageCorrect,
      source,
    },
  });
}

export async function captureSubjectReviewStatsFromApi(params: {
  token: string;
  accountId: string;
  subjectId: number;
  source: SnapshotSource;
}): Promise<boolean> {
  const collection = await fetchAllCollectionPages(
    `/review_statistics?subject_ids=${params.subjectId}`,
    params.token,
  );
  const row = collection.data[0];
  if (!row) {
    return false;
  }

  const parsed = parseReviewStatisticRow(row);
  if (!parsed) {
    return false;
  }

  await insertSnapshot(params.accountId, params.source, parsed);
  return true;
}

export async function recordStudyReviewAttempt(params: {
  accountId: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: ReviewResult;
}): Promise<void> {
  await prisma.studyReviewAttempt.create({
    data: {
      accountId: params.accountId,
      assignmentId: params.assignmentId,
      subjectId: params.subjectId,
      subjectType: params.subjectType,
      result: params.result,
    },
  });
}

export async function recordSubmissionSnapshot(params: {
  accountId: string;
  data: SubmissionReviewStatisticData | null | undefined;
}): Promise<void> {
  if (!params.data) {
    return;
  }

  const parsed = parseReviewStatisticRow({
    id: 0,
    data: params.data as Record<string, unknown>,
  } as WaniKaniCollectionResponse["data"][number]);

  if (!parsed) {
    return;
  }

  await insertSnapshot(params.accountId, "submit", parsed);
}

export async function getSubjectHistory(accountId: string, subjectId: number) {
  const [snapshots, attempts] = await Promise.all([
    prisma.subjectReviewStatsSnapshot.findMany({
      where: { accountId, subjectId },
      orderBy: { capturedAt: "asc" },
      take: 60,
    }),
    prisma.studyReviewAttempt.findMany({
      where: { accountId, subjectId },
      orderBy: { submittedAt: "desc" },
      take: 120,
    }),
  ]);

  const latest = snapshots[snapshots.length - 1] ?? null;
  const attemptTotals = attempts.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.result === "correct") acc.correct += 1;
      if (row.result === "wrong") acc.wrong += 1;
      if (row.result === "skipped") acc.skipped += 1;
      return acc;
    },
    { total: 0, correct: 0, wrong: 0, skipped: 0 },
  );

  return {
    latest: latest
      ? {
          subjectType: latest.subjectType,
          percentageCorrect: latest.percentageCorrect,
          meaningCorrect: latest.meaningCorrect,
          meaningIncorrect: latest.meaningIncorrect,
          readingCorrect: latest.readingCorrect,
          readingIncorrect: latest.readingIncorrect,
          meaningCurrentStreak: latest.meaningCurrentStreak,
          meaningMaxStreak: latest.meaningMaxStreak,
          readingCurrentStreak: latest.readingCurrentStreak,
          readingMaxStreak: latest.readingMaxStreak,
          capturedAt: latest.capturedAt.toISOString(),
          source: latest.source,
        }
      : null,
    trend: snapshots.map((row) => ({
      capturedAt: row.capturedAt.toISOString(),
      percentageCorrect: row.percentageCorrect,
      totalAnswers:
        row.meaningCorrect + row.meaningIncorrect + row.readingCorrect + row.readingIncorrect,
      correctAnswers: row.meaningCorrect + row.readingCorrect,
      wrongAnswers: row.meaningIncorrect + row.readingIncorrect,
      source: row.source,
    })),
    attempts: {
      totals: attemptTotals,
      recent: attempts.slice(0, 20).map((row) => ({
        assignmentId: row.assignmentId,
        result: row.result,
        submittedAt: row.submittedAt.toISOString(),
      })),
    },
  };
}
