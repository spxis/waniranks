type WaniKaniUserResponse = {
  data: {
    id: string;
    username: string;
    level: number;
  };
};

import { prisma } from "@/lib/prisma";
import { LEADERBOARD_REQUEST_GAP_MS } from "@/lib/refreshPolicy";

type WaniKaniCollectionResponse = {
  object: "collection";
  data_updated_at?: string | null;
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

type WaniKaniResponseHeaders = {
  etag: string | null;
  lastModified: string | null;
};

type HttpCacheEntry = {
  etag: string | null;
  lastModified: string | null;
};

type HttpCacheState = {
  user?: HttpCacheEntry;
  reviewStats?: HttpCacheEntry;
  burnedAssignments?: HttpCacheEntry;
};

type AssignmentCacheRow = {
  id: number;
  object?: string;
  data_updated_at?: string;
  data: Record<string, unknown>;
};

export type ExistingLeaderboardState = {
  wkUserId: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  reviewsUpdatedAt: Date | null;
  lastRadicalGuruedAt: Date | null;
  lastKanjiGuruedAt: Date | null;
  lastVocabularyGuruedAt: Date | null;
  assignmentCache: unknown;
  assignmentCacheUpdatedAt: Date | null;
  wkHttpCache: unknown;
};

type LeaderboardSyncCache = {
  assignmentCache: AssignmentCacheRow[];
  assignmentCacheUpdatedAt: Date;
  reviewsUpdatedAt: Date | null;
  wkHttpCache: HttpCacheState;
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
  itemSpread: {
    apprentice: { radical: number; kanji: number; vocabulary: number; total: number };
    guru: { radical: number; kanji: number; vocabulary: number; total: number };
    master: { radical: number; kanji: number; vocabulary: number; total: number };
    enlightened: { radical: number; kanji: number; vocabulary: number; total: number };
    burned: { radical: number; kanji: number; vocabulary: number; total: number };
    totals: { radical: number; kanji: number; vocabulary: number; total: number };
  };
  jlptCounts: {
    n1: { learned: number; total: number; percent: number };
    n2: { learned: number; total: number; percent: number };
    n3: { learned: number; total: number; percent: number };
    n4: { learned: number; total: number; percent: number };
    n5: { learned: number; total: number; percent: number };
  };
  lastRadicalGuruedAt: Date | null;
  lastKanjiGuruedAt: Date | null;
  lastVocabularyGuruedAt: Date | null;
  score: number;
  cache: LeaderboardSyncCache;
};

export type UserKanjiIndexItem = {
  subjectId: number;
  characters: string;
  meanings: string[];
  readings: string[];
  primaryReadings: string[];
  meaningExplanation: string;
  readingExplanation: string;
  startedAt: string | null;
  passedAt: string | null;
  availableAt: string | null;
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  wkLevel: number | null;
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
      wkLevel: number | null;
      reading: string | null;
    }>;
    visuallySimilar: Array<{
      subjectId: number;
      label: string;
      wkLevel: number | null;
      reading: string | null;
    }>;
    usedInVocabulary: Array<{
      subjectId: number;
      label: string;
      wkLevel: number | null;
      reading: string | null;
    }>;
    componentKanji: Array<{
      subjectId: number;
      label: string;
      wkLevel: number | null;
      reading: string | null;
    }>;
    meaningExplanation: string;
    readingExplanation: string;
    jlptLevel: number | null;
    srsStage: number;
    status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
    startedAt: string | null;
    passedAt: string | null;
    availableAt: string | null;
  }>;
};

const BASE_URL = "https://api.wanikani.com/v2";
let requestChain: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runThrottledRequest<T>(work: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, lastRequestStartedAt + LEADERBOARD_REQUEST_GAP_MS - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    lastRequestStartedAt = Date.now();
    return work();
  });

  requestChain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

async function fetchWaniKani<T>(
  path: string,
  token: string,
  conditionalHeaders?: { ifNoneMatch?: string | null; ifModifiedSince?: string | null },
): Promise<{ status: number; data: T | null; headers: WaniKaniResponseHeaders }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Wanikani-Revision": "20170710",
  };

  if (conditionalHeaders?.ifNoneMatch) {
    headers["If-None-Match"] = conditionalHeaders.ifNoneMatch;
  }

  if (conditionalHeaders?.ifModifiedSince) {
    headers["If-Modified-Since"] = conditionalHeaders.ifModifiedSince;
  }

  const response = await runThrottledRequest(() =>
    fetch(`${BASE_URL}${path}`, {
      headers,
      cache: "no-store",
    }),
  );

  const responseHeaders: WaniKaniResponseHeaders = {
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };

  if (response.status === 304) {
    return { status: 304, data: null, headers: responseHeaders };
  }

  if (!response.ok) {
    throw new Error(`WaniKani API error: ${response.status}`);
  }

  return {
    status: response.status,
    data: (await response.json()) as T,
    headers: responseHeaders,
  };
}

async function fetchAllCollectionPages(path: string, token: string): Promise<WaniKaniCollectionResponse> {
  let nextPath = path;
  let totalCount = 0;
  const allData: WaniKaniCollectionResponse["data"] = [];
  let latestDataUpdatedAt: string | null = null;

  while (nextPath) {
    const pageResponse = await fetchWaniKani<WaniKaniCollectionResponse>(nextPath, token);
    const page = pageResponse.data;
    if (!page) {
      break;
    }

    totalCount = page.total_count;
    allData.push(...page.data);
    latestDataUpdatedAt = page.data_updated_at ?? latestDataUpdatedAt;

    if (!page.pages.next_url) {
      break;
    }

    const url = new URL(page.pages.next_url);
    nextPath = `${url.pathname}${url.search}`.replace("/v2", "");
  }

  return {
    object: "collection",
    data_updated_at: latestDataUpdatedAt,
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

function normalizeAssignmentType(input: string): "radical" | "kanji" | "vocabulary" | null {
  if (input === "radical" || input === "kanji") {
    return input;
  }

  if (input === "vocabulary" || input === "kana_vocabulary") {
    return "vocabulary";
  }

  return null;
}

export async function getUserKanjiIndex(token: string): Promise<UserKanjiIndexItem[]> {
  const assignmentsCollection = await fetchAllCollectionPages("/assignments?subject_types=kanji", token);

  const assignments = assignmentsCollection.data
    .map((row) =>
      row.data as {
        subject_id: number;
        subject_type: string;
        srs_stage: number;
        unlocked_at: string | null;
        started_at: string | null;
        passed_at: string | null;
        available_at: string | null;
      },
    )
    .filter((assignment) => assignment.subject_type === "kanji");

  const ids = Array.from(new Set(assignments.map((assignment) => assignment.subject_id)));
  const subjectById = new Map<
    number,
    {
      characters: string;
      meanings: string[];
      readings: string[];
      primaryReadings: string[];
      meaningExplanation: string;
      readingExplanation: string;
      wkLevel: number | null;
    }
  >();

  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize).join(",");
    if (!chunk) {
      continue;
    }

    const subjects = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);
    for (const row of subjects.data) {
      if ((row.object ?? "") !== "kanji") {
        continue;
      }

      const data = row.data as {
        characters?: string | null;
        level?: number | null;
        meanings?: Array<{ meaning?: string; primary?: boolean }>;
        readings?: Array<{ reading?: string; primary?: boolean; accepted_answer?: boolean }>;
        meaning_mnemonic?: string;
        reading_mnemonic?: string;
      };

      const characters = data.characters ?? "";
      if (!characters) {
        continue;
      }

      const readings = (data.readings ?? [])
        .filter((reading) => reading.accepted_answer ?? true)
        .map((reading) => reading.reading)
        .filter((reading): reading is string => typeof reading === "string" && reading.length > 0);

      const primaryReadings = (data.readings ?? [])
        .filter((reading) => reading.primary)
        .map((reading) => reading.reading)
        .filter((reading): reading is string => typeof reading === "string" && reading.length > 0);

      const meanings = (data.meanings ?? [])
        .map((entry) => entry.meaning)
        .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        .slice(0, 3);

      subjectById.set(row.id, {
        characters,
        meanings,
        readings,
        primaryReadings,
        meaningExplanation: data.meaning_mnemonic ?? "",
        readingExplanation: data.reading_mnemonic ?? "",
        wkLevel: typeof data.level === "number" ? data.level : null,
      });
    }
  }

  const byChar = new Map<string, UserKanjiIndexItem>();
  for (const assignment of assignments) {
    const subject = subjectById.get(assignment.subject_id);
    if (!subject) {
      continue;
    }

    const locked = !assignment.unlocked_at || assignment.srs_stage <= 0;
    const item: UserKanjiIndexItem = {
      subjectId: assignment.subject_id,
      characters: subject.characters,
      meanings: subject.meanings,
      readings: subject.readings,
      primaryReadings: subject.primaryReadings,
      meaningExplanation: subject.meaningExplanation,
      readingExplanation: subject.readingExplanation,
      startedAt: assignment.started_at ?? null,
      passedAt: assignment.passed_at ?? null,
      availableAt: assignment.available_at ?? null,
      srsStage: assignment.srs_stage,
      status: srsLabel(assignment.srs_stage, locked),
      wkLevel: subject.wkLevel,
    };

    const existing = byChar.get(item.characters);
    if (!existing || item.srsStage >= existing.srsStage) {
      byChar.set(item.characters, item);
    }
  }

  return Array.from(byChar.values());
}

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
          select: { kanji: true, nLevel: true },
        })
      : [];
  const jlptByKanji = new Map(jlptRows.map((row) => [row.kanji, row.nLevel]));

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
          object === "kanji" ? jlptByKanji.get(subject?.characters ?? "") ?? null : null,
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

type WaniKaniAssignmentData = {
  subject_id: number;
  subject_type: string;
  srs_stage: number;
  unlocked_at: string | null;
  started_at: string | null;
  passed_at: string | null;
  burned_at: string | null;
  resurrected_at: string | null;
  available_at: string | null;
};

type WaniKaniReviewData = {
  subject_id: number;
  starting_srs_stage: number;
  ending_srs_stage: number;
  created_at: string | null;
};

function parseHttpCacheState(input: unknown): HttpCacheState {
  if (!input || typeof input !== "object") {
    return {};
  }

  const record = input as Record<string, unknown>;
  const keys: Array<keyof HttpCacheState> = ["user", "reviewStats", "burnedAssignments"];
  const output: HttpCacheState = {};

  for (const key of keys) {
    const entry = record[key];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const row = entry as Record<string, unknown>;
    const etag = typeof row.etag === "string" ? row.etag : null;
    const lastModified = typeof row.lastModified === "string" ? row.lastModified : null;
    output[key] = { etag, lastModified };
  }

  return output;
}

function maxDate(input: Array<Date | null>): Date | null {
  const values = input
    .filter((item): item is Date => item !== null)
    .map((item) => item.getTime());

  if (values.length === 0) {
    return null;
  }

  return new Date(Math.max(...values));
}

function reviewsCheckpointDate(collection: WaniKaniCollectionResponse): Date | null {
  const collectionUpdatedAt = toDate(collection.data_updated_at);
  const rowUpdatedAt = maxDate(collection.data.map((row) => toDate(row.data_updated_at)));
  return maxDate([collectionUpdatedAt, rowUpdatedAt]);
}

async function loadSubjectTypes(
  token: string,
  subjectIds: number[],
): Promise<Map<number, "radical" | "kanji" | "vocabulary">> {
  const output = new Map<number, "radical" | "kanji" | "vocabulary">();
  const chunkSize = 200;

  for (let i = 0; i < subjectIds.length; i += chunkSize) {
    const chunk = subjectIds.slice(i, i + chunkSize).join(",");
    if (!chunk) {
      continue;
    }

    const subjectChunk = await fetchAllCollectionPages(`/subjects?ids=${chunk}`, token);
    for (const row of subjectChunk.data) {
      const normalized = normalizeAssignmentType(row.object ?? "");
      if (!normalized) {
        continue;
      }

      output.set(row.id, normalized);
    }
  }

  return output;
}

function mergeHttpCacheEntry(
  previous: HttpCacheEntry | undefined,
  headers: WaniKaniResponseHeaders,
): HttpCacheEntry {
  return {
    etag: headers.etag ?? previous?.etag ?? null,
    lastModified: headers.lastModified ?? previous?.lastModified ?? null,
  };
}

function parseAssignmentCacheRows(input: unknown): AssignmentCacheRow[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: typeof item.id === "number" ? item.id : -1,
        object: typeof item.object === "string" ? item.object : undefined,
        data_updated_at:
          typeof item.data_updated_at === "string" ? item.data_updated_at : undefined,
        data:
          item.data && typeof item.data === "object"
            ? (item.data as Record<string, unknown>)
            : {},
      };
    })
    .filter((row) => row.id >= 0);
}

function maxAssignmentUpdatedAt(rows: AssignmentCacheRow[]): Date | null {
  const timestamps = rows
    .map((row) => toDate(row.data_updated_at))
    .filter((value): value is Date => value !== null)
    .map((value) => value.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function mergeAssignmentRows(
  existingRows: AssignmentCacheRow[],
  updates: AssignmentCacheRow[],
): AssignmentCacheRow[] {
  const byId = new Map<number, AssignmentCacheRow>();

  for (const row of existingRows) {
    byId.set(row.id, row);
  }

  for (const row of updates) {
    byId.set(row.id, row);
  }

  return Array.from(byId.values());
}

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
    missingSubjectIds.length > 0 ? await loadSubjectTypes(token, missingSubjectIds) : new Map();

  const lastGuruedAt = {
    radical: existing.lastRadicalGuruedAt,
    kanji: existing.lastKanjiGuruedAt,
    vocabulary: existing.lastVocabularyGuruedAt,
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
    }
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
  const jlptLearnedCounts = { n1: 0, n2: 0, n3: 0, n4: 0, n5: 0 };
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

  const jlptCounts = {
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

  const levelKanjiTotal = levelSnapshot.kanjiTotal;
  const levelKanjiLearned = levelSnapshot.kanjiLearned;
  const levelKanjiGuruPlus = levelSnapshot.kanjiGuruPlus;
  const levelKanjiLocked = levelSnapshot.kanjiLocked;
  const estimatedHoursRemaining = levelSnapshot.estimatedHoursRemaining;
  const levelKanjiItems = levelSnapshot.items;

  // Weighted score based on real progress metrics only.
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
