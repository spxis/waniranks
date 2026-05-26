import { prisma } from "@/lib/prisma";

export type ReadingSignoffEntryDelegate = {
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, "asc" | "desc">>;
  }) => Promise<Array<{
    id: string;
    challengeId?: string | null;
    accountId: string;
    signoffDatePst: string;
    bookTitle: string;
    pagesRead: number;
    minutesRead: number;
    didWanikaniReviews: boolean;
    reviewWorkDone: number;
    reviewCorrect: number;
    reviewIncorrect: number;
    reviewSuccessPercent: number | null;
    createdAt: Date;
  }>>;
  create: (args: {
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

export function getReadingSignoffEntryDelegate(): ReadingSignoffEntryDelegate | null {
  const delegate = (prisma as unknown as { readingSignoffEntry?: ReadingSignoffEntryDelegate }).readingSignoffEntry;
  return delegate ?? null;
}

export function challengeReadScope(challengeId: string | null): Record<string, unknown> {
  if (!challengeId) {
    return {};
  }

  return {
    OR: [{ challengeId }, { challengeId: null }],
  };
}
