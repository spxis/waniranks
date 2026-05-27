import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { prisma } from "@/lib/prisma";
import { ensureActiveReadingChallengeId } from "@/lib/readingChallengeStore";

type ReadingBookRow = {
  id: string;
  challengeId?: string | null;
  accountId: string;
  isbn: string;
  title: string;
  thumbnailUrl: string | null;
  infoUrl: string | null;
  updatedAt?: Date;
};

type ReadingChallengeBookDelegate = {
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    select: Record<string, true>;
  }) => Promise<ReadingBookRow[]>;
};

type BookCatalogOption = {
  isbn: string;
  title: string;
};

const querySchema = z.object({
  accountId: z.string().cuid(),
});

function getReadingChallengeBookDelegate(): ReadingChallengeBookDelegate | null {
  const delegate = (prisma as unknown as { readingChallengeBook?: ReadingChallengeBookDelegate }).readingChallengeBook;
  return delegate ?? null;
}

function normalizeCatalogTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function isFallbackCatalogTitle(title: string): boolean {
  return /^isbn[:\s]/i.test(title.trim());
}

function buildCatalogOptions(rows: ReadingBookRow[]): BookCatalogOption[] {
  const uniqueByTitle = new Map<string, BookCatalogOption>();

  for (const row of rows) {
    const isbn = row.isbn.trim();
    const title = row.title.trim();
    if (!isbn || !title) {
      continue;
    }

    const normalizedTitle = normalizeCatalogTitle(title);
    if (!normalizedTitle) {
      continue;
    }

    const existing = uniqueByTitle.get(normalizedTitle);
    if (!existing) {
      uniqueByTitle.set(normalizedTitle, {
        isbn,
        title,
      });
      continue;
    }

    if (isFallbackCatalogTitle(existing.title) && !isFallbackCatalogTitle(title)) {
      uniqueByTitle.set(normalizedTitle, {
        isbn,
        title,
      });
    }
  }

  return [...uniqueByTitle.values()].sort((left, right) => left.title.localeCompare(right.title, "en"));
}

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-books/catalog",
    method: "GET",
    request,
    execute: async () => {
      try {
        const params = Object.fromEntries(new URL(request.url).searchParams.entries());
        const parsed = querySchema.safeParse(params);
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

        const rows = await readingChallengeBook.findMany({
          where: activeChallengeId
            ? {
                OR: [{ challengeId: activeChallengeId }, { challengeId: null }],
              }
            : {},
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            challengeId: true,
            accountId: true,
            isbn: true,
            title: true,
            thumbnailUrl: true,
            infoUrl: true,
            updatedAt: true,
          },
        });

        return NextResponse.json({ books: buildCatalogOptions(rows) }, { status: 200 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not load books yet." }, { status: 500 });
      }
    },
  });
}
