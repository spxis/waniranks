import type { TabId } from "./UserDashboardTabs.types";

type QueryShape = {
  dashboard?: string;
  tab?: string;
  read?: string;
};

type ReadTab = "news" | "history" | "stats";

export function resolveInitialDashboardTab(query: QueryShape): TabId {
  if (query.dashboard === "stats") return "stats";
  if (query.dashboard === "read") return "read";
  if (query.tab === "stats") return "stats";
  if (query.tab === "read") return "read";
  return "learn";
}

export function resolveInitialReadTab(query: QueryShape): ReadTab {
  if (query.read === "history") return "history";
  if (query.read === "stats") return "stats";
  return "news";
}

export function getNewsDevSampleUrls(): string[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  const raw = process.env.NEWS_DEV_SAMPLE_URLS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
