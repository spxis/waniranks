import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

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

async function fetchKanjiDetails(kanji) {
  const response = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed fetch for ${kanji}: ${response.status}`);
  }

  const payload = await response.json();

  const meanings = uniqueStrings(Array.isArray(payload?.meanings) ? payload.meanings : []);
  const onReadings = uniqueStrings(Array.isArray(payload?.on_readings) ? payload.on_readings : []);
  const kunReadings = uniqueStrings(Array.isArray(payload?.kun_readings) ? payload.kun_readings : []);
  const nanoriReadings = uniqueStrings(Array.isArray(payload?.name_readings) ? payload.name_readings : []);
  const primaryMeaning = meanings[0] ?? null;
  const strokeCount = Number.isInteger(payload?.stroke_count) ? payload.stroke_count : null;

  return {
    strokeCount,
    primaryMeaning,
    meanings,
    onReadings,
    kunReadings,
    nanoriReadings,
    enrichedAt: new Date(),
  };
}

async function main() {
  const rows = await prisma.jlptKanji.findMany({
    orderBy: [{ nLevel: "asc" }, { kanji: "asc" }],
    select: { kanji: true },
  });

  if (rows.length === 0) {
    console.log("No JLPT kanji rows found. Run db:seed:jlpt first.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const { kanji } = rows[index];

    try {
      const details = await fetchKanjiDetails(kanji);
      await prisma.jlptKanji.update({
        where: { kanji },
        data: details,
      });

      success += 1;
      if ((index + 1) % 100 === 0 || index + 1 === rows.length) {
        console.log(`Enriched ${index + 1}/${rows.length} (ok=${success}, failed=${failed})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to enrich ${kanji}:`, error instanceof Error ? error.message : error);
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  console.log(`Done. success=${success}, failed=${failed}, total=${rows.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
