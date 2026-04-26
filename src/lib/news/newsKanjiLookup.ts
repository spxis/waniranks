import { fetchAllCollectionPages } from "@/lib/wanikani/http";

export type LookupGlyphItem = {
  text: string;
  subjectType: "kanji" | "vocabulary";
  subjectId: number | null;
  meanings: string[];
  readings: string[];
  primaryReadings: string[];
  meaningExplanation: string;
  readingExplanation: string;
  wkLevel: number | null;
};

export type LookupRunResult = {
  vocabulary: LookupGlyphItem | null;
  kanjiItems: LookupGlyphItem[];
  missingChars: string[];
};

const CHUNK_SIZE = 60;

export async function lookupRunInWaniKani(run: string, token: string): Promise<LookupRunResult> {
  const vocabulary = await lookupVocabulary(run, token);
  const chars = Array.from(run).filter((char) => char.trim().length > 0);
  const kanjiItems = await lookupKanjiByChars(chars, token);
  const missingChars = kanjiItems.filter((item) => item.subjectId === null).map((item) => item.text);

  return {
    vocabulary,
    kanjiItems,
    missingChars,
  };
}

async function lookupVocabulary(run: string, token: string): Promise<LookupGlyphItem | null> {
  const value = run.trim();
  if (!value) {
    return null;
  }

  const collection = await fetchAllCollectionPages(
    `/subjects?types=vocabulary&slugs=${encodeURIComponent(value)}`,
    token,
  );

  for (const row of collection.data) {
    if ((row.object ?? "") !== "vocabulary") {
      continue;
    }
    const data = row.data as {
      characters?: string | null;
      level?: number | null;
      meanings?: Array<{ meaning?: string; primary?: boolean }>;
      readings?: Array<{ reading?: string; primary?: boolean; accepted_answer?: boolean }>;
      meaning_mnemonic?: string;
      reading_mnemonic?: string;
    };

    const text = data.characters ?? "";
    if (!text || text !== value) {
      continue;
    }

    const readings = (data.readings ?? [])
      .map((reading) => reading.reading)
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

    const primaryReadings = (data.readings ?? [])
      .filter((reading) => reading.primary)
      .map((reading) => reading.reading)
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);

    const meanings = (data.meanings ?? [])
      .map((entry) => entry.meaning)
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .slice(0, 3);

    return {
      text,
      subjectType: "vocabulary",
      subjectId: row.id,
      meanings,
      readings,
      primaryReadings,
      meaningExplanation: data.meaning_mnemonic ?? "",
      readingExplanation: data.reading_mnemonic ?? "",
      wkLevel: typeof data.level === "number" ? data.level : null,
    };
  }

  return null;
}

async function lookupKanjiByChars(
  chars: string[],
  token: string,
): Promise<LookupGlyphItem[]> {
  const unique = Array.from(new Set(chars.filter((char) => char && char.length === 1)));
  if (unique.length === 0) {
    return [];
  }

  const subjects = new Map<string, LookupGlyphItem>();

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const slugs = chunk.map((char) => encodeURIComponent(char)).join(",");
    const collection = await fetchAllCollectionPages(
      `/subjects?types=kanji&slugs=${slugs}`,
      token,
    );

    for (const row of collection.data) {
      if ((row.object ?? "") !== "kanji") {
        continue;
      }

      const data = row.data as {
        characters?: string | null;
        level?: number | null;
        meanings?: Array<{ meaning?: string; primary?: boolean }>;
        readings?: Array<{ reading?: string; primary?: boolean; accepted_answer?: boolean }>;
        meaning_mnemonic?: string;
        reading_mnemonic?: string;
      };

      const characters = data.characters ?? "";
      if (!characters) {
        continue;
      }

      const readings = (data.readings ?? [])
        .map((reading) => reading.reading)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const primaryReadings = (data.readings ?? [])
        .filter((reading) => reading.primary)
        .map((reading) => reading.reading)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const meanings = (data.meanings ?? [])
        .map((entry) => entry.meaning)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .slice(0, 3);

      subjects.set(characters, {
        text: characters,
        subjectType: "kanji",
        subjectId: row.id,
        meanings,
        readings,
        primaryReadings,
        meaningExplanation: data.meaning_mnemonic ?? "",
        readingExplanation: data.reading_mnemonic ?? "",
        wkLevel: typeof data.level === "number" ? data.level : null,
      });
    }
  }

  return unique.map(
    (char) =>
      subjects.get(char) ?? {
        text: char,
        subjectType: "kanji",
        subjectId: null,
        meanings: [],
        readings: [],
        primaryReadings: [],
        meaningExplanation: "",
        readingExplanation: "",
        wkLevel: null,
      },
  );
}
