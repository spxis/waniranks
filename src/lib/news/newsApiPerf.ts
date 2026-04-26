type PerfMeta = Record<string, number | string | boolean | null | undefined>;

function isPerfEnabled(): boolean {
  if (typeof process === "undefined") {
    return false;
  }

  return process.env?.NEWS_API_PERF_LOG === "1";
}

export function logNewsApiPerf(
  route: string,
  startedAtMs: number,
  status: number,
  meta?: PerfMeta,
): void {
  if (!isPerfEnabled()) {
    return;
  }

  const durationMs = Date.now() - startedAtMs;
  if (meta && Object.keys(meta).length > 0) {
    console.info(`[news/perf] ${route} ${status} ${durationMs}ms`, meta);
    return;
  }
  console.info(`[news/perf] ${route} ${status} ${durationMs}ms`);
}
