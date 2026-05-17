import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getCachedStudyQueue, setCachedStudyQueue } from "@/lib/studyQueueCache";
import { SUBJECT_TYPES } from "@/lib/domainConstants";
import { srsLabel } from "@/lib/wanikani/helpers";
import {
  fetchAssignmentCount,
  hydrateMissingSubjects,
  normalizeSubjectType,
  queueRowsFromState,
  type SubjectData,
} from "./queueRouteUtils";
import { hydrateQueueSyncState } from "./queueRouteSync";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/study/[accountId]/queue",
    method: "GET",
    request,
    execute: async () => {
      try {
        const url = new URL(request.url);
        const modeParam = url.searchParams.get("mode");
        const mode = modeParam === "lesson" ? "lesson" : modeParam === "all" ? "all" : "review";
        const limitParam = Number(url.searchParams.get("limit") ?? "");
        const offsetParam = Number(url.searchParams.get("offset") ?? "");
        const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : null;
        const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const { accountId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        tokenEncrypted: true,
        tokenIv: true,
        tokenTag: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const token = decryptToken({
      encrypted: account.tokenEncrypted,
      iv: account.tokenIv,
      tag: account.tokenTag,
    });

    const cached = getCachedStudyQueue(accountId, mode);
    if (cached) {
      const cachedItems = cached.items as Array<{
        queueType: "review" | "lesson";
      }>;
      const pagedItems = limit === null ? cachedItems : cachedItems.slice(offset, offset + limit);

      return NextResponse.json(
        {
          items: pagedItems,
          counts: cached.counts,
          levelCounts: cached.levelCounts ?? {},
          typeCounts: cached.typeCounts ?? { all: 0, radical: 0, kanji: 0, vocabulary: 0 },
          typeCountsByLevel: cached.typeCountsByLevel ?? {},
          srsCounts: cached.srsCounts ?? {
            all: 0,
            locked: 0,
            apprentice: 0,
            guru: 0,
            master: 0,
            enlightened: 0,
            burned: 0,
          },
          srsStageCounts: cached.srsStageCounts ?? {},
          pagination: {
            offset,
            limit: limit ?? cachedItems.length,
            total: cachedItems.length,
            hasMore: limit === null ? false : offset + limit < cachedItems.length,
          },
          cached: true,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
          },
        },
      );
    }

    const reviewState =
      mode === "lesson" ? null : await hydrateQueueSyncState(accountId, "review", token);
    const lessonState =
      mode === "review" ? null : await hydrateQueueSyncState(accountId, "lesson", token);

    const reviewAssignments = reviewState ? queueRowsFromState(reviewState, "review") : [];
    const lessonAssignments = lessonState ? queueRowsFromState(lessonState, "lesson") : [];
    const queued =
      mode === "all"
        ? [...reviewAssignments, ...lessonAssignments]
        : mode === "lesson"
          ? lessonAssignments
          : reviewAssignments;

    const subjectById = new Map<number, { object: string; data: SubjectData }>();
    if (reviewState) {
      for (const [subjectId, row] of reviewState.subjectById.entries()) {
        subjectById.set(subjectId, { object: row.object, data: row.data });
      }
    }

    if (lessonState) {
      for (const [subjectId, row] of lessonState.subjectById.entries()) {
        subjectById.set(subjectId, { object: row.object, data: row.data });
      }
    }

    const relatedSubjectIds = new Set<number>();
    for (const row of queued) {
      const subject = subjectById.get(row.data.subject_id)?.data;
      if (!subject) {
        continue;
      }

      for (const subjectId of subject.component_subject_ids ?? []) {
        relatedSubjectIds.add(subjectId);
      }

      for (const subjectId of subject.amalgamation_subject_ids ?? []) {
        relatedSubjectIds.add(subjectId);
      }

      for (const subjectId of subject.visually_similar_subject_ids ?? []) {
        relatedSubjectIds.add(subjectId);
      }
    }

    if (relatedSubjectIds.size > 0) {
      await hydrateMissingSubjects(token, subjectById, Array.from(relatedSubjectIds));
    }

    const kanjiChars = Array.from(
      new Set(
        queued
          .filter((row) => normalizeSubjectType(row.data.subject_type) === SUBJECT_TYPES.kanji)
          .map((row) => subjectById.get(row.data.subject_id)?.data.characters)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const jlptRows =
      kanjiChars.length > 0
        ? await prisma.jlptKanji.findMany({
            where: { kanji: { in: kanjiChars } },
            select: {
              kanji: true,
              nLevel: true,
              primaryMeaning: true,
              meanings: true,
              onReadings: true,
              kunReadings: true,
              nanoriReadings: true,
              wordExamples: true,
              strokeCount: true,
              frequencyRank: true,
              schoolGrade: true,
              heisigKeyword: true,
            },
          })
        : [];
    const jlptByKanji = new Map(jlptRows.map((row) => [row.kanji, row]));

    const relatedReferenceFromId = (subjectId: number) => {
      const related = subjectById.get(subjectId);
      const meaning =
        (related?.data.meanings ?? [])
          .find((item) => (item.primary ?? true) && typeof item.meaning === "string" && item.meaning.length > 0)
          ?.meaning ??
        (related?.data.meanings ?? [])
          .find((item) => typeof item.meaning === "string" && item.meaning.length > 0)
          ?.meaning ??
        null;

      const reading =
        (related?.data.readings ?? [])
          .find((item) => item.primary && (item.accepted_answer ?? true))
          ?.reading ??
        null;

      return {
        subjectId,
        label: related?.data.characters ?? related?.data.slug ?? String(subjectId),
        wkLevel: typeof related?.data.level === "number" ? related.data.level : null,
        reading,
        meaning,
      };
    };

    const items = queued
      .map((row) => {
        const subject = subjectById.get(row.data.subject_id);
        const subjectData = subject?.data;
        const subjectType = normalizeSubjectType(row.data.subject_type);
        const label = subjectData?.characters ?? subjectData?.slug ?? `#${row.data.subject_id}`;
        const primaryMeanings = (subjectData?.meanings ?? []).map((item) => item.meaning);
        const auxiliaryMeanings = (subjectData?.auxiliary_meanings ?? []).map((item) => item.meaning);
        const meanings = Array.from(new Set([...primaryMeanings, ...auxiliaryMeanings]));
        const readings = (subjectData?.readings ?? [])
          .filter((item) => item.accepted_answer ?? true)
          .map((item) => item.reading);
        const primaryReadings = (subjectData?.readings ?? [])
          .filter((item) => item.primary)
          .map((item) => item.reading);

        const componentSubjectIds = subjectData?.component_subject_ids ?? [];
        const amalgamationSubjectIds = subjectData?.amalgamation_subject_ids ?? [];
        const visuallySimilarSubjectIds = subjectData?.visually_similar_subject_ids ?? [];
        const relatedSubjectType = (subjectId: number) => normalizeSubjectType(subjectById.get(subjectId)?.object ?? "");

        const radicals =
          subjectType === SUBJECT_TYPES.kanji
            ? componentSubjectIds
                .filter((subjectId) => relatedSubjectType(subjectId) === SUBJECT_TYPES.radical)
                .map(relatedReferenceFromId)
            : [];

        const usedInVocabulary =
          subjectType === SUBJECT_TYPES.kanji
            ? amalgamationSubjectIds
                .filter((subjectId) => relatedSubjectType(subjectId) === SUBJECT_TYPES.vocabulary)
                .map(relatedReferenceFromId)
            : subjectType === SUBJECT_TYPES.radical
              ? amalgamationSubjectIds
                  .filter((subjectId) => relatedSubjectType(subjectId) === SUBJECT_TYPES.kanji)
                  .map(relatedReferenceFromId)
              : [];

        const visuallySimilar =
          subjectType === SUBJECT_TYPES.kanji
            ? visuallySimilarSubjectIds.map(relatedReferenceFromId)
            : [];

        const componentKanji =
          subjectType === SUBJECT_TYPES.vocabulary
            ? componentSubjectIds
                .filter((subjectId) => relatedSubjectType(subjectId) === SUBJECT_TYPES.kanji)
                .map(relatedReferenceFromId)
            : [];

        const jlpt = subjectType === SUBJECT_TYPES.kanji ? jlptByKanji.get(subjectData?.characters ?? "") : null;
        const jlptMeta = jlpt
          ? {
              primaryMeaning: jlpt.primaryMeaning,
              meanings: jlpt.meanings,
              onReadings: jlpt.onReadings,
              kunReadings: jlpt.kunReadings,
              nanoriReadings: jlpt.nanoriReadings,
              wordExamples: jlpt.wordExamples,
              strokeCount: jlpt.strokeCount,
              frequencyRank: jlpt.frequencyRank,
              schoolGrade: jlpt.schoolGrade,
              heisigKeyword: jlpt.heisigKeyword,
            }
          : null;

        return {
          subjectId: row.data.subject_id,
          assignmentId: row.assignmentId,
          queueType: row.queueType,
          subjectType,
          wkLevel: subjectData?.level ?? null,
          characters: label,
          meanings,
          readings,
          primaryReadings,
          radicals,
          visuallySimilar,
          usedInVocabulary,
          componentKanji,
          meaningExplanation: subjectData?.meaning_mnemonic ?? "",
          readingExplanation: subjectData?.reading_mnemonic ?? "",
          jlptLevel: jlpt?.nLevel ?? null,
          jlptMeta,
          srsStage: row.data.srs_stage,
          status: srsLabel(row.data.srs_stage, row.data.srs_stage <= 0 || !row.data.unlocked_at),
          startedAt: row.data.started_at,
          passedAt: row.data.passed_at,
          availableAt: row.data.available_at,
        };
      })
      .sort((a, b) => {
        const aReview = a.queueType === "review" ? 0 : 1;
        const bReview = b.queueType === "review" ? 0 : 1;
        if (aReview !== bReview) {
          return aReview - bReview;
        }

        const aLevel = a.wkLevel ?? 999;
        const bLevel = b.wkLevel ?? 999;
        if (aLevel !== bLevel) {
          return aLevel - bLevel;
        }

        return a.subjectId - b.subjectId;
      });

    const counts =
      mode === "all"
        ? {
            all: items.length,
          reviews: reviewAssignments.length,
          lessons: lessonAssignments.length,
          }
        : mode === "lesson"
          ? {
              lessons: items.length,
              reviews: await fetchAssignmentCount("/assignments?immediately_available_for_review=true", token),
              all: 0,
            }
          : {
              reviews: items.length,
              lessons: await fetchAssignmentCount("/assignments?srs_stages=0", token),
              all: 0,
            };

    counts.all = counts.reviews + counts.lessons;

    const levelCounts = items.reduce<Record<number, number>>((acc, item) => {
      if (typeof item.wkLevel !== "number") {
        return acc;
      }

      acc[item.wkLevel] = (acc[item.wkLevel] ?? 0) + 1;
      return acc;
    }, {});

    const emptyTypeCounts = {
      all: 0,
      [SUBJECT_TYPES.radical]: 0,
      [SUBJECT_TYPES.kanji]: 0,
      [SUBJECT_TYPES.vocabulary]: 0,
    };
    const typeCounts = items.reduce<typeof emptyTypeCounts>((acc, item) => {
      acc.all += 1;
      if (item.subjectType === SUBJECT_TYPES.radical) {
        acc[SUBJECT_TYPES.radical] += 1;
      } else if (item.subjectType === SUBJECT_TYPES.kanji) {
        acc[SUBJECT_TYPES.kanji] += 1;
      } else {
        acc[SUBJECT_TYPES.vocabulary] += 1;
      }

      return acc;
    }, { ...emptyTypeCounts });

    const typeCountsByLevel = items.reduce<Record<number, typeof emptyTypeCounts>>((acc, item) => {
      if (typeof item.wkLevel !== "number") {
        return acc;
      }

      const bucket = acc[item.wkLevel] ?? { ...emptyTypeCounts };
      bucket.all += 1;
      if (item.subjectType === SUBJECT_TYPES.radical) {
        bucket[SUBJECT_TYPES.radical] += 1;
      } else if (item.subjectType === SUBJECT_TYPES.kanji) {
        bucket[SUBJECT_TYPES.kanji] += 1;
      } else {
        bucket[SUBJECT_TYPES.vocabulary] += 1;
      }

      acc[item.wkLevel] = bucket;
      return acc;
    }, {});

    const emptySrsCounts = {
      all: 0,
      locked: 0,
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 0,
      burned: 0,
    };

    const srsCounts = items.reduce<typeof emptySrsCounts>((acc, item) => {
      acc.all += 1;
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, { ...emptySrsCounts });

    const srsStageCounts = items.reduce<Record<number, number>>((acc, item) => {
      const stage = item.srsStage;
      if (!Number.isInteger(stage) || stage <= 0) {
        return acc;
      }

      acc[stage] = (acc[stage] ?? 0) + 1;
      return acc;
    }, {});

    setCachedStudyQueue(
      accountId,
      mode,
      items,
      counts,
      levelCounts,
      typeCounts,
      typeCountsByLevel,
      srsCounts,
      srsStageCounts,
    );

    const pagedItems = limit === null ? items : items.slice(offset, offset + limit);

    return NextResponse.json(
      {
        items: pagedItems,
        counts,
        levelCounts,
        typeCounts,
        typeCountsByLevel,
        srsCounts,
        srsStageCounts,
        pagination: {
          offset,
          limit: limit ?? items.length,
          total: items.length,
          hasMore: limit === null ? false : offset + limit < items.length,
        },
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
        },
      },
    );
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not fetch study queue." }, { status: 500 });
      }
    },
  });
}
