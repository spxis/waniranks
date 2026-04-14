import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getUserKanjiIndex } from "@/lib/wanikani";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const requestUrl = new URL(_.url);
    const includeItems = requestUrl.searchParams.get("includeItems") !== "0";
    const includeUserIndex = requestUrl.searchParams.get("includeUserIndex") !== "0";
    const limitParam = Number(requestUrl.searchParams.get("limit") ?? "");
    const offsetParam = Number(requestUrl.searchParams.get("offset") ?? "");
    const limit = Number.isInteger(limitParam) && limitParam >= 0 ? Math.min(limitParam, 500) : null;
    const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

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

    const [userKanjiItems, jlptItems, jlptTotal] = await Promise.all([
      includeUserIndex ? getUserKanjiIndex(token) : Promise.resolve([]),
      includeItems
        ? prisma.jlptKanji.findMany({
            orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
            ...(limit === null ? {} : { skip: offset, take: limit }),
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
          })
        : Promise.resolve([]),
      includeItems ? prisma.jlptKanji.count() : Promise.resolve(0),
    ]);

    return NextResponse.json({
      jlptItems,
      userKanjiItems,
      pagination: {
        offset,
        limit: limit ?? jlptItems.length,
        total: jlptTotal,
        hasMore: includeItems && limit !== null ? offset + limit < jlptTotal : false,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load JLPT explorer data." }, { status: 500 });
  }
}
