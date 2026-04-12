"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

type JoinStatus = {
  type: "idle" | "ok" | "error";
  message: string;
};

type SessionStatus = {
  signedIn?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export default function JoinPage() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<JoinStatus>({ type: "idle", message: "" });

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as SessionStatus;
        setSignedIn(Boolean(data.signedIn));
        setUserName(data.user?.name ?? null);
        setUserEmail(data.user?.email ?? null);
      } finally {
        setChecking(false);
      }
    }

    loadSession().catch(() => {
      setChecking(false);
    });
  }, []);

  async function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname, token }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not join leaderboard.");
      }

      setToken("");
      setStatus({
        type: "ok",
        message: "You joined the leaderboard. Return to home page to see your rank.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not join leaderboard.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-2xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back to leaderboard
        </Link>

        <section className="animate-enter rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Open signup</p>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">Join WaniRanks</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Sign in with Google, then connect your WaniKani token.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void signIn("google", { callbackUrl: "/join" });
              }}
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
            >
              Sign in with Google
            </button>
            <Link
              href="/api/auth/signout?callbackUrl=/join"
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
            >
              Sign out
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold">{checking ? "Checking session..." : signedIn ? `Signed in: ${userName ?? "Google user"}` : "Not signed in"}</p>
            <p className="mt-1 text-xs">{userEmail ?? "No Google account in session."}</p>
          </div>

          <form onSubmit={join} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Display name
              </span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="How your name appears on leaderboard"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                WaniKani API token
              </span>
              <input
                type="password"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="Paste personal token"
              />
            </label>

            <button
              type="submit"
              disabled={loading || !signedIn}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Joining..." : "Join leaderboard"}
            </button>
          </form>

          {status.message ? (
            <p
              className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
                status.type === "error"
                  ? "border border-red-200 bg-red-50 text-red-800"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {status.message}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
