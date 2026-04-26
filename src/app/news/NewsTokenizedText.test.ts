import { describe, expect, it } from "vitest";

import {
  buildCandidatesFromSelectedText,
  buildLookupCandidates,
} from "./newsLookupCandidates";

describe("news lookup candidate priority", () => {
  it("keeps clicked run first for mixed kana context", () => {
    const segments = [
      { kind: "other" as const, text: "ハウス" },
      { kind: "kanji" as const, text: "記者会" },
      { kind: "other" as const, text: "のイベ" },
    ];

    const candidates = buildLookupCandidates(segments, 1);

    expect(candidates[0]).toBe("記者会");
    expect(candidates).toContain("ウス記者会のイベ");
  });

  it("starts selected-text candidates with exact selection", () => {
    const candidates = buildCandidatesFromSelectedText(" 記者会 ");
    expect(candidates[0]).toBe("記者会");
  });

  it("adds pure-kanji subruns for long compounds", () => {
    const segments = [{ kind: "kanji" as const, text: "日本時間" }];
    const candidates = buildLookupCandidates(segments, 0);

    expect(candidates[0]).toBe("日本時間");
    expect(candidates).toContain("日本");
    expect(candidates).toContain("時間");
  });

  it("includes kanji core candidate for inflected mixed runs", () => {
    const segments = [{ kind: "kanji" as const, text: "締結されて" }];
    const candidates = buildLookupCandidates(segments, 0);

    expect(candidates[0]).toBe("締結されて");
    expect(candidates).toContain("締結");
    expect(candidates).toContain("締結される");
  });

  it("strips punctuation from selected-text lookup", () => {
    const candidates = buildCandidatesFromSelectedText("配信・");
    expect(candidates[0]).toBe("配信");
    expect(candidates).not.toContain("配信・");
  });
});
