import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ensureActiveReadingChallengeId } from "@/lib/readingChallengeStore";
import {
  currentReviewQueueFromAssignmentCache,
  isMonthKey,
  isPstDateKey,
} from "@/lib/readingSignoff";
import {
  challengeReadScope,
  getReadingSignoffEntryDelegate,
} from "./readingSignoffsRoute.types";
import {
  backfillStaleCoverUrls,
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
  challengeId: z.string().min(1).max(120).optional(),
  accountId: z.string().cuid().optional(),
});

const postBodySchema = z.object({
  accountId: z.string().cuid(),
  challengeId: z.string().min(1).max(120).optional(),
  signoffDatePst: z.string().refine((value) => isPstDateKey(value), {
    message: "Invalid signoff date.",
  }),
  submittedAt: z.string().datetime({ offset: true }).optional(),
  bookTitle: z.string().trim().min(1).max(180),
  pagesRead: z.number().int().min(0).max(2000),
  minutesRead: z.number().int().min(0).max(1440),
  didWanikaniReviews: z.boolean(),
});

const patchBodySchema = z.object({
  accountId: z.string().cuid(),
  tracked: z.boolean(),
});

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
          challengeId: url.searchParams.get("challengeId") ?? undefined,
          accountId: url.searchParams.get("accountId") ?? undefined,
        });

        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        const viewerAccounts = await resolveViewerAccounts(request);
        if (viewerAccounts.length === 0) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const activeChallengeId = await ensureActiveReadingChallengeId();
        const selectedChallengeId = parsed.data.challengeId ?? activeChallengeId;

        if (parsed.data.challengeId && activeChallengeId && parsed.data.challengeId !== activeChallengeId) {
          return NextResponse.json({ error: "Selected campaign is not available yet." }, { status: 404 });
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
            ...challengeReadScope(selectedChallengeId),
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
                ...challengeReadScope(selectedChallengeId),
              },
              orderBy: [{ signoffDatePst: "asc" }, { createdAt: "asc" }],
            })
          : [];

        const latestSignoffs = await readingSignoff.findMany({
          where: {
            accountId: { in: targetAccountIds },
            ...challengeReadScope(selectedChallengeId),
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
            ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
        await ensureSeedBooks(viewerAccounts, challengeBooks, readingChallengeBook, selectedChallengeId);
        await backfillStaleCoverUrls(challengeBooks);

        const challengeBooksAfterSeed = await readingChallengeBook.findMany({
          where: {
            accountId: { in: targetAccountIds },
            ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
          },
        });

        const accountReviewQueues = await prisma.account.findMany({
          where: {
            id: { in: targetAccountIds },
          },
          select: {
            id: true,
            assignmentCache: true,
          },
        });

        const reviewQueues = accountReviewQueues.map((row) => {
          const queue = currentReviewQueueFromAssignmentCache(row.assignmentCache);
          return {
            accountId: row.id,
            radical: queue.radical,
            kanji: queue.kanji,
            vocabulary: queue.vocabulary,
            total: queue.total,
          };
        });

        const trackedMemberAccountIds = readingChallengeMember
          ? (() => {
              return readingChallengeMember.findMany({
                where: {
                  accountId: { in: targetAccountIds },
                  ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
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
            selectedChallengeId,
            viewerCanChooseMember: await isAuthorizedAdmin(request),
            trackedMemberAccountIds: await trackedMemberAccountIds,
            challengeBooks: challengeBooksAfterSeed.map(toChallengeBookRecord),
            signoffs: signoffs.map(toReadingSignoffRecord),
            signoffEntries: signoffEntries.map(toReadingSignoffEntryRecord),
            reviewQueues,
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

        const viewerIsAdmin = await isAuthorizedAdmin(request);
        if (!viewerIsAdmin && !(await canAccessAccount(request, parsed.data.accountId))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const activeChallengeId = await ensureActiveReadingChallengeId();
        const selectedChallengeId = parsed.data.challengeId ?? activeChallengeId;

        if (parsed.data.challengeId && activeChallengeId && parsed.data.challengeId !== activeChallengeId) {
          return NextResponse.json({ error: "Selected campaign is not available yet." }, { status: 404 });
        }

        if (parsed.data.submittedAt && !viewerIsAdmin) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const submittedAt = parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null;

        const account = await prisma.account.findUnique({
          where: { id: parsed.data.accountId },
          select: {
            id: true,
            apprenticeCount: true,
            wkLevel: true,
            assignmentCache: true,
          },
        });

        if (!account) {
          return NextResponse.json({ error: "Account not found." }, { status: 404 });
        }

        const readingChallengeBook = getReadingChallengeBookDelegate();
        if (!readingChallengeBook) {
          return NextResponse.json(
            { error: "Reading challenge setup is not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const challengeBooks = await readingChallengeBook.findMany({
          where: {
            accountId: { in: [account.id] },
            ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
          },
        });

        const hasReadingActivity = parsed.data.pagesRead > 0 || parsed.data.minutesRead > 0;
        const hasWaniKaniActivity = parsed.data.didWanikaniReviews;
        const isWaniKaniOnlyCheckin = !hasReadingActivity && hasWaniKaniActivity;

        if (!hasReadingActivity && !hasWaniKaniActivity) {
          return NextResponse.json({ error: "Choose reading activity, WaniKani activity, or both before saving." }, { status: 400 });
        }

        const allowedBookTitles = new Set(challengeBooks.map((book) => book.title.trim()));
        if (hasReadingActivity && !allowedBookTitles.has(parsed.data.bookTitle.trim())) {
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

        const existingChallengeId =
          ((existing as { challengeId?: string | null } | null)?.challengeId ?? null);

        if (existing && selectedChallengeId && existingChallengeId && existingChallengeId !== selectedChallengeId) {
          return NextResponse.json({ error: "Signoff belongs to a different challenge." }, { status: 409 });
        }

        const nextPagesRead = (existing?.pagesRead ?? 0) + parsed.data.pagesRead;
        const nextMinutesRead = (existing?.minutesRead ?? 0) + parsed.data.minutesRead;
        const normalizedBookTitle = isWaniKaniOnlyCheckin
          ? "WaniKani only"
          : parsed.data.bookTitle.trim() || existing?.bookTitle || "Reviews only";

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const reviewQueue = currentReviewQueueFromAssignmentCache(account.assignmentCache);
        const reviewWorkDone = reviewQueue.total;
        const reviewCorrect = reviewQueue.kanji;
        const reviewIncorrect = reviewQueue.vocabulary;
        const reviewSuccessPercent = reviewQueue.radical;
        const entryDidWanikaniReviews = parsed.data.didWanikaniReviews;

        if (readingSignoffEntry) {
          await readingSignoffEntry.create({
            data: {
              ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
              accountId: account.id,
              signoffDatePst: parsed.data.signoffDatePst,
              createdAt: submittedAt ?? undefined,
              bookTitle: normalizedBookTitle,
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
            ...(existingChallengeId ?? selectedChallengeId
              ? { challengeId: existingChallengeId ?? selectedChallengeId }
              : {}),
            bookTitle: normalizedBookTitle,
            pagesRead: nextPagesRead,
            minutesRead: nextMinutesRead,
            didWanikaniReviews: nextDidWanikaniReviews,
            reviewsLeft: reviewQueue.total,
            apprenticeCount: account.apprenticeCount,
            currentWkLevel: account.wkLevel,
          },
          create: {
            ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
            accountId: account.id,
            signoffDatePst: parsed.data.signoffDatePst,
            createdAt: submittedAt ?? undefined,
            bookTitle: normalizedBookTitle,
            pagesRead: parsed.data.pagesRead,
            minutesRead: parsed.data.minutesRead,
            didWanikaniReviews: nextDidWanikaniReviews,
            reviewsLeft: reviewQueue.total,
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

        const activeChallengeId = await ensureActiveReadingChallengeId();

        const readingChallengeMember = getReadingChallengeMemberDelegate();
        if (!readingChallengeMember) {
          return NextResponse.json(
            { error: "Reading challenge setup is not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const existing = await readingChallengeMember.findFirst({
          where: {
            accountId: parsed.data.accountId,
            ...(activeChallengeId ? { challengeId: activeChallengeId } : {}),
          },
          select: { id: true, accountId: true, tracked: true },
        });

        const saved = existing
          ? await readingChallengeMember.update({
              where: { id: existing.id },
              data: { tracked: parsed.data.tracked },
            })
          : await readingChallengeMember.create({
              data: {
                ...(activeChallengeId ? { challengeId: activeChallengeId } : {}),
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
