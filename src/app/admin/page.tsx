"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AdminAccountsSection, { type AdminAccount } from "./AdminAccountsSection";
import AdminControlRoom from "./AdminControlRoom";
import type { AdminSessionStatus, Status } from "./AdminPage.types";

export default function AdminPage() {
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
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

  async function completeGoogleSignOut() {
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    window.location.href = "/signout?callbackUrl=/admin&clearAdmin=1";
  }

  function adminAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return extraHeaders;
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

  async function assignInviteCode(accountId: string): Promise<string | null> {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/accounts/${accountId}/invite-code`, {
        method: "POST",
        headers: adminAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as { error?: string; inviteCode?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not assign invite code.");
      }

      await loadAccounts();
      setStatus({
        type: "ok",
        message: data.inviteCode
          ? `Invite code generated: ${data.inviteCode} (copied if permitted).`
          : "Invite code generated.",
      });

      return data.inviteCode ?? null;
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not assign invite code.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function resetInviteCode(accountId: string) {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/accounts/${accountId}/invite-code`, {
        method: "DELETE",
        headers: adminAuthHeaders(),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not reset invite code.");
      }

      await loadAccounts();
      setStatus({ type: "ok", message: "Invite code reset." });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not reset invite code.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back to leaderboard
        </Link>

        <AdminControlRoom
          nickname={nickname}
          token={token}
          sessionAuthorized={sessionAuthorized}
          checkingSession={checkingSession}
          googleConfigured={googleConfigured}
          signedIn={signedIn}
          emailAllowed={emailAllowed}
          userName={userName}
          userEmail={userEmail}
          status={status}
          loading={loading}
          jlptRefreshing={jlptRefreshing}
          jlptEnriching={jlptEnriching}
          onSetNickname={setNickname}
          onSetToken={setToken}
          onAddAccount={addAccount}
          onCompleteGoogleSignOut={() => {
            void completeGoogleSignOut();
          }}
          onRefreshAll={() => {
            void refreshAll();
          }}
          onRefreshJlptList={() => {
            void refreshJlptList();
          }}
          onEnrichJlptKanji={() => {
            void enrichJlptKanji();
          }}
        />

        <AdminAccountsSection
          sessionAuthorized={sessionAuthorized}
          accounts={accounts}
          loading={loading}
          onRefreshOne={refreshOne}
          onAssignInviteCode={assignInviteCode}
          onResetInviteCode={resetInviteCode}
        />

      </main>
    </div>
  );
}
