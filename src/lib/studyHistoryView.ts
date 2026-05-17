import { prisma } from "@/lib/prisma";
import {
  isSubjectStatus,
  srsBucketFromStage,
  type SrsBucket,
  type SubjectStatus,
  type SubjectType,
} from "@/lib/domainConstants";

export type StudyHistorySortBy = "submittedAt" | "result" | "subjectType" | "subject" | "user";
export type StudyHistorySortDir = "asc" | "desc";

export type StudyHistoryRow = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: string;
  submittedAt: string;
  subjectLabel: string;
  subjectReading: string | null;
  subjectMeaning: string | null;
  wkLevel: number | null;
  srsStage: number | null;
  srsBucket: SrsBucket;
  subjectData: SnapshotItem | null;
};

export type StudyHistoryPage = {
  attempts: StudyHistoryRow[];
  totals: Record<string, number>;
  accountCount: number;
  availableLevels: number[];
  availableSrs: number[];
  availableSrsBuckets: Array<
    SrsBucket
  >;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

type QueryArgs = {
  accountId?: string;
  result?: "correct" | "wrong" | "skipped";
  level?: number;
  srs?: number;
  srsBucket?: SubjectStatus;
  page: number;
  pageSize: number;
  sortBy: StudyHistorySortBy;
  sortDir: StudyHistorySortDir;
};

type SnapshotItem = {
  subjectId?: number;
  subjectType?: SubjectType;
  status?: SubjectStatus;
  characters?: string;
  meanings?: string[];
  readings?: string[];
  primaryReadings?: string[];
  radicals?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  visuallySimilar?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  usedInVocabulary?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  componentKanji?: Array<{ subjectId: number; label: string; wkLevel?: number | null; reading?: string | null }>;
  meaningExplanation?: string;
  readingExplanation?: string;
  jlptLevel?: number | null;
  jlptMeta?: {
    primaryMeaning: string | null;
    meanings: string[];
    onReadings: string[];
    kunReadings: string[];
    nanoriReadings: string[];
    wordExamples: unknown;
    strokeCount: number | null;
    frequencyRank: number | null;
    schoolGrade: number | null;
    heisigKeyword: string | null;
  } | null;
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt?: string | null;
  wkLevel?: number;
  srsStage?: number;
};

function parseSnapshotItems(raw: unknown): SnapshotItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((row): row is SnapshotItem => {
    if (!row || typeof row !== "object") {
      return false;
    }

    const typed = row as SnapshotItem;
    return typeof typed.subjectId === "number" && typed.subjectId > 0;
  });
}

function normalizeSort(sortBy: string | null): StudyHistorySortBy {
  if (sortBy === "result" || sortBy === "subjectType" || sortBy === "subject" || sortBy === "user") {
    return sortBy;
  }
  return "submittedAt";
}

function normalizeDir(sortDir: string | null): StudyHistorySortDir {
  return sortDir === "asc" ? "asc" : "desc";
}

function normalizePage(raw: string | null): number {
  const parsed = Number(raw ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.trunc(parsed);
}

function normalizePageSize(raw: string | null): number {
  const parsed = Number(raw ?? "25");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 25;
  }
  return Math.min(100, Math.trunc(parsed));
}

function normalizeResult(raw: string | null): QueryArgs["result"] {
  if (raw === "correct" || raw === "wrong" || raw === "skipped") {
    return raw;
  }

  return undefined;
}

function normalizeSrsBucket(raw: string | null): QueryArgs["srsBucket"] {
  if (isSubjectStatus(raw)) {
    return raw;
  }

  return undefined;
}

function getSrsBucketFromStage(stage: number | null): SrsBucket {
  return srsBucketFromStage(stage);
}

function normalizeOptionalPositiveInt(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export function parseStudyHistoryQuery(url: URL): QueryArgs {
  return {
    accountId: url.searchParams.get("accountId") ?? undefined,
    result: normalizeResult(url.searchParams.get("result")),
    level: normalizeOptionalPositiveInt(url.searchParams.get("level")),
    srs: normalizeOptionalPositiveInt(url.searchParams.get("srs")),
    srsBucket: normalizeSrsBucket(url.searchParams.get("srsBucket")),
    page: normalizePage(url.searchParams.get("page")),
    pageSize: normalizePageSize(url.searchParams.get("pageSize")),
    sortBy: normalizeSort(url.searchParams.get("sortBy")),
    sortDir: normalizeDir(url.searchParams.get("sortDir")),
  };
}

export async function getStudyHistoryPage(args: QueryArgs): Promise<StudyHistoryPage> {
  const where = {
    ...(args.accountId ? { accountId: args.accountId } : {}),
    ...(args.result ? { result: args.result } : {}),
  };

  const attempts = await prisma.studyReviewAttempt.findMany({
    where,
    orderBy: { submittedAt: "desc" },
  });

  const accountIds = Array.from(new Set(attempts.map((row) => row.accountId)));

  const [accountRows, subjectSnapshotRows] = await Promise.all([
    prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
        levelKanjiItems: true,
      },
    }),
    prisma.levelSnapshot.findMany({
      where: { accountId: { in: accountIds } },
      orderBy: { syncedAt: "desc" },
      select: { accountId: true, items: true },
    }),
  ]);

  const accountMap = new Map(
    accountRows.map((row) => [row.id, { nickname: row.nickname, wkUsername: row.wkUsername }]),
  );

  const subjectMeta = new Map<
    string,
    {
      label: string;
      reading: string | null;
      meaning: string | null;
      wkLevel: number | null;
      srsStage: number | null;
      srsBucket: SrsBucket;
      subjectData: SnapshotItem | null;
    }
  >();

  for (const row of subjectSnapshotRows) {
    for (const item of parseSnapshotItems(row.items)) {
      const key = `${row.accountId}:${item.subjectId}`;
      if (subjectMeta.has(key)) {
        continue;
      }

      const reading = Array.isArray(item.primaryReadings)
        ? item.primaryReadings[0] ?? null
        : Array.isArray(item.readings)
          ? item.readings[0] ?? null
          : null;

      const meaning = Array.isArray(item.meanings) ? item.meanings[0] ?? null : null;
      const stage = typeof item.srsStage === "number" ? item.srsStage : null;
      subjectMeta.set(key, {
        label: item.characters ?? `#${item.subjectId}`,
        reading,
        meaning,
        wkLevel: typeof item.wkLevel === "number" ? item.wkLevel : null,
        srsStage: stage,
        srsBucket: item.status ?? getSrsBucketFromStage(stage),
        subjectData: item,
      });
    }
  }

  for (const row of accountRows) {
    for (const item of parseSnapshotItems(row.levelKanjiItems)) {
      const key = `${row.id}:${item.subjectId}`;
      if (subjectMeta.has(key)) {
        continue;
      }

      const reading = Array.isArray(item.primaryReadings)
        ? item.primaryReadings[0] ?? null
        : Array.isArray(item.readings)
          ? item.readings[0] ?? null
          : null;
      const meaning = Array.isArray(item.meanings) ? item.meanings[0] ?? null : null;
      const stage = typeof item.srsStage === "number" ? item.srsStage : null;
      subjectMeta.set(key, {
        label: item.characters ?? `#${item.subjectId}`,
        reading,
        meaning,
        wkLevel: typeof item.wkLevel === "number" ? item.wkLevel : null,
        srsStage: stage,
        srsBucket: item.status ?? getSrsBucketFromStage(stage),
        subjectData: item,
      });
    }
  }

  let rows: StudyHistoryRow[] = attempts.map((row) => {
    const account = accountMap.get(row.accountId);
    const fallbackUser = row.accountId;
    const key = `${row.accountId}:${row.subjectId}`;
    const subject = subjectMeta.get(key);

    return {
      id: row.id,
      accountId: row.accountId,
      nickname: account?.nickname ?? fallbackUser,
      wkUsername: account?.wkUsername ?? fallbackUser,
      assignmentId: row.assignmentId,
      subjectId: row.subjectId,
      subjectType: row.subjectType,
      result: row.result,
      submittedAt: row.submittedAt.toISOString(),
      subjectLabel: subject?.label ?? `#${row.subjectId}`,
      subjectReading: subject?.reading ?? null,
      subjectMeaning: subject?.meaning ?? null,
      wkLevel: subject?.wkLevel ?? null,
      srsStage: subject?.srsStage ?? null,
      srsBucket: subject?.srsBucket ?? "unknown",
      subjectData: subject?.subjectData ?? null,
    };
  });

  if (typeof args.level === "number") {
    rows = rows.filter((row) => row.wkLevel === args.level);
  }

  if (typeof args.srs === "number") {
    rows = rows.filter((row) => row.srsStage === args.srs);
  }

  if (args.srsBucket) {
    rows = rows.filter((row) => row.srsBucket === args.srsBucket);
  }

  const compareSign = args.sortDir === "asc" ? 1 : -1;
  rows = rows.sort((a, b) => {
    if (args.sortBy === "submittedAt") {
      return compareSign * (new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }

    if (args.sortBy === "result") {
      const compare = a.result.localeCompare(b.result, undefined, { sensitivity: "base" });
      return compare === 0
        ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        : compare * compareSign;
    }

    if (args.sortBy === "subjectType") {
      const compare = a.subjectType.localeCompare(b.subjectType, undefined, { sensitivity: "base" });
      return compare === 0
        ? new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        : compare * compareSign;
    }

    if (args.sortBy === "subject") {
      const compare = a.subjectLabel.localeCompare(b.subjectLabel, undefined, { sensitivity: "base" });
      return compare * compareSign;
    }

    const compare = a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
    return compare * compareSign;
  });

  const totalsByResult: Record<string, number> = {};
  for (const row of rows) {
    totalsByResult[row.result] = (totalsByResult[row.result] ?? 0) + 1;
  }

  const filteredTotal = rows.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / args.pageSize));
  const page = Math.min(args.page, totalPages);
  const pageStart = (page - 1) * args.pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + args.pageSize);
  const availableLevels = Array.from(
    new Set(rows.map((row) => row.wkLevel).filter((level): level is number => typeof level === "number")),
  ).sort((a, b) => a - b);
  const availableSrs = Array.from(
    new Set(rows.map((row) => row.srsStage).filter((srs): srs is number => typeof srs === "number")),
  ).sort((a, b) => a - b);
  const availableSrsBuckets = Array.from(new Set(rows.map((row) => row.srsBucket)));
  const accountCount = new Set(rows.map((row) => row.accountId)).size;

  return {
    attempts: pagedRows,
    totals: totalsByResult,
    accountCount,
    availableLevels,
    availableSrs,
    availableSrsBuckets,
    pagination: {
      page,
      pageSize: args.pageSize,
      total: filteredTotal,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
