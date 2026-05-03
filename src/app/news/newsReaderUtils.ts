export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function fallbackNewsError(mode: "read" | "scan", status: number): string {
  if (status === 403) {
    return "That site blocked server access (403). Try another source or a direct article URL.";
  }
  if (status === 408) {
    return "That site took too long to respond. Try again in a moment.";
  }
  if (status === 413) {
    return mode === "scan"
      ? "That page is too large to scan safely. Try a narrower section URL."
      : "That page is too large to read safely.";
  }
  if (status === 415) {
    return "That URL did not return an HTML page.";
  }
  if (status === 422) {
    return mode === "scan"
      ? "No article links were found on that page. Try a section or homepage URL."
      : "That page did not look like an article.";
  }
  if (status === 429) {
    return "That site is rate limiting requests right now. Please wait and try again.";
  }
  if (status >= 500) {
    return `Request failed on the server (HTTP ${status}). Please try again.`;
  }
  return mode === "scan" ? "Could not scan that page." : "Could not read that article.";
}
