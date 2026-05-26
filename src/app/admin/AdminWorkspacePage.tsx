"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import type { ViewerMenuInfo } from "../users/[nickname]/UserDashboardTabs.types";
import UserHeaderMenu from "../users/[nickname]/UserHeaderMenu";
import AdminCampaignManager from "./AdminCampaignManager";
import AdminControlRoom from "./AdminControlRoom";
import type { CampaignRecord } from "./AdminCampaignManager.types";
import AdminFeedbackProvider, { useAdminFeedback } from "./AdminFeedbackProvider";
import type { AdminSessionStatus } from "./AdminPage.types";
import AdminStudyHistory from "./AdminStudyHistory";
import AdminUsersPanel from "./AdminUsersPanel";
import AdminReadingEntriesClient from "./reading-entries/AdminReadingEntriesClient";
import {
  ADMIN_WORKSPACE_COOKIE_KEY,
  ADMIN_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  type AdminWorkspaceTab,
  routeForAdminWorkspaceTab,
} from "./AdminWorkspaceTabs";

type AdminWorkspacePageProps = {
  activeTab: AdminWorkspaceTab;
  initialSession?: AdminSessionStatus;
  initialCampaigns?: CampaignRecord[];
};

function tabClassName(isActive: boolean): string {
  return `inline-flex h-10 items-center justify-center rounded-full border px-4 text-xs font-bold uppercase tracking-[0.08em] transition ${
    isActive
      ? "border-accent bg-accent text-white"
      : "border-line bg-surface text-slate-700 hover:bg-surface-muted"
  }`;
}

export default function AdminWorkspacePage({
  activeTab,
  initialSession,
  initialCampaigns = [],
}: AdminWorkspacePageProps) {
  return (
    <AdminFeedbackProvider>
      <AdminWorkspacePageContent
        activeTab={activeTab}
        initialSession={initialSession}
        initialCampaigns={initialCampaigns}
      />
    </AdminFeedbackProvider>
  );
}

function AdminWorkspacePageContent({
  activeTab,
  initialSession,
  initialCampaigns = [],
}: AdminWorkspacePageProps) {
  const { showToast } = useAdminFeedback();
  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState("");
  const hasInitialSession = Boolean(initialSession);
  const [sessionAuthorized, setSessionAuthorized] = useState(Boolean(initialSession?.authorized));
  const [checkingSession, setCheckingSession] = useState(!hasInitialSession);
  const [googleConfigured, setGoogleConfigured] = useState(Boolean(initialSession?.googleConfigured));
  const [signedIn, setSignedIn] = useState(Boolean(initialSession?.signedIn));
  const [emailAllowed, setEmailAllowed] = useState(Boolean(initialSession?.emailAllowed));
  const [userName, setUserName] = useState<string | null>(initialSession?.user?.name ?? null);
  const [userEmail, setUserEmail] = useState<string | null>(initialSession?.user?.email ?? null);
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
        if (!hasInitialSession) {
          setCheckingSession(false);
        }
      }
    }

    void getAdminSessionStatus().catch(() => {
      if (!hasInitialSession) {
        setCheckingSession(false);
      }
    });
  }, [hasInitialSession]);

  async function completeGoogleSignOut() {
    setLoading(true);
    window.location.href = "/signout?callbackUrl=/admin&clearAdmin=1";
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

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
      showToast({ tone: "success", message: "Account saved." });
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not save account." });
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    setLoading(true);

    try {
      const response = await fetch("/api/leaderboard/refresh", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Refresh failed.");
      }

      showToast({ tone: "success", message: "Leaderboard refreshed." });
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not refresh leaderboard." });
    } finally {
      setLoading(false);
    }
  }

  async function refreshJlptList() {
    setJlptRefreshing(true);

    try {
      const response = await fetch("/api/jlpt/refresh", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; count?: number };
      if (!response.ok) {
        throw new Error(data.error ?? "JLPT list refresh failed.");
      }

      showToast({ tone: "success", message: `JLPT list refreshed (${data.count ?? 0} records).` });
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not refresh JLPT list." });
    } finally {
      setJlptRefreshing(false);
    }
  }

  async function enrichJlptKanji() {
    setJlptEnriching(true);

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

      showToast({
        tone: "success",
        message: `JLPT enriched chunk processed=${data.processed ?? 0}, updated=${data.updated ?? 0}, failed=${data.failed ?? 0}, remaining=${data.remaining ?? 0}.`,
      });
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not enrich JLPT data." });
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
            <Link href={routeForAdminWorkspaceTab("users")} className={tabClassName(activeTab === "users")}>
              Users
            </Link>
            <Link href={routeForAdminWorkspaceTab("readingEntries")} className={tabClassName(activeTab === "readingEntries")}>
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
            <AdminCampaignManager
              sessionAuthorized={sessionAuthorized}
              checkingSession={checkingSession}
              initialCampaigns={initialCampaigns}
            />
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

        {activeTab === "users" ? (
          <section id="admin-users" className="space-y-3">
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Users</p>
              <p className="mt-1 text-sm text-foreground/70">Manage accounts, refreshes, invite codes, and user history.</p>
            </div>
            <AdminUsersPanel
              sessionAuthorized={sessionAuthorized}
              checkingSession={checkingSession}
              viewerEmail={userEmail}
            />
          </section>
        ) : null}

        {activeTab === "readingEntries" ? (
          <section id="admin-reading-entries" className="space-y-3">
            <div className="rounded-xl border border-line bg-surface/70 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Reading check-ins</p>
              <p className="mt-1 text-sm text-foreground/70">Browse and edit reading submissions across all members.</p>
            </div>
            <AdminReadingEntriesClient
              embedded
              sessionAuthorized={sessionAuthorized}
              checkingSession={checkingSession}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
