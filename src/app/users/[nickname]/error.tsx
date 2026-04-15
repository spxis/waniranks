"use client";

import { useEffect } from "react";

type UserPageErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function UserPageError({ error, reset }: UserPageErrorProps) {
  useEffect(() => {
    console.error("User drilldown error:", error);
  }, [error]);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-4xl">
        <section className="rounded-[2rem] border border-red-300 bg-red-50/95 p-6 shadow-[0_16px_48px_rgba(220,38,38,0.15)] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">User page error</p>
          <h1 className="mt-2 text-3xl font-black text-red-900 sm:text-4xl">We could not load this user drilldown</h1>
          <p className="mt-3 text-base text-red-900/80 sm:text-lg">
            Data or rendering failed for this profile. Try again, or return to the leaderboard.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-full border border-red-400 bg-white px-5 text-sm font-bold uppercase tracking-[0.08em] text-red-800 hover:bg-red-100"
            >
              Retry user page
            </button>
            <a
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-bold uppercase tracking-[0.08em] text-foreground hover:bg-surface-muted"
            >
              Back to Leaderboard
            </a>
          </div>
          {process.env.NODE_ENV !== "production" ? (
            <pre className="mt-5 max-h-72 overflow-auto rounded-xl border border-red-200 bg-white/80 p-3 text-xs leading-5 text-red-900">
              {error.message}
            </pre>
          ) : null}
        </section>
      </main>
    </div>
  );
}
