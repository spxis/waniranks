import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";

import NewsHistoryViewerClient from "./NewsHistoryViewerClient";

export const metadata: Metadata = {
  title: "News History · UmaKuma",
  description: "History of kanji and vocabulary clicked from News Reader.",
};

export default async function NewsHistoryPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="relative min-h-full overflow-hidden pb-12">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-line/80 bg-surface/90 p-5 shadow-[0_20px_55px_rgba(8,16,36,0.12)] sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-3xl font-black text-foreground">News Glyph History</h1>
            <div className="flex flex-wrap gap-2">
              <Link href="/news" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/80">Reader</Link>
              <Link href="/news/stats" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/80">Stats</Link>
            </div>
          </div>

          {session?.user?.email ? (
            <NewsHistoryViewerClient />
          ) : (
            <div className="rounded-2xl border border-line bg-surface-muted p-6 text-sm text-foreground/80">
              Please sign in to view your history.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
