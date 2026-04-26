import { getStoredJson, setStoredJson } from "@/lib/clientStorage";

export const NEWS_READING_PREFS_KEY = "uk:news-reading-prefs";

export type NewsTextSize = "sm" | "md" | "lg" | "xl" | "2xl";
export type NewsArticleFont = "body" | "jp-sans" | "jp-serif";
export type NewsKanjiDowngrade = "off" | "n5" | "n4" | "n3" | "n2" | "n1";

export type NewsReadingPrefs = {
  textSize: NewsTextSize;
  emphasizeKanji: boolean;
  articleFont: NewsArticleFont;
  kanjiDowngrade: NewsKanjiDowngrade;
};

export const DEFAULT_NEWS_READING_PREFS: NewsReadingPrefs = {
  textSize: "lg",
  emphasizeKanji: false,
  articleFont: "body",
  kanjiDowngrade: "off",
};

const TEXT_SIZE_ORDER: NewsTextSize[] = ["sm", "md", "lg", "xl", "2xl"];
const ARTICLE_FONTS: NewsArticleFont[] = ["body", "jp-sans", "jp-serif"];
const KANJI_DOWNGRADE_OPTIONS: NewsKanjiDowngrade[] = ["off", "n5", "n4", "n3", "n2", "n1"];

export function readReadingPrefs(): NewsReadingPrefs {
  const stored = getStoredJson<Partial<NewsReadingPrefs> | null>(
    NEWS_READING_PREFS_KEY,
    null,
  );
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_NEWS_READING_PREFS };
  }
  const textSize = TEXT_SIZE_ORDER.includes(stored.textSize as NewsTextSize)
    ? (stored.textSize as NewsTextSize)
    : DEFAULT_NEWS_READING_PREFS.textSize;
  const emphasizeKanji =
    typeof stored.emphasizeKanji === "boolean"
      ? stored.emphasizeKanji
      : DEFAULT_NEWS_READING_PREFS.emphasizeKanji;
  const articleFont = ARTICLE_FONTS.includes(stored.articleFont as NewsArticleFont)
    ? (stored.articleFont as NewsArticleFont)
    : DEFAULT_NEWS_READING_PREFS.articleFont;
  const kanjiDowngrade = KANJI_DOWNGRADE_OPTIONS.includes(
    stored.kanjiDowngrade as NewsKanjiDowngrade,
  )
    ? (stored.kanjiDowngrade as NewsKanjiDowngrade)
    : DEFAULT_NEWS_READING_PREFS.kanjiDowngrade;
  return { textSize, emphasizeKanji, articleFont, kanjiDowngrade };
}

export function writeReadingPrefs(prefs: NewsReadingPrefs): void {
  setStoredJson(NEWS_READING_PREFS_KEY, prefs);
}

export function bumpTextSize(current: NewsTextSize, delta: 1 | -1): NewsTextSize {
  const index = TEXT_SIZE_ORDER.indexOf(current);
  const safe = index < 0 ? TEXT_SIZE_ORDER.indexOf(DEFAULT_NEWS_READING_PREFS.textSize) : index;
  const next = Math.max(0, Math.min(TEXT_SIZE_ORDER.length - 1, safe + delta));
  return TEXT_SIZE_ORDER[next] ?? DEFAULT_NEWS_READING_PREFS.textSize;
}

export function textSizeClass(size: NewsTextSize): string {
  switch (size) {
    case "sm":
      return "text-base leading-[1.9]";
    case "lg":
      return "text-xl leading-[2.05]";
    case "xl":
      return "text-2xl leading-[2.1]";
    case "2xl":
      return "text-3xl leading-[2.15]";
    case "md":
    default:
      return "text-lg leading-[2]";
  }
}

export function textSizeLabel(size: NewsTextSize): string {
  switch (size) {
    case "sm":
      return "Small";
    case "lg":
      return "Large";
    case "xl":
      return "X-Large";
    case "2xl":
      return "XX-Large";
    case "md":
    default:
      return "Medium";
  }
}

export function articleFontLabel(font: NewsArticleFont): string {
  switch (font) {
    case "jp-sans":
      return "JP Sans";
    case "jp-serif":
      return "JP Serif";
    case "body":
    default:
      return "Body";
  }
}

export function kanjiDowngradeLabel(value: NewsKanjiDowngrade): string {
  switch (value) {
    case "n5":
      return "N5+";
    case "n4":
      return "N4+";
    case "n3":
      return "N3+";
    case "n2":
      return "N2+";
    case "n1":
      return "N1+";
    case "off":
    default:
      return "Off";
  }
}
