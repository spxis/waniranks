import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
