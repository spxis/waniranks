import { prisma } from "@/lib/prisma";

const VANCOUVER_TZ = "America/Vancouver";

export type DailySnapshotInput = {
  accountId: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  radicalCount: number;
  vocabularyCount: number;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiLearned: number;
  levelKanjiTotal: number;
  score: number;
  lastActivityAt: Date | null;
  lastSyncedAt: Date;
};

export function getVancouverDateKey(input: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: VANCOUVER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(input);
}

export async function upsertDailySnapshot(input: DailySnapshotInput): Promise<void> {
  const snapshotDatePst = getVancouverDateKey(input.lastSyncedAt);

  await prisma.dailyAccountSnapshot.upsert({
    where: {
      accountId_snapshotDatePst: {
        accountId: input.accountId,
        snapshotDatePst,
      },
    },
    update: {
      snapshotAt: new Date(),
      wkLevel: input.wkLevel,
      reviewCount: input.reviewCount,
      burnedCount: input.burnedCount,
      pendingReviews: input.pendingReviews,
      radicalCount: input.radicalCount,
      vocabularyCount: input.vocabularyCount,
      apprenticeCount: input.apprenticeCount,
      guruCount: input.guruCount,
      masterCount: input.masterCount,
      enlightenedCount: input.enlightenedCount,
      levelKanjiLearned: input.levelKanjiLearned,
      levelKanjiTotal: input.levelKanjiTotal,
      score: input.score,
      lastActivityAt: input.lastActivityAt,
      lastSyncedAt: input.lastSyncedAt,
    },
    create: {
      accountId: input.accountId,
      snapshotDatePst,
      snapshotAt: new Date(),
      wkLevel: input.wkLevel,
      reviewCount: input.reviewCount,
      burnedCount: input.burnedCount,
      pendingReviews: input.pendingReviews,
      radicalCount: input.radicalCount,
      vocabularyCount: input.vocabularyCount,
      apprenticeCount: input.apprenticeCount,
      guruCount: input.guruCount,
      masterCount: input.masterCount,
      enlightenedCount: input.enlightenedCount,
      levelKanjiLearned: input.levelKanjiLearned,
      levelKanjiTotal: input.levelKanjiTotal,
      score: input.score,
      lastActivityAt: input.lastActivityAt,
      lastSyncedAt: input.lastSyncedAt,
    },
  });
}
