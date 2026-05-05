import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { logNewsApiPerf } from "@/lib/news/newsApiPerf";
import { lookupKanjiLevelsByChars } from "@/lib/news/newsKanjiLookup";
import { prisma } from "@/lib/prisma";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export const runtime = "nodejs";

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

const requestSchema = z.object({
  chars: z.array(z.string().trim().min(1).max(1)).min(1).max(300),
});

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/news/kanji-levels",
    method: "POST",
    request: request,
    execute: async () => {

const startedAtMs = Date.now();
              const respond = (body: unknown, status: number, meta?: Record<string, number | string | boolean | null>) => {
                logNewsApiPerf("/api/news/kanji-levels", startedAtMs, status, meta);
                return NextResponse.json(body, { status });
              };

              try {
                const session = await getServerSession(authOptions);
                const email = session?.user?.email?.trim().toLowerCase() ?? null;
                if (!email) {
                  return respond({ error: "Unauthorized." }, 401);
                }

                const json = await request.json().catch(() => null);
                const parsed = requestSchema.safeParse(json);
                if (!parsed.success) {
                  return respond({ error: "Invalid request payload." }, 400);
                }

                const chars = Array.from(new Set(parsed.data.chars.map((char) => char.trim()))).filter((char) =>
                  KANJI_REGEX.test(char),
                );

                if (chars.length === 0) {
                  return respond({ error: "No kanji to look up." }, 400);
                }

                const account = await prisma.account.findFirst({
                  where: { joinedByEmail: email },
                  select: {
                    id: true,
                    tokenEncrypted: true,
                    tokenIv: true,
                    tokenTag: true,
                  },
                });

                if (!account) {
                  return respond({ error: "No linked WaniKani account." }, 404);
                }

                const token = decryptToken({
                  encrypted: account.tokenEncrypted,
                  iv: account.tokenIv,
                  tag: account.tokenTag,
                });

                const levels = await lookupKanjiLevelsByChars(chars, token);

                const jlptRows = await prisma.jlptKanji.findMany({
                  where: { kanji: { in: chars } },
                  select: { kanji: true, schoolGrade: true },
                });

                const grades: Record<string, number | null> = {};
                for (const char of chars) {
                  grades[char] = null;
                }
                for (const row of jlptRows) {
                  grades[row.kanji] = typeof row.schoolGrade === "number" ? row.schoolGrade : null;
                }

                return respond({ levels, grades }, 200, { chars: chars.length });
              } catch (error) {
                console.error("[news/kanji-levels] failed", error);
                return respond({ error: "Lookup failed." }, 500);
              }
    },
  });
}
