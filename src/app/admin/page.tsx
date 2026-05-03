"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import AdminControlRoom from "./AdminControlRoom";
import type { AdminSessionStatus, Status } from "./AdminPage.types";
import type { ViewerMenuInfo } from "../users/[nickname]/UserDashboardTabs.types";
import UserHeaderMenu from "../users/[nickname]/UserHeaderMenu";

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

  const viewerMenuInfo: ViewerMenuInfo | null = signedIn
    ? {
        provider: "google",
        name: userName?.trim() || userEmail?.split("@")[0] || "Google user",
        email: userEmail,
        wkUsername: null,
      }
    : null;

  useEffect(() => {
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
      } finally {
        setCheckingSession(false);
      }
    }

    void getAdminSessionStatus().catch(() => {
      setCheckingSession(false);
    });
  }, []);

  async function completeGoogleSignOut() {
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    window.location.href = "/signout?callbackUrl=/admin&clearAdmin=1";
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  async function refreshJlptList() {
    setJlptRefreshing(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/jlpt/refresh", {
        method: "POST",
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
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <div className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
          >
            Back to leaderboard
          </Link>
          <div className="ml-auto">
            <UserHeaderMenu viewerMenuInfo={viewerMenuInfo} />
          </div>
        </div>

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
      </main>
    </div>
  );
}
