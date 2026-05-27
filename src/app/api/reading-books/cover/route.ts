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

function openLibraryCoverUrlsForSize(isbn: string, size: CoverSize): string[] {
  const large = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  const medium = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  return size === "large" ? [large, medium] : [medium];
}

function googleBooksCoverUrlsForSize(url: string, size: CoverSize): string[] {
  if (size !== "large") {
    return [url];
  }
  // Try a sharper crop first; fall back to the original thumbnail if zoom=3 404s.
  const withoutEdge = url.replace(/&edge=curl/gi, "");
  const sharp = /[?&]zoom=\d+/i.test(withoutEdge)
    ? withoutEdge.replace(/([?&]zoom=)\d+/i, "$13")
    : withoutEdge.includes("?")
      ? `${withoutEdge}&zoom=3`
      : `${withoutEdge}?zoom=3`;
  return sharp === url ? [url] : [sharp, url];
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
    where: { isbn: { in: string[] }; manualCoverUrl?: { not: null } };
    select: { manualCoverUrl?: true; thumbnailUrl?: true };
  }) => Promise<{ manualCoverUrl?: string | null; thumbnailUrl?: string | null } | null>;
};

function readingBookDelegate(): ReadingChallengeBookCoverDelegate | null {
  return (prisma as unknown as { readingChallengeBook?: ReadingChallengeBookCoverDelegate }).readingChallengeBook ?? null;
}

async function fetchManualCoverUrl(lookupIsbns: string[]): Promise<string | null> {
  const delegate = readingBookDelegate();
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

async function fetchStoredThumbnailUrl(lookupIsbns: string[]): Promise<string | null> {
  const delegate = readingBookDelegate();
  if (!delegate) {
    return null;
  }

  try {
    const row = await delegate.findFirst({
      where: { isbn: { in: lookupIsbns } },
      select: { thumbnailUrl: true },
    });
    return row?.thumbnailUrl?.trim() || null;
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

type FetchImageOptions = {
  minBytes?: number;
  // When true, reject PNG responses. Google Books' "image not available"
  // placeholder is a grayscale PNG (~9KB at zoom=3, ~2KB at zoom=1); real
  // Google covers are always JPEG. This lets us reject the placeholder by
  // content-type without false positives on real covers.
  rejectPng?: boolean;
};

async function fetchImageFromUrl(
  url: string,
  options: FetchImageOptions = {},
): Promise<NextResponse | null> {
  const { minBytes = MIN_VALID_COVER_BYTES, rejectPng = false } = options;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return null;
    }
    if (rejectPng && /^image\/png/i.test(contentType)) {
      return null;
    }

    const body = await response.arrayBuffer();
    if (body.byteLength < minBytes) {
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

// NDL (National Diet Library) Japan no longer serves anonymous thumbnail
// requests (the /thumbnail/{isbn} endpoint returns 403 from CloudFront), so
// we rely on Amazon + openBD + Google for Japanese covers instead.

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

        // Source order honours user spec: try the largest known-real cover
        // first, then progressively smaller fallbacks, ending on the stored
        // thumbnailUrl from the DB so we (almost) always have an image.

        const amazonIsbn10 = lookupIsbns.find((value) => value.length === 10);
        const amazonUrls = amazonIsbn10
          ? [
              `https://images-na.ssl-images-amazon.com/images/P/${amazonIsbn10}.09.LZZZZZZZ.jpg`,
              `https://images-fe.ssl-images-amazon.com/images/P/${amazonIsbn10}.09.LZZZZZZZ.jpg`,
              `https://m.media-amazon.com/images/P/${amazonIsbn10}.09.LZZZZZZZ.jpg`,
              `https://images-na.ssl-images-amazon.com/images/P/${amazonIsbn10}.01.LZZZZZZZ.jpg`,
            ]
          : [];

        // At "large" we want the biggest real cover first. Amazon's LZZZZZZZ
        // hosts the publisher-supplied art (typically 500px+ wide JPEG) and is
        // the most reliable source for Japanese-published books.
        if (size === "large") {
          for (const amazonUrl of amazonUrls) {
            const amazonImage = await fetchImageFromUrl(amazonUrl);
            if (amazonImage) {
              return amazonImage;
            }
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
          for (const openLibraryUrl of openLibraryCoverUrlsForSize(candidateIsbn, size)) {
            const openLibraryImage = await fetchImageFromUrl(openLibraryUrl);
            if (openLibraryImage) {
              return openLibraryImage;
            }
          }
        }

        for (const candidateIsbn of lookupIsbns) {
          const googleCoverUrl = await fetchGoogleBooksCoverUrlByIsbn(candidateIsbn);
          if (googleCoverUrl) {
            for (const variant of googleBooksCoverUrlsForSize(googleCoverUrl, size)) {
              // Reject PNG: Google's "image not available" placeholder is a
              // grayscale PNG; real Google Books covers are always JPEG.
              const googleImage = await fetchImageFromUrl(variant, { rejectPng: true });
              if (googleImage) {
                return googleImage;
              }
            }
          }
        }

        // At "small" Amazon is still a valid (if oversized) real cover.
        if (size !== "large") {
          for (const amazonUrl of amazonUrls) {
            const amazonImage = await fetchImageFromUrl(amazonUrl);
            if (amazonImage) {
              return amazonImage;
            }
          }
        }

        // Final fallback: the thumbnail URL persisted at book-add time. This
        // may itself be a Google placeholder for some rows, but per user spec
        // we'd rather render *something* than the local SVG.
        const storedThumbnailUrl = await fetchStoredThumbnailUrl(lookupIsbns);
        if (storedThumbnailUrl) {
          const storedImage = await fetchImageFromUrl(storedThumbnailUrl);
          if (storedImage) {
            return storedImage;
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
