import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  isMonthKey,
  isPstDateKey,
} from "@/lib/readingSignoff";
import {
  ensureSeedBooks,
  getReadingChallengeBookDelegate,
  getReadingChallengeMemberDelegate,
  getReadingSignoffDelegate,
  resolveViewerAccounts,
  toChallengeBookRecord,
  toReadingSignoffEntryRecord,
  toReadingSignoffRecord,
  type LatestSignoffSummary,
} from "./readingSignoffsRoute.lib";

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
  bookTitle: z.string().trim().min(1).max(180),
  pagesRead: z.number().int().min(1).max(2000),
  minutesRead: z.number().int().min(1).max(1440),
  didWanikaniReviews: z.boolean(),
});

const patchBodySchema = z.object({
  accountId: z.string().cuid(),
  tracked: z.boolean(),
});

type ReadingSignoffEntryDelegate = {
  findMany: typeof prisma.readingSignoffEntry.findMany;
  findFirst: typeof prisma.readingSignoffEntry.findFirst;
  create: typeof prisma.readingSignoffEntry.create;
};

function getReadingSignoffEntryDelegate(): ReadingSignoffEntryDelegate | null {
  const delegate = (prisma as unknown as { readingSignoffEntry?: ReadingSignoffEntryDelegate }).readingSignoffEntry;
  return delegate ?? null;
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
        const readingChallengeBook = getReadingChallengeBookDelegate();
        const readingChallengeMember = getReadingChallengeMemberDelegate();
        if (!readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        if (!readingChallengeBook) {
          return NextResponse.json(
            { error: "Reading challenge setup is not ready yet. Restart the dev server and try again." },
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

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const signoffEntries = readingSignoffEntry
          ? await readingSignoffEntry.findMany({
              where: {
                accountId: { in: targetAccountIds },
                signoffDatePst: {
                  startsWith: `${parsed.data.month}-`,
                },
              },
              orderBy: [{ signoffDatePst: "asc" }, { createdAt: "asc" }],
            })
          : [];

        const latestSignoffs = await readingSignoff.findMany({
          where: {
            accountId: { in: targetAccountIds },
          },
          orderBy: [{ updatedAt: "desc" }],
        });

        const latestByAccountId = new Map<string, LatestSignoffSummary>();
        for (const row of latestSignoffs) {
          if (latestByAccountId.has(row.accountId)) {
            continue;
          }

          latestByAccountId.set(row.accountId, {
            accountId: row.accountId,
            bookTitle: row.bookTitle,
            pagesRead: row.pagesRead,
            signoffDatePst: row.signoffDatePst,
          });
        }

        const challengeBooksRaw = await readingChallengeBook.findMany({
          where: {
            accountId: { in: targetAccountIds },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
          },
        });

        const challengeBooks = challengeBooksRaw.map(toChallengeBookRecord);
        await ensureSeedBooks(viewerAccounts, challengeBooks, readingChallengeBook);

        const challengeBooksAfterSeed = await readingChallengeBook.findMany({
          where: {
            accountId: { in: targetAccountIds },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
          },
        });

        const trackedMemberAccountIds = readingChallengeMember
          ? (() => {
              return readingChallengeMember.findMany({
                where: {
                  accountId: { in: targetAccountIds },
                },
                select: {
                  accountId: true,
                  tracked: true,
                },
              }).then((trackedMembers) => {
                const trackedByAccountId = new Map(trackedMembers.map((row) => [row.accountId, row.tracked]));
                return targetAccountIds.filter((accountId) => trackedByAccountId.get(accountId) !== false);
              });
            })()
          : Promise.resolve(targetAccountIds);

        return NextResponse.json(
          {
            members: viewerAccounts,
            viewerCanChooseMember: await isAuthorizedAdmin(request),
            trackedMemberAccountIds: await trackedMemberAccountIds,
            challengeBooks: challengeBooksAfterSeed.map(toChallengeBookRecord),
            signoffs: signoffs.map(toReadingSignoffRecord),
            signoffEntries: signoffEntries.map(toReadingSignoffEntryRecord),
            latestSignoffs: targetAccountIds
              .map((accountId) => latestByAccountId.get(accountId))
              .filter((value): value is LatestSignoffSummary => Boolean(value)),
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

        const challengeBooks = await prisma.readingChallengeBook.findMany({
          where: { accountId: account.id },
          select: { title: true },
        });

        const allowedBookTitles = new Set(challengeBooks.map((book) => book.title.trim()));
        if (!allowedBookTitles.has(parsed.data.bookTitle.trim())) {
          return NextResponse.json({ error: "Pick a saved challenge book before saving." }, { status: 400 });
        }

        const readingSignoff = getReadingSignoffDelegate();
        if (!readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const existing = await readingSignoff.findUnique({
          where: {
            accountId_signoffDatePst: {
              accountId: account.id,
              signoffDatePst: parsed.data.signoffDatePst,
            },
          },
        });

        const nextPagesRead = (existing?.pagesRead ?? 0) + parsed.data.pagesRead;
        const nextMinutesRead = (existing?.minutesRead ?? 0) + parsed.data.minutesRead;

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const previousEntry = readingSignoffEntry
          ? await readingSignoffEntry.findFirst({
              where: { accountId: account.id },
              orderBy: [{ createdAt: "desc" }],
              select: { createdAt: true },
            })
          : null;

        const reviewWindowStart = previousEntry?.createdAt ?? new Date(`${parsed.data.signoffDatePst}T00:00:00.000Z`);
        const reviewWindowWhere = {
          accountId: account.id,
          submittedAt: {
            gt: reviewWindowStart,
          },
        } as const;

        const reviewCorrect = await prisma.studyReviewAttempt.count({
          where: {
            ...reviewWindowWhere,
            result: "correct",
          },
        });

        const reviewIncorrect = await prisma.studyReviewAttempt.count({
          where: {
            ...reviewWindowWhere,
            result: { in: ["wrong", "skipped"] },
          },
        });

        const reviewWorkDone = reviewCorrect + reviewIncorrect;
        const reviewSuccessPercent = reviewWorkDone > 0
          ? Math.round((reviewCorrect / reviewWorkDone) * 100)
          : null;
        const entryDidWanikaniReviews = parsed.data.didWanikaniReviews || reviewWorkDone > 0;

        if (readingSignoffEntry) {
          await readingSignoffEntry.create({
            data: {
              accountId: account.id,
              signoffDatePst: parsed.data.signoffDatePst,
              bookTitle: parsed.data.bookTitle,
              pagesRead: parsed.data.pagesRead,
              minutesRead: parsed.data.minutesRead,
              didWanikaniReviews: entryDidWanikaniReviews,
              reviewWorkDone,
              reviewCorrect,
              reviewIncorrect,
              reviewSuccessPercent,
            },
          });
        }

        const nextDidWanikaniReviews = Boolean(existing?.didWanikaniReviews || entryDidWanikaniReviews);

        const saved = await readingSignoff.upsert({
          where: {
            accountId_signoffDatePst: {
              accountId: account.id,
              signoffDatePst: parsed.data.signoffDatePst,
            },
          },
          update: {
            bookTitle: parsed.data.bookTitle,
            pagesRead: nextPagesRead,
            minutesRead: nextMinutesRead,
            didWanikaniReviews: nextDidWanikaniReviews,
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

export async function PATCH(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-signoffs",
    method: "PATCH",
    request,
    execute: async () => {
      try {
        const parsed = patchBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const readingChallengeMember = getReadingChallengeMemberDelegate();
        if (!readingChallengeMember) {
          return NextResponse.json(
            { error: "Reading challenge setup is not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const saved = await readingChallengeMember.upsert({
          where: { accountId: parsed.data.accountId },
          update: { tracked: parsed.data.tracked },
          create: {
            accountId: parsed.data.accountId,
            tracked: parsed.data.tracked,
          },
        });

        return NextResponse.json({ trackedMember: saved }, { status: 200 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not update tracked members." }, { status: 500 });
      }
    },
  });
}
