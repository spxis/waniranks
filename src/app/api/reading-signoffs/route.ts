import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import {
  INVITE_SESSION_COOKIE_NAME,
  getCookieValue,
  verifyInviteSessionToken,
} from "@/lib/inviteSession";
import { prisma } from "@/lib/prisma";
import {
  READING_BOOK_OPTIONS,
  isMonthKey,
  isPstDateKey,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";

const getQuerySchema = z.object({
  month: z.string().refine((value) => isMonthKey(value), {
    message: "Invalid month key.",
  }),
  accountId: z.string().cuid().optional(),
});

const postBodySchema = z.object({
  accountId: z.string().cuid(),
  signoffDatePst: z.string().refine((value) => isPstDateKey(value), {
    message: "Invalid signoff date.",
  }),
  bookTitle: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => READING_BOOK_OPTIONS.includes(value as (typeof READING_BOOK_OPTIONS)[number]), {
      message: "Invalid book choice.",
    }),
  pagesRead: z.number().int().min(1).max(2000),
  minutesRead: z.number().int().min(1).max(1440),
  didWanikaniReviews: z.boolean(),
});

type ViewerAccountSummary = {
  id: string;
  nickname: string;
  wkUsername: string;
};

type ReadingSignoffDelegate = {
  findMany: typeof prisma.readingSignoff.findMany;
  upsert: typeof prisma.readingSignoff.upsert;
};

function getReadingSignoffDelegate(): ReadingSignoffDelegate | null {
  const delegate = (prisma as unknown as { readingSignoff?: ReadingSignoffDelegate }).readingSignoff;
  return delegate ?? null;
}

function toReadingSignoffRecord(row: {
  id: string;
  accountId: string;
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewsLeft: number;
  apprenticeCount: number;
  currentWkLevel: number;
  createdAt: Date;
  updatedAt: Date;
}): ReadingSignoffRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    signoffDatePst: row.signoffDatePst,
    bookTitle: row.bookTitle,
    pagesRead: row.pagesRead,
    minutesRead: row.minutesRead,
    didWanikaniReviews: row.didWanikaniReviews,
    reviewsLeft: row.reviewsLeft,
    apprenticeCount: row.apprenticeCount,
    currentWkLevel: row.currentWkLevel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function resolveViewerAccounts(request: Request): Promise<ViewerAccountSummary[]> {
  if (await isAuthorizedAdmin(request)) {
    return prisma.account.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, wkUsername: true },
    });
  }

  const inviteToken = getCookieValue(request.headers.get("cookie"), INVITE_SESSION_COOKIE_NAME);
  const invitePayload = inviteToken ? verifyInviteSessionToken(inviteToken) : null;
  if (invitePayload?.accountId) {
    const inviteAccount = await prisma.account.findUnique({
      where: { id: invitePayload.accountId },
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
        inviteCodeHash: true,
      },
    });

    if (inviteAccount?.inviteCodeHash) {
      return [{ id: inviteAccount.id, nickname: inviteAccount.nickname, wkUsername: inviteAccount.wkUsername }];
    }
  }

  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!viewerEmail) {
    return [];
  }

  return prisma.account.findMany({
    where: { joinedByEmail: viewerEmail },
    orderBy: [{ nickname: "asc" }],
    select: { id: true, nickname: true, wkUsername: true },
  });
}

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-signoffs",
    method: "GET",
    request,
    execute: async () => {
      try {
        const url = new URL(request.url);
        const parsed = getQuerySchema.safeParse({
          month: url.searchParams.get("month") ?? "",
          accountId: url.searchParams.get("accountId") ?? undefined,
        });

        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        const viewerAccounts = await resolveViewerAccounts(request);
        if (viewerAccounts.length === 0) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const viewerAccountIds = new Set(viewerAccounts.map((account) => account.id));
        const requestedAccountId = parsed.data.accountId ?? null;
        if (requestedAccountId && !viewerAccountIds.has(requestedAccountId)) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const targetAccountIds = requestedAccountId
          ? [requestedAccountId]
          : viewerAccounts.map((account) => account.id);

        const readingSignoff = getReadingSignoffDelegate();
        if (!readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const signoffs = await readingSignoff.findMany({
          where: {
            accountId: { in: targetAccountIds },
            signoffDatePst: {
              startsWith: `${parsed.data.month}-`,
            },
          },
          orderBy: [{ signoffDatePst: "asc" }, { updatedAt: "desc" }],
        });

        return NextResponse.json(
          {
            members: viewerAccounts,
            signoffs: signoffs.map(toReadingSignoffRecord),
          },
          { status: 200 },
        );
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not fetch reading signoffs." }, { status: 500 });
      }
    },
  });
}

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-signoffs",
    method: "POST",
    request,
    execute: async () => {
      try {
        const parsed = postBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await canAccessAccount(request, parsed.data.accountId))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const account = await prisma.account.findUnique({
          where: { id: parsed.data.accountId },
          select: {
            id: true,
            pendingReviews: true,
            apprenticeCount: true,
            wkLevel: true,
          },
        });

        if (!account) {
          return NextResponse.json({ error: "Account not found." }, { status: 404 });
        }

        const readingSignoff = getReadingSignoffDelegate();
        if (!readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const saved = await readingSignoff.upsert({
          where: {
            accountId_signoffDatePst: {
              accountId: account.id,
              signoffDatePst: parsed.data.signoffDatePst,
            },
          },
          update: {
            bookTitle: parsed.data.bookTitle,
            pagesRead: parsed.data.pagesRead,
            minutesRead: parsed.data.minutesRead,
            didWanikaniReviews: parsed.data.didWanikaniReviews,
            reviewsLeft: account.pendingReviews,
            apprenticeCount: account.apprenticeCount,
            currentWkLevel: account.wkLevel,
          },
          create: {
            accountId: account.id,
            signoffDatePst: parsed.data.signoffDatePst,
            bookTitle: parsed.data.bookTitle,
            pagesRead: parsed.data.pagesRead,
            minutesRead: parsed.data.minutesRead,
            didWanikaniReviews: parsed.data.didWanikaniReviews,
            reviewsLeft: account.pendingReviews,
            apprenticeCount: account.apprenticeCount,
            currentWkLevel: account.wkLevel,
          },
        });

        return NextResponse.json({ signoff: toReadingSignoffRecord(saved) }, { status: 201 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not save reading signoff." }, { status: 500 });
      }
    },
  });
}
