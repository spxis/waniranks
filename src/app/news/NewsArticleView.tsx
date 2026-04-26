"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { NewsArticle, NewsArticleBlock } from "@/lib/news/newsTypes";

import NewsCacheBadge from "./NewsCacheBadge";
import NewsReadingControls from "./NewsReadingControls";
import NewsTokenizedText from "./NewsTokenizedText";
import {
  readReadingPrefs,
  textSizeClass,
  writeReadingPrefs,
  type NewsReadingPrefs,
} from "./newsReadingPrefs";

const AD_INTERVAL = 4;

export type ArticlePanelTab = "article" | "history" | "stats";

type Props = {
  article: NewsArticle;
  activeTab: ArticlePanelTab;
  onTabChangeAction: (next: ArticlePanelTab) => void;
  historyCount: number;
  statsCount: number;
  historyPanel: ReactNode;
  statsPanel: ReactNode;
};

export default function NewsArticleView({
  article,
  activeTab,
  onTabChangeAction,
  historyCount,
  statsCount,
  historyPanel,
  statsPanel,
}: Props) {
  const items = interleaveAdSlots(article.blocks);
  const [prefs, setPrefs] = useState<NewsReadingPrefs>(() => readReadingPrefs());

  useEffect(() => {
    setPrefs(readReadingPrefs());
  }, []);

  function updatePrefs(next: NewsReadingPrefs) {
    setPrefs(next);
    writeReadingPrefs(next);
  }

  return (
    <article className="space-y-6">
      <header className="space-y-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
            Article
          </p>
          <NewsCacheBadge
            cached={Boolean(article.cached)}
            cachedAgeMs={article.cachedAgeMs}
            fetchedAt={article.fetchedAt}
          />
        </div>
        <h2 className="text-3xl leading-tight text-foreground sm:text-4xl">
          {article.title}
        </h2>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60">
          {articleMetaLine(article)}
        </p>
        {article.excerpt ? (
          <p className="text-sm text-foreground/75">{article.excerpt}</p>
        ) : null}
      </header>

      <NewsReadingControls prefs={prefs} onChange={updatePrefs} />

      <ArticleTabs
        activeTab={activeTab}
        onChange={onTabChangeAction}
        historyCount={historyCount}
        statsCount={statsCount}
      />

      {activeTab === "article" ? (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-accent/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(245,249,255,0.9)_100%)] px-4 py-5 shadow-[0_18px_50px_rgba(11,40,90,0.14)] sm:px-6 sm:py-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-[linear-gradient(180deg,rgba(15,111,255,0.09),rgba(15,111,255,0))]" />
          <div className="relative mb-4 flex items-center gap-2 border-b border-line/80 pb-3">
            <span className="inline-flex items-center rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-accent">
              Reading View
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/55">
              Article Body
            </span>
          </div>

          <div
            className="relative mx-auto max-w-3xl rounded-2xl border border-line/70 bg-surface/80 px-4 py-4 sm:px-6 sm:py-6"
          >
            <div
              className={`space-y-5 text-foreground leading-relaxed ${textSizeClass(prefs.textSize)}`.trim()}
              style={articleTextStyle(prefs.articleFont)}
            >
              {items.map((item, index) => {
                if (item.kind === "ad") {
                  return <AdPlaceholder key={`ad-${index}`} />;
                }
                return (
                  <BlockView
                    key={`block-${index}`}
                    block={item.block}
                    emphasizeKanji={prefs.emphasizeKanji}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? historyPanel : null}
      {activeTab === "stats" ? statsPanel : null}

      <footer className="border-t border-line pt-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/55">
        Source:{" "}
        <a
          href={article.finalUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline"
        >
          {article.finalUrl}
        </a>
      </footer>
    </article>
  );
}

function ArticleTabs({
  activeTab,
  onChange,
  historyCount,
  statsCount,
}: {
  activeTab: ArticlePanelTab;
  onChange: (next: ArticlePanelTab) => void;
  historyCount: number;
  statsCount: number;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-full border border-line bg-surface-muted text-[11px] font-bold uppercase tracking-[0.12em]">
      <button
        type="button"
        onClick={() => onChange("article")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "article" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>Article</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "history" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>History</span>
        <span className="text-[10px] opacity-85">{historyCount}</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("stats")}
        className={`inline-flex items-center gap-1 px-3 py-1 ${activeTab === "stats" ? "bg-accent text-surface" : "text-foreground/70"}`}
      >
        <span>Stats</span>
        <span className="text-[10px] opacity-85">{statsCount}</span>
      </button>
    </div>
  );
}

function articleTextStyle(font: "body" | "jp-sans" | "jp-serif"): { fontFamily: string } {
  if (font === "jp-sans") {
    return { fontFamily: "var(--font-jp-sans), var(--font-body-sans), sans-serif" };
  }
  if (font === "jp-serif") {
    return { fontFamily: "var(--font-jp-serif), serif" };
  }
  return { fontFamily: "var(--font-body-sans), var(--font-jp-current), sans-serif" };
}

function BlockView({
  block,
  emphasizeKanji,
}: {
  block: NewsArticleBlock;
  emphasizeKanji: boolean;
}) {
  const content = (
    <NewsTokenizedText text={block.text} emphasizeKanji={emphasizeKanji} />
  );

  if (block.kind === "heading") {
    const level = Math.min(Math.max(block.level ?? 2, 2), 4);
    if (level === 2) {
      return <h3 className="pt-2 text-2xl text-foreground">{content}</h3>;
    }
    if (level === 3) {
      return <h4 className="pt-2 text-xl text-foreground">{content}</h4>;
    }
    return <h5 className="pt-2 text-lg text-foreground">{content}</h5>;
  }
  return <p>{content}</p>;
}

function AdPlaceholder() {
  return (
    <div
      role="presentation"
      aria-label="Ad placeholder"
      className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-line bg-surface-muted text-xs font-bold uppercase tracking-[0.18em] text-foreground/45"
    >
      Ad placeholder
    </div>
  );
}

type RenderItem = { kind: "block"; block: NewsArticleBlock } | { kind: "ad" };

function interleaveAdSlots(blocks: NewsArticleBlock[]): RenderItem[] {
  const out: RenderItem[] = [];
  let paragraphCount = 0;
  for (const block of blocks) {
    out.push({ kind: "block", block });
    if (block.kind === "paragraph") {
      paragraphCount += 1;
      if (paragraphCount % AD_INTERVAL === 0) {
        out.push({ kind: "ad" });
      }
    }
  }
  return out;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function articleMetaLine(article: NewsArticle): string {
  const values = [article.siteName ?? hostnameOf(article.finalUrl), article.byline ?? ""]
    .map((value) => cleanMetaDisplayValue(value))
    .filter((value) => value.length > 0);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeMetaValue(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(value);
  }

  return unique.join(" · ");
}

function normalizeMetaValue(value: string): string {
  return cleanMetaDisplayValue(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/[\[\]（）()]/g, "")
    .replace(/[・･·]/g, "")
    .trim();
}

function cleanMetaDisplayValue(value: string): string {
  return value
    .replace(/[＆&]\s*\[(?:and|AND)\]/g, "")
    .replace(/\[(?:and|AND)\]/g, "")
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/\s*[·・･]\s*$/g, "")
    .trim();
}
