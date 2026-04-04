import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getLeaderboardStats } from "@/lib/wanikani";

const DAILY_REFRESH_MS = 24 * 60 * 60 * 1000;
const SYNC_LOCK_MS = 5 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const SUCCESS_COOLDOWN_MS = 60 * 60 * 1000;
const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000;

type SyncResult = {
  refreshed: boolean;
  reason?: string;
};

function nowPlus(ms: number): Date {
  return new Date(Date.now() + ms);
}

export async function refreshDueAccounts(maxAccounts = 2): Promise<void> {
  const now = new Date();
  const staleBefore = new Date(Date.now() - DAILY_REFRESH_MS);

  const due = await prisma.account.findMany({
    where: {
      AND: [
        { lastSyncedAt: { lt: staleBefore } },
        { nextSyncAllowedAt: { lte: now } },
        {
          OR: [{ isSyncing: false }, { syncLockUntil: { lt: now } }, { syncLockUntil: null }],
        },
      ],
    },
    orderBy: { lastSyncedAt: "asc" },
    select: { id: true },
    take: maxAccounts,
  });

  for (const account of due) {
    await refreshAccountById(account.id, false);
  }
}

export async function refreshAccountById(accountId: string, force: boolean): Promise<SyncResult> {
  const now = new Date();
  const manualThreshold = new Date(Date.now() - MANUAL_REFRESH_COOLDOWN_MS);

  const claim = await prisma.account.updateMany({
    where: {
      id: accountId,
      ...(force
        ? { lastSyncedAt: { lt: manualThreshold } }
        : { nextSyncAllowedAt: { lte: now } }),
      OR: [{ isSyncing: false }, { syncLockUntil: { lt: now } }, { syncLockUntil: null }],
    },
    data: {
      isSyncing: true,
      syncLockUntil: nowPlus(SYNC_LOCK_MS),
      lastSyncStatus: "syncing",
      lastSyncError: null,
    },
  });

  if (claim.count === 0) {
    return { refreshed: false, reason: force ? "manual-cooldown-1m" : "busy-or-rate-limited" };
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      tokenEncrypted: true,
      tokenIv: true,
      tokenTag: true,
    },
  });

  if (!account) {
    return { refreshed: false, reason: "missing" };
  }

  try {
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
        score: stats.score,
        lastSyncedAt: new Date(),
        nextSyncAllowedAt: nowPlus(SUCCESS_COOLDOWN_MS),
        lastSyncStatus: "ok",
        lastSyncError: null,
        isSyncing: false,
        syncLockUntil: null,
      },
    });

    return { refreshed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "unknown-sync-error";

    await prisma.account.update({
      where: { id: account.id },
      data: {
        lastSyncStatus: "error",
        lastSyncError: message,
        nextSyncAllowedAt: nowPlus(FAILURE_COOLDOWN_MS),
        isSyncing: false,
        syncLockUntil: null,
      },
    });

    return { refreshed: false, reason: message };
  }
}
