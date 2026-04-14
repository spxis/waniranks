import { fetchAllCollectionPages, fetchWaniKani } from "./http";
import {
  maxAssignmentUpdatedAt,
  maxDate,
  mergeAssignmentRows,
  mergeHttpCacheEntry,
  normalizeAssignmentType,
  parseAssignmentCacheRows,
  parseGuruedItemSummary,
  parseHttpCacheState,
  reviewsCheckpointDate,
  toDate,
  srsLabel,
} from "./helpers";
import { getLevelKanjiSnapshot } from "./levelSnapshot";
import { loadSubjectSummaries, loadSubjectTypes } from "./subjects";
import { computeJlptKanjiProgress } from "./leaderboardJlpt";
import type {
  ExistingLeaderboardState,
  LeaderboardStats,
  WaniKaniAssignmentData,
  WaniKaniCollectionResponse,
  WaniKaniReviewData,
  WaniKaniSummaryResponse,
  WaniKaniUserResponse,
} from "./types";

export async function getLeaderboardStats(
  token: string,
  existing: ExistingLeaderboardState,
): Promise<LeaderboardStats> {
  const httpCache = parseHttpCacheState(existing.wkHttpCache);

  const userResponse = await fetchWaniKani<WaniKaniUserResponse>("/user", token, {
    ifNoneMatch: httpCache.user?.etag,
    ifModifiedSince: httpCache.user?.lastModified,
  });

  const wkUserId = userResponse.status === 304 ? existing.wkUserId : userResponse.data?.data.id;
  const wkUsername =
    userResponse.status === 304 ? existing.wkUsername : userResponse.data?.data.username;
  const wkLevel = userResponse.status === 304 ? existing.wkLevel : userResponse.data?.data.level;

  if (!wkUserId || !wkUsername || typeof wkLevel !== "number") {
    throw new Error("Unable to determine WaniKani user profile.");
  }

  const reviewStatsResponse = await fetchWaniKani<WaniKaniCollectionResponse>(
    "/review_statistics",
    token,
    {
      ifNoneMatch: httpCache.reviewStats?.etag,
      ifModifiedSince: httpCache.reviewStats?.lastModified,
    },
  );

  const burnedResponse = await fetchWaniKani<WaniKaniCollectionResponse>(
    "/assignments?srs_stages=9",
    token,
    {
      ifNoneMatch: httpCache.burnedAssignments?.etag,
      ifModifiedSince: httpCache.burnedAssignments?.lastModified,
    },
  );

  const summaryResponse = await fetchWaniKani<WaniKaniSummaryResponse>("/summary", token);
  const summary = summaryResponse.data;

  if (!summary) {
    throw new Error("Unable to fetch WaniKani summary data.");
  }

  const reviewCount =
    reviewStatsResponse.status === 304
      ? existing.reviewCount
      : (reviewStatsResponse.data?.total_count ?? existing.reviewCount);
  const burnedCount =
    burnedResponse.status === 304
      ? existing.burnedCount
      : (burnedResponse.data?.total_count ?? existing.burnedCount);

  const now = Date.now();
  const pendingReviews = summary.data.reviews
    .filter((group) => new Date(group.available_at).getTime() <= now)
    .reduce((sum, group) => sum + group.subject_ids.length, 0);

  const existingAssignmentCache = parseAssignmentCacheRows(existing.assignmentCache);
  const existingAssignmentUpdatedAt =
    existing.assignmentCacheUpdatedAt ?? maxAssignmentUpdatedAt(existingAssignmentCache);

  let assignmentRows = existingAssignmentCache;
  let assignmentCacheUpdatedAt = existingAssignmentUpdatedAt;

  if (!assignmentCacheUpdatedAt || existingAssignmentCache.length === 0) {
    const allAssignments = await fetchAllCollectionPages("/assignments", token);
    assignmentRows = allAssignments.data;
    assignmentCacheUpdatedAt =
      toDate(allAssignments.data_updated_at) ??
      maxAssignmentUpdatedAt(assignmentRows) ??
      new Date();
  } else {
    const updatedAfter = encodeURIComponent(assignmentCacheUpdatedAt.toISOString());
    const assignmentUpdates = await fetchAllCollectionPages(
      `/assignments?updated_after=${updatedAfter}`,
      token,
    );

    if (assignmentUpdates.data.length > 0) {
      assignmentRows = mergeAssignmentRows(existingAssignmentCache, assignmentUpdates.data);
    }

    assignmentCacheUpdatedAt =
      toDate(assignmentUpdates.data_updated_at) ??
      maxAssignmentUpdatedAt(assignmentRows) ??
      assignmentCacheUpdatedAt;
  }

  const levelSnapshot = await getLevelKanjiSnapshot(token, wkLevel);

  const allAssignmentData = assignmentRows.map(
    (row) => row.data as WaniKaniAssignmentData,
  );

  const assignmentTypeBySubjectId = new Map<number, "radical" | "kanji" | "vocabulary">();
  for (const assignment of allAssignmentData) {
    const normalized = normalizeAssignmentType(assignment.subject_type);
    if (!normalized) {
      continue;
    }

    assignmentTypeBySubjectId.set(assignment.subject_id, normalized);
  }

  const reviewPath = existing.reviewsUpdatedAt
    ? `/reviews?updated_after=${encodeURIComponent(existing.reviewsUpdatedAt.toISOString())}`
    : "/reviews";
  const reviewCollection = await fetchAllCollectionPages(reviewPath, token);
  const reviews = reviewCollection.data.map((row) => row.data as WaniKaniReviewData);

  const missingSubjectIds = Array.from(
    new Set(
      reviews
        .map((review) => review.subject_id)
        .filter((subjectId) => !assignmentTypeBySubjectId.has(subjectId)),
    ),
  );
  const fallbackTypeBySubjectId =
    missingSubjectIds.length > 0
      ? await loadSubjectTypes(token, missingSubjectIds)
      : new Map<number, "radical" | "kanji" | "vocabulary">();

  const lastGuruedAt = {
    radical: existing.lastRadicalGuruedAt,
    kanji: existing.lastKanjiGuruedAt,
    vocabulary: existing.lastVocabularyGuruedAt,
  };
  const lastGuruedItem = {
    radical: parseGuruedItemSummary(existing.lastRadicalGuruedItem),
    kanji: parseGuruedItemSummary(existing.lastKanjiGuruedItem),
    vocabulary: parseGuruedItemSummary(existing.lastVocabularyGuruedItem),
  };
  const latestSubjectIdByType: {
    radical: number | null;
    kanji: number | null;
    vocabulary: number | null;
  } = {
    radical: null,
    kanji: null,
    vocabulary: null,
  };

  for (const review of reviews) {
    if (!(review.starting_srs_stage < 5 && review.ending_srs_stage >= 5)) {
      continue;
    }

    const type = assignmentTypeBySubjectId.get(review.subject_id) ?? fallbackTypeBySubjectId.get(review.subject_id);
    if (!type) {
      continue;
    }

    const createdAt = toDate(review.created_at);
    if (!createdAt) {
      continue;
    }

    const current = lastGuruedAt[type];
    if (!current || createdAt.getTime() > current.getTime()) {
      lastGuruedAt[type] = createdAt;
      latestSubjectIdByType[type] = review.subject_id;
    }
  }

  const latestSubjectIds = Array.from(
    new Set(
      [
        latestSubjectIdByType.radical,
        latestSubjectIdByType.kanji,
        latestSubjectIdByType.vocabulary,
      ].filter((value): value is number => value !== null),
    ),
  );
  const latestSubjectSummaryById =
    latestSubjectIds.length > 0 ? await loadSubjectSummaries(token, latestSubjectIds) : new Map();

  for (const type of ["radical", "kanji", "vocabulary"] as const) {
    const subjectId = latestSubjectIdByType[type];
    if (!subjectId) {
      continue;
    }

    const passedAt = lastGuruedAt[type]?.toISOString();
    if (!passedAt) {
      continue;
    }

    const summary = latestSubjectSummaryById.get(subjectId);
    lastGuruedItem[type] = {
      subjectId,
      label: summary?.label ?? `#${subjectId}`,
      reading: summary?.reading ?? null,
      passedAt,
    };
  }

  const reviewsUpdatedAt =
    maxDate([existing.reviewsUpdatedAt, reviewsCheckpointDate(reviewCollection)]) ?? existing.reviewsUpdatedAt;

  const lastActivityAt = allAssignmentData
    .flatMap((assignment) => [
      assignment.started_at,
      assignment.passed_at,
      assignment.burned_at,
      assignment.resurrected_at,
    ])
    .map((value) => toDate(value))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const radicalCount = allAssignmentData.filter(
    (assignment) => assignment.subject_type === "radical" && assignment.srs_stage > 0,
  ).length;
  const vocabularyCount = allAssignmentData.filter(
    (assignment) => assignment.subject_type === "vocabulary" && assignment.srs_stage > 0,
  ).length;

  let apprenticeCount = 0;
  let guruCount = 0;
  let masterCount = 0;
  let enlightenedCount = 0;
  const itemSpread = {
    apprentice: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
    guru: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
    master: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
    enlightened: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
    burned: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
    totals: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  };

  for (const assignment of allAssignmentData) {
    if (!assignment.unlocked_at || assignment.srs_stage <= 0) {
      continue;
    }

    const type = normalizeAssignmentType(assignment.subject_type);
    if (!type) {
      continue;
    }

    const status = srsLabel(assignment.srs_stage, false);
    if (status !== "locked") {
      itemSpread[status][type] += 1;
      itemSpread[status].total += 1;
      itemSpread.totals[type] += 1;
      itemSpread.totals.total += 1;
    }

    if (assignment.srs_stage <= 4) {
      apprenticeCount += 1;
    } else if (assignment.srs_stage <= 6) {
      guruCount += 1;
    } else if (assignment.srs_stage === 7) {
      masterCount += 1;
    } else if (assignment.srs_stage === 8) {
      enlightenedCount += 1;
    }
  }

  const { learnedKanjiCount, jlptCounts } = await computeJlptKanjiProgress(token, allAssignmentData);

  const levelKanjiTotal = levelSnapshot.kanjiTotal;
  const levelKanjiLearned = levelSnapshot.kanjiLearned;
  const levelKanjiGuruPlus = levelSnapshot.kanjiGuruPlus;
  const levelKanjiLocked = levelSnapshot.kanjiLocked;
  const estimatedHoursRemaining = levelSnapshot.estimatedHoursRemaining;
  const levelKanjiItems = levelSnapshot.items;

  const score = wkLevel * 1000 + reviewCount * 2 + burnedCount * 4 + learnedKanjiCount * 3;

  return {
    wkUserId,
    wkUsername,
    wkLevel,
    reviewCount,
    burnedCount,
    pendingReviews,
    radicalCount,
    vocabularyCount,
    apprenticeCount,
    guruCount,
    masterCount,
    enlightenedCount,
    levelKanjiTotal,
    levelKanjiLearned,
    levelKanjiGuruPlus,
    levelKanjiLocked,
    estimatedHoursRemaining,
    lastActivityAt,
    levelKanjiItems,
    itemSpread,
    jlptCounts,
    lastRadicalGuruedAt: lastGuruedAt.radical,
    lastKanjiGuruedAt: lastGuruedAt.kanji,
    lastVocabularyGuruedAt: lastGuruedAt.vocabulary,
    lastRadicalGuruedItem: lastGuruedItem.radical,
    lastKanjiGuruedItem: lastGuruedItem.kanji,
    lastVocabularyGuruedItem: lastGuruedItem.vocabulary,
    score,
    cache: {
      assignmentCache: assignmentRows,
      assignmentCacheUpdatedAt: assignmentCacheUpdatedAt ?? new Date(),
      reviewsUpdatedAt,
      wkHttpCache: {
        user: mergeHttpCacheEntry(httpCache.user, userResponse.headers),
        reviewStats: mergeHttpCacheEntry(httpCache.reviewStats, reviewStatsResponse.headers),
        burnedAssignments: mergeHttpCacheEntry(
          httpCache.burnedAssignments,
          burnedResponse.headers,
        ),
      },
    },
  };
}
