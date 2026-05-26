"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import type { ViewerMenuInfo } from "../users/[nickname]/UserDashboardTabs.types";
import UserHeaderMenu from "../users/[nickname]/UserHeaderMenu";
import AdminCampaignManager from "./AdminCampaignManager";
import AdminChallengeSimulator from "./AdminChallengeSimulator";
import AdminControlRoom from "./AdminControlRoom";
import type { AdminSessionStatus, Status } from "./AdminPage.types";
import AdminStudyHistory from "./AdminStudyHistory";
import {
  ADMIN_WORKSPACE_COOKIE_KEY,
  ADMIN_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  type AdminWorkspaceTab,
  routeForAdminWorkspaceTab,
} from "./AdminWorkspaceTabs";

type AdminWorkspacePageProps = {
  activeTab: AdminWorkspaceTab;
};

function tabClassName(isActive: boolean): string {
  return `inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold uppercase tracking-[0.08em] transition ${
    isActive
      ? "border-accent bg-accent text-white"
      : "border-line bg-surface text-slate-700 hover:bg-surface-muted"
  }`;
}

export default function AdminWorkspacePage({ activeTab }: AdminWorkspacePageProps) {
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
    document.cookie = [
      `${ADMIN_WORKSPACE_COOKIE_KEY}=${activeTab}`,
      "Path=/admin",
      `Max-Age=${ADMIN_WORKSPACE_COOKIE_MAX_AGE_SECONDS}`,
      "SameSite=Lax",
    ].join("; ");
  }, [activeTab]);

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
        <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Admin workspace</p>
              <h1 className="mt-1 text-2xl font-black text-foreground sm:text-3xl">Manage accounts, campaigns, and logs</h1>
              <p className="mt-1 text-sm text-foreground/70">Switch tabs to focus on one admin job at a time.</p>
            </div>
            <div className="ml-auto">
              <UserHeaderMenu viewerMenuInfo={viewerMenuInfo} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={routeForAdminWorkspaceTab("operations")} className={tabClassName(activeTab === "operations")}>
              Account operations
            </Link>
            <Link href={routeForAdminWorkspaceTab("campaigns")} className={tabClassName(activeTab === "campaigns")}>
              Campaign workspace
            </Link>
            <Link href={routeForAdminWorkspaceTab("history")} className={tabClassName(activeTab === "history")}>
              Submission history
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/60">Additional admin pages</p>
            <Link
              href="/admin/users"
              className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-surface-muted"
            >
              Users
            </Link>
            <Link
              href="/admin/reading-entries"
              className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-surface px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-surface-muted"
            >
              Reading check-ins
            </Link>
          </div>
        </section>

        {activeTab === "operations" ? (
          <section id="admin-operations" className="space-y-3">
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Account operations</p>
              <p className="mt-1 text-sm text-foreground/70">Sign in, add family accounts, and run leaderboard or JLPT refresh actions.</p>
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
          </section>
        ) : null}

        {activeTab === "campaigns" ? (
          <section className="space-y-3">
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Campaign workspace</p>
              <p className="mt-1 text-sm text-foreground/70">Edit campaign rules and run payout simulations.</p>
            </div>
            <AdminCampaignManager sessionAuthorized={sessionAuthorized} checkingSession={checkingSession} />
            <AdminChallengeSimulator />
          </section>
        ) : null}

        {activeTab === "history" ? (
          <section id="admin-history" className="space-y-3">
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Submission history</p>
              <p className="mt-1 text-sm text-foreground/70">Review, edit, or remove study submissions in one place.</p>
            </div>
            <AdminStudyHistory sessionAuthorized={sessionAuthorized} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
