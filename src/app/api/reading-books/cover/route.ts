import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { prisma } from "@/lib/prisma";
import { normalizeIsbn } from "@/lib/readingSignoff";

const querySchema = z.object({
  isbn: z.string().min(1).max(32),
  size: z.enum(["small", "large"]).optional(),
});

type CoverSize = "small" | "large";

function toOpenLibraryCoverUrlSized(isbn: string, size: CoverSize): string {
  const suffix = size === "large" ? "L" : "M";
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${suffix}.jpg?default=false`;
}

function upgradeGoogleBooksUrlForSize(url: string, size: CoverSize): string {
  if (size !== "large") {
    return url;
  }
  // Drop edge=curl artifact and bump zoom for a sharper crop.
  const withoutEdge = url.replace(/&edge=curl/gi, "");
  if (/[?&]zoom=\d+/i.test(withoutEdge)) {
    return withoutEdge.replace(/([?&]zoom=)\d+/i, "$13");
  }
  return withoutEdge.includes("?") ? `${withoutEdge}&zoom=3` : `${withoutEdge}?zoom=3`;
}

function toIsbn13FromIsbn10(isbn10: string): string | null {
  if (!/^\d{9}[\dX]$/.test(isbn10)) {
    return null;
  }

  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return `${body}${checkDigit}`;
}

function toIsbn10FromIsbn13(isbn13: string): string | null {
  if (!/^978\d{10}$/.test(isbn13)) {
    return null;
  }

  const body = isbn13.slice(3, 12);
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    sum += Number(body[index]) * (10 - index);
  }

  const remainder = (11 - (sum % 11)) % 11;
  const checkChar = remainder === 10 ? "X" : String(remainder);
  return `${body}${checkChar}`;
}

function expandLookupIsbns(isbn: string): string[] {
  if (isbn.length === 10) {
    const isbn13 = toIsbn13FromIsbn10(isbn);
    return isbn13 ? [isbn13, isbn] : [isbn];
  }

  if (isbn.length === 13) {
    const isbn10 = toIsbn10FromIsbn13(isbn);
    return isbn10 ? [isbn, isbn10] : [isbn];
  }

  return [isbn];
}

type ReadingChallengeBookCoverDelegate = {
  findFirst: (args: {
    where: { isbn: { in: string[] }; manualCoverUrl: { not: null } };
    select: { manualCoverUrl: true };
  }) => Promise<{ manualCoverUrl: string | null } | null>;
};

async function fetchManualCoverUrl(lookupIsbns: string[]): Promise<string | null> {
  const delegate = (prisma as unknown as { readingChallengeBook?: ReadingChallengeBookCoverDelegate }).readingChallengeBook;
  if (!delegate) {
    return null;
  }

  try {
    const row = await delegate.findFirst({
      where: { isbn: { in: lookupIsbns }, manualCoverUrl: { not: null } },
      select: { manualCoverUrl: true },
    });
    return row?.manualCoverUrl?.trim() || null;
  } catch {
    return null;
  }
}

function noCoverResponse(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

const MIN_VALID_COVER_BYTES = 1024;

async function fetchImageFromUrl(url: string): Promise<NextResponse | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const body = await response.arrayBuffer();
    if (body.byteLength < MIN_VALID_COVER_BYTES) {
      return null;
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return null;
  }
}

async function fetchOpenBdCoverUrlByIsbn(isbn: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Array<{
      summary?: {
        cover?: string;
      };
    } | null>;

    const cover = payload[0]?.summary?.cover?.trim();
    if (!cover) {
      return null;
    }

    return cover.replace(/^http:\/\//, "https://");
  } catch {
    return null;
  }
}

async function fetchGoogleBooksCoverUrlByIsbn(isbn: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : "";
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${keyParam}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      items?: Array<{
        volumeInfo?: {
          imageLinks?: {
            thumbnail?: string;
            smallThumbnail?: string;
          };
        };
      }>;
    };

    const url = payload.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
      ?? payload.items?.[0]?.volumeInfo?.imageLinks?.smallThumbnail
      ?? null;

    return url?.replace(/^http:\/\//, "https://") ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/reading-books/cover",
    method: "GET",
    request,
    execute: async () => {
      try {
        const params = Object.fromEntries(new URL(request.url).searchParams.entries());
        const parsed = querySchema.safeParse(params);
        if (!parsed.success) {
          return noCoverResponse();
        }

        const isbn = normalizeIsbn(parsed.data.isbn);
        if (!isbn) {
          return noCoverResponse();
        }

        const size: CoverSize = parsed.data.size ?? "small";
        const lookupIsbns = expandLookupIsbns(isbn);

        const manualOverrideUrl = await fetchManualCoverUrl(lookupIsbns);
        if (manualOverrideUrl) {
          const manualImage = await fetchImageFromUrl(manualOverrideUrl);
          if (manualImage) {
            return manualImage;
          }
        }

        for (const candidateIsbn of lookupIsbns) {
          const openBdUrl = await fetchOpenBdCoverUrlByIsbn(candidateIsbn);
          if (openBdUrl) {
            const openBdImage = await fetchImageFromUrl(openBdUrl);
            if (openBdImage) {
              return openBdImage;
            }
          }
        }

        for (const candidateIsbn of lookupIsbns) {
          const googleCoverUrl = await fetchGoogleBooksCoverUrlByIsbn(candidateIsbn);
          if (googleCoverUrl) {
            const googleImage = await fetchImageFromUrl(upgradeGoogleBooksUrlForSize(googleCoverUrl, size));
            if (googleImage) {
              return googleImage;
            }
          }
        }

        for (const candidateIsbn of lookupIsbns) {
          const openLibraryImage = await fetchImageFromUrl(toOpenLibraryCoverUrlSized(candidateIsbn, size));
          if (openLibraryImage) {
            return openLibraryImage;
          }
        }

        const amazonIsbn10 = lookupIsbns.find((value) => value.length === 10);
        if (amazonIsbn10) {
          const amazonUrls = [
            `https://images-na.ssl-images-amazon.com/images/P/${amazonIsbn10}.09.LZZZZZZZ.jpg`,
            `https://images-fe.ssl-images-amazon.com/images/P/${amazonIsbn10}.09.LZZZZZZZ.jpg`,
            `https://images-na.ssl-images-amazon.com/images/P/${amazonIsbn10}.01.LZZZZZZZ.jpg`,
            `https://m.media-amazon.com/images/P/${amazonIsbn10}.01._SCLZZZZZZZ_.jpg`,
          ];
          for (const amazonUrl of amazonUrls) {
            const amazonImage = await fetchImageFromUrl(amazonUrl);
            if (amazonImage) {
              return amazonImage;
            }
          }
        }

        return noCoverResponse();
      } catch (error) {
        console.error(error);
        return noCoverResponse();
      }
    },
  });
}
