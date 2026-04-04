import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { refreshDueAccounts } from "@/lib/sync";

export async function GET() {
  try {
    await refreshDueAccounts(1);

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
        estimatedHoursRemaining: true,
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
