"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Status = {
  type: "idle" | "ok" | "error";
  message: string;
};

export default function AdminPage() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ nickname, token }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add account.");
      }

      setNickname("");
      setToken("");
      setStatus({ type: "ok", message: "Account saved." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/leaderboard/refresh", {
        method: "POST",
        headers: {
          "x-admin-key": adminKey,
        },
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      setStatus({ type: "ok", message: "Leaderboard refreshed." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-10">
      <main className="mx-auto w-full max-w-2xl space-y-5">
        <Link href="/" className="text-sm font-semibold text-amber-800 hover:text-amber-950">
          Back to public leaderboard
        </Link>

        <section className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black tracking-tight text-amber-950">Admin controls</h1>
          <p className="mt-2 text-sm text-amber-900/80">
            Keep this page private. Add/update family tokens and manually refresh everyone.
          </p>

          <form onSubmit={addAccount} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-amber-800">
                Admin API key
              </span>
              <input
                type="password"
                required
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring"
                placeholder="Set this in Vercel env as ADMIN_API_KEY"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-amber-800">
                Family nickname
              </span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring"
                placeholder="e.g. Mom"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-amber-800">
                WaniKani API token
              </span>
              <input
                type="password"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm outline-none ring-amber-500 focus:ring"
                placeholder="Paste token"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-full bg-amber-600 px-4 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                Save account
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={refreshAll}
                className="inline-flex h-10 items-center justify-center rounded-full border border-amber-300 bg-amber-100 px-4 text-sm font-bold text-amber-900 transition hover:bg-amber-200 disabled:opacity-60"
              >
                Refresh everyone now
              </button>
            </div>
          </form>

          {status.message ? (
            <p
              className={`mt-4 rounded-xl px-3 py-2 text-sm ${
                status.type === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-emerald-100 text-emerald-800"
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
