"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Status = {
  type: "idle" | "ok" | "error";
  message: string;
};

type AdminAccount = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  pendingReviews: number;
  lastSyncedAt: string;
  lastSyncStatus: string;
};

function isManualRefreshOnCooldown(lastSyncedAt: string): boolean {
  const last = new Date(lastSyncedAt).getTime();
  return Date.now() - last < 60_000;
}

export default function AdminPage() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [sessionAuthorized, setSessionAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);

  async function getAdminSessionStatus() {
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as { authorized?: boolean };
      setSessionAuthorized(Boolean(data.authorized));
    } finally {
      setCheckingSession(false);
    }
  }

  async function persistAdminSession() {
    if (!rememberDevice || !adminKey.trim() || sessionAuthorized) {
      return;
    }

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: {
        "x-admin-key": adminKey,
      },
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Could not remember this device.");
    }

    setSessionAuthorized(true);
  }

  async function clearAdminSession() {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/admin/session", {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not forget this device.");
      }

      setSessionAuthorized(false);
      setStatus({ type: "ok", message: "This device is no longer remembered." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function adminAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return adminKey.trim() ? { ...extraHeaders, "x-admin-key": adminKey } : extraHeaders;
  }

  async function loadAccounts() {
    const response = await fetch("/api/accounts", { cache: "no-store" });
    const data = (await response.json()) as { accounts?: AdminAccount[] };
    setAccounts(data.accounts ?? []);
  }

  useEffect(() => {
    loadAccounts().catch(() => {
      setStatus({ type: "error", message: "Could not load account list." });
    });

    getAdminSessionStatus().catch(() => {
      setCheckingSession(false);
    });
  }, []);

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: adminAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ nickname, token }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add account.");
      }

      setNickname("");
      setToken("");
      await persistAdminSession();
      setStatus({ type: "ok", message: "Account saved." });
      await loadAccounts();
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
        headers: adminAuthHeaders(),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      await persistAdminSession();
      setStatus({ type: "ok", message: "Leaderboard refreshed." });
      await loadAccounts();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshOne(accountId: string) {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: "POST",
        headers: adminAuthHeaders(),
      });

      const data = (await response.json()) as { error?: string; refreshed?: boolean; reason?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      if (!data.refreshed && data.reason) {
        setStatus({ type: "error", message: `Skipped: ${data.reason}` });
      } else {
        await persistAdminSession();
        setStatus({ type: "ok", message: "User refreshed." });
      }

      await loadAccounts();
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
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-3xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back to leaderboard
        </Link>

        <section className="animate-enter rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Control room</p>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">Admin Panel</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Manage family accounts, rotate tokens, and push fresh stats to the leaderboard.
          </p>

          <form onSubmit={addAccount} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Admin API key
              </span>
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder={sessionAuthorized ? "Already remembered on this device" : "Paste admin key"}
              />
              <p className="mt-1.5 text-xs font-semibold text-slate-500">
                {checkingSession
                  ? "Checking admin session..."
                  : sessionAuthorized
                    ? "This device is remembered. You only need the key again if you forget this device."
                    : "Needed once to unlock admin actions on this browser/device."}
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                Family nickname
              </span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="e.g. John"
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

            <label className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Remember admin access on this device for 30 days (stored as HttpOnly cookie)
            </label>

            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save account
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={refreshAll}
                className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh all stats
              </button>
            </div>

            <button
              type="button"
              disabled={loading || !sessionAuthorized}
              onClick={clearAdminSession}
              className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Forget this device
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

        <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.08)] sm:p-8">
          <h2 className="text-2xl font-black text-foreground">Accounts</h2>
          <div className="mt-4 space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-600">No accounts yet.</p>
            ) : (
              accounts.map((account) => (
                <article
                  key={account.id}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-black text-foreground">{account.nickname}</p>
                    <p className="text-sm text-slate-600">
                      @{account.wkUsername} · Lv {account.wkLevel} · Due {account.pendingReviews}
                    </p>
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                      Last sync {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(account.lastSyncedAt))} · {account.lastSyncStatus}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loading || isManualRefreshOnCooldown(account.lastSyncedAt)}
                    onClick={() => refreshOne(account.id)}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isManualRefreshOnCooldown(account.lastSyncedAt)
                      ? "Wait 1 minute"
                      : "Refresh user"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
