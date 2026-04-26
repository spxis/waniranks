import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";

import NewsReader from "./NewsReader";

function getDevSampleUrls(): string[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  const raw = process.env.NEWS_DEV_SAMPLE_URLS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const metadata: Metadata = {
  title: "News Reader · UmaKuma",
  description: "Read Japanese news articles you choose, with kanji insight.",
};

export default async function NewsPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold text-[#16223A]">News Reader</h1>
        <p className="text-sm text-slate-600">
          Paste a news article URL. Uma and Kuma will fetch it for you.
        </p>
      </header>

      {session?.user?.email ? (
        <NewsReader devSampleUrls={getDevSampleUrls()} />
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
          Please{" "}
          <Link href="/login" className="font-semibold text-[#2D7CFF] underline">
            sign in
          </Link>{" "}
          to use the News Reader.
        </div>
      )}
    </main>
  );
}
