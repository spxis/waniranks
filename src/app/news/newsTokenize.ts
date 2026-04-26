// Tokenize Japanese text into clickable lookup runs. A run starts at kanji,
// includes adjacent kanji, then includes trailing kana (okurigana) so forms
// like 高い / 食べたり are clickable as a single unit.

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FFー]/;
const PARTICLE_BOUNDARY = new Set(["を", "が", "に", "で", "と", "へ", "は", "も", "や", "の", "か"]);

export type NewsTextSegment = {
  kind: "kanji" | "other";
  text: string;
};

export function tokenizeJapanese(text: string): NewsTextSegment[] {
  if (!text) {
    return [];
  }

  const segments: NewsTextSegment[] = [];
  const chars = Array.from(text);
  let index = 0;

  while (index < chars.length) {
    const char = chars[index] ?? "";
    if (!KANJI_REGEX.test(char)) {
      let start = index;
      index += 1;
      while (index < chars.length && !KANJI_REGEX.test(chars[index] ?? "")) {
        index += 1;
      }
      segments.push({ kind: "other", text: chars.slice(start, index).join("") });
      continue;
    }

    const start = index;
    index += 1;
    while (index < chars.length && KANJI_REGEX.test(chars[index] ?? "")) {
      index += 1;
    }

    const kanjiEnd = index;
    let suffixEnd = index;
    let suffixCount = 0;

    while (suffixEnd < chars.length && KANA_REGEX.test(chars[suffixEnd] ?? "")) {
      const nextChar = chars[suffixEnd] ?? "";
      // If kana starts with a likely particle, keep it outside the clickable token.
      if (suffixCount === 0 && PARTICLE_BOUNDARY.has(nextChar)) {
        break;
      }
      // If a particle appears after an inflectional suffix, stop before it.
      if (suffixCount > 0 && PARTICLE_BOUNDARY.has(nextChar)) {
        break;
      }
      suffixEnd += 1;
      suffixCount += 1;
    }

    index = suffixEnd;
    const runEnd = suffixCount > 0 ? suffixEnd : kanjiEnd;
    segments.push({ kind: "kanji", text: chars.slice(start, runEnd).join("") });
  }

  return segments;
}
