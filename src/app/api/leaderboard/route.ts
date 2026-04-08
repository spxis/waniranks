import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";

export async function GET() {
  try {
    void refreshDueAccounts(1).catch((error) => {
      console.error("Non-blocking refresh failed", error);
    });

    const leaderboard = await prisma.account.findMany({
      orderBy: [{ score: "desc" }, { wkLevel: "desc" }, { reviewCount: "desc" }],
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
        wkLevel: true,
        reviewCount: true,
        burnedCount: true,
        pendingReviews: true,
        radicalCount: true,
        vocabularyCount: true,
        apprenticeCount: true,
        guruCount: true,
        masterCount: true,
        enlightenedCount: true,
        levelKanjiTotal: true,
        levelKanjiLearned: true,
        levelKanjiGuruPlus: true,
        levelKanjiLocked: true,
        itemSpread: true,
        jlptCounts: true,
        estimatedHoursRemaining: true,
        lastActivityAt: true,
        lastRadicalGuruedAt: true,
        lastKanjiGuruedAt: true,
        lastVocabularyGuruedAt: true,
        lastRadicalGuruedItem: true,
        lastKanjiGuruedItem: true,
        lastVocabularyGuruedItem: true,
        score: true,
        lastSyncedAt: true,
      },
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not fetch leaderboard right now." },
      { status: 500 },
    );
  }
}
