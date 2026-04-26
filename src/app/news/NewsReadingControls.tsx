"use client";

import {
  articleFontLabel,
  bumpTextSize,
  kanjiCapBasisLabel,
  kanjiCapLabel,
  NEWS_KANJI_CAP_BASIS_OPTIONS,
  NEWS_KANJI_CAP_GRADE_OPTIONS,
  NEWS_KANJI_CAP_JLPT_OPTIONS,
  NEWS_KANJI_CAP_WK_OPTIONS,
  textSizeLabel,
  type NewsArticleFont,
  type NewsKanjiCapBasis,
  type NewsKanjiCapGrade,
  type NewsKanjiCapJlpt,
  type NewsKanjiCapWk,
  type NewsReadingPrefs,
  type NewsTextSize,
} from "./newsReadingPrefs";

type Props = {
  prefs: NewsReadingPrefs;
  onChange: (next: NewsReadingPrefs) => void;
};

export default function NewsReadingControls({ prefs, onChange }: Props) {
  function setSize(size: NewsTextSize) {
    onChange({ ...prefs, textSize: size });
  }

  function toggleKanji() {
    onChange({ ...prefs, emphasizeKanji: !prefs.emphasizeKanji });
  }

  function setFont(font: NewsArticleFont) {
    onChange({ ...prefs, articleFont: font });
  }

  function setKanjiCapBasis(value: NewsKanjiCapBasis) {
    onChange({ ...prefs, kanjiCapBasis: value });
  }

  function setKanjiCapJlpt(value: NewsKanjiCapJlpt) {
    onChange({ ...prefs, kanjiCapJlpt: value });
  }

  function setKanjiCapWk(value: NewsKanjiCapWk) {
    onChange({ ...prefs, kanjiCapWk: value });
  }

  function setKanjiCapGrade(value: NewsKanjiCapGrade) {
    onChange({ ...prefs, kanjiCapGrade: value });
  }

  const capOptions =
    prefs.kanjiCapBasis === "jlpt"
      ? NEWS_KANJI_CAP_JLPT_OPTIONS
      : prefs.kanjiCapBasis === "wk"
        ? NEWS_KANJI_CAP_WK_OPTIONS
        : NEWS_KANJI_CAP_GRADE_OPTIONS;

  const activeCapValue =
    prefs.kanjiCapBasis === "jlpt"
      ? prefs.kanjiCapJlpt
      : prefs.kanjiCapBasis === "wk"
        ? prefs.kanjiCapWk
        : prefs.kanjiCapGrade;

  const setCapValue = (value: string) => {
    if (prefs.kanjiCapBasis === "jlpt") {
      setKanjiCapJlpt(value as NewsKanjiCapJlpt);
      return;
    }
    if (prefs.kanjiCapBasis === "wk") {
      setKanjiCapWk(value as NewsKanjiCapWk);
      return;
    }
    setKanjiCapGrade(value as NewsKanjiCapGrade);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/80 bg-surface-muted px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">
            Text size
          </span>
          <div className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface">
            <button
              type="button"
              onClick={() => setSize(bumpTextSize(prefs.textSize, -1))}
              className="px-3 py-1 text-sm font-bold text-foreground/80 hover:bg-surface-muted"
              aria-label="Decrease text size"
            >
              A−
            </button>
            <span className="border-x border-line px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/70">
              {textSizeLabel(prefs.textSize)}
            </span>
            <button
              type="button"
              onClick={() => setSize(bumpTextSize(prefs.textSize, 1))}
              className="px-3 py-1 text-sm font-bold text-foreground/80 hover:bg-surface-muted"
              aria-label="Increase text size"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">
            Font
          </span>
          <div className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface">
            {(["body", "jp-sans", "jp-serif"] as const).map((font) => (
              <button
                key={font}
                type="button"
                onClick={() => setFont(font)}
                className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${prefs.articleFont === font ? "bg-accent text-surface" : "text-foreground/75 hover:bg-surface-muted"}`}
                aria-label={`Use ${articleFontLabel(font)} font`}
              >
                {articleFontLabel(font)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">
            Kanji cap
          </span>
          <div className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface">
            {NEWS_KANJI_CAP_BASIS_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKanjiCapBasis(value)}
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${prefs.kanjiCapBasis === value ? "bg-accent text-surface" : "text-foreground/75 hover:bg-surface-muted"}`}
                aria-label={`Use ${kanjiCapBasisLabel(value)} cap basis`}
              >
                {kanjiCapBasisLabel(value)}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface">
            {capOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCapValue(value)}
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${activeCapValue === value ? "bg-accent text-surface" : "text-foreground/75 hover:bg-surface-muted"}`}
                aria-label={`Use ${kanjiCapLabel(prefs.kanjiCapBasis, value)} kanji cap`}
              >
                {kanjiCapLabel(prefs.kanjiCapBasis, value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/75">
        <input
          type="checkbox"
          checked={prefs.emphasizeKanji}
          onChange={toggleKanji}
          className="h-4 w-4 accent-accent"
        />
        Enlarge kanji
      </label>
    </div>
  );
}
