import type { Prisma } from "@prisma/client";

import { encryptToken } from "@/lib/crypto";
import { upsertDailySnapshot } from "@/lib/dailySnapshot";
import { prisma } from "@/lib/prisma";
import { getLeaderboardStats } from "@/lib/wanikani";

type SaveAccountFromTokenArgs = {
  token: string;
  nickname: string;
  joinedByEmail?: string | null;
  joinedByName?: string | null;
};

export async function saveAccountFromToken({
  token,
  nickname,
  joinedByEmail,
  joinedByName,
}: SaveAccountFromTokenArgs) {
  const normalizedEmail = joinedByEmail?.trim().toLowerCase() ?? null;
  const normalizedName = joinedByName?.trim() ?? null;

  const stats = await getLeaderboardStats(token, {
    wkUserId: "",
    wkUsername: "",
    wkLevel: 1,
    reviewCount: 0,
    burnedCount: 0,
    reviewsUpdatedAt: null,
    lastRadicalGuruedAt: null,
    lastKanjiGuruedAt: null,
    lastVocabularyGuruedAt: null,
    lastRadicalGuruedItem: null,
    lastKanjiGuruedItem: null,
    lastVocabularyGuruedItem: null,
    assignmentCache: null,
    assignmentCacheUpdatedAt: null,
    wkHttpCache: null,
  });

  const encrypted = encryptToken(token);
  const syncedAt = new Date();

  if (normalizedEmail) {
    const existingByEmail = await prisma.account.findFirst({
      where: {
        joinedByEmail: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        wkUserId: true,
        wkUsername: true,
      },
    });

    if (existingByEmail && existingByEmail.wkUserId !== stats.wkUserId) {
      throw new Error(
        `This Google account is already linked to @${existingByEmail.wkUsername}. Sign in with that account or use its WaniKani token.`,
      );
    }
  }

  const existingByWkUserId = await prisma.account.findUnique({
    where: { wkUserId: stats.wkUserId },
    select: {
      joinedByEmail: true,
      wkUsername: true,
    },
  });

  if (
    normalizedEmail &&
    existingByWkUserId?.joinedByEmail &&
    existingByWkUserId.joinedByEmail.toLowerCase() !== normalizedEmail
  ) {
    throw new Error(
      `This WaniKani account (@${existingByWkUserId.wkUsername}) is already linked to another Google account.`,
    );
  }

  const account = await prisma.account.upsert({
    where: { wkUserId: stats.wkUserId },
    update: {
      nickname,
      joinedByEmail: normalizedEmail ?? undefined,
      joinedByName: normalizedName ?? undefined,
      tokenEncrypted: encrypted.encrypted,
      tokenIv: encrypted.iv,
      tokenTag: encrypted.tag,
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
      nextSyncAllowedAt: syncedAt,
      lastSyncStatus: "ok",
      lastSyncError: null,
      isSyncing: false,
      syncLockUntil: null,
    },
    create: {
      nickname,
      joinedByEmail: normalizedEmail ?? undefined,
      joinedByName: normalizedName ?? undefined,
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
      nextSyncAllowedAt: syncedAt,
      lastSyncStatus: "ok",
      lastSyncError: null,
      isSyncing: false,
      syncLockUntil: null,
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
      lastActivityAt: true,
      score: true,
      lastSyncedAt: true,
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

  return account;
}
