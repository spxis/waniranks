import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { normalizeIsbn, toOpenLibraryCoverUrl } from "@/lib/readingSignoff";

const querySchema = z.object({
  isbn: z.string().min(1).max(32),
});

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520" role="img" aria-label="Book cover placeholder"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dbeafe"/><stop offset="55%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#c7d2fe"/></linearGradient></defs><rect width="360" height="520" fill="url(#bg)"/><rect x="28" y="28" width="304" height="464" rx="18" fill="#ffffff" opacity="0.75"/><rect x="56" y="86" width="248" height="18" rx="9" fill="#1e3a8a" opacity="0.72"/><rect x="56" y="122" width="212" height="12" rx="6" fill="#1d4ed8" opacity="0.5"/><rect x="56" y="332" width="248" height="12" rx="6" fill="#1d4ed8" opacity="0.25"/><rect x="56" y="356" width="190" height="12" rx="6" fill="#1d4ed8" opacity="0.22"/><g transform="translate(84 162)"><rect x="0" y="0" width="192" height="144" rx="16" fill="#e2e8f0"/><rect x="34" y="28" width="124" height="18" rx="9" fill="#475569" opacity="0.4"/><rect x="34" y="58" width="92" height="12" rx="6" fill="#475569" opacity="0.3"/><path d="M26 114c18-26 34-39 50-39 15 0 25 8 40 23l6 6c11 11 19 16 30 16 10 0 20-4 32-15v21H26z" fill="#64748b" opacity="0.3"/></g></svg>`;

function placeholderImageResponse(): NextResponse {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=86400",
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
          return placeholderImageResponse();
        }

        const isbn = normalizeIsbn(parsed.data.isbn);
        if (!isbn) {
          return placeholderImageResponse();
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

        return placeholderImageResponse();
      } catch (error) {
        console.error(error);
        return placeholderImageResponse();
      }
    },
  });
}
