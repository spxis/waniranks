import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { normalizeIsbn, toOpenLibraryCoverUrl } from "@/lib/readingSignoff";

const querySchema = z.object({
  isbn: z.string().min(1).max(32),
});

function noCoverResponse(): NextResponse {
  return new NextResponse(null, {
    status: 404,
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

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
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
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

        const openBdUrl = await fetchOpenBdCoverUrlByIsbn(isbn);
        if (openBdUrl) {
          const openBdImage = await fetchImageFromUrl(openBdUrl);
          if (openBdImage) {
            return openBdImage;
          }
        }

        const googleCoverUrl = await fetchGoogleBooksCoverUrlByIsbn(isbn);
        if (googleCoverUrl) {
          const googleImage = await fetchImageFromUrl(googleCoverUrl);
          if (googleImage) {
            return googleImage;
          }
        }

        const openLibraryImage = await fetchImageFromUrl(toOpenLibraryCoverUrl(isbn));
        if (openLibraryImage) {
          return openLibraryImage;
        }

        return noCoverResponse();
      } catch (error) {
        console.error(error);
        return noCoverResponse();
      }
    },
  });
}
