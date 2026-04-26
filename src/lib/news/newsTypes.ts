export type NewsArticleBlock = {
  kind: "paragraph" | "heading";
  level?: number;
  text: string;
};

export type NewsArticle = {
  url: string;
  finalUrl: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  lang: string | null;
  excerpt: string | null;
  blocks: NewsArticleBlock[];
  textLength: number;
  fetchedAt: string;
  cached: boolean;
};
