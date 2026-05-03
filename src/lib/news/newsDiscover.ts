import { fetchNewsHtml, type NewsHttpError } from "./newsHttp";

const MAX_RESULTS = 30;
const MIN_TITLE_LENGTH = 6;

const EXCLUDE_PATH_SEGMENTS = new Set([
  "tag",
  "tags",
  "category",
  "categories",
  "author",
  "authors",
  "search",
  "login",
  "signin",
  "signup",
  "subscribe",
  "about",
  "contact",
  "privacy",
  "terms",
  "rss",
  "feed",
  "sitemap",
  "topics",
  "section",
  "sections",
  "video",
  "videos",
  "photo",
  "photos",
  "gallery",
  "live",
]);

const EXCLUDE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".mp4",
  ".mp3",
  ".zip",
  ".css",
  ".js",
]);

export type DiscoveredLink = {
  url: string;
  title: string;
};

export type DiscoverError =
  | { kind: "invalid_url" }
  | { kind: "blocked_host" }
  | { kind: "no_links" }
  | { kind: "parse_failed"; message?: string }
  | NewsHttpError;

export type DiscoverPayload = {
  baseUrl: string;
  links: DiscoveredLink[];
  fetchedAt: string;
};

export type DiscoverResult =
  | { ok: true; payload: DiscoverPayload }
  | { ok: false; error: DiscoverError };

export async function discoverArticleLinks(rawUrl: string): Promise<DiscoverResult> {
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

  try {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(fetched.html, { url: fetched.finalUrl });
    const baseHost = new URL(fetched.finalUrl).hostname.toLowerCase();
    const seen = new Map<string, DiscoveredLink>();

    const anchors = dom.window.document.querySelectorAll("a[href]");
    anchors.forEach((node) => {
      const anchor = node as HTMLAnchorElement;
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }

      const target = resolveUrl(href, fetched.finalUrl);
      if (!target) {
        return;
      }
      if (target.hostname.toLowerCase() !== baseHost) {
        return;
      }
      if (!looksLikeArticlePath(target)) {
        return;
      }
      if (hasExcludedExtension(target.pathname)) {
        return;
      }

      const cleanUrl = stripTrackingParams(target).toString();
      if (seen.has(cleanUrl)) {
        return;
      }

      const title = extractAnchorTitle(anchor);
      if (!title || title.length < MIN_TITLE_LENGTH) {
        return;
      }

      seen.set(cleanUrl, { url: cleanUrl, title });
    });

    if (seen.size === 0) {
      return { ok: false, error: { kind: "no_links" } };
    }

    const payload: DiscoverPayload = {
      baseUrl: fetched.finalUrl,
      links: Array.from(seen.values()).slice(0, MAX_RESULTS),
      fetchedAt: new Date().toISOString(),
    };

    return { ok: true, payload };
  } catch {
    // Some publisher responses can include malformed HTML/URL values that break parsing.
    // Return a typed parse failure so API routes can log and surface traceable diagnostics.
    return { ok: false, error: { kind: "parse_failed" } };
  }
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

function resolveUrl(href: string, base: string): URL | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function looksLikeArticlePath(url: URL): boolean {
  const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase() ?? "";
  if (EXCLUDE_PATH_SEGMENTS.has(firstSegment)) {
    return false;
  }

  const lastSegment = segments[segments.length - 1] ?? "";
  if (lastSegment.length < 4) {
    return false;
  }

  const hasSlugLike = /[-_]/.test(lastSegment) || /\d{4,}/.test(lastSegment);
  return hasSlugLike;
}

function hasExcludedExtension(pathname: string): boolean {
  const lowered = pathname.toLowerCase();
  for (const ext of EXCLUDE_EXTENSIONS) {
    if (lowered.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

function stripTrackingParams(url: URL): URL {
  const next = new URL(url.toString());
  const remove: string[] = [];
  next.searchParams.forEach((_value, key) => {
    if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid") {
      remove.push(key);
    }
  });
  remove.forEach((key) => next.searchParams.delete(key));
  return next;
}

function extractAnchorTitle(anchor: HTMLAnchorElement): string {
  const direct = normalizeWhitespace(anchor.textContent ?? "");
  if (direct.length >= MIN_TITLE_LENGTH) {
    return direct;
  }

  const ariaLabel = anchor.getAttribute("aria-label");
  if (ariaLabel) {
    const value = normalizeWhitespace(ariaLabel);
    if (value.length >= MIN_TITLE_LENGTH) {
      return value;
    }
  }

  const title = anchor.getAttribute("title");
  if (title) {
    const value = normalizeWhitespace(title);
    if (value.length >= MIN_TITLE_LENGTH) {
      return value;
    }
  }

  return direct;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
