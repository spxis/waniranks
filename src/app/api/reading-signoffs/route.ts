import { NextResponse } from "next/server";
import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { resolveReadingCampaignSelection } from "@/lib/readingChallengeStore";
import { currentReviewQueueFromAssignmentCache } from "@/lib/readingSignoff";
import {
  challengeReadScope,
  getReadingSignoffEntryDelegate,
} from "./readingSignoffsRoute.types";
import {
  getQuerySchema,
  patchBodySchema,
  postBodySchema,
  prismaErrorCode,
} from "./readingSignoffsRoute.validation";
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
import { toReadingReviewQueueSnapshot } from "./readingSignoffsRoute.reviewQueue";

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

        const campaignSelection = await resolveReadingCampaignSelection(parsed.data.challengeId);
        const selectedChallengeId = campaignSelection.selectedCampaignId;

        if (parsed.data.challengeId && parsed.data.challengeId !== selectedChallengeId) {
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

        const challengeBookQuery: Parameters<typeof readingChallengeBook.findMany>[0] = {
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
            manualCoverUrl: true,
            infoUrl: true,
          },
        };

        const challengeBooksRaw = await readingChallengeBook.findMany(challengeBookQuery);
        const challengeBooks = challengeBooksRaw.map(toChallengeBookRecord);
        await ensureSeedBooks(viewerAccounts, challengeBooks, readingChallengeBook, selectedChallengeId);
        await backfillStaleCoverUrls(challengeBooks);

        const challengeBooksAfterSeed = await readingChallengeBook.findMany(challengeBookQuery);

        const accountReviewQueues = await prisma.account.findMany({
          where: {
            id: { in: targetAccountIds },
          },
          select: {
            id: true,
            pendingReviews: true,
            assignmentCache: true,
          },
        });

        const reviewQueues = accountReviewQueues.map(toReadingReviewQueueSnapshot);

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
            campaigns: campaignSelection.campaigns,
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

        const campaignSelection = await resolveReadingCampaignSelection(parsed.data.challengeId);
        const selectedChallengeId = campaignSelection.selectedCampaignId;

        if (parsed.data.challengeId && parsed.data.challengeId !== selectedChallengeId) {
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
            pendingReviews: true,
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
            manualCoverUrl: true,
            infoUrl: true,
          },
        });

        const hasReadingActivity = parsed.data.pagesRead > 0 || parsed.data.minutesRead > 0;
        const requestedWaniKaniCredit = parsed.data.didWanikaniReviews;
        const isWaniKaniOnlyCheckin = !hasReadingActivity && requestedWaniKaniCredit;

        if (!hasReadingActivity && !requestedWaniKaniCredit) {
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

        const reviewQueue = currentReviewQueueFromAssignmentCache(account.assignmentCache);
        const pendingReviewsAtSave = Math.max(0, account.pendingReviews ?? reviewQueue.total);
        if (isWaniKaniOnlyCheckin && pendingReviewsAtSave > 0) {
          return NextResponse.json(
            {
              error: `WaniKani credit requires 0 reviews due. ${pendingReviewsAtSave} review${pendingReviewsAtSave === 1 ? "" : "s"} still due.`,
            },
            { status: 400 },
          );
        }

        const alreadyLockedZeroReviewCredit = Boolean(existing?.didWanikaniReviews && existing.reviewsLeft === 0);
        const grantedWaniKaniCreditNow = requestedWaniKaniCredit && pendingReviewsAtSave === 0;
        const didWanikaniReviewsForDay = alreadyLockedZeroReviewCredit || grantedWaniKaniCreditNow;
        const reviewsLeftForDay = didWanikaniReviewsForDay ? 0 : pendingReviewsAtSave;

        const nextPagesRead = (existing?.pagesRead ?? 0) + parsed.data.pagesRead;
        const nextMinutesRead = (existing?.minutesRead ?? 0) + parsed.data.minutesRead;
        const normalizedBookTitle = isWaniKaniOnlyCheckin
          ? "WaniKani only"
          : parsed.data.bookTitle.trim() || existing?.bookTitle || "Reviews only";

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const reviewWorkDone = pendingReviewsAtSave;
        const reviewCorrect = reviewQueue.kanji;
        const reviewIncorrect = reviewQueue.vocabulary;
        const reviewSuccessPercent = reviewQueue.radical;
        const entryDidWanikaniReviews = grantedWaniKaniCreditNow;

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
            didWanikaniReviews: didWanikaniReviewsForDay,
            reviewsLeft: reviewsLeftForDay,
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
            didWanikaniReviews: didWanikaniReviewsForDay,
            reviewsLeft: reviewsLeftForDay,
            apprenticeCount: account.apprenticeCount,
            currentWkLevel: account.wkLevel,
          },
        });

        return NextResponse.json(
          {
            signoff: toReadingSignoffRecord(saved),
            waniKaniCreditRequested: requestedWaniKaniCredit,
            waniKaniCreditGranted: didWanikaniReviewsForDay && reviewsLeftForDay === 0,
            pendingReviewsAtSave,
          },
          { status: 201 },
        );
      } catch (error) {
        const code = prismaErrorCode(error);
        if (code === "P2002") {
          return NextResponse.json({ error: "This check-in was already saved. Refresh and try again." }, { status: 409 });
        }

        if (code === "P2003") {
          return NextResponse.json({ error: "Selected campaign is invalid. Refresh and try again." }, { status: 409 });
        }

        console.error(error);
        return NextResponse.json({ error: "Could not save check-in." }, { status: 500 });
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

        const campaignSelection = await resolveReadingCampaignSelection();
        const selectedChallengeId = campaignSelection.selectedCampaignId;

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
            ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
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
                ...(selectedChallengeId ? { challengeId: selectedChallengeId } : {}),
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
