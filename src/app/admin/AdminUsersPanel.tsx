"use client";

import { useEffect, useState } from "react";

import { useAdminFeedback } from "./AdminFeedbackProvider";
import AdminAccountsSection, { type AdminAccount } from "./AdminAccountsSection";

type AdminUsersPanelProps = {
  sessionAuthorized: boolean;
  checkingSession: boolean;
  viewerEmail: string | null;
};

export default function AdminUsersPanel({
  sessionAuthorized,
  checkingSession,
  viewerEmail,
}: AdminUsersPanelProps) {
  const { showToast } = useAdminFeedback();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [generatedInviteCodesByAccountId, setGeneratedInviteCodesByAccountId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    if (checkingSession) {
      return;
    }

    if (!sessionAuthorized) {
      setAccounts([]);
      return;
    }

    void loadAccounts().catch(() => {
      showToast({ tone: "error", message: "Could not load account list." });
    });
  }, [checkingSession, sessionAuthorized, showToast]);

  async function refreshOne(accountId: string) {
    setLoading(true);

    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; refreshed?: boolean; reason?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      if (!data.refreshed && data.reason) {
        showToast({ tone: "error", message: `Skipped: ${data.reason}` });
      } else {
        showToast({ tone: "success", message: "User refreshed." });
      }

      await loadAccounts();
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not refresh user." });
    } finally {
      setLoading(false);
    }
  }

  async function assignInviteCode(accountId: string): Promise<string | null> {
    setLoading(true);

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
      showToast({
        tone: "success",
        message: data.inviteCode
          ? `Invite code generated: ${data.inviteCode} (copied if permitted).`
          : "Invite code generated.",
      });

      return data.inviteCode ?? null;
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not assign invite code." });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function resetInviteCode(accountId: string) {
    setLoading(true);

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
      showToast({ tone: "success", message: "Invite code reset." });
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not reset invite code." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {checkingSession ? (
        <p className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">Checking admin session...</p>
      ) : null}

      {!checkingSession && !sessionAuthorized ? (
        <p className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">
          Admin tools are hidden. Sign in with an allowlisted Google account.
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
    </>
  );
}
