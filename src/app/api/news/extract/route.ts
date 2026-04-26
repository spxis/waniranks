import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { logNewsApiPerf } from "@/lib/news/newsApiPerf";
import { extractArticle, type NewsExtractError } from "@/lib/news/newsExtract";

const requestSchema = z.object({
  url: z.string().trim().min(8).max(2048),
});

export async function POST(request: Request) {
  const startedAtMs = Date.now();
  const respond = (body: unknown, status: number, meta?: Record<string, number | string | boolean | null>) => {
    logNewsApiPerf("/api/news/extract", startedAtMs, status, meta);
    return NextResponse.json(body, { status });
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return respond({ error: "Unauthorized." }, 401);
    }

    const json = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return respond({ error: "Invalid request payload." }, 400);
    }

    const result = await extractArticle(parsed.data.url);
    if (!result.ok) {
      const { status, message } = mapErrorToResponse(result.error);
      return respond({ error: message }, status, {
        errorKind: result.error.kind,
      });
    }

    return respond(
      { article: result.article },
      200,
      {
        blocks: result.article.blocks.length,
        textLength: result.article.textLength,
      },
    );
  } catch (error) {
    console.error("[news/extract] failed", error);
    return respond(
      {
        error:
          "Server could not parse that page. Try the clean article URL (without tracking params) or use site mode first.",
      },
      500,
    );
  }
}

function mapErrorToResponse(error: NewsExtractError): { status: number; message: string } {
  switch (error.kind) {
    case "invalid_url":
      return { status: 400, message: "That doesn't look like a valid URL." };
    case "blocked_host":
      return { status: 400, message: "That host isn't allowed." };
    case "fetch_failed":
      if (error.status === 403) {
        return { status: 403, message: "That site blocked server access (403)." };
      }
      if (error.status === 429) {
        return { status: 429, message: "That site is rate limiting requests right now." };
      }
      return {
        status: 502,
        message: error.status === 408 ? "The site took too long to respond." : "Couldn't reach that page.",
      };
    case "too_large":
      return { status: 413, message: "That page is too large to read." };
    case "not_html":
      return { status: 415, message: "That URL isn't an HTML page." };
    case "not_article":
      return { status: 422, message: "Couldn't find an article on that page." };
  }
}
