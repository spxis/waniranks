"use client";

import {
  articleFontLabel,
  bumpTextSize,
  kanjiDowngradeLabel,
  textSizeLabel,
  type NewsArticleFont,
  type NewsKanjiDowngrade,
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

  function setKanjiDowngrade(value: NewsKanjiDowngrade) {
    onChange({ ...prefs, kanjiDowngrade: value });
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
            {(["off", "n5", "n4", "n3", "n2", "n1"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKanjiDowngrade(value)}
                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${prefs.kanjiDowngrade === value ? "bg-accent text-surface" : "text-foreground/75 hover:bg-surface-muted"}`}
                aria-label={`Use ${kanjiDowngradeLabel(value)} kanji cap`}
              >
                {kanjiDowngradeLabel(value)}
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
