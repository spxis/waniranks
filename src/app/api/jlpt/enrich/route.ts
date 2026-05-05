import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { isAuthorizedAdmin } from "@/lib/admin";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { prisma } from "@/lib/prisma";

type KanjiApiPayload = {
  freq_mainichi_shinbun?: unknown;
  grade?: unknown;
  heisig_en?: unknown;
  jlpt?: unknown;
  unicode?: unknown;
  meanings?: unknown;
  on_readings?: unknown;
  kun_readings?: unknown;
  name_readings?: unknown;
  notes?: unknown;
  stroke_count?: unknown;
};

type WordsApiVariant = {
  written?: unknown;
  pronounced?: unknown;
};

type WordsApiMeaning = {
  glosses?: unknown;
};

type WordsApiEntry = {
  variants?: unknown;
  meanings?: unknown;
};

type JlptWordExample = {
  written: string;
  pronounced: string;
  gloss: string;
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

  const wordsResponse = await fetch(`https://kanjiapi.dev/v1/words/${encodeURIComponent(kanji)}`, {
    cache: "no-store",
  });
  const wordsPayload = wordsResponse.ok ? ((await wordsResponse.json()) as unknown) : [];

  const meanings = uniqueStrings(payload.meanings);
  const onReadings = uniqueStrings(payload.on_readings);
  const kunReadings = uniqueStrings(payload.kun_readings);
  const nanoriReadings = uniqueStrings(payload.name_readings);
  const notes = uniqueStrings(payload.notes);

  const wordExamples: JlptWordExample[] = Array.isArray(wordsPayload)
    ? (wordsPayload as WordsApiEntry[])
        .map((entry) => {
          const variants = Array.isArray(entry.variants) ? (entry.variants as WordsApiVariant[]) : [];
          const firstVariant = variants[0];

          const meaningsList = Array.isArray(entry.meanings) ? (entry.meanings as WordsApiMeaning[]) : [];
          const firstMeaning = meaningsList[0];
          const glosses = Array.isArray(firstMeaning?.glosses) ? firstMeaning.glosses : [];

          const written = typeof firstVariant?.written === "string" ? firstVariant.written.trim() : "";
          const pronounced =
            typeof firstVariant?.pronounced === "string" ? firstVariant.pronounced.trim() : "";
          const gloss = typeof glosses[0] === "string" ? glosses[0].trim() : "";

          if (!written && !pronounced) {
            return null;
          }

          return {
            written,
            pronounced,
            gloss,
          };
        })
        .filter((entry): entry is JlptWordExample => entry !== null)
        .slice(0, 12)
    : [];

  return {
    strokeCount: typeof payload.stroke_count === "number" ? payload.stroke_count : null,
    frequencyRank: typeof payload.freq_mainichi_shinbun === "number" ? payload.freq_mainichi_shinbun : null,
    schoolGrade: typeof payload.grade === "number" ? payload.grade : null,
    heisigKeyword: typeof payload.heisig_en === "string" ? payload.heisig_en.trim() || null : null,
    unicodeHex: typeof payload.unicode === "string" ? payload.unicode.trim() || null : null,
    sourceJlpt: typeof payload.jlpt === "number" ? payload.jlpt : null,
    primaryMeaning: meanings[0] ?? null,
    meanings,
    onReadings,
    kunReadings,
    nanoriReadings,
    notes,
    wordExamples,
    enrichedAt: new Date(),
  };
}

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/jlpt/enrich",
    method: "POST",
    request,
    execute: async () => {
      try {
        if (!(await isAuthorizedAdmin(request))) {
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
        heisigKeyword?: { equals: null };
        wordExamples?: { equals: Prisma.NullTypes.DbNull | Prisma.NullTypes.JsonNull };
      }>;
    } | undefined = onlyMissing
      ? {
          OR: [
            { enrichedAt: { equals: null } },
            { meanings: { isEmpty: true } },
            { strokeCount: { equals: null } },
            { heisigKeyword: { equals: null } },
            { wordExamples: { equals: Prisma.DbNull } },
            { wordExamples: { equals: Prisma.JsonNull } },
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
    },
  });
}
