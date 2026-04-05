import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fetchJlptList(nLevel) {
  const response = await fetch(`https://kanjiapi.dev/v1/kanji/jlpt-${nLevel}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch JLPT N${nLevel} list: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`Invalid JLPT N${nLevel} response shape.`);
  }

  return data.filter((item) => typeof item === "string" && item.length > 0);
}

async function main() {
  const levels = [1, 2, 3, 4, 5];
  const records = [];

  for (const nLevel of levels) {
    const kanjiList = await fetchJlptList(nLevel);
    for (const kanji of kanjiList) {
      records.push({ kanji, nLevel });
    }
  }

  const nextKanjiSet = new Set(records.map((record) => record.kanji));

  await prisma.jlptKanji.createMany({
    data: records,
    skipDuplicates: true,
  });

  for (const record of records) {
    await prisma.jlptKanji.update({
      where: { kanji: record.kanji },
      data: { nLevel: record.nLevel },
    });
  }

  await prisma.jlptKanji.deleteMany({
    where: {
      kanji: {
        notIn: Array.from(nextKanjiSet),
      },
    },
  });

  console.log(`Seeded ${records.length} JLPT kanji entries.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
