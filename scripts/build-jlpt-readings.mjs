import fs from "node:fs/promises";
import path from "node:path";

const LEVELS = [1, 2, 3, 4, 5];
const CONCURRENCY = 6;
const RETRIES = 4;
const BASE_DELAY_MS = 200;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}`);
  }
  return await response.json();
}

async function withRetry(task, label) {
  let attempt = 0;
  while (attempt < RETRIES) {
    try {
      return await task();
    } catch (error) {
      attempt += 1;
      if (attempt >= RETRIES) {
        throw new Error(`${label} failed after ${RETRIES} attempts: ${String(error)}`);
      }
      const delay = BASE_DELAY_MS * attempt * attempt;
      await sleep(delay);
    }
  }

  throw new Error(`${label} failed unexpectedly.`);
}

async function fetchJlptLists() {
  const allKanji = [];
  for (const level of LEVELS) {
    const list = await withRetry(
      () => fetchJson(`https://kanjiapi.dev/v1/kanji/jlpt-${level}`),
      `JLPT list N${level}`,
    );

    for (const kanji of list) {
      if (typeof kanji === "string" && kanji.length > 0) {
        allKanji.push({ kanji, nLevel: level });
      }
    }
  }

  return allKanji;
}

function toHiragana(reading) {
  return reading.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

async function fetchKanjiDetail(kanji) {
  const detail = await withRetry(
    () => fetchJson(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(kanji)}`),
    `Kanji detail ${kanji}`,
  );

  const kun = Array.isArray(detail.kun_readings) ? detail.kun_readings : [];
  const on = Array.isArray(detail.on_readings) ? detail.on_readings : [];
  const kunyomi = kun.map((reading) => String(reading).trim()).filter(Boolean);
  const onyomi = on.map((reading) => toHiragana(String(reading).trim())).filter(Boolean);

  const allReadings = Array.from(new Set([...kunyomi, ...onyomi]));
  return allReadings;
}

async function runPool(items, worker, concurrency) {
  const results = new Map();
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      const value = await worker(current);
      results.set(current, value);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()));
  return results;
}

async function main() {
  const jlptEntries = await fetchJlptLists();
  const uniqueKanji = Array.from(new Set(jlptEntries.map((entry) => entry.kanji)));

  console.log(`Fetching readings for ${uniqueKanji.length} JLPT kanji...`);

  const readingMap = await runPool(
    uniqueKanji,
    async (kanji) => await fetchKanjiDetail(kanji),
    CONCURRENCY,
  );

  const output = {};
  for (const entry of jlptEntries) {
    output[entry.kanji] = {
      nLevel: entry.nLevel,
      readings: readingMap.get(entry.kanji) ?? [],
    };
  }

  const outputPath = path.resolve("src/data/jlptReadings.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`Wrote ${Object.keys(output).length} entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
