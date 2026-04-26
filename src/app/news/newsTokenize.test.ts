import { describe, expect, it } from "vitest";

import { tokenizeJapanese } from "./newsTokenize";

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const MAX_PURE_KANJI_CLICKABLE_RUN = 4;

describe("tokenizeJapanese", () => {
  it("keeps okurigana with kanji for inflectional forms", () => {
    const segments = tokenizeJapanese("高い山 食べたり飲んだり");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("高い");
    expect(kanjiRuns).toContain("食べたり");
    expect(kanjiRuns).toContain("飲んだり");
  });

  it("does not swallow particles after a kanji word", () => {
    const segments = tokenizeJapanese("物語を元にした");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("物語");
    expect(kanjiRuns).not.toContain("物語を");
    expect(kanjiRuns).toContain("元");
  });

  it("does not attach particle-led kana to the preceding kanji run", () => {
    const segments = tokenizeJapanese("基調にした");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toEqual(["基調"]);
    expect(segments.some((segment) => segment.kind === "other" && segment.text.includes("にした"))).toBe(true);
  });

  it("keeps indefinite pronoun suffix before following particle", () => {
    const segments = tokenizeJapanese("誰かの声");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("誰か");
    expect(kanjiRuns).not.toContain("誰");
    expect(segments.some((segment) => segment.kind === "other" && segment.text.includes("の"))).toBe(true);
  });

  it("keeps 誰も and 何も as one lexical unit", () => {
    const segments = tokenizeJapanese("誰も知らない。何もない。");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("誰も");
    expect(kanjiRuns).toContain("何も");
    expect(kanjiRuns).not.toContain("何もない");
    expect(kanjiRuns).not.toContain("誰");
    expect(kanjiRuns).not.toContain("何");
  });

  it("does not merge generic particle か after normal nouns", () => {
    const segments = tokenizeJapanese("花か草か");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toEqual(["花", "草"]);
  });

  it("keeps verb intent forms without swallowing following object marker", () => {
    const segments = tokenizeJapanese("花を贈りたい人");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toEqual(["花", "贈りたい", "人"]);
    expect(kanjiRuns).not.toContain("花を");
  });

  it("keeps adjective and ichidan style okurigana runs", () => {
    const segments = tokenizeJapanese("高い音を届けたい");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("高い");
    expect(kanjiRuns).toContain("届けたい");
    expect(kanjiRuns).not.toContain("音を");
  });

  it("keeps katakana tails after okurigana for mixed compounds", () => {
    const segments = tokenizeJapanese("深掘りコンテンツを読む");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("深掘りコンテンツ");
    expect(kanjiRuns).not.toContain("深掘りコン");
  });

  it("splits 4-kanji pure compounds into smaller runs", () => {
    const segments = tokenizeJapanese("日本時間の26日夜");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("日本");
    expect(kanjiRuns).toContain("時間");
    expect(kanjiRuns).not.toContain("日本時間");
  });

  it("does not keep long kanji chains merged when okurigana follows", () => {
    const segments = tokenizeJapanese("情勢悪化後初めて確認した");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).not.toContain("情勢悪化後初めて");
    expect(kanjiRuns).toContain("情勢");
    expect(kanjiRuns).toContain("悪化");
  });

  it("splits honorific 氏 from following compound", () => {
    const segments = tokenizeJapanese("トランプ氏出席の会合");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("氏");
    expect(kanjiRuns).toContain("出席");
    expect(kanjiRuns).not.toContain("氏出席");
  });

  it("keeps suffix with post-氏 compound while splitting 氏", () => {
    const segments = tokenizeJapanese("トランプ氏出席した会合");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("氏");
    expect(kanjiRuns).toContain("出席した");
    expect(kanjiRuns).not.toContain("氏出席した");
  });

  it("does not create giant merged clickable runs after numeric counters", () => {
    const segments = tokenizeJapanese("さん55歳地方公務員愛知県在住");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).not.toContain("歳地方公務員愛知県在住");
    expect(kanjiRuns).toContain("歳");
  });

  it("does not swallow nominalizer in 〜すること pattern", () => {
    const segments = tokenizeJapanese("応募すること");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns).toContain("応募する");
    expect(kanjiRuns).not.toContain("応募するこ");
  });

  it("caps overlong polite suffix attachment", () => {
    const segments = tokenizeJapanese("紹介させていただきます");
    const kanjiRuns = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);

    expect(kanjiRuns[0]?.startsWith("紹介")).toBe(true);
    expect(kanjiRuns).not.toContain("紹介させていただきます");
  });

  it("maintains core segmentation invariants across mixed corpus", () => {
    const corpus = [
      "高い山に登った。",
      "花を贈りたい人へ。",
      "誰かの物語を読んだ。",
      "何もない夜でも、星は見える。",
      "基調にした配色。",
      "さん55歳地方公務員愛知県在住",
      "SNSで共有された。",
      "今日、東京で雨が降る。",
      "食べたり飲んだりして過ごす。",
      "A/Bテストを回した。",
    ];

    for (const text of corpus) {
      const segments = tokenizeJapanese(text);
      assertTokenizerInvariants(text, segments);
    }
  });

  it("handles generated particle boundaries for many nouns", () => {
    const nouns = ["物語", "計画", "現場", "資料", "社会", "政策", "市場", "話題"];
    const particles = ["を", "に", "が", "で", "と", "へ", "は", "も", "や", "の", "か"];

    for (const noun of nouns) {
      for (const particle of particles) {
        const text = `${noun}${particle}進める`;
        const runs = kanjiRuns(text);
        if (particle === "か") {
          // Generic nouns should not absorb interrogative particle.
          expect(runs).toContain(noun);
          expect(runs).not.toContain(`${noun}${particle}`);
        } else {
          expect(runs).toContain(noun);
          expect(runs).not.toContain(`${noun}${particle}`);
        }
      }
    }
  });

  it("keeps common inflection suffixes attached for verb/adjective stems", () => {
    const stems = ["食べ", "届け", "見", "書き", "高", "強"];
    const suffixes = ["たい", "た", "たり", "ない", "ます"];

    for (const stem of stems) {
      for (const suffix of suffixes) {
        const token = `${stem}${suffix}`;
        const text = `${token}。`;
        const runs = kanjiRuns(text);
        expect(runs).toContain(token);
      }
    }
  });

  it("passes deterministic fuzz-style invariant checks", () => {
    const seedText = ["山", "川", "花", "語", "高", "食", "べ", "た", "り", "を", "に", "の", "A", " ", "。", "、"];
    for (let i = 0; i < 30; i += 1) {
      const text = generateDeterministicString(seedText, i + 17, 22);
      const segments = tokenizeJapanese(text);
      assertTokenizerInvariants(text, segments);
    }
  });

  it("article-derived matrix: keeps boundaries conservative across 15 snippets", () => {
    const articleSnippets = [
      "就労継続支援A型事業所",
      "福祉関連会社",
      "再度挑戦できる",
      "地方公務員愛知県在住",
      "応募すること",
      "紹介させていただきます",
      "支援会社で働く",
      "福祉サービス事業所",
      "職場環境の改善",
      "就労支援の現場",
      "利用者家族の声",
      "支援制度を活用",
      "地域社会との連携",
      "雇用機会の確保",
      "再挑戦への希望",
    ];

    for (const text of articleSnippets) {
      const segments = tokenizeJapanese(text);
      assertTokenizerInvariants(text, segments);

      const runs = segments.filter((segment) => segment.kind === "kanji").map((segment) => segment.text);
      for (const run of runs) {
        expect(/[A-Za-z0-9０-９]/.test(run)).toBe(false);
        if (isPureKanji(run)) {
          expect(Array.from(run).length).toBeLessThanOrEqual(MAX_PURE_KANJI_CLICKABLE_RUN);
        }
      }
    }
  });
});

function kanjiRuns(text: string): string[] {
  return tokenizeJapanese(text)
    .filter((segment) => segment.kind === "kanji")
    .map((segment) => segment.text);
}

function assertTokenizerInvariants(
  original: string,
  segments: Array<{ kind: "kanji" | "other"; text: string }>,
): void {
  expect(segments.map((segment) => segment.text).join("")).toBe(original);
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    expect(segment.text.length).toBeGreaterThan(0);

    if (segment.kind === "kanji") {
      expect(KANJI_REGEX.test(segment.text)).toBe(true);
    } else {
      expect(KANJI_REGEX.test(segment.text)).toBe(false);
    }

    if (i > 0) {
      const prev = segments[i - 1];
      if (prev?.kind === segment.kind) {
        // Adjacent kanji segments can happen by design after anti-overmerge splits.
        // Adjacent "other" segments indicate an actual segmentation bug.
        expect(segment.kind).toBe("kanji");
      }
    }
  }
}

function isPureKanji(value: string): boolean {
  if (!value) {
    return false;
  }
  return Array.from(value).every((char) => KANJI_REGEX.test(char));
}

function generateDeterministicString(pool: string[], seed: number, length: number): string {
  let state = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < length; i += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    out.push(pool[state % pool.length] ?? "");
  }
  return out.join("");
}
