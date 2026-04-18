import { toRomaji } from "wanakana";

export function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

export function normalizeSearch(input: string): string {
  return input.trim().toLowerCase();
}

export function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function stripReadingSeparators(input: string): string {
  return input.replace(/[.・]/g, "").trim();
}

export function normalizeReadingForSearch(reading: string): string {
  return normalizeSearch(stripReadingSeparators(reading));
}

export function readingLabel(reading: string | null, showEnglish: boolean): string {
  if (!reading) {
    return "-";
  }

  const normalizedReading = stripReadingSeparators(reading);

  if (!showEnglish) {
    return normalizedReading;
  }

  const romaji = toRomaji(normalizedReading, { upcaseKatakana: false }).trim();
  return romaji && romaji !== normalizedReading ? `${normalizedReading} / ${romaji}` : normalizedReading;
}

export function readingLabelFromList(readings: string[], showEnglish: boolean): string {
  if (readings.length === 0) {
    return "-";
  }

  const primary = readings[0] ?? null;
  return readingLabel(primary, showEnglish);
}

export function jlptHeading(
  mainMeaning: string | null | undefined,
  userMeanings: string[] | undefined,
  fallbackMeanings: string[] | undefined,
  fallbackKanji: string,
): string {
  const fromMain = mainMeaning?.trim();
  if (fromMain) {
    return fromMain;
  }

  const fromUser = userMeanings?.[0]?.trim();
  if (fromUser) {
    return fromUser;
  }

  const fromFallback = fallbackMeanings?.[0]?.trim();
  if (fromFallback) {
    return fromFallback;
  }

  return fallbackKanji;
}

type JlptSearchItem = {
  kanji: string;
  kunReadings: string[];
  onReadings: string[];
  nanoriReadings: string[];
  primaryMeaning?: string | null;
  meanings: string[];
};

type JlptReadingsEntry = { readings?: string[]; meanings?: string[] };

export function matchesJlptSearch(
  item: JlptSearchItem,
  rawQuery: string,
  normalizedQuery: string,
  preload: JlptReadingsEntry | undefined,
): boolean {
  if (!normalizedQuery) return true;

  const readings = [...item.kunReadings, ...item.onReadings, ...item.nanoriReadings, ...(preload?.readings ?? [])];
  const meanings = [...(item.primaryMeaning ? [item.primaryMeaning] : []), ...item.meanings, ...(preload?.meanings ?? [])];
  const romaji = normalizeSearch(toRomaji(item.kanji, { upcaseKatakana: false }));

  return (
    item.kanji.includes(rawQuery.trim()) ||
    normalizeSearch(item.kanji).includes(normalizedQuery) ||
    romaji.includes(normalizedQuery) ||
    readings.some((r) => normalizeSearch(r).includes(normalizedQuery) || normalizeReadingForSearch(r).includes(normalizedQuery)) ||
    readings.some((r) => normalizeSearch(toRomaji(stripReadingSeparators(r), { upcaseKatakana: false })).includes(normalizedQuery)) ||
    meanings.some((m) => normalizeSearch(m).includes(normalizedQuery))
  );
}
