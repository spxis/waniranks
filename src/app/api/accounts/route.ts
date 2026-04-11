import { NextResponse } from "next/server";
import { z } from "zod";

import { saveAccountFromToken } from "@/lib/accountUpsert";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { clearExpiredSyncLocks } from "@/lib/sync";

const createAccountSchema = z.object({
  nickname: z.string().trim().min(2).max(32),
  token: z.string().trim().min(10),
});

export async function POST(request: Request) {
  try {
    if (!(await isAuthorizedAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createAccountSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { nickname, token } = parsed.data;
    const account = await saveAccountFromToken({
      token,
      nickname,
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

export async function GET(request: Request) {
  try {
    if (!(await isAuthorizedAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    await clearExpiredSyncLocks();

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
        lastActivityAt: true,
        score: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        isSyncing: true,
        syncLockUntil: true,
        joinedByName: true,
        joinedByEmail: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch accounts." }, { status: 500 });
  }
}

