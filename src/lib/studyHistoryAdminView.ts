import { prisma } from "@/lib/prisma";

type AdminStudyHistoryQuery = {
  accountId?: string;
  result?: "correct" | "wrong" | "skipped";
  page: number;
  pageSize: number;
};

export type AdminStudyHistoryRow = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: string;
  submittedAt: string;
};

export type AdminStudyHistoryPage = {
  attempts: AdminStudyHistoryRow[];
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

function normalizePage(raw: string | null): number {
  const parsed = Number(raw ?? "1");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.trunc(parsed);
}

function normalizePageSize(raw: string | null): number {
  const parsed = Number(raw ?? "30");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 30;
  }
  return Math.min(100, Math.trunc(parsed));
}

function normalizeResult(raw: string | null): AdminStudyHistoryQuery["result"] {
  if (raw === "correct" || raw === "wrong" || raw === "skipped") {
    return raw;
  }

  return undefined;
}

export function parseAdminStudyHistoryQuery(url: URL): AdminStudyHistoryQuery {
  return {
    accountId: url.searchParams.get("accountId") ?? undefined,
    result: normalizeResult(url.searchParams.get("result")),
    page: normalizePage(url.searchParams.get("page")),
    pageSize: normalizePageSize(url.searchParams.get("pageSize")),
  };
}

export async function getAdminStudyHistoryPage(args: AdminStudyHistoryQuery): Promise<AdminStudyHistoryPage> {
  const where = {
    ...(args.accountId ? { accountId: args.accountId } : {}),
    ...(args.result ? { result: args.result } : {}),
  };

  const total = await prisma.studyReviewAttempt.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / args.pageSize));
  const page = Math.min(args.page, totalPages);
  const skip = (page - 1) * args.pageSize;

  const [attemptRows, totalsByResultRows, accountRowsWithHistory] = await Promise.all([
    prisma.studyReviewAttempt.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip,
      take: args.pageSize,
      select: {
        id: true,
        accountId: true,
        assignmentId: true,
        subjectId: true,
        subjectType: true,
        result: true,
        submittedAt: true,
      },
    }),
    prisma.studyReviewAttempt.groupBy({
      by: ["result"],
      where,
      _count: {
        _all: true,
      },
    }),
    prisma.studyReviewAttempt.groupBy({
      by: ["accountId"],
      where,
      _count: {
        _all: true,
      },
    }),
  ]);

  const accountIds = Array.from(new Set(attemptRows.map((row) => row.accountId)));
  const accountRows = accountIds.length > 0
    ? await prisma.account.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          nickname: true,
          wkUsername: true,
        },
      })
    : [];

  const accountMap = new Map(accountRows.map((row) => [row.id, row]));

  const attempts = attemptRows.map((row) => {
    const account = accountMap.get(row.accountId);
    const fallbackUser = row.accountId;
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
    };
  });

  const totals: Record<string, number> = {};
  for (const row of totalsByResultRows) {
    totals[row.result] = row._count._all;
  }

  return {
    attempts,
    totals,
    accountCount: accountRowsWithHistory.length,
    pagination: {
      page,
      pageSize: args.pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}
