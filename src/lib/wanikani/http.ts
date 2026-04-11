import { LEADERBOARD_REQUEST_GAP_MS } from "@/lib/refreshPolicy";

import type {
  WaniKaniCollectionResponse,
  WaniKaniResponseHeaders,
} from "./types";

const BASE_URL = "https://api.wanikani.com/v2";
type TokenThrottleState = {
  requestChain: Promise<void>;
  lastRequestStartedAt: number;
};

const throttleByToken = new Map<string, TokenThrottleState>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getThrottleState(token: string): TokenThrottleState {
  const existing = throttleByToken.get(token);
  if (existing) {
    return existing;
  }

  const created: TokenThrottleState = {
    requestChain: Promise.resolve(),
    lastRequestStartedAt: 0,
  };
  throttleByToken.set(token, created);
  return created;
}

async function runThrottledRequest<T>(token: string, work: () => Promise<T>): Promise<T> {
  const state = getThrottleState(token);

  const run = state.requestChain.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, state.lastRequestStartedAt + LEADERBOARD_REQUEST_GAP_MS - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    state.lastRequestStartedAt = Date.now();
    return work();
  });

  state.requestChain = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

export async function fetchWaniKani<T>(
  path: string,
  token: string,
  conditionalHeaders?: { ifNoneMatch?: string | null; ifModifiedSince?: string | null },
): Promise<{ status: number; data: T | null; headers: WaniKaniResponseHeaders }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Wanikani-Revision": "20170710",
  };

  if (conditionalHeaders?.ifNoneMatch) {
    headers["If-None-Match"] = conditionalHeaders.ifNoneMatch;
  }

  if (conditionalHeaders?.ifModifiedSince) {
    headers["If-Modified-Since"] = conditionalHeaders.ifModifiedSince;
  }

  const response = await runThrottledRequest(token, () =>
    fetch(`${BASE_URL}${path}`, {
      headers,
      cache: "no-store",
    }),
  );

  const responseHeaders: WaniKaniResponseHeaders = {
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };

  if (response.status === 304) {
    return { status: 304, data: null, headers: responseHeaders };
  }

  if (!response.ok) {
    throw new Error(`WaniKani API error: ${response.status}`);
  }

  return {
    status: response.status,
    data: (await response.json()) as T,
    headers: responseHeaders,
  };
}

export async function fetchAllCollectionPages(
  path: string,
  token: string,
): Promise<WaniKaniCollectionResponse> {
  let nextPath = path;
  let totalCount = 0;
  const allData: WaniKaniCollectionResponse["data"] = [];
  let latestDataUpdatedAt: string | null = null;

  while (nextPath) {
    const pageResponse = await fetchWaniKani<WaniKaniCollectionResponse>(nextPath, token);
    const page = pageResponse.data;
    if (!page) {
      break;
    }

    totalCount = page.total_count;
    allData.push(...page.data);
    latestDataUpdatedAt = page.data_updated_at ?? latestDataUpdatedAt;

    if (!page.pages.next_url) {
      break;
    }

    const url = new URL(page.pages.next_url);
    nextPath = `${url.pathname}${url.search}`.replace("/v2", "");
  }

  return {
    object: "collection",
    data_updated_at: latestDataUpdatedAt,
    total_count: totalCount,
    pages: { next_url: null },
    data: allData,
  };
}

export async function postWaniKani<TResponse>(
  path: string,
  token: string,
  body: unknown,
): Promise<TResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Wanikani-Revision": "20170710",
    "Content-Type": "application/json",
  };

  const response = await runThrottledRequest(token, () =>
    fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    }),
  );

  if (!response.ok) {
    throw new Error(`WaniKani API error: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
