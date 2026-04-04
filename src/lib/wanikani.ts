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
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiTotal: number;
  levelKanjiLearned: number;
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  estimatedHoursRemaining: number | null;
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
    characters: string;
    meanings: string[];
    srsStage: number;
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
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
    fetchWaniKani<WaniKaniCollectionResponse>(`/subjects?types=kanji&levels=${level}`, token),
    fetchWaniKani<WaniKaniCollectionResponse>(
      `/assignments?subject_types=kanji&levels=${level}`,
      token,
    ),
  ]);

  const subjectById = new Map(
    levelSubjects.data.map((row) => [
      row.id,
      row.data as {
        characters: string | null;
        meanings: Array<{ meaning: string; primary: boolean }>;
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
        available_at: string | null;
      },
    ]),
  );

  const items = levelSubjects.data
    .map((subjectRow) => {
      const subject = subjectById.get(subjectRow.id);
      const assignment = assignmentBySubjectId.get(subjectRow.id);

      const srsStage = assignment?.srs_stage ?? 0;
      const locked = !assignment || !assignment.unlocked_at || srsStage <= 0;

      return {
        subjectId: subjectRow.id,
        characters: subject?.characters ?? "?",
        meanings: (subject?.meanings ?? []).slice(0, 3).map((item) => item.meaning),
        srsStage,
        status: srsLabel(srsStage, locked),
        availableAt: assignment?.available_at ?? null,
      };
    })
    .sort((a, b) => a.subjectId - b.subjectId);

  const kanjiTotal = items.length;
  const kanjiLearned = items.filter((item) => item.srsStage > 0).length;
  const kanjiGuruPlus = items.filter((item) => item.srsStage >= 5).length;
  const kanjiLocked = items.filter((item) => item.status === "locked").length;

  let estimatedHoursRemaining: number | null = null;
  const remainingGuru = Math.max(0, Math.ceil(kanjiTotal * 0.9) - kanjiGuruPlus);
  const nextTimes = items
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
      available_at: string | null;
    },
  );

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
    apprenticeCount,
    guruCount,
    masterCount,
    enlightenedCount,
    levelKanjiTotal,
    levelKanjiLearned,
    levelKanjiGuruPlus,
    levelKanjiLocked,
    estimatedHoursRemaining,
    levelKanjiItems,
    score,
  };
}
