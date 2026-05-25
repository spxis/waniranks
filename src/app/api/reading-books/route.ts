import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { prisma } from "@/lib/prisma";
import {
  normalizeIsbn,
  toOpenLibraryCoverUrl,
  toOpenLibraryBookUrl,
} from "@/lib/readingSignoff";

const postBodySchema = z.object({
  accountId: z.string().cuid(),
  isbn: z.string().min(1).max(32),
});

const deleteBodySchema = z.object({
  accountId: z.string().cuid(),
  bookId: z.string().cuid(),
});

type ReadingChallengeBookDelegate = {
  create: (args: {
    data: {
      accountId: string;
      isbn: string;
      title: string;
      thumbnailUrl: string | null;
      infoUrl: string | null;
    };
  }) => Promise<{ id: string; accountId: string; isbn: string; title: string; thumbnailUrl: string | null; infoUrl: string | null }>;
  findUnique: (args: {
    where: { id: string };
    select: { id: true; accountId: true; title: true };
  }) => Promise<{ id: string; accountId: string; title: string } | null>;
  delete: (args: { where: { id: string } }) => Promise<void>;
};

type ReadingSignoffDelegate = {
  findFirst: (args: {
    where: {
      accountId: string;
      bookTitle: string;
    };
    select: { id: true };
  }) => Promise<{ id: string } | null>;
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

        const metadata = await fetchBookMetadataByIsbn(isbn);
        if (!metadata.title) {
          return NextResponse.json({ error: "Could not find that ISBN. Check the number and try again." }, { status: 404 });
        }

        const created = await readingChallengeBook.create({
          data: {
            accountId: parsed.data.accountId,
            isbn,
            title: metadata.title,
            thumbnailUrl: metadata.thumbnailUrl,
            infoUrl: metadata.infoUrl,
          },
        });

        return NextResponse.json({ book: created }, { status: 201 });
      } catch (error) {
        if (error instanceof Error && error.message.includes("Unique constraint")) {
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
            accountId: true,
            title: true,
          },
        });

        if (!book || book.accountId !== parsed.data.accountId) {
          return NextResponse.json({ error: "Book not found." }, { status: 404 });
        }

        const startedCheck = await readingSignoff.findFirst({
          where: {
            accountId: parsed.data.accountId,
            bookTitle: book.title,
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
