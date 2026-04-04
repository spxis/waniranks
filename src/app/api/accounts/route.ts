import { NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedAdmin } from "@/lib/admin";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getLeaderboardStats } from "@/lib/wanikani";

const createAccountSchema = z.object({
  nickname: z.string().trim().min(2).max(32),
  token: z.string().trim().min(10),
});

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createAccountSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { nickname, token } = parsed.data;
    const stats = await getLeaderboardStats(token);
    const encrypted = encryptToken(token);

    const account = await prisma.account.upsert({
      where: { nickname },
      update: {
        tokenEncrypted: encrypted.encrypted,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        wkUserId: stats.wkUserId,
        wkUsername: stats.wkUsername,
        wkLevel: stats.wkLevel,
        reviewCount: stats.reviewCount,
        burnedCount: stats.burnedCount,
        pendingReviews: stats.pendingReviews,
        radicalCount: stats.radicalCount,
        vocabularyCount: stats.vocabularyCount,
        apprenticeCount: stats.apprenticeCount,
        guruCount: stats.guruCount,
        masterCount: stats.masterCount,
        enlightenedCount: stats.enlightenedCount,
        levelKanjiTotal: stats.levelKanjiTotal,
        levelKanjiLearned: stats.levelKanjiLearned,
        levelKanjiGuruPlus: stats.levelKanjiGuruPlus,
        levelKanjiLocked: stats.levelKanjiLocked,
        estimatedHoursRemaining: stats.estimatedHoursRemaining,
        levelKanjiItems: stats.levelKanjiItems,
        lastSyncStatus: "ok",
        lastSyncError: null,
        isSyncing: false,
        syncLockUntil: null,
        score: stats.score,
        lastSyncedAt: new Date(),
      },
      create: {
        nickname,
        tokenEncrypted: encrypted.encrypted,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        wkUserId: stats.wkUserId,
        wkUsername: stats.wkUsername,
        wkLevel: stats.wkLevel,
        reviewCount: stats.reviewCount,
        burnedCount: stats.burnedCount,
        pendingReviews: stats.pendingReviews,
        radicalCount: stats.radicalCount,
        vocabularyCount: stats.vocabularyCount,
        apprenticeCount: stats.apprenticeCount,
        guruCount: stats.guruCount,
        masterCount: stats.masterCount,
        enlightenedCount: stats.enlightenedCount,
        levelKanjiTotal: stats.levelKanjiTotal,
        levelKanjiLearned: stats.levelKanjiLearned,
        levelKanjiGuruPlus: stats.levelKanjiGuruPlus,
        levelKanjiLocked: stats.levelKanjiLocked,
        estimatedHoursRemaining: stats.estimatedHoursRemaining,
        levelKanjiItems: stats.levelKanjiItems,
        lastSyncStatus: "ok",
        lastSyncError: null,
        isSyncing: false,
        syncLockUntil: null,
        score: stats.score,
        lastSyncedAt: new Date(),
      },
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

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not save token. Confirm env vars and token validity." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: [{ score: "desc" }, { wkLevel: "desc" }],
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
        lastSyncStatus: true,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch accounts." }, { status: 500 });
  }
}

