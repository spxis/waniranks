import type { NewsArticle, NewsArticleBlock } from "@/lib/news/newsTypes";

const AD_INTERVAL = 4;

type Props = {
  article: NewsArticle;
};

export default function NewsArticleView({ article }: Props) {
  const items = interleaveAdSlots(article.blocks);

  return (
    <article className="space-y-4">
      <header className="space-y-1 border-b border-slate-200 pb-3">
        <h2 className="text-2xl font-semibold leading-tight text-[#16223A]">{article.title}</h2>
        <p className="text-xs text-slate-500">
          {article.siteName ?? hostnameOf(article.finalUrl)}
          {article.byline ? ` · ${article.byline}` : ""}
          {article.cached ? " · cached" : ""}
        </p>
        {article.excerpt ? <p className="text-sm text-slate-600">{article.excerpt}</p> : null}
      </header>

      <div className="space-y-4 text-[15px] leading-relaxed text-[#16223A]">
        {items.map((item, index) => {
          if (item.kind === "ad") {
            return <AdPlaceholder key={`ad-${index}`} />;
          }
          return <BlockView key={`block-${index}`} block={item.block} />;
        })}
      </div>

      <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        Source:{" "}
        <a href={article.finalUrl} target="_blank" rel="noreferrer" className="underline">
          {article.finalUrl}
        </a>
      </footer>
    </article>
  );
}

function BlockView({ block }: { block: NewsArticleBlock }) {
  if (block.kind === "heading") {
    const level = Math.min(Math.max(block.level ?? 2, 2), 4);
    if (level === 2) {
      return <h3 className="pt-2 text-xl font-semibold">{block.text}</h3>;
    }
    if (level === 3) {
      return <h4 className="pt-2 text-lg font-semibold">{block.text}</h4>;
    }
    return <h5 className="pt-2 text-base font-semibold">{block.text}</h5>;
  }
  return <p>{block.text}</p>;
}

function AdPlaceholder() {
  return (
    <div
      role="presentation"
      aria-label="Ad placeholder"
      className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"
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
