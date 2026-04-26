import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import type { NewsArticle, NewsArticleBlock } from "./newsTypes";
import { fetchNewsHtml, type NewsHttpError } from "./newsHttp";

const MIN_TEXT_LENGTH = 400;

export type NewsExtractError =
  | { kind: "invalid_url" }
  | { kind: "blocked_host" }
  | { kind: "not_article" }
  | NewsHttpError;

export type NewsExtractResult =
  | { ok: true; article: NewsArticle }
  | { ok: false; error: NewsExtractError };

export async function extractArticle(rawUrl: string): Promise<NewsExtractResult> {
  const parsed = parseAllowedUrl(rawUrl);
  if (!parsed) {
    return { ok: false, error: { kind: "invalid_url" } };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: { kind: "blocked_host" } };
  }

  const fetched = await fetchNewsHtml(parsed.toString());
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const dom = new JSDOM(fetched.html, { url: fetched.finalUrl });
  const reader = new Readability(dom.window.document);
  const parsedArticle = reader.parse();

  if (!parsedArticle || !parsedArticle.content) {
    return { ok: false, error: { kind: "not_article" } };
  }

  const blocks = htmlToBlocks(parsedArticle.content, fetched.finalUrl);
  const textLength = blocks.reduce((sum, block) => sum + block.text.length, 0);

  if (textLength < MIN_TEXT_LENGTH || blocks.length === 0) {
    return { ok: false, error: { kind: "not_article" } };
  }

  const article: NewsArticle = {
    url: rawUrl,
    finalUrl: fetched.finalUrl,
    title: parsedArticle.title?.trim() || dom.window.document.title || "Untitled",
    byline: parsedArticle.byline?.trim() || null,
    siteName: parsedArticle.siteName?.trim() || null,
    lang: parsedArticle.lang || dom.window.document.documentElement.lang || null,
    excerpt: parsedArticle.excerpt?.trim() || null,
    blocks,
    textLength,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  return { ok: true, article };
}

function parseAllowedUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  if (lowered === "localhost" || lowered.endsWith(".local")) {
    return true;
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lowered)) {
    return true;
  }
  return false;
}

function htmlToBlocks(html: string, baseUrl: string): NewsArticleBlock[] {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: baseUrl });
  const body = dom.window.document.body;
  const out: NewsArticleBlock[] = [];

  const walk = (node: Node): void => {
    if (node.nodeType !== dom.window.Node.ELEMENT_NODE) {
      return;
    }
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "p" || tag === "li" || tag === "blockquote") {
      const text = normalizeWhitespace(el.textContent ?? "");
      if (text.length > 0) {
        out.push({ kind: "paragraph", text });
      }
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const text = normalizeWhitespace(el.textContent ?? "");
      if (text.length > 0) {
        out.push({ kind: "heading", level: Number(tag.substring(1)), text });
      }
      return;
    }

    el.childNodes.forEach((child) => walk(child));
  };

  body.childNodes.forEach((child) => walk(child));
  return cleanExtractedBlocks(out);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cleanExtractedBlocks(blocks: NewsArticleBlock[]): NewsArticleBlock[] {
  if (blocks.length <= 2) {
    return blocks;
  }

  const start = findLikelyContentStart(blocks);
  const end = findLikelyContentEnd(blocks);
  if (start > end) {
    return blocks;
  }

  const sliced = blocks.slice(start, end + 1);
  return sliced.filter((block) => {
    const text = block.text;
    return !isAlwaysDropBoilerplate(text) && !isLikelyInlineRelatedBlock(text);
  });
}

function findLikelyContentStart(blocks: NewsArticleBlock[]): number {
  let start = 0;

  while (start < blocks.length - 1 && isLikelyLeadingNoise(blocks[start], start)) {
    start += 1;
  }

  const scanLimit = Math.min(blocks.length, start + 80);
  for (let index = start; index < scanLimit; index += 1) {
    const block = blocks[index];
    if (isSubstantialParagraph(block)) {
      if (index - start >= 4) {
        const leadingSlice = blocks.slice(start, index);
        const navLikeCount = leadingSlice.filter((entry) => isShortNavLikeBlock(entry) || isLikelyLeadingNoise(entry, 0)).length;
        if (navLikeCount >= Math.ceil(leadingSlice.length * 0.6)) {
          return index;
        }
      }

      if (index > 0) {
        const prev = blocks[index - 1];
        if (prev.kind === "heading" && !isLikelyHeadingNoise(prev.text) && !isShortNavLikeBlock(prev)) {
          return index - 1;
        }
      }
      return index;
    }
  }

  return start;
}

function findLikelyContentEnd(blocks: NewsArticleBlock[]): number {
  let end = blocks.length - 1;

  while (end > 0 && isLikelyTrailingNoise(blocks[end], blocks.length - 1 - end)) {
    end -= 1;
  }

  for (let index = end; index >= Math.max(0, end - 10); index -= 1) {
    if (isSubstantialParagraph(blocks[index])) {
      return index;
    }
  }

  return end;
}

function isSubstantialParagraph(block: NewsArticleBlock): boolean {
  if (block.kind !== "paragraph") {
    return false;
  }
  const text = block.text.trim();
  if (text.length < 44) {
    return false;
  }
  return !isLikelyHeadingNoise(text) && !isLikelyLinkHubText(text) && !isAlwaysDropBoilerplate(text);
}

function isLikelyLeadingNoise(block: NewsArticleBlock, indexFromTop: number): boolean {
  const text = block.text.trim();
  if (!text) {
    return true;
  }

  if (isAlwaysDropBoilerplate(text) || isLikelyHeadingNoise(text)) {
    return true;
  }

  if (block.kind === "heading" && isLikelyTocHeading(text)) {
    return true;
  }

  if (indexFromTop <= 5 && isLikelyLinkHubText(text)) {
    return true;
  }

  if (indexFromTop <= 3 && block.kind === "paragraph" && text.length <= 20) {
    return true;
  }

  return false;
}

function isLikelyTrailingNoise(block: NewsArticleBlock, indexFromBottom: number): boolean {
  const text = block.text.trim();
  if (!text) {
    return true;
  }

  if (isAlwaysDropBoilerplate(text)) {
    return true;
  }

  if (isLikelyHeadingNoise(text) || isLikelyLinkHubText(text)) {
    return true;
  }

  if (indexFromBottom <= 3 && block.kind === "paragraph" && text.length <= 26) {
    return true;
  }

  return false;
}

function isLikelyHeadingNoise(text: string): boolean {
  const value = text.toLowerCase();
  return (
    /(table of contents|contents|toc|related articles?|recommended|share|follow us|newsletter|subscribe|sponsored|advertisement)/i.test(value) ||
    /(目次|関連記事|関連リンク|あわせて読みたい|シェア|フォロー|広告|スポンサー|おすすめ|ランキング|次の記事|前の記事|トップへ|深掘りコンテンツ|特集コンテンツ|注目コンテンツ)/.test(text)
  );
}

function isLikelyTocHeading(text: string): boolean {
  const normalized = text.replace(/[\s:：]+/g, "").toLowerCase();
  return (
    normalized === "toc" ||
    normalized === "contents" ||
    normalized === "tableofcontents" ||
    normalized === "目次"
  );
}

function isLikelyLinkHubText(text: string): boolean {
  const value = text.trim();
  if (!value) {
    return false;
  }

  const tokenSplit = value.split(/[|｜・•·／/]/).map((token) => token.trim()).filter(Boolean);
  const manyShortTokens = tokenSplit.length >= 4 && tokenSplit.every((token) => token.length <= 10);
  const hasUrlish = /(https?:\/\/|www\.|\.com\b|\.jp\b)/i.test(value);
  const navWords = /(home|news|sports|life|business|tech|menu|login|sign in|register)/i.test(value);

  return manyShortTokens || hasUrlish || navWords;
}

function isShortNavLikeBlock(block: NewsArticleBlock): boolean {
  const text = block.text.trim();
  if (!text) {
    return true;
  }

  const noSentencePunctuation = !/[。！？.!?]/.test(text);
  const shortText = text.length <= 14;
  if (!shortText || !noSentencePunctuation) {
    return false;
  }

  if (block.kind === "heading") {
    return true;
  }

  return isLikelyLinkHubText(text) || /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}・･\s]+$/u.test(text);
}

function isAlwaysDropBoilerplate(text: string): boolean {
  const value = text.toLowerCase();
  return (
    /(all rights reserved|copyright|terms of use|privacy policy|cookie policy|about us|contact us)/i.test(value) ||
    /(利用規約|プライバシーポリシー|著作権|無断転載|会社概要|お問い合わせ|サイトマップ|免責事項)/.test(text)
  );
}

function isLikelyInlineRelatedBlock(text: string): boolean {
  const value = text.trim();
  if (!value) {
    return true;
  }

  if (/^(深掘りコンテンツ|関連記事|関連リンク|あわせて読みたい|おすすめ|注目記事)$/.test(value)) {
    return true;
  }

  const endsWithTimestamp = /(?:\d{1,2}月\d{1,2}日)?\d{1,2}:\d{2}$/.test(value);
  const quoteHeadline = /[「『“"].+[」』”"]/.test(value);
  const bracketTag = /【[^】]{2,20}】/.test(value);
  const noSentencePunctuation = !/[。！？.!?]$/.test(value);
  const likelyHeadlineLine = value.length <= 90 && noSentencePunctuation;

  if (endsWithTimestamp && likelyHeadlineLine && (quoteHeadline || bracketTag || /[\p{Script=Han}]{4,}/u.test(value))) {
    return true;
  }

  return false;
}
