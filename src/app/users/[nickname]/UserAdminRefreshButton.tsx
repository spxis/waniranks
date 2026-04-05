"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  accountId: string;
};

export default function UserAdminRefreshButton({ accountId }: Props) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as { authorized?: boolean };
        setAuthorized(Boolean(data.authorized));
      } catch {
        setAuthorized(false);
      } finally {
        setChecking(false);
      }
    }

    checkSession().catch(() => {
      setAuthorized(false);
      setChecking(false);
    });
  }, []);

  async function refreshUser() {
    setRefreshing(true);
    setMessage("");

    try {
      const response = await fetch(`/api/accounts/${accountId}/refresh`, {
        method: "POST",
      });

      const data = (await response.json()) as { refreshed?: boolean; reason?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      if (!data.refreshed && data.reason) {
        setMessage(`Skipped: ${data.reason}`);
      } else {
        setMessage("Refreshed.");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (checking || !authorized) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          refreshUser().catch(() => {
            // Handled in refreshUser.
          });
        }}
        disabled={refreshing}
        className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing..." : "Refresh user"}
      </button>
      {message ? <p className="text-xs font-semibold text-slate-600">{message}</p> : null}
    </div>
  );
}
