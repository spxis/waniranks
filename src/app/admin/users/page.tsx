"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import AdminAccountsSection, { type AdminAccount } from "../AdminAccountsSection";
import type { AdminSessionStatus, Status } from "../AdminPage.types";
import type { ViewerMenuInfo } from "../../users/[nickname]/UserDashboardTabs.types";
import UserHeaderMenu from "../../users/[nickname]/UserHeaderMenu";

export default function AdminUsersPage() {
  const [sessionAuthorized, setSessionAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [generatedInviteCodesByAccountId, setGeneratedInviteCodesByAccountId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  const viewerMenuInfo: ViewerMenuInfo | null = viewerEmail
    ? {
        provider: "google",
        name: viewerEmail.split("@")[0] || "Google user",
        email: viewerEmail,
        wkUsername: null,
      }
    : null;

  async function loadAccounts() {
    const response = await fetch("/api/accounts", {
      cache: "no-store",
    });
    const data = (await response.json()) as { accounts?: AdminAccount[]; error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Could not load account list.");
    }
    setAccounts(data.accounts ?? []);
  }

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as AdminSessionStatus;
        const authorized = Boolean(data.authorized);
        setSessionAuthorized(authorized);
        setViewerEmail(data.user?.email?.trim().toLowerCase() ?? null);

        if (authorized) {
          await loadAccounts();
        } else {
          setAccounts([]);
        }
      } finally {
        setCheckingSession(false);
      }
    }

    void loadSession().catch(() => {
      setCheckingSession(false);
    });
  }, []);

  async function refreshOne(accountId: string) {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: "POST",
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

  async function assignInviteCode(accountId: string): Promise<string | null> {
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/accounts/${accountId}/invite-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as { error?: string; inviteCode?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not assign invite code.");
      }

      await loadAccounts();
      if (data.inviteCode) {
        setGeneratedInviteCodesByAccountId((prev) => ({ ...prev, [accountId]: data.inviteCode! }));
      }
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
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not reset invite code.");
      }

      await loadAccounts();
      setGeneratedInviteCodesByAccountId((prev) => {
        if (!(accountId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[accountId];
        return next;
      });
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
    <div className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
          >
            Back to admin
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
          >
            Leaderboard
          </Link>
          <div className="ml-auto">
            <UserHeaderMenu viewerMenuInfo={viewerMenuInfo} />
          </div>
        </div>

        {checkingSession ? (
          <p className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">Checking admin session...</p>
        ) : null}

        {status.message ? (
          <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${status.type === "error" ? "border border-red-200 bg-red-50 text-red-800" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {status.message}
          </p>
        ) : null}

        <AdminAccountsSection
          sessionAuthorized={sessionAuthorized}
          accounts={accounts}
          loading={loading}
          viewerEmail={viewerEmail}
          generatedInviteCodesByAccountId={generatedInviteCodesByAccountId}
          onRefreshOne={refreshOne}
          onAssignInviteCode={assignInviteCode}
          onResetInviteCode={resetInviteCode}
        />
      </main>
    </div>
  );
}
