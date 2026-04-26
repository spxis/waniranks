import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { extractArticle, type NewsExtractError } from "@/lib/news/newsExtract";

const requestSchema = z.object({
  url: z.string().trim().min(8).max(2048),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const result = await extractArticle(parsed.data.url);
    if (!result.ok) {
      const { status, message } = mapErrorToResponse(result.error);
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ article: result.article }, { status: 200 });
  } catch (error) {
    console.error("[news/extract] failed", error);
    return NextResponse.json({ error: "Couldn't read that article." }, { status: 500 });
  }
}

function mapErrorToResponse(error: NewsExtractError): { status: number; message: string } {
  switch (error.kind) {
    case "invalid_url":
      return { status: 400, message: "That doesn't look like a valid URL." };
    case "blocked_host":
      return { status: 400, message: "That host isn't allowed." };
    case "fetch_failed":
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
