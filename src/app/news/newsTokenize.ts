// Tokenize Japanese text into clickable lookup runs. A run starts at kanji,
// includes adjacent kanji, then includes trailing kana (okurigana) so forms
// like 高い / 食べたり are clickable as a single unit.

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FFー]/;
const PARTICLE_BOUNDARY_FIRST = new Set(["を", "が", "に", "で", "と", "へ", "は", "も", "や", "の", "か"]);
const PARTICLE_BOUNDARY_LATER = new Set(["を", "が", "に", "で", "と", "へ", "は", "も", "や", "の", "か"]);
const INDEFINITE_PRONOUN_BASE = new Set(["誰", "何"]);
const COUNTER_AFTER_DIGIT = new Set(["歳", "才", "人", "円", "年", "月", "日", "時", "分", "秒", "代", "位", "名"]);
const MAX_PURE_KANJI_CLICKABLE_RUN = 4;
const MAX_KANA_SUFFIX = 3;

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

    let kanjiEnd = index;
    const firstKanji = chars[start] ?? "";
    const prevChar = chars[start - 1] ?? "";

    // Avoid swallowing profile-like noun chains after numeric counters (e.g. 55歳地方公務員...).
    if (/[0-9０-９]/.test(prevChar) && COUNTER_AFTER_DIGIT.has(firstKanji) && kanjiEnd > start + 1) {
      kanjiEnd = start + 1;
    }

    let suffixEnd = kanjiEnd;
    let suffixCount = 0;
    let firstAttachedKana = "";

    while (suffixEnd < chars.length && KANA_REGEX.test(chars[suffixEnd] ?? "")) {
      const nextChar = chars[suffixEnd] ?? "";
      const followingChar = chars[suffixEnd + 1] ?? "";
      // If kana starts with a likely particle, keep it outside the clickable token.
      if (suffixCount === 0 && !shouldAttachFirstKana(chars.slice(start, kanjiEnd).join(""), nextChar)) {
        break;
      }
      if (suffixCount === 0) {
        firstAttachedKana = nextChar;
      }
      // If a particle appears after an inflectional suffix, stop before it.
      if (suffixCount > 0 && PARTICLE_BOUNDARY_LATER.has(nextChar)) {
        break;
      }
      // Avoid swallowing nominalizer boundary in patterns like 応募すること.
      if (suffixCount > 0 && nextChar === "こ" && followingChar === "と") {
        break;
      }
      // For pronoun compounds (誰か, 何か, 誰も, 何も), keep only the one-kana suffix.
      if (
        suffixCount > 0 &&
        (firstAttachedKana === "か" || firstAttachedKana === "も") &&
        INDEFINITE_PRONOUN_BASE.has(chars.slice(start, kanjiEnd).join(""))
      ) {
        break;
      }
      if (suffixCount >= MAX_KANA_SUFFIX) {
        break;
      }
      suffixEnd += 1;
      suffixCount += 1;
    }

    index = suffixEnd;
    if (suffixCount === 0 && kanjiEnd - start > MAX_PURE_KANJI_CLICKABLE_RUN) {
      for (let i = start; i < kanjiEnd; i += MAX_PURE_KANJI_CLICKABLE_RUN) {
        const chunk = chars.slice(i, Math.min(i + MAX_PURE_KANJI_CLICKABLE_RUN, kanjiEnd)).join("");
        if (chunk) {
          segments.push({ kind: "kanji", text: chunk });
        }
      }
      continue;
    }

    const runEnd = suffixCount > 0 ? suffixEnd : kanjiEnd;
    segments.push({ kind: "kanji", text: chars.slice(start, runEnd).join("") });
  }

  return segments;
}

function shouldAttachFirstKana(kanjiRun: string, kana: string): boolean {
  if (!PARTICLE_BOUNDARY_FIRST.has(kana)) {
    return true;
  }

  // Keep interrogative/indefinite pronouns together: 誰か, 何か, 誰も, 何も.
  if ((kana === "か" || kana === "も") && INDEFINITE_PRONOUN_BASE.has(kanjiRun)) {
    return true;
  }

  return false;
}
