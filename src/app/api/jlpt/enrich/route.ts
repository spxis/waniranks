import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type KanjiApiPayload = {
  meanings?: unknown;
  on_readings?: unknown;
  kun_readings?: unknown;
  name_readings?: unknown;
  stroke_count?: unknown;
};

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

async function fetchKanjiDetails(kanji: string) {
  const response = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed fetch for ${kanji}: ${response.status}`);
  }

  const payload = (await response.json()) as KanjiApiPayload;

  const meanings = uniqueStrings(payload.meanings);
  const onReadings = uniqueStrings(payload.on_readings);
  const kunReadings = uniqueStrings(payload.kun_readings);
  const nanoriReadings = uniqueStrings(payload.name_readings);

  return {
    strokeCount: typeof payload.stroke_count === "number" ? payload.stroke_count : null,
    primaryMeaning: meanings[0] ?? null,
    meanings,
    onReadings,
    kunReadings,
    nanoriReadings,
    enrichedAt: new Date(),
  };
}

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: { limit?: number; onlyMissing?: boolean } = {};
    try {
      body = (await request.json()) as { limit?: number; onlyMissing?: boolean };
    } catch {
      body = {};
    }

    const limit = Math.max(1, Math.min(500, Number(body.limit) || 250));
    const onlyMissing = body.onlyMissing ?? true;

    const where: {
      OR: Array<{
        enrichedAt?: { equals: null };
        meanings?: { isEmpty: true };
        strokeCount?: { equals: null };
      }>;
    } | undefined = onlyMissing
      ? {
          OR: [
            { enrichedAt: { equals: null } },
            { meanings: { isEmpty: true } },
            { strokeCount: { equals: null } },
          ],
        }
      : undefined;

    const candidates = await prisma.jlptKanji.findMany({
      where,
      select: { kanji: true },
      orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
      take: limit,
    });

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, updated: 0, failed: 0, remaining: 0 });
    }

    let updated = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const details = await fetchKanjiDetails(candidate.kanji);
        await prisma.jlptKanji.update({
          where: { kanji: candidate.kanji },
          data: details,
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`JLPT enrich failed for ${candidate.kanji}:`, error);
      }
    }

    const remaining = await prisma.jlptKanji.count({ where });

    return NextResponse.json({
      ok: true,
      processed: candidates.length,
      updated,
      failed,
      remaining,
      hint: remaining > 0 ? "Run this endpoint again to continue enriching." : "Enrichment complete.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "JLPT enrichment failed." }, { status: 500 });
  }
}
