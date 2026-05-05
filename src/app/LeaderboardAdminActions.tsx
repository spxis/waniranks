"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LeaderboardAdminActions() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  async function refreshLeaderboard() {
    setRefreshing(true);

    try {
      const response = await fetch("/api/leaderboard/refresh", { method: "POST" });
      if (!response.ok) {
        throw new Error("Refresh failed.");
      }

      router.refresh();
    } catch {
      // Keep UI stable and avoid noisy errors in header actions.
    } finally {
      setRefreshing(false);
    }
  }

  if (checking || !authorized) {
    return null;
  }

  return (
    <div className="inline-flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => {
          refreshLeaderboard().catch(() => {
            // Handled in refreshLeaderboard.
          });
        }}
        disabled={refreshing}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface px-5 text-xs font-bold uppercase tracking-[0.12em] text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}
