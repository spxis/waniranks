"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminAccountsSection, { type AdminAccount } from "./AdminAccountsSection";
import AdminStatusBadge from "./AdminStatusBadge";

type Status = {
  type: "idle" | "ok" | "error";
  message: string;
};
type AdminSessionStatus = {
  authorized?: boolean;
  googleConfigured?: boolean;
  signedIn?: boolean;
  emailAllowed?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export default function AdminPage() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [sessionAuthorized, setSessionAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [emailAllowed, setEmailAllowed] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [jlptRefreshing, setJlptRefreshing] = useState(false);
  const [jlptEnriching, setJlptEnriching] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);

  async function getAdminSessionStatus() {
    try {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as AdminSessionStatus;
      setSessionAuthorized(Boolean(data.authorized));
      setGoogleConfigured(Boolean(data.googleConfigured));
      setSignedIn(Boolean(data.signedIn));
      setEmailAllowed(Boolean(data.emailAllowed));
      setUserName(data.user?.name ?? null);
      setUserEmail(data.user?.email ?? null);

      if (data.authorized) {
        await loadAccounts();
      } else {
        setAccounts([]);
      }
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
      setSignedIn(false);
      setEmailAllowed(false);
      setUserName(null);
      setUserEmail(null);
      setAccounts([]);
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
    const response = await fetch("/api/accounts", {
      cache: "no-store",
      headers: adminAuthHeaders(),
    });
    const data = (await response.json()) as { accounts?: AdminAccount[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load account list.");
    }
    setAccounts(data.accounts ?? []);
  }

  useEffect(() => {
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

  async function refreshJlptList() {
    setJlptRefreshing(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/jlpt/refresh", {
        method: "POST",
        headers: adminAuthHeaders(),
      });

      const data = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) {
        throw new Error(data.error ?? "JLPT list refresh failed.");
      }

      await persistAdminSession();
      setStatus({
        type: "ok",
        message: `JLPT list refreshed (${data.count ?? 0} records).`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "JLPT list refresh failed.",
      });
    } finally {
      setJlptRefreshing(false);
    }
  }

  async function enrichJlptKanji() {
    setJlptEnriching(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/jlpt/enrich", {
        method: "POST",
        headers: adminAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ limit: 250, onlyMissing: true }),
      });

      const data = (await response.json()) as {
        error?: string;
        processed?: number;
        updated?: number;
        failed?: number;
        remaining?: number;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "JLPT enrichment failed.");
      }

      await persistAdminSession();
      setStatus({
        type: "ok",
        message: `JLPT enriched chunk processed=${data.processed ?? 0}, updated=${data.updated ?? 0}, failed=${data.failed ?? 0}, remaining=${data.remaining ?? 0}.`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "JLPT enrichment failed.",
      });
    } finally {
      setJlptEnriching(false);
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
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl leading-[0.95] text-foreground sm:text-5xl">Admin Panel</h1>
            <AdminStatusBadge
              checkingSession={checkingSession}
              sessionAuthorized={sessionAuthorized}
              signedIn={signedIn}
              emailAllowed={emailAllowed}
            />
          </div>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Manage family accounts, rotate tokens, and push fresh stats to the leaderboard.
          </p>

          {googleConfigured ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/api/auth/signin/google?callbackUrl=/admin"
                className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
              >
                Sign in with Google
              </Link>
              <Link
                href="/api/auth/signout?callbackUrl=/admin"
                className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
              >
                Sign out Google
              </Link>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold">{signedIn ? `Signed in: ${userName ?? "Google user"}` : "Not signed in"}</p>
            <p className="mt-1 text-xs">{userEmail ?? "No Google account in session."}</p>
            {!checkingSession && signedIn && !emailAllowed ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                This Google account is not on admin allowlist.
              </p>
            ) : null}
          </div>

          {sessionAuthorized ? (
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
                    ? "Admin unlocked by Google sign-in or remembered device cookie."
                    : "Use Google sign-in (recommended) or API key once to unlock this browser/device."}
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

            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <button
                type="button"
                disabled={loading || jlptRefreshing || jlptEnriching}
                onClick={refreshJlptList}
                className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {jlptRefreshing ? "Refreshing JLPT..." : "Refresh JLPT List"}
              </button>
              <button
                type="button"
                disabled={loading || jlptRefreshing || jlptEnriching}
                onClick={enrichJlptKanji}
                className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {jlptEnriching ? "Enriching JLPT..." : "Enrich JLPT Data"}
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
          ) : (
            <div className="mt-7 rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">
              Admin tools hidden. Sign in with allowlisted Google account, or use admin API key.
            </div>
          )}

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

        <AdminAccountsSection
          sessionAuthorized={sessionAuthorized}
          accounts={accounts}
          loading={loading}
          onRefreshOne={refreshOne}
        />
      </main>
    </div>
  );
}
