import { prisma } from "@/lib/prisma";
import { WK_STATUSES } from "@/lib/domainConstants";

import { fetchAllCollectionPages, fetchWaniKani } from "./http";
import { normalizeAssignmentType, srsLabel, toDate } from "./helpers";
import type { LevelKanjiSnapshot, WaniKaniCollectionResponse } from "./types";

export async function getLevelKanjiSnapshot(
  token: string,
  level: number,
): Promise<LevelKanjiSnapshot> {
  const levelSubjectsResponse = await fetchWaniKani<WaniKaniCollectionResponse>(
    `/subjects?types=kanji,radical,vocabulary&levels=${level}`,
    token,
  );
  const levelAssignmentsResponse = await fetchWaniKani<WaniKaniCollectionResponse>(
    `/assignments?subject_types=kanji,radical,vocabulary&levels=${level}`,
    token,
  );

  const levelSubjects = levelSubjectsResponse.data;
  const levelAssignments = levelAssignmentsResponse.data;

  if (!levelSubjects || !levelAssignments) {
    throw new Error("WaniKani API returned an unexpected empty payload.");
  }

  const subjectById = new Map(
    levelSubjects.data.map((row) => [
      row.id,
      row.data as {
        level: number;
        characters: string | null;
        slug: string | null;
        meanings: Array<{ meaning: string; primary: boolean }>;
        readings: Array<{ reading: string; primary: boolean; accepted_answer: boolean }>;
        component_subject_ids: number[];
        amalgamation_subject_ids: number[];
        visually_similar_subject_ids: number[];
        meaning_mnemonic: string;
        reading_mnemonic: string;
      },
    ]),
  );

  const assignmentBySubjectId = new Map(
    levelAssignments.data.map((row) => [
      (row.data as { subject_id: number }).subject_id,
      row.data as {
        subject_id: number;
        srs_stage: number;
        unlocked_at: string | null;
        started_at: string | null;
        passed_at: string | null;
        available_at: string | null;
      },
    ]),
  );

  const kanjiCharsForLevel = levelSubjects.data
    .filter((row) => (row.object ?? "") === "kanji")
    .map((row) => {
      const subject = subjectById.get(row.id);
      return subject?.characters ?? null;
    })
    .filter((value): value is string => Boolean(value));

  const jlptRows =
    kanjiCharsForLevel.length > 0
      ? await prisma.jlptKanji.findMany({
          where: { kanji: { in: kanjiCharsForLevel } },
          select: {
            kanji: true,
            nLevel: true,
            schoolGrade: true,
            primaryMeaning: true,
            meanings: true,
            onReadings: true,
            kunReadings: true,
            nanoriReadings: true,
            wordExamples: true,
            strokeCount: true,
            frequencyRank: true,
            heisigKeyword: true,
          },
        })
      : [];
  const jlptByKanji = new Map(jlptRows.map((row) => [row.kanji, row]));

  const relatedSubjectIds = new Set<number>();
  for (const subject of subjectById.values()) {
    for (const id of subject.component_subject_ids ?? []) {
      relatedSubjectIds.add(id);
    }

    for (const id of subject.amalgamation_subject_ids ?? []) {
      relatedSubjectIds.add(id);
    }

    for (const id of subject.visually_similar_subject_ids ?? []) {
      relatedSubjectIds.add(id);
    }
  }

  const relatedSubjects = new Map<
    number,
    {
      subjectId: number;
      object: string;
      characters: string | null;
      slug: string | null;
      level: number | null;
      primaryReading: string | null;
      primaryMeaning: string | null;
    }
  >();

  if (relatedSubjectIds.size > 0) {
    const ids = Array.from(relatedSubjectIds.values());
    const chunkSize = 200;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize).join(",");
      const relatedCollection = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);

      for (const row of relatedCollection.data) {
        const data = row.data as {
          characters?: string | null;
          slug?: string | null;
          level?: number | null;
          readings?: Array<{ reading?: string; primary?: boolean; accepted_answer?: boolean }>;
          meanings?: Array<{ meaning?: string; primary?: boolean }>;
        };
        const primaryReading =
          data.readings
            ?.filter((reading) => reading.primary && (reading.accepted_answer ?? true))
            .map((reading) => reading.reading)
            .find((reading): reading is string => typeof reading === "string" && reading.length > 0) ?? null;
        const primaryMeaning =
          data.meanings
            ?.filter((meaning) => meaning.primary ?? true)
            .map((meaning) => meaning.meaning)
            .find((meaning): meaning is string => typeof meaning === "string" && meaning.length > 0) ?? null;

        relatedSubjects.set(row.id, {
          subjectId: row.id,
          object: row.object ?? "subject",
          characters: data.characters ?? null,
          slug: data.slug ?? null,
          level: typeof data.level === "number" ? data.level : null,
          primaryReading,
          primaryMeaning,
        });
      }
    }
  }

  function subjectLabel(subjectId: number): string {
    const item = relatedSubjects.get(subjectId);
    if (!item) {
      return String(subjectId);
    }

    return item.characters || item.slug || String(subjectId);
  }

  const items = levelSubjects.data
    .map((subjectRow) => {
      const subject = subjectById.get(subjectRow.id);
      const assignment = assignmentBySubjectId.get(subjectRow.id);

      const srsStage = assignment?.srs_stage ?? 0;
      const locked = !assignment || !assignment.unlocked_at || srsStage <= 0;
      const object = normalizeAssignmentType(subjectRow.object ?? "") ?? "kanji";

      return {
        subjectId: subjectRow.id,
        subjectType: object,
        wkLevel: subject?.level ?? level,
        characters: subject?.characters ?? subject?.slug ?? "?",
        meanings: (subject?.meanings ?? []).slice(0, 3).map((item) => item.meaning),
        readings: (subject?.readings ?? [])
          .filter((item) => item.accepted_answer)
          .map((item) => item.reading),
        primaryReadings: (subject?.readings ?? [])
          .filter((item) => item.primary)
          .map((item) => item.reading),
        radicals: (subject?.component_subject_ids ?? [])
          .filter((id) => {
            const related = relatedSubjects.get(id);
            return related?.object === "radical";
          })
          .map((id) => ({
            subjectId: id,
            label: subjectLabel(id),
            wkLevel: relatedSubjects.get(id)?.level ?? null,
            reading: relatedSubjects.get(id)?.primaryMeaning ?? null,
          })),
        visuallySimilar: (subject?.visually_similar_subject_ids ?? []).map((id) => ({
          subjectId: id,
          label: subjectLabel(id),
          wkLevel: relatedSubjects.get(id)?.level ?? null,
          reading:
            relatedSubjects.get(id)?.object === "radical"
              ? relatedSubjects.get(id)?.primaryMeaning ?? null
              : relatedSubjects.get(id)?.primaryReading ?? null,
        })),
        usedInVocabulary: (subject?.amalgamation_subject_ids ?? []).map((id) => ({
          subjectId: id,
          label: subjectLabel(id),
          wkLevel: relatedSubjects.get(id)?.level ?? null,
          reading: relatedSubjects.get(id)?.primaryReading ?? null,
        })),
        componentKanji: (subject?.component_subject_ids ?? [])
          .filter((id) => {
            const related = relatedSubjects.get(id);
            return related?.object === "kanji";
          })
          .map((id) => ({
            subjectId: id,
            label: subjectLabel(id),
            wkLevel: relatedSubjects.get(id)?.level ?? null,
            reading: relatedSubjects.get(id)?.primaryReading ?? null,
          })),
        meaningExplanation: subject?.meaning_mnemonic ?? "",
        readingExplanation: subject?.reading_mnemonic ?? "",
        jlptLevel:
          object === "kanji" ? jlptByKanji.get(subject?.characters ?? "")?.nLevel ?? null : null,
        jlptMeta:
          object === "kanji" && jlptByKanji.has(subject?.characters ?? "")
            ? {
                primaryMeaning: jlptByKanji.get(subject?.characters ?? "")?.primaryMeaning ?? null,
                meanings: jlptByKanji.get(subject?.characters ?? "")?.meanings ?? [],
                onReadings: jlptByKanji.get(subject?.characters ?? "")?.onReadings ?? [],
                kunReadings: jlptByKanji.get(subject?.characters ?? "")?.kunReadings ?? [],
                nanoriReadings: jlptByKanji.get(subject?.characters ?? "")?.nanoriReadings ?? [],
                wordExamples: jlptByKanji.get(subject?.characters ?? "")?.wordExamples ?? null,
                strokeCount: jlptByKanji.get(subject?.characters ?? "")?.strokeCount ?? null,
                frequencyRank: jlptByKanji.get(subject?.characters ?? "")?.frequencyRank ?? null,
                schoolGrade: jlptByKanji.get(subject?.characters ?? "")?.schoolGrade ?? null,
                heisigKeyword: jlptByKanji.get(subject?.characters ?? "")?.heisigKeyword ?? null,
              }
            : null,
        srsStage,
        status: srsLabel(srsStage, locked),
        startedAt: assignment?.started_at ?? null,
        passedAt: assignment?.passed_at ?? null,
        availableAt: assignment?.available_at ?? null,
      };
    })
    .sort((a, b) => a.subjectId - b.subjectId);

  const onlyKanji = items.filter((item) => item.subjectType === "kanji");
  const kanjiTotal = onlyKanji.length;
  const kanjiLearned = onlyKanji.filter((item) => item.srsStage >= 5).length;
  const kanjiGuruPlus = onlyKanji.filter((item) => item.srsStage >= 5).length;
  const kanjiLocked = onlyKanji.filter((item) => item.status === WK_STATUSES.locked).length;

  let estimatedHoursRemaining: number | null = null;
  const remainingGuru = Math.max(0, Math.ceil(kanjiTotal * 0.9) - kanjiGuruPlus);
  const nextTimes = onlyKanji
    .filter((item) => item.status !== WK_STATUSES.locked && item.srsStage < 5)
    .map((item) => toDate(item.availableAt))
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (remainingGuru <= 0) {
    estimatedHoursRemaining = 0;
  } else if (nextTimes.length >= remainingGuru) {
    const target = nextTimes[remainingGuru - 1];
    estimatedHoursRemaining = Math.max(1, Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60)));
  }

  return {
    level,
    kanjiTotal,
    kanjiLearned,
    kanjiGuruPlus,
    kanjiLocked,
    estimatedHoursRemaining,
    items,
  };
}
