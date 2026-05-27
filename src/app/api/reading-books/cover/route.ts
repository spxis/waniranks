import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { normalizeIsbn, toOpenLibraryCoverUrl } from "@/lib/readingSignoff";

const querySchema = z.object({
  isbn: z.string().min(1).max(32),
});

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

function expandLookupIsbns(isbn: string): string[] {
  if (isbn.length !== 10) {
    return [isbn];
  }

  const isbn13 = toIsbn13FromIsbn10(isbn);
  return isbn13 ? [isbn13, isbn] : [isbn];
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

        const lookupIsbns = expandLookupIsbns(isbn);

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
            const googleImage = await fetchImageFromUrl(googleCoverUrl);
            if (googleImage) {
              return googleImage;
            }
          }
        }

        for (const candidateIsbn of lookupIsbns) {
          const openLibraryImage = await fetchImageFromUrl(toOpenLibraryCoverUrl(candidateIsbn));
          if (openLibraryImage) {
            return openLibraryImage;
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
