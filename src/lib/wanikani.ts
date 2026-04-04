type WaniKaniUserResponse = {
  data: {
    id: string;
    username: string;
    level: number;
  };
};

type WaniKaniCollectionResponse = {
  object: "collection";
  pages: {
    next_url: string | null;
  };
  total_count: number;
  data: Array<{
    id: number;
    object?: string;
    data_updated_at?: string;
    data: Record<string, unknown>;
  }>;
};

type WaniKaniSummaryResponse = {
  data: {
    reviews: Array<{
      available_at: string;
      subject_ids: number[];
    }>;
  };
};

type LeaderboardStats = {
  wkUserId: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  radicalCount: number;
  vocabularyCount: number;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiTotal: number;
  levelKanjiLearned: number;
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  estimatedHoursRemaining: number | null;
  lastActivityAt: Date | null;
  levelKanjiItems: Array<{
    subjectId: number;
    characters: string;
    meanings: string[];
    srsStage: number;
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
    availableAt: string | null;
  }>;
  score: number;
};

export type LevelKanjiSnapshot = {
  level: number;
  kanjiTotal: number;
  kanjiLearned: number;
  kanjiGuruPlus: number;
  kanjiLocked: number;
  estimatedHoursRemaining: number | null;
  items: Array<{
    subjectId: number;
    subjectType: "kanji" | "radical" | "vocabulary";
    wkLevel: number;
    characters: string;
    meanings: string[];
    readings: string[];
    primaryReadings: string[];
    radicals: Array<{
      subjectId: number;
      label: string;
    }>;
    visuallySimilar: Array<{
      subjectId: number;
      label: string;
    }>;
    usedInVocabulary: Array<{
      subjectId: number;
      label: string;
    }>;
    meaningExplanation: string;
    readingExplanation: string;
    srsStage: number;
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
    startedAt: string | null;
    passedAt: string | null;
    availableAt: string | null;
  }>;
};

const BASE_URL = "https://api.wanikani.com/v2";

async function fetchWaniKani<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Wanikani-Revision": "20170710",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`WaniKani API error: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchAllCollectionPages(path: string, token: string): Promise<WaniKaniCollectionResponse> {
  let nextPath = path;
  let totalCount = 0;
  const allData: WaniKaniCollectionResponse["data"] = [];

  while (nextPath) {
    const page = await fetchWaniKani<WaniKaniCollectionResponse>(nextPath, token);

    totalCount = page.total_count;
    allData.push(...page.data);

    if (!page.pages.next_url) {
      break;
    }

    const url = new URL(page.pages.next_url);
    nextPath = `${url.pathname}${url.search}`.replace("/v2", "");
  }

  return {
    object: "collection",
    total_count: totalCount,
    pages: { next_url: null },
    data: allData,
  };
}

function srsLabel(stage: number, locked: boolean):
  | "locked"
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened"
  | "burned" {
  if (locked) {
    return "locked";
  }

  if (stage >= 9) {
    return "burned";
  }

  if (stage >= 8) {
    return "enlightened";
  }

  if (stage >= 7) {
    return "master";
  }

  if (stage >= 5) {
    return "guru";
  }

  return "apprentice";
}

function toDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getLevelKanjiSnapshot(
  token: string,
  level: number,
): Promise<LevelKanjiSnapshot> {
  const [levelSubjects, levelAssignments] = await Promise.all([
    fetchWaniKani<WaniKaniCollectionResponse>(
      `/subjects?types=kanji,radical,vocabulary&levels=${level}`,
      token,
    ),
    fetchWaniKani<WaniKaniCollectionResponse>(
      `/assignments?subject_types=kanji,radical,vocabulary&levels=${level}`,
      token,
    ),
  ]);

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

  let relatedSubjects = new Map<
    number,
    {
      subjectId: number;
      object: string;
      characters: string | null;
      slug: string | null;
    }
  >();

  if (relatedSubjectIds.size > 0) {
    const ids = Array.from(relatedSubjectIds.values());
    const chunkSize = 200;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize).join(",");
      const relatedCollection = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);

      for (const row of relatedCollection.data) {
        const data = row.data as { characters?: string | null; slug?: string | null };
        relatedSubjects.set(row.id, {
          subjectId: row.id,
          object: row.object ?? "subject",
          characters: data.characters ?? null,
          slug: data.slug ?? null,
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
      const object = (subjectRow.object ?? "kanji") as "kanji" | "radical" | "vocabulary";

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
          .map((id) => ({ subjectId: id, label: subjectLabel(id) })),
        visuallySimilar: (subject?.visually_similar_subject_ids ?? []).map((id) => ({
          subjectId: id,
          label: subjectLabel(id),
        })),
        usedInVocabulary: (subject?.amalgamation_subject_ids ?? []).map((id) => ({
          subjectId: id,
          label: subjectLabel(id),
        })),
        meaningExplanation: subject?.meaning_mnemonic ?? "",
        readingExplanation: subject?.reading_mnemonic ?? "",
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
  const kanjiLearned = onlyKanji.filter((item) => item.srsStage > 0).length;
  const kanjiGuruPlus = onlyKanji.filter((item) => item.srsStage >= 5).length;
  const kanjiLocked = onlyKanji.filter((item) => item.status === "locked").length;

  let estimatedHoursRemaining: number | null = null;
  const remainingGuru = Math.max(0, Math.ceil(kanjiTotal * 0.9) - kanjiGuruPlus);
  const nextTimes = onlyKanji
    .filter((item) => item.status !== "locked" && item.srsStage < 5)
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

export async function getLeaderboardStats(token: string): Promise<LeaderboardStats> {
  const userRes = await fetchWaniKani<WaniKaniUserResponse>("/user", token);

  const [reviewStatsRes, burnedRes, summaryRes, allAssignments, levelSnapshot] = await Promise.all([
    fetchWaniKani<WaniKaniCollectionResponse>("/review_statistics", token),
    fetchWaniKani<WaniKaniCollectionResponse>("/assignments?srs_stages=9", token),
    fetchWaniKani<WaniKaniSummaryResponse>("/summary", token),
    fetchAllCollectionPages("/assignments", token),
    getLevelKanjiSnapshot(token, userRes.data.level),
  ]);

  const wkLevel = userRes.data.level;
  const reviewCount = reviewStatsRes.total_count;
  const burnedCount = burnedRes.total_count;
  const now = Date.now();
  const pendingReviews = summaryRes.data.reviews
    .filter((group) => new Date(group.available_at).getTime() <= now)
    .reduce((sum, group) => sum + group.subject_ids.length, 0);

  const allAssignmentData = allAssignments.data.map((row) =>
    row.data as {
      subject_id: number;
      subject_type: string;
      srs_stage: number;
      unlocked_at: string | null;
      started_at: string | null;
      passed_at: string | null;
      burned_at: string | null;
      resurrected_at: string | null;
      available_at: string | null;
    },
  );

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

  for (const assignment of allAssignmentData) {
    if (!assignment.unlocked_at || assignment.srs_stage <= 0) {
      continue;
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

  const levelKanjiTotal = levelSnapshot.kanjiTotal;
  const levelKanjiLearned = levelSnapshot.kanjiLearned;
  const levelKanjiGuruPlus = levelSnapshot.kanjiGuruPlus;
  const levelKanjiLocked = levelSnapshot.kanjiLocked;
  const estimatedHoursRemaining = levelSnapshot.estimatedHoursRemaining;
  const levelKanjiItems = levelSnapshot.items;

  // Weighted score based on real progress metrics only.
  const score = wkLevel * 1000 + reviewCount * 2 + burnedCount * 4;

  return {
    wkUserId: userRes.data.id,
    wkUsername: userRes.data.username,
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
    score,
  };
}
