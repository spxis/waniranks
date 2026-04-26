// Shared HTTP fetcher for the News reader. Goal: look like a normal Chrome
// reader, never hammer a host, and surface clear typed errors.

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_FALLBACK_MS = 30_000;
const MAX_BYTES = 4 * 1024 * 1024;

export type NewsHttpError =
  | { kind: "fetch_failed"; status?: number }
  | { kind: "too_large" }
  | { kind: "not_html" };

export type NewsHttpOk = {
  ok: true;
  html: string;
  finalUrl: string;
};

export type NewsHttpResult = NewsHttpOk | { ok: false; error: NewsHttpError };

type HeaderProfile = "minimal" | "browser-like";

type FetchAttempt = {
  profile: HeaderProfile;
  timeoutMs: number;
  includeReferer: boolean;
};

export async function fetchNewsHtml(url: string): Promise<NewsHttpResult> {
  const attempts: FetchAttempt[] = [
    { profile: "minimal", timeoutMs: FETCH_TIMEOUT_MS, includeReferer: true },
    { profile: "browser-like", timeoutMs: FETCH_TIMEOUT_MS, includeReferer: true },
    { profile: "browser-like", timeoutMs: FETCH_TIMEOUT_FALLBACK_MS, includeReferer: false },
  ];

  let lastFailure: NewsHttpError = { kind: "fetch_failed" };

  for (const attemptConfig of attempts) {
    const headers = buildHeaders(url, attemptConfig.profile, attemptConfig.includeReferer);
    const attempt = await fetchNewsHtmlOnce(url, headers, attemptConfig.timeoutMs);
    if (attempt.ok) {
      return attempt;
    }
    lastFailure = attempt.error;
    if (attempt.error.kind === "too_large") {
      return attempt;
    }
  }

  return { ok: false, error: lastFailure };
}

async function fetchNewsHtmlOnce(
  url: string,
  headers: HeadersInit,
  timeoutMs: number,
): Promise<NewsHttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: { kind: "fetch_failed", status: response.status } };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { ok: false, error: { kind: "not_html" } };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: { kind: "too_large" } };
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    return { ok: true, html, finalUrl: response.url || url };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: { kind: "fetch_failed", status: isAbort ? 408 : undefined },
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildHeaders(url: string, profile: HeaderProfile, includeReferer: boolean): HeadersInit {
  let referer: string | null = null;
  try {
    referer = new URL(url).origin + "/";
  } catch {
    referer = null;
  }

  const headers: Record<string, string> = {
    "User-Agent": CHROME_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Cache-Control": "max-age=0",
  };

  if (profile === "browser-like") {
    headers["Sec-Ch-Ua"] = '"Not A(Brand";v="99", "Google Chrome";v="132", "Chromium";v="132"';
    headers["Sec-Ch-Ua-Mobile"] = "?0";
    headers["Sec-Ch-Ua-Platform"] = '"macOS"';
    headers["Sec-Fetch-Dest"] = "document";
    headers["Sec-Fetch-Mode"] = "navigate";
    headers["Sec-Fetch-Site"] = "none";
    headers["Sec-Fetch-User"] = "?1";
    headers["Upgrade-Insecure-Requests"] = "1";
  }

  if (includeReferer && referer) {
    headers.Referer = referer;
  }

  return headers;
}
