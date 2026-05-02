import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import NewsStatsClient from "./NewsStatsClient";

export const metadata: Metadata = {
  title: "News Stats · UmaKuma",
  description: "Kanji and vocabulary interaction stats from News Reader.",
};

export default async function NewsStatsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  const linkedAccount = email
    ? await prisma.account.findFirst({
        where: { joinedByEmail: email },
        select: { wkUsername: true },
      })
    : null;
  if (linkedAccount?.wkUsername) {
    redirect(`/users/${encodeURIComponent(linkedAccount.wkUsername)}?dashboard=read&read=stats`);
  }

  return (
    <div className="relative min-h-full overflow-hidden pb-12">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-line/80 bg-surface/90 p-5 shadow-[0_20px_55px_rgba(8,16,36,0.12)] sm:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-3xl font-black text-foreground">News Stats</h1>
            <div className="flex flex-wrap gap-2">
              <Link href="/news" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/80">Reader</Link>
              <Link href="/news/history" className="rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/80">History</Link>
            </div>
          </div>

          {session?.user?.email ? (
            <NewsStatsClient />
          ) : (
            <div className="rounded-2xl border border-line bg-surface-muted p-6 text-sm text-foreground/80">
              Please sign in to view your stats.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
