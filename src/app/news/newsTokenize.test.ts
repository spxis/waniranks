import { describe, expect, it } from "vitest";

import { tokenizeJapanese } from "./newsTokenize";

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
});
