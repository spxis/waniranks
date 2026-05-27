import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { prisma } from "@/lib/prisma";
import { ensureActiveReadingChallengeId } from "@/lib/readingChallengeStore";
import { normalizeIsbn, toOpenLibraryCoverUrl, toOpenLibraryBookUrl } from "@/lib/readingSignoff";

const postBodySchema = z.object({
  accountId: z.string().cuid(),
  isbn: z.string().min(1).max(32),
});

const deleteBodySchema = z.object({
  accountId: z.string().cuid(),
  bookId: z.string().cuid(),
});

type ReadingBookRow = {
  id: string;
  challengeId?: string | null;
  accountId: string;
  isbn: string;
  title: string;
  thumbnailUrl: string | null;
  infoUrl: string | null;
};

type ReadingChallengeBookDelegate = {
  create: (args: { data: { challengeId?: string | null; accountId: string; isbn: string; title: string; thumbnailUrl: string | null; infoUrl: string | null } }) => Promise<ReadingBookRow>;
  findFirst: (args: { where: Record<string, unknown>; select: Record<string, true> }) => Promise<ReadingBookRow | null>;
  findMany: (args: { where: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">; select: Record<string, true> }) => Promise<Array<ReadingBookRow & { updatedAt?: Date }>>;
  findUnique: (args: {
    where: { id: string };
    select: { id: true; challengeId?: true; accountId: true; title: true };
  }) => Promise<{ id: string; challengeId?: string | null; accountId: string; title: string } | null>;
  update: (args: { where: { id: string }; data: { title?: string; thumbnailUrl?: string | null; infoUrl?: string | null } }) => Promise<ReadingBookRow>;
  updateMany: (args: { where: Record<string, unknown>; data: { title?: string; thumbnailUrl?: string; infoUrl?: string } }) => Promise<{ count: number }>;
  delete: (args: { where: { id: string } }) => Promise<void>;
};

type ReadingSignoffDelegate = {
  findFirst: (args: { where: Record<string, unknown>; select: { id: true } }) => Promise<{ id: string } | null>;
};

function getReadingChallengeBookDelegate(): ReadingChallengeBookDelegate | null {
  const delegate = (prisma as unknown as { readingChallengeBook?: ReadingChallengeBookDelegate }).readingChallengeBook;
  return delegate ?? null;
}

function getReadingSignoffDelegate(): ReadingSignoffDelegate | null {
  const delegate = (prisma as unknown as { readingSignoff?: ReadingSignoffDelegate }).readingSignoff;
  return delegate ?? null;
}

function toHttpsUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^http:\/\//, "https://");
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "P2002" || error.message.includes("Unique constraint");
}

function isFallbackIsbnTitle(title: string, isbn: string): boolean {
  const normalized = title.trim().toLowerCase();
  const normalizedIsbn = isbn.trim().toLowerCase();
  return normalized === `isbn ${normalizedIsbn}` || normalized === `isbn:${normalizedIsbn}`;
}

type SharedBookMetadata = {
  title: string | null;
  thumbnailUrl: string | null;
  infoUrl: string | null;
};

async function getSharedBookMetadataByIsbn(
  readingChallengeBook: ReadingChallengeBookDelegate,
  isbn: string,
): Promise<SharedBookMetadata> {
  const rows = await readingChallengeBook.findMany({
    where: { isbn },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      accountId: true,
      isbn: true,
      title: true,
      thumbnailUrl: true,
      infoUrl: true,
      updatedAt: true,
    },
  });

  const rowWithRealTitle = rows.find((row) => !isFallbackIsbnTitle(row.title, isbn));
  const rowWithThumbnail = rows.find((row) => Boolean(row.thumbnailUrl));
  const rowWithInfo = rows.find((row) => Boolean(row.infoUrl));

  return {
    title: rowWithRealTitle?.title ?? null,
    thumbnailUrl: rowWithThumbnail?.thumbnailUrl ?? null,
    infoUrl: rowWithInfo?.infoUrl ?? null,
  };
}

function buildMetadataUpdateData(input: {
  currentTitle: string;
  isbn: string;
  nextTitle: string | null;
  currentThumbnailUrl: string | null;
  nextThumbnailUrl: string | null;
  currentInfoUrl: string | null;
  nextInfoUrl: string | null;
}): {
  title?: string;
  thumbnailUrl?: string;
  infoUrl?: string;
} {
  const data: {
    title?: string;
    thumbnailUrl?: string;
    infoUrl?: string;
  } = {};

  if (input.nextTitle && (isFallbackIsbnTitle(input.currentTitle, input.isbn) || input.currentTitle.trim().length === 0)) {
    data.title = input.nextTitle;
  }

  if (!input.currentThumbnailUrl && input.nextThumbnailUrl) {
    data.thumbnailUrl = input.nextThumbnailUrl;
  }

  if (!input.currentInfoUrl && input.nextInfoUrl) {
    data.infoUrl = input.nextInfoUrl;
  }

  return data;
}

async function propagateSharedMetadata(
  readingChallengeBook: ReadingChallengeBookDelegate,
  isbn: string,
  metadata: SharedBookMetadata,
): Promise<void> {
  const updateData: {
    title?: string;
    thumbnailUrl?: string;
    infoUrl?: string;
  } = {};

  if (metadata.title) {
    updateData.title = metadata.title;
  }

  if (metadata.thumbnailUrl) {
    updateData.thumbnailUrl = metadata.thumbnailUrl;
  }

  if (metadata.infoUrl) {
    updateData.infoUrl = metadata.infoUrl;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await readingChallengeBook.updateMany({
    where: {
      isbn,
      OR: [
        { title: { startsWith: "ISBN " } },
        { title: { startsWith: "isbn " } },
        { thumbnailUrl: null },
        { infoUrl: null },
      ],
    },
    data: updateData,
  });
}

async function fetchOpenBdMetadataByIsbn(isbn: string): Promise<{
  title: string | null;
  thumbnailUrl: string | null;
}> {
  try {
    const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, { cache: "no-store" });
    if (!response.ok) {
      return { title: null, thumbnailUrl: null };
    }

    const payload = (await response.json()) as Array<{
      summary?: {
        title?: string;
        cover?: string;
      };
    } | null>;

    const summary = payload[0]?.summary;
    const title = summary?.title?.trim() ?? null;
    const thumbnailUrl = toHttpsUrl(summary?.cover);
    return {
      title: title && title.length > 0 ? title : null,
      thumbnailUrl,
    };
  } catch {
    return { title: null, thumbnailUrl: null };
  }
}

async function fetchOpenLibraryTitleByIsbn(isbn: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, { title?: string } | undefined>;
    const title = payload[`ISBN:${isbn}`]?.title?.trim() ?? null;
    return title && title.length > 0 ? title : null;
  } catch {
    return null;
  }
}

async function fetchGoogleBooksMetadataByIsbn(isbn: string): Promise<{
  title: string | null;
  thumbnailUrl: string | null;
  infoUrl: string | null;
}> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return { title: null, thumbnailUrl: null, infoUrl: null };
    }

    const payload = (await response.json()) as {
      items?: Array<{
        volumeInfo?: {
          title?: string;
          infoLink?: string;
          imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
          };
        };
      }>;
    };

    const volumeInfo = payload.items?.[0]?.volumeInfo;
    const title = volumeInfo?.title?.trim() ?? null;
    const thumbnailUrl = toHttpsUrl(volumeInfo?.imageLinks?.thumbnail ?? volumeInfo?.imageLinks?.smallThumbnail);
    const infoUrl = toHttpsUrl(volumeInfo?.infoLink);

    return {
      title: title && title.length > 0 ? title : null,
      thumbnailUrl,
      infoUrl,
    };
  } catch {
    return { title: null, thumbnailUrl: null, infoUrl: null };
  }
}

async function fetchBookMetadataByIsbn(isbn: string): Promise<{
  title: string | null;
  thumbnailUrl: string;
  infoUrl: string;
}> {
  const openBd = await fetchOpenBdMetadataByIsbn(isbn);
  const openLibraryTitle = await fetchOpenLibraryTitleByIsbn(isbn);
  const google = await fetchGoogleBooksMetadataByIsbn(isbn);

  const title = openBd.title ?? openLibraryTitle ?? google.title;
  return {
    title,
    thumbnailUrl: openBd.thumbnailUrl ?? google.thumbnailUrl ?? toOpenLibraryCoverUrl(isbn),
    infoUrl: google.infoUrl ?? toOpenLibraryBookUrl(isbn),
  };
}

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-books",
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

        const activeChallengeId = await ensureActiveReadingChallengeId();

        const readingChallengeBook = getReadingChallengeBookDelegate();
        if (!readingChallengeBook) {
          return NextResponse.json(
            { error: "Reading books are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const isbn = normalizeIsbn(parsed.data.isbn);
        if (!isbn) {
          return NextResponse.json({ error: "Enter a valid ISBN-10 or ISBN-13." }, { status: 400 });
        }

        const existing = await readingChallengeBook.findFirst({
          where: {
            accountId: parsed.data.accountId,
            isbn,
            ...(activeChallengeId ? { challengeId: activeChallengeId } : {}),
          },
          select: {
            id: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
          },
        });

        const sharedMetadata = await getSharedBookMetadataByIsbn(readingChallengeBook, isbn);

        let externalMetadata:
          | {
              title: string | null;
              thumbnailUrl: string;
              infoUrl: string;
            }
          | null = null;

        if (!sharedMetadata.title || !sharedMetadata.thumbnailUrl || !sharedMetadata.infoUrl) {
          externalMetadata = await fetchBookMetadataByIsbn(isbn);
        }

        const resolvedMetadata: SharedBookMetadata = {
          title: sharedMetadata.title ?? externalMetadata?.title ?? null,
          thumbnailUrl: sharedMetadata.thumbnailUrl ?? externalMetadata?.thumbnailUrl ?? toOpenLibraryCoverUrl(isbn),
          infoUrl: sharedMetadata.infoUrl ?? externalMetadata?.infoUrl ?? toOpenLibraryBookUrl(isbn),
        };

        if (existing) {
          const updateData = buildMetadataUpdateData({
            currentTitle: existing.title,
            isbn,
            nextTitle: resolvedMetadata.title,
            currentThumbnailUrl: existing.thumbnailUrl,
            nextThumbnailUrl: resolvedMetadata.thumbnailUrl,
            currentInfoUrl: existing.infoUrl,
            nextInfoUrl: resolvedMetadata.infoUrl,
          });

          if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ book: existing, existed: true, refreshed: false }, { status: 200 });
          }

          const updated = await readingChallengeBook.update({
            where: { id: existing.id },
            data: updateData,
          });

          await propagateSharedMetadata(readingChallengeBook, isbn, resolvedMetadata);
          return NextResponse.json({ book: updated, existed: true, refreshed: true }, { status: 200 });
        }

        const resolvedTitle = resolvedMetadata.title ?? `ISBN ${isbn}`;

        const created = await readingChallengeBook.create({
          data: {
            ...(activeChallengeId ? { challengeId: activeChallengeId } : {}),
            accountId: parsed.data.accountId,
            isbn,
            title: resolvedTitle,
            thumbnailUrl: resolvedMetadata.thumbnailUrl,
            infoUrl: resolvedMetadata.infoUrl,
          },
        });

        await propagateSharedMetadata(readingChallengeBook, isbn, {
          title: isFallbackIsbnTitle(created.title, isbn) ? null : created.title,
          thumbnailUrl: created.thumbnailUrl,
          infoUrl: created.infoUrl,
        });

        return NextResponse.json({ book: created }, { status: 201 });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ error: "That ISBN is already in this collection." }, { status: 409 });
        }

        console.error(error);
        return NextResponse.json({ error: "Could not add that book yet." }, { status: 500 });
      }
    },
  });
}

export async function DELETE(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-books",
    method: "DELETE",
    request,
    execute: async () => {
      try {
        const parsed = deleteBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await canAccessAccount(request, parsed.data.accountId))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const activeChallengeId = await ensureActiveReadingChallengeId();

        const readingChallengeBook = getReadingChallengeBookDelegate();
        const readingSignoff = getReadingSignoffDelegate();
        if (!readingChallengeBook || !readingSignoff) {
          return NextResponse.json(
            { error: "Reading books are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const book = await readingChallengeBook.findUnique({
          where: { id: parsed.data.bookId },
          select: {
            id: true,
            challengeId: true,
            accountId: true,
            title: true,
          },
        });

        if (!book || book.accountId !== parsed.data.accountId) {
          return NextResponse.json({ error: "Book not found." }, { status: 404 });
        }

        if (activeChallengeId && book.challengeId && book.challengeId !== activeChallengeId) {
          return NextResponse.json({ error: "Book belongs to a different challenge." }, { status: 409 });
        }

        const startedCheck = await readingSignoff.findFirst({
          where: {
            accountId: parsed.data.accountId,
            bookTitle: book.title,
            ...(activeChallengeId ? { OR: [{ challengeId: activeChallengeId }, { challengeId: null }] } : {}),
          },
          select: { id: true },
        });

        if (startedCheck) {
          return NextResponse.json({ error: "You can only delete books that were not started yet." }, { status: 409 });
        }

        await readingChallengeBook.delete({ where: { id: book.id } });
        return NextResponse.json({ ok: true }, { status: 200 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not delete that book." }, { status: 500 });
      }
    },
  });
}
