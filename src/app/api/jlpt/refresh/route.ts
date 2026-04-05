import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function fetchJlptList(nLevel: number): Promise<string[]> {
  const response = await fetch(`https://kanjiapi.dev/v1/kanji/jlpt-${nLevel}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed JLPT N${nLevel} fetch: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Invalid JLPT N${nLevel} payload.`);
  }

  return data.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedCron(request) && !isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const levels = [1, 2, 3, 4, 5] as const;
    const records: Array<{ kanji: string; nLevel: number }> = [];

    for (const nLevel of levels) {
      const list = await fetchJlptList(nLevel);
      for (const kanji of list) {
        records.push({ kanji, nLevel });
      }
    }

    await prisma.$transaction([
      prisma.jlptKanji.deleteMany({}),
      prisma.jlptKanji.createMany({ data: records, skipDuplicates: true }),
    ]);

    return NextResponse.json({ ok: true, count: records.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "JLPT refresh failed." }, { status: 500 });
  }
}
