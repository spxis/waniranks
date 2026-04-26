#!/usr/bin/env node
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FFー]/;

const urls = process.argv.slice(2).filter(Boolean);
if (urls.length === 0) {
  console.error("Usage: node scripts/news-candidate-analysis.mjs <url1> [url2 ...]");
  process.exit(1);
}

for (const url of urls) {
  const result = await analyzeUrl(url);
  if (!result.ok) {
    console.log(`\nURL: ${url}`);
    console.log(`  error: ${result.error}`);
    continue;
  }

  console.log(`\nURL: ${url}`);
  console.log(`  title: ${result.title}`);
  console.log(`  text chars: ${result.text.length}`);
  console.log(`  baseline tokens: ${result.baseline.tokenCount}`);
  console.log(`  expanded tokens: ${result.expanded.tokenCount}`);
  console.log(`  baseline avg len: ${result.baseline.avgLen.toFixed(2)}`);
  console.log(`  expanded avg len: ${result.expanded.avgLen.toFixed(2)}`);
  console.log(`  expanded tokens with kana suffix: ${result.expanded.withKanaSuffix}`);
  console.log(`  expanded avg candidates/click: ${result.expanded.avgCandidates.toFixed(2)}`);
  console.log(`  sample expanded tokens: ${result.expanded.samples.join(" | ")}`);
}

async function analyzeUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return { ok: false, error: `fetch failed (${response.status})` };
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article?.content) {
      return { ok: false, error: "readability parse failed" };
    }

    const text = extractText(article.content, url);
    const baseline = baselineTokens(text);
    const expanded = expandedTokens(text);

    return {
      ok: true,
      title: article.title || "(untitled)",
      text,
      baseline,
      expanded,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractText(html, baseUrl) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { url: baseUrl });
  const parts = [];
  const nodes = dom.window.document.querySelectorAll("p,li,blockquote,h1,h2,h3,h4,h5,h6");
  for (const node of nodes) {
    const value = normalize(node.textContent || "");
    if (value) {
      parts.push(value);
    }
  }
  return parts.join("\n");
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function baselineTokens(text) {
  const runs = [];
  for (const line of text.split("\n")) {
    let buf = "";
    for (const char of Array.from(line)) {
      if (KANJI_REGEX.test(char)) {
        buf += char;
      } else if (buf) {
        runs.push(buf);
        buf = "";
      }
    }
    if (buf) {
      runs.push(buf);
    }
  }
  const unique = Array.from(new Set(runs));
  return {
    tokenCount: unique.length,
    avgLen: avg(unique.map((token) => Array.from(token).length)),
  };
}

function expandedTokens(text) {
  const runs = [];
  const candidatesPerRun = [];

  for (const line of text.split("\n")) {
    const chars = Array.from(line);
    let i = 0;
    while (i < chars.length) {
      if (!KANJI_REGEX.test(chars[i] || "")) {
        i += 1;
        continue;
      }

      const start = i;
      i += 1;
      while (i < chars.length && KANJI_REGEX.test(chars[i] || "")) {
        i += 1;
      }
      while (i < chars.length && KANA_REGEX.test(chars[i] || "")) {
        i += 1;
      }

      const run = chars.slice(start, i).join("");
      runs.push(run);
      candidatesPerRun.push(buildCandidates(run).length);
    }
  }

  const unique = Array.from(new Set(runs));
  return {
    tokenCount: unique.length,
    avgLen: avg(unique.map((token) => Array.from(token).length)),
    withKanaSuffix: unique.filter((token) => /[\u3040-\u309F\u30A0-\u30FFー]/.test(token)).length,
    avgCandidates: avg(candidatesPerRun),
    samples: unique.slice(0, 10),
  };
}

function buildCandidates(run) {
  const out = [run];
  const chars = Array.from(run);
  while (chars.length > 1 && KANA_REGEX.test(chars[chars.length - 1] || "")) {
    chars.pop();
    out.push(chars.join(""));
  }
  return Array.from(new Set(out.filter(Boolean)));
}

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
