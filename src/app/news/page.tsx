import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  title: "Read · UmaKuma",
  description: "Read Japanese news articles you choose, with kanji insight.",
};

export default async function NewsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  const linkedAccount = email
    ? await prisma.account.findFirst({
        where: { joinedByEmail: email },
        select: { wkLevel: true, wkUsername: true },
      })
    : null;
  if (linkedAccount?.wkUsername) {
    redirect(`/users/${encodeURIComponent(linkedAccount.wkUsername)}?dashboard=read&read=news`);
  }
  const userWkLevel = typeof linkedAccount?.wkLevel === "number" ? linkedAccount.wkLevel : null;

  return (
    <div className="relative min-h-full overflow-hidden pb-12">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 lg:px-8">
        <section className="animate-enter rounded-[2rem] border border-line/80 bg-surface/85 p-5 shadow-[0_24px_80px_rgba(15,111,255,0.17)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
                Reader
              </p>
              <h1 className="mt-2 text-4xl leading-[0.9] text-foreground sm:text-6xl lg:text-7xl">
                Read News
              </h1>
              <p className="mt-4 max-w-2xl text-base text-foreground/75 sm:text-lg">
                Paste a Japanese news article. Uma and Kuma fetch it for you, then surface
                the kanji you&rsquo;re ready for.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-bold uppercase tracking-[0.14em] text-foreground transition hover:bg-surface-muted"
              >
                Learn
              </Link>
              <Link
                href="/news/history"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-bold uppercase tracking-[0.14em] text-foreground transition hover:bg-surface-muted"
              >
                History
              </Link>
              <Link
                href="/news/stats"
                className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-bold uppercase tracking-[0.14em] text-foreground transition hover:bg-surface-muted"
              >
                Stats
              </Link>
            </div>
          </div>
        </section>

        <section className="animate-enter animate-enter-delay-2 mt-6 rounded-[2rem] border border-line bg-surface/90 p-5 shadow-[0_20px_55px_rgba(8,16,36,0.12)] sm:p-8">
          {session?.user?.email ? (
            <Suspense fallback={<NewsReaderFallback />}>
              <NewsReader devSampleUrls={getDevSampleUrls()} userWkLevel={userWkLevel} />
            </Suspense>
          ) : (
            <div className="rounded-2xl border border-line bg-surface-muted p-6 text-sm text-foreground/80">
              Please{" "}
              <Link href="/login" className="font-bold uppercase tracking-[0.12em] text-accent underline">
                sign in
              </Link>{" "}
              to use the News Reader.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NewsReaderFallback() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-6 text-center text-sm font-semibold uppercase tracking-[0.14em] text-foreground/60">
      Loading…
    </div>
  );
}
