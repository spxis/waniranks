import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { srsLabel } from "@/lib/wanikani/helpers";
import { fetchAllCollectionPages } from "@/lib/wanikani/http";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

type AssignmentData = {
  subject_id: number;
  subject_type: string;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  available_at: string | null;
};

type SubjectData = {
  level?: number;
  characters?: string | null;
  slug?: string | null;
  meanings?: Array<{ meaning: string; primary?: boolean }>;
  readings?: Array<{ reading: string; primary?: boolean; accepted_answer?: boolean }>;
  meaning_mnemonic?: string;
  reading_mnemonic?: string;
};

function normalizeSubjectType(input: string): "radical" | "kanji" | "vocabulary" {
  if (input === "radical" || input === "kanji") {
    return input;
  }
  return "vocabulary";
}

function normalizeQueueType(assignment: AssignmentData, nowMs: number): "review" | "lesson" | null {
  if (assignment.srs_stage > 0) {
    const availableMs = assignment.available_at ? new Date(assignment.available_at).getTime() : Number.NaN;
    if (!Number.isNaN(availableMs) && availableMs <= nowMs) {
      return "review";
    }
    return null;
  }

  if (assignment.unlocked_at && !assignment.started_at) {
    return "lesson";
  }

  return null;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
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

    const assignmentsResponse = await fetchAllCollectionPages("/assignments", token);
    const assignments = assignmentsResponse.data.map((row) => ({
      assignmentId: row.id,
      data: row.data as AssignmentData,
    }));

    const nowMs = Date.now();
    const queued = assignments
      .map((row) => ({ ...row, queueType: normalizeQueueType(row.data, nowMs) }))
      .filter((row): row is typeof row & { queueType: "review" | "lesson" } => Boolean(row.queueType));

    const subjectIds = Array.from(new Set(queued.map((row) => row.data.subject_id)));
    const subjectById = new Map<number, { object: string; data: SubjectData }>();

    for (let i = 0; i < subjectIds.length; i += 200) {
      const chunk = subjectIds.slice(i, i + 200).join(",");
      const subjectCollection = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);
      for (const row of subjectCollection.data) {
        subjectById.set(row.id, { object: row.object ?? "subject", data: row.data as SubjectData });
      }
    }

    const kanjiChars = Array.from(
      new Set(
        queued
          .filter((row) => normalizeSubjectType(row.data.subject_type) === "kanji")
          .map((row) => subjectById.get(row.data.subject_id)?.data.characters)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const jlptRows =
      kanjiChars.length > 0
        ? await prisma.jlptKanji.findMany({ where: { kanji: { in: kanjiChars } }, select: { kanji: true, nLevel: true } })
        : [];
    const jlptByKanji = new Map(jlptRows.map((row) => [row.kanji, row.nLevel]));

    const items = queued
      .map((row) => {
        const subject = subjectById.get(row.data.subject_id);
        const subjectData = subject?.data;
        const subjectType = normalizeSubjectType(row.data.subject_type);
        const label = subjectData?.characters ?? subjectData?.slug ?? `#${row.data.subject_id}`;
        const meanings = (subjectData?.meanings ?? []).map((item) => item.meaning).slice(0, 3);
        const readings = (subjectData?.readings ?? [])
          .filter((item) => item.accepted_answer ?? true)
          .map((item) => item.reading);
        const primaryReadings = (subjectData?.readings ?? [])
          .filter((item) => item.primary)
          .map((item) => item.reading);

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
          radicals: [],
          visuallySimilar: [],
          usedInVocabulary: [],
          componentKanji: [],
          meaningExplanation: subjectData?.meaning_mnemonic ?? "",
          readingExplanation: subjectData?.reading_mnemonic ?? "",
          jlptLevel: subjectType === "kanji" ? jlptByKanji.get(subjectData?.characters ?? "") ?? null : null,
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

    const pagedItems = limit === null ? items : items.slice(offset, offset + limit);

    return NextResponse.json({
      items: pagedItems,
      counts: {
        all: items.length,
        reviews: items.filter((item) => item.queueType === "review").length,
        lessons: items.filter((item) => item.queueType === "lesson").length,
      },
      pagination: {
        offset,
        limit: limit ?? items.length,
        total: items.length,
        hasMore: limit === null ? false : offset + limit < items.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch study queue." }, { status: 500 });
  }
}
