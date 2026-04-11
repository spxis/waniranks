import { decryptToken } from "@/lib/crypto";
import { upsertDailySnapshot } from "@/lib/dailySnapshot";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LEADERBOARD_REFRESH_INTERVAL_MS } from "@/lib/refreshPolicy";
import { getLeaderboardStats } from "@/lib/wanikani";

const SYNC_LOCK_MS = 5 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const MANUAL_REFRESH_COOLDOWN_MS = 60 * 1000;

type SyncResult = {
  refreshed: boolean;
  reason?: string;
};

type RefreshBatchResult = {
  refreshed: number;
  skipped: number;
};

function nowPlus(ms: number): Date {
  return new Date(Date.now() + ms);
}

export async function clearExpiredSyncLocks(now: Date = new Date()): Promise<void> {
  await prisma.account.updateMany({
    where: {
      isSyncing: true,
      syncLockUntil: { lt: now },
    },
    data: {
      isSyncing: false,
      syncLockUntil: null,
      lastSyncStatus: "idle",
    },
  });
}

export async function refreshDueAccounts(maxAccounts = 2): Promise<RefreshBatchResult> {
  const now = new Date();
  await clearExpiredSyncLocks(now);
  const staleBefore = new Date(Date.now() - LEADERBOARD_REFRESH_INTERVAL_MS);

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

  let refreshed = 0;

  for (let index = 0; index < due.length; index += 1) {
    const account = due[index];
    const result = await refreshAccountById(account.id, false);
    if (result.refreshed) {
      refreshed += 1;
    }
  }

  return {
    refreshed,
    skipped: due.length - refreshed,
  };
}

export async function refreshAccountById(accountId: string, force: boolean, ignoreManualCooldown = false): Promise<SyncResult> {
  const now = new Date();
  await clearExpiredSyncLocks(now);
  const staleBefore = new Date(Date.now() - LEADERBOARD_REFRESH_INTERVAL_MS);
  const manualThreshold = new Date(Date.now() - MANUAL_REFRESH_COOLDOWN_MS);

  const claim = await prisma.account.updateMany({
    where: {
      id: accountId,
      ...(force
        ? (ignoreManualCooldown ? {} : { lastSyncedAt: { lt: manualThreshold } })
        : {
            AND: [{ nextSyncAllowedAt: { lte: now } }, { lastSyncedAt: { lt: staleBefore } }],
          }),
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
    return {
      refreshed: false,
      reason: force ? "manual-cooldown-1m" : "not-due-or-busy",
    };
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      tokenEncrypted: true,
      tokenIv: true,
      tokenTag: true,
      wkUserId: true,
      wkUsername: true,
      wkLevel: true,
      reviewCount: true,
      burnedCount: true,
      reviewsUpdatedAt: true,
      lastRadicalGuruedAt: true,
      lastKanjiGuruedAt: true,
      lastVocabularyGuruedAt: true,
      lastRadicalGuruedItem: true,
      lastKanjiGuruedItem: true,
      lastVocabularyGuruedItem: true,
      assignmentCache: true,
      assignmentCacheUpdatedAt: true,
      wkHttpCache: true,
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

    const stats = await getLeaderboardStats(token, {
      wkUserId: account.wkUserId,
      wkUsername: account.wkUsername,
      wkLevel: account.wkLevel,
      reviewCount: account.reviewCount,
      burnedCount: account.burnedCount,
      reviewsUpdatedAt: account.reviewsUpdatedAt,
      lastRadicalGuruedAt: account.lastRadicalGuruedAt,
      lastKanjiGuruedAt: account.lastKanjiGuruedAt,
      lastVocabularyGuruedAt: account.lastVocabularyGuruedAt,
      lastRadicalGuruedItem: account.lastRadicalGuruedItem,
      lastKanjiGuruedItem: account.lastKanjiGuruedItem,
      lastVocabularyGuruedItem: account.lastVocabularyGuruedItem,
      assignmentCache: account.assignmentCache,
      assignmentCacheUpdatedAt: account.assignmentCacheUpdatedAt,
      wkHttpCache: account.wkHttpCache,
    });

    const syncedAt = new Date();

    await prisma.account.update({
      where: { id: account.id },
      data: {
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
        lastActivityAt: stats.lastActivityAt,
        levelKanjiItems: stats.levelKanjiItems,
        itemSpread: stats.itemSpread,
        jlptCounts: stats.jlptCounts,
        assignmentCache: stats.cache.assignmentCache as Prisma.InputJsonValue,
        assignmentCacheUpdatedAt: stats.cache.assignmentCacheUpdatedAt,
        reviewsUpdatedAt: stats.cache.reviewsUpdatedAt,
        lastRadicalGuruedAt: stats.lastRadicalGuruedAt,
        lastKanjiGuruedAt: stats.lastKanjiGuruedAt,
        lastVocabularyGuruedAt: stats.lastVocabularyGuruedAt,
        lastRadicalGuruedItem: stats.lastRadicalGuruedItem as Prisma.InputJsonValue,
        lastKanjiGuruedItem: stats.lastKanjiGuruedItem as Prisma.InputJsonValue,
        lastVocabularyGuruedItem: stats.lastVocabularyGuruedItem as Prisma.InputJsonValue,
        wkHttpCache: stats.cache.wkHttpCache as Prisma.InputJsonValue,
        score: stats.score,
        lastSyncedAt: syncedAt,
        nextSyncAllowedAt: nowPlus(LEADERBOARD_REFRESH_INTERVAL_MS),
        lastSyncStatus: "ok",
        lastSyncError: null,
        isSyncing: false,
        syncLockUntil: null,
      },
    });

    await upsertDailySnapshot({
      accountId: account.id,
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
      levelKanjiLearned: stats.levelKanjiLearned,
      levelKanjiTotal: stats.levelKanjiTotal,
      score: stats.score,
      lastActivityAt: stats.lastActivityAt,
      lastSyncedAt: syncedAt,
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
