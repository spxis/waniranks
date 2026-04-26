"use client";

import { useState } from "react";

import type { NewsArticle } from "@/lib/news/newsTypes";

import NewsArticleView from "./NewsArticleView";

export default function NewsReader() {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) {
      return;
    }

    setLoading(true);
    setError(null);
    setArticle(null);

    try {
      const response = await fetch("/api/news/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { article?: NewsArticle; error?: string }
        | null;

      if (!response.ok || !payload?.article) {
        setError(payload?.error ?? "Couldn't read that article.");
        return;
      }

      setArticle(payload.article);
    } catch {
      setError("Network problem — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="news-url" className="block text-sm font-medium">
          Paste a news article URL
        </label>
        <div className="flex gap-2">
          <input
            id="news-url"
            type="url"
            inputMode="url"
            placeholder="https://..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-[#2D7CFF] focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-md bg-[#2D7CFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Reading…" : "Read"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          You provide the link, so you take responsibility for the source. Articles are cached briefly and not stored.
        </p>
      </form>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {article && !loading ? <NewsArticleView article={article} /> : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      Fetching the article…
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[#FF5D73] bg-[#FFF1F4] p-4 text-sm text-[#16223A]">
      {message}
    </div>
  );
}
