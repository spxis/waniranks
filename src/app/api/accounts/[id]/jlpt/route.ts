import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getUserKanjiIndex } from "@/lib/wanikani";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const account = await prisma.account.findUnique({
      where: { id },
      select: {
        tokenEncrypted: true,
        tokenIv: true,
        tokenTag: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const token = decryptToken({
      encrypted: account.tokenEncrypted,
      iv: account.tokenIv,
      tag: account.tokenTag,
    });

    const [userKanjiItems, jlptItems] = await Promise.all([
      getUserKanjiIndex(token),
      prisma.jlptKanji.findMany({
        orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
        select: {
          kanji: true,
          nLevel: true,
          strokeCount: true,
          frequencyRank: true,
          schoolGrade: true,
          heisigKeyword: true,
          unicodeHex: true,
          sourceJlpt: true,
          primaryMeaning: true,
          meanings: true,
          onReadings: true,
          kunReadings: true,
          nanoriReadings: true,
          notes: true,
          wordExamples: true,
        },
      }),
    ]);

    return NextResponse.json({
      jlptItems,
      userKanjiItems,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load JLPT explorer data." }, { status: 500 });
  }
}
