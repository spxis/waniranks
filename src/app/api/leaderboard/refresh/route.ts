import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getLeaderboardStats } from "@/lib/wanikani";

type StoredTokenRecord = {
  id: string;
  tokenEncrypted: string;
  tokenIv: string;
  tokenTag: string;
};

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const accounts: StoredTokenRecord[] = await prisma.account.findMany({
      select: {
        id: true,
        tokenEncrypted: true,
        tokenIv: true,
        tokenTag: true,
      },
    });

    await Promise.all(
      accounts.map(async (account) => {
        const token = decryptToken({
          encrypted: account.tokenEncrypted,
          iv: account.tokenIv,
          tag: account.tokenTag,
        });

        const stats = await getLeaderboardStats(token);

        await prisma.account.update({
          where: { id: account.id },
          data: {
            wkUserId: stats.wkUserId,
            wkUsername: stats.wkUsername,
            wkLevel: stats.wkLevel,
            reviewCount: stats.reviewCount,
            burnedCount: stats.burnedCount,
            pendingReviews: stats.pendingReviews,
            score: stats.score,
            lastSyncedAt: new Date(),
          },
        });
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
