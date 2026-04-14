import { prisma } from "@/lib/prisma";

import { fetchAllCollectionPages } from "./http";
import type { LeaderboardStats, WaniKaniAssignmentData } from "./types";

type JlptProgressResult = {
  learnedKanjiCount: number;
  jlptCounts: LeaderboardStats["jlptCounts"];
};

export async function computeJlptKanjiProgress(
  token: string,
  allAssignmentData: WaniKaniAssignmentData[],
): Promise<JlptProgressResult> {
  const learnedKanjiSubjectIds = Array.from(
    new Set(
      allAssignmentData
        .filter(
          (assignment) =>
            assignment.subject_type === "kanji" && assignment.unlocked_at && assignment.srs_stage >= 5,
        )
        .map((assignment) => assignment.subject_id),
    ),
  );

  const learnedKanjiCount = learnedKanjiSubjectIds.length;
  const jlptLearnedCounts = { n1: 0, n2: 0, n3: 0, n4: 0, n5: 0 };

  if (learnedKanjiSubjectIds.length > 0) {
    const chunkSize = 200;
    const learnedKanjiChars = new Set<string>();

    for (let i = 0; i < learnedKanjiSubjectIds.length; i += chunkSize) {
      const chunk = learnedKanjiSubjectIds.slice(i, i + chunkSize).join(",");
      const subjectChunk = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);

      for (const row of subjectChunk.data) {
        if ((row.object ?? "") !== "kanji") {
          continue;
        }

        const data = row.data as { characters?: string | null };
        if (data.characters) {
          learnedKanjiChars.add(data.characters);
        }
      }
    }

    if (learnedKanjiChars.size > 0) {
      const jlptRows = await prisma.jlptKanji.findMany({
        where: { kanji: { in: Array.from(learnedKanjiChars) } },
        select: { nLevel: true },
      });

      for (const row of jlptRows) {
        if (row.nLevel === 1) jlptLearnedCounts.n1 += 1;
        if (row.nLevel === 2) jlptLearnedCounts.n2 += 1;
        if (row.nLevel === 3) jlptLearnedCounts.n3 += 1;
        if (row.nLevel === 4) jlptLearnedCounts.n4 += 1;
        if (row.nLevel === 5) jlptLearnedCounts.n5 += 1;
      }
    }
  }

  const jlptTotalsRows = await prisma.jlptKanji.groupBy({
    by: ["nLevel"],
    _count: { _all: true },
  });

  const jlptTotals = { n1: 0, n2: 0, n3: 0, n4: 0, n5: 0 };
  for (const row of jlptTotalsRows) {
    if (row.nLevel === 1) jlptTotals.n1 = row._count._all;
    if (row.nLevel === 2) jlptTotals.n2 = row._count._all;
    if (row.nLevel === 3) jlptTotals.n3 = row._count._all;
    if (row.nLevel === 4) jlptTotals.n4 = row._count._all;
    if (row.nLevel === 5) jlptTotals.n5 = row._count._all;
  }

  const jlptCounts: LeaderboardStats["jlptCounts"] = {
    n1: {
      learned: jlptLearnedCounts.n1,
      total: jlptTotals.n1,
      percent: jlptTotals.n1 > 0 ? Math.round((jlptLearnedCounts.n1 / jlptTotals.n1) * 100) : 0,
    },
    n2: {
      learned: jlptLearnedCounts.n2,
      total: jlptTotals.n2,
      percent: jlptTotals.n2 > 0 ? Math.round((jlptLearnedCounts.n2 / jlptTotals.n2) * 100) : 0,
    },
    n3: {
      learned: jlptLearnedCounts.n3,
      total: jlptTotals.n3,
      percent: jlptTotals.n3 > 0 ? Math.round((jlptLearnedCounts.n3 / jlptTotals.n3) * 100) : 0,
    },
    n4: {
      learned: jlptLearnedCounts.n4,
      total: jlptTotals.n4,
      percent: jlptTotals.n4 > 0 ? Math.round((jlptLearnedCounts.n4 / jlptTotals.n4) * 100) : 0,
    },
    n5: {
      learned: jlptLearnedCounts.n5,
      total: jlptTotals.n5,
      percent: jlptTotals.n5 > 0 ? Math.round((jlptLearnedCounts.n5 / jlptTotals.n5) * 100) : 0,
    },
  };

  return { learnedKanjiCount, jlptCounts };
}
