import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { lookupKanjiLevelsByChars } from "@/lib/news/newsKanjiLookup";
import { prisma } from "@/lib/prisma";

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

const requestSchema = z.object({
  chars: z.array(z.string().trim().min(1).max(1)).min(1).max(300),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase() ?? null;
    if (!email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const chars = Array.from(new Set(parsed.data.chars.map((char) => char.trim()))).filter((char) =>
      KANJI_REGEX.test(char),
    );

    if (chars.length === 0) {
      return NextResponse.json({ error: "No kanji to look up." }, { status: 400 });
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
      return NextResponse.json({ error: "No linked WaniKani account." }, { status: 404 });
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

    return NextResponse.json({ levels, grades }, { status: 200 });
  } catch (error) {
    console.error("[news/kanji-levels] failed", error);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
