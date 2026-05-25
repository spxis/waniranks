import { getServerSession } from "next-auth";

import { isAuthorizedAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import {
  INVITE_SESSION_COOKIE_NAME,
  getCookieValue,
  verifyInviteSessionToken,
} from "@/lib/inviteSession";
import { isItemSpread } from "@/lib/itemSpread";
import { prisma } from "@/lib/prisma";
import {
  READING_CHALLENGE_BOOK_SEEDS_BY_NICKNAME,
  normalizeIsbn,
  toBookCoverUrl,
  toOpenLibraryBookUrl,
  type ReadingChallengeBookRecord,
  type ReadingSignoffEntryRecord,
  type ReadingSignoffRecord,
} from "@/lib/readingSignoff";

export type ViewerAccountSummary = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  learnedKanji: number;
  learnedRadicals: number;
  learnedVocabulary: number;
};

export type LatestSignoffSummary = {
  accountId: string;
  bookTitle: string;
  pagesRead: number;
  signoffDatePst: string;
};

export type ReadingSignoffDelegate = {
  findMany: typeof prisma.readingSignoff.findMany;
  findUnique: typeof prisma.readingSignoff.findUnique;
  upsert: typeof prisma.readingSignoff.upsert;
};

export type ReadingChallengeBookDelegate = {
  findMany: (args: {
    where: { accountId: { in: string[] } };
    orderBy: [{ createdAt: "asc" }, { id: "asc" }];
    select: {
      id: true;
      accountId: true;
      isbn: true;
      title: true;
      thumbnailUrl: true;
      infoUrl: true;
    };
  }) => Promise<Array<{
    id: string;
    accountId: string;
    isbn: string;
    title: string;
    thumbnailUrl: string | null;
    infoUrl: string | null;
  }>>;
  createMany: (args: {
    data: Array<{
      accountId: string;
      isbn: string;
      title: string;
      thumbnailUrl: string | null;
      infoUrl: string | null;
    }>;
    skipDuplicates: true;
  }) => Promise<{ count: number }>;
};

export type ReadingChallengeMemberDelegate = {
  findMany: (args: {
    where: { accountId: { in: string[] } };
    select: { accountId: true; tracked: true };
  }) => Promise<Array<{ accountId: string; tracked: boolean }>>;
  upsert: (args: {
    where: { accountId: string };
    update: { tracked: boolean };
    create: { accountId: string; tracked: boolean };
  }) => Promise<{ accountId: string; tracked: boolean }>;
};

export function getReadingSignoffDelegate(): ReadingSignoffDelegate | null {
  const delegate = (prisma as unknown as { readingSignoff?: ReadingSignoffDelegate }).readingSignoff;
  return delegate ?? null;
}

export function getReadingChallengeBookDelegate(): ReadingChallengeBookDelegate | null {
  const delegate = (prisma as unknown as { readingChallengeBook?: ReadingChallengeBookDelegate }).readingChallengeBook;
  return delegate ?? null;
}

export function getReadingChallengeMemberDelegate(): ReadingChallengeMemberDelegate | null {
  const delegate = (prisma as unknown as { readingChallengeMember?: ReadingChallengeMemberDelegate }).readingChallengeMember;
  return delegate ?? null;
}

function learnedCountsFromItemSpread(input: unknown): {
  learnedKanji: number;
  learnedRadicals: number;
  learnedVocabulary: number;
} {
  if (!isItemSpread(input)) {
    return {
      learnedKanji: 0,
      learnedRadicals: 0,
      learnedVocabulary: 0,
    };
  }

  return {
    learnedKanji: input.guru.kanji + input.master.kanji + input.enlightened.kanji + input.burned.kanji,
    learnedRadicals: input.guru.radical + input.master.radical + input.enlightened.radical + input.burned.radical,
    learnedVocabulary: input.guru.vocabulary + input.master.vocabulary + input.enlightened.vocabulary + input.burned.vocabulary,
  };
}

export function toReadingSignoffRecord(row: {
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

export function toReadingSignoffEntryRecord(row: {
  id: string;
  accountId: string;
  signoffDatePst: string;
  bookTitle: string;
  pagesRead: number;
  minutesRead: number;
  didWanikaniReviews: boolean;
  reviewWorkDone: number;
  reviewCorrect: number;
  reviewIncorrect: number;
  reviewSuccessPercent: number | null;
  createdAt: Date;
}): ReadingSignoffEntryRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    signoffDatePst: row.signoffDatePst,
    bookTitle: row.bookTitle,
    pagesRead: row.pagesRead,
    minutesRead: row.minutesRead,
    didWanikaniReviews: row.didWanikaniReviews,
    reviewWorkDone: row.reviewWorkDone,
    reviewCorrect: row.reviewCorrect,
    reviewIncorrect: row.reviewIncorrect,
    reviewSuccessPercent: row.reviewSuccessPercent,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toChallengeBookRecord(row: {
  id: string;
  accountId: string;
  isbn: string;
  title: string;
  thumbnailUrl: string | null;
  infoUrl: string | null;
}): ReadingChallengeBookRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    isbn: row.isbn,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    infoUrl: row.infoUrl,
  };
}

export async function resolveViewerAccounts(request: Request): Promise<ViewerAccountSummary[]> {
  if (await isAuthorizedAdmin(request)) {
    const rows = await prisma.account.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, wkUsername: true, wkLevel: true, itemSpread: true },
    });

    return rows.map((row) => {
      const learned = learnedCountsFromItemSpread(row.itemSpread);
      return {
        id: row.id,
        nickname: row.nickname,
        wkUsername: row.wkUsername,
        wkLevel: row.wkLevel,
        ...learned,
      };
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
        wkLevel: true,
        itemSpread: true,
        inviteCodeHash: true,
      },
    });

    if (inviteAccount?.inviteCodeHash) {
      return [{
        id: inviteAccount.id,
        nickname: inviteAccount.nickname,
        wkUsername: inviteAccount.wkUsername,
        wkLevel: inviteAccount.wkLevel,
        ...learnedCountsFromItemSpread(inviteAccount.itemSpread),
      }];
    }
  }

  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!viewerEmail) {
    return [];
  }

  const rows = await prisma.account.findMany({
    where: { joinedByEmail: viewerEmail },
    orderBy: [{ nickname: "asc" }],
    select: { id: true, nickname: true, wkUsername: true, wkLevel: true, itemSpread: true },
  });

  return rows.map((row) => {
    const learned = learnedCountsFromItemSpread(row.itemSpread);
    return {
      id: row.id,
      nickname: row.nickname,
      wkUsername: row.wkUsername,
      wkLevel: row.wkLevel,
      ...learned,
    };
  });
}

export async function ensureSeedBooks(
  accounts: ViewerAccountSummary[],
  challengeBooks: ReadingChallengeBookRecord[],
  readingChallengeBook: ReadingChallengeBookDelegate,
): Promise<void> {
  const accountIdsWithBooks = new Set(challengeBooks.map((book) => book.accountId));
  const seedsToInsert: Array<{
    accountId: string;
    isbn: string;
    title: string;
    thumbnailUrl: string | null;
    infoUrl: string | null;
  }> = [];

  for (const account of accounts) {
    if (accountIdsWithBooks.has(account.id)) {
      continue;
    }

    const seedBooks = READING_CHALLENGE_BOOK_SEEDS_BY_NICKNAME[account.nickname.trim().toLowerCase()];
    if (!seedBooks) {
      continue;
    }

    for (const seedBook of seedBooks) {
      const normalizedIsbn = normalizeIsbn(seedBook.isbn);
      if (!normalizedIsbn) {
        continue;
      }

      seedsToInsert.push({
        accountId: account.id,
        isbn: normalizedIsbn,
        title: seedBook.title,
        thumbnailUrl: toBookCoverUrl(normalizedIsbn),
        infoUrl: toOpenLibraryBookUrl(normalizedIsbn),
      });
    }
  }

  if (seedsToInsert.length > 0) {
    await readingChallengeBook.createMany({
      data: seedsToInsert,
      skipDuplicates: true,
    });
  }
}

/**
 * Existing rows seeded before openBD support stored Open Library cover URLs,
 * which 404 for Japanese manga. Rewrite those to the openBD cover URL once.
 */
export async function backfillStaleCoverUrls(
  challengeBooks: ReadingChallengeBookRecord[],
): Promise<void> {
  const updates: Array<{ id: string; thumbnailUrl: string }> = [];

  for (const book of challengeBooks) {
    const desired = toBookCoverUrl(book.isbn);
    if (desired === book.thumbnailUrl) {
      continue;
    }

    if (!desired.includes("cover.openbd.jp")) {
      continue;
    }

    updates.push({ id: book.id, thumbnailUrl: desired });
  }

  if (updates.length === 0) {
    return;
  }

  await Promise.all(
    updates.map((update) =>
      prisma.readingChallengeBook.update({
        where: { id: update.id },
        data: { thumbnailUrl: update.thumbnailUrl },
      }),
    ),
  );
}
