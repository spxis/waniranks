import { prisma } from "@/lib/prisma";

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
};

export type StudyHistoryPage = {
  attempts: StudyHistoryRow[];
  totals: Record<string, number>;
  accountCount: number;
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
  page: number;
  pageSize: number;
  sortBy: StudyHistorySortBy;
  sortDir: StudyHistorySortDir;
};

type SnapshotItem = {
  subjectId?: number;
  characters?: string;
  meanings?: string[];
  primaryReadings?: string[];
  readings?: string[];
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

export function parseStudyHistoryQuery(url: URL): QueryArgs {
  return {
    accountId: url.searchParams.get("accountId") ?? undefined,
    page: normalizePage(url.searchParams.get("page")),
    pageSize: normalizePageSize(url.searchParams.get("pageSize")),
    sortBy: normalizeSort(url.searchParams.get("sortBy")),
    sortDir: normalizeDir(url.searchParams.get("sortDir")),
  };
}

export async function getStudyHistoryPage(args: QueryArgs): Promise<StudyHistoryPage> {
  const where = args.accountId ? { accountId: args.accountId } : {};
  const skip = (args.page - 1) * args.pageSize;

  const baseOrderBy =
    args.sortBy === "result"
      ? [{ result: args.sortDir }, { submittedAt: "desc" as const }]
      : args.sortBy === "subjectType"
        ? [{ subjectType: args.sortDir }, { submittedAt: "desc" as const }]
        : [{ submittedAt: args.sortDir }];

  const [attempts, totalCount, totals, accountStats, accountRows] = await Promise.all([
    prisma.studyReviewAttempt.findMany({
      where,
      orderBy: baseOrderBy,
      skip,
      take: args.pageSize,
    }),
    prisma.studyReviewAttempt.count({ where }),
    prisma.studyReviewAttempt.groupBy({
      by: ["result"],
      where,
      _count: true,
    }),
    prisma.studyReviewAttempt.groupBy({
      by: ["accountId"],
      where,
      _count: true,
    }),
    prisma.account.findMany({
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
        levelKanjiItems: true,
      },
    }),
  ]);

  const accountMap = new Map(
    accountRows.map((row) => [row.id, { nickname: row.nickname, wkUsername: row.wkUsername }]),
  );

  const accountIds = Array.from(new Set(attempts.map((row) => row.accountId)));

  const snapshotRows = await prisma.levelSnapshot.findMany({
    where: { accountId: { in: accountIds } },
    orderBy: { syncedAt: "desc" },
    select: { accountId: true, items: true },
  });

  const subjectMeta = new Map<
    string,
    { label: string; reading: string | null; meaning: string | null }
  >();

  for (const row of snapshotRows) {
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
      subjectMeta.set(key, {
        label: item.characters ?? `#${item.subjectId}`,
        reading,
        meaning,
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
      subjectMeta.set(key, {
        label: item.characters ?? `#${item.subjectId}`,
        reading,
        meaning,
      });
    }
  }

  const totalsByResult: Record<string, number> = {};
  for (const row of totals) {
    totalsByResult[row.result] = row._count;
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
    };
  });

  if (args.sortBy === "subject") {
    rows = rows.sort((a, b) => {
      const compare = a.subjectLabel.localeCompare(b.subjectLabel, undefined, { sensitivity: "base" });
      return args.sortDir === "asc" ? compare : -compare;
    });
  }

  if (args.sortBy === "user") {
    rows = rows.sort((a, b) => {
      const compare = a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
      return args.sortDir === "asc" ? compare : -compare;
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / args.pageSize));

  return {
    attempts: rows,
    totals: totalsByResult,
    accountCount: accountStats.length,
    pagination: {
      page: args.page,
      pageSize: args.pageSize,
      total: totalCount,
      totalPages,
      hasNext: args.page < totalPages,
      hasPrevious: args.page > 1,
    },
  };
}
