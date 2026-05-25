"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { AdminSessionStatus, Status } from "@/app/admin/AdminPage.types";
import type { ViewerMenuInfo } from "@/app/users/[nickname]/UserDashboardTabs.types";
import UserHeaderMenu from "@/app/users/[nickname]/UserHeaderMenu";

import AdminReadingEntriesTable from "./AdminReadingEntriesTable";
import type {
  AdminReadingEntry,
  EntryEditDraft,
  ReadingEntriesResponse,
} from "./AdminReadingEntries.types";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

export default function AdminReadingEntriesClient() {
  const [sessionAuthorized, setSessionAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });

  const [monthFilter, setMonthFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReadingEntriesResponse | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryEditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const viewerMenuInfo: ViewerMenuInfo | null = viewerEmail
    ? {
        provider: "google",
        name: viewerEmail.split("@")[0] || "Google user",
        email: viewerEmail,
        wkUsername: null,
      }
    : null;

  const entries = data?.entries ?? [];
  const members = data?.members ?? [];
  const pagination = data?.pagination ?? { page, pageSize, pageCount: 1, total: 0 };

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    if (monthFilter.trim().length > 0) {
      params.set("month", monthFilter.trim());
    }

    if (accountFilter !== "all") {
      params.set("accountId", accountFilter);
    }

    return params.toString();
  }, [accountFilter, monthFilter, page, pageSize]);

  const loadEntries = useCallback(async () => {
    if (!sessionAuthorized) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/reading-signoff-entries?${queryString}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as ReadingEntriesResponse;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not load reading entries."));
      }

      setData(payload);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not load reading entries.",
      });
    } finally {
      setLoading(false);
    }
  }, [queryString, sessionAuthorized]);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const payload = (await response.json()) as AdminSessionStatus;

        setSessionAuthorized(Boolean(payload.authorized));
        setViewerEmail(payload.user?.email?.trim().toLowerCase() ?? null);
      } finally {
        setCheckingSession(false);
      }
    }

    void loadSession().catch(() => {
      setCheckingSession(false);
    });
  }, []);

  useEffect(() => {
    if (!sessionAuthorized) {
      return;
    }

    void loadEntries();
  }, [loadEntries, sessionAuthorized]);

  function beginEdit(entry: AdminReadingEntry) {
    setStatus({ type: "idle", message: "" });
    setEditingEntryId(entry.id);
    setDraft({
      signoffDatePst: entry.signoffDatePst,
      bookTitle: entry.bookTitle,
      pagesRead: entry.pagesRead,
      minutesRead: entry.minutesRead,
      didWanikaniReviews: entry.didWanikaniReviews,
    });
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setDraft(null);
  }

  async function saveEdit() {
    if (!editingEntryId || !draft) {
      return;
    }

    setSaving(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(editingEntryId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signoffDatePst: draft.signoffDatePst,
          bookTitle: draft.bookTitle,
          pagesRead: draft.pagesRead,
          minutesRead: draft.minutesRead,
          didWanikaniReviews: draft.didWanikaniReviews,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not update entry."));
      }

      setStatus({ type: "ok", message: "Entry updated." });
      cancelEdit();
      await loadEntries();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not update entry.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: AdminReadingEntry) {
    const confirmed = window.confirm(`Delete this entry for ${entry.nickname} on ${entry.signoffDatePst}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not delete entry."));
      }

      setStatus({ type: "ok", message: "Entry deleted." });

      if (entries.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await loadEntries();
      }

      if (editingEntryId === entry.id) {
        cancelEdit();
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not delete entry.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-7xl space-y-5">
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

        <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Reading check-in entries</h1>
          <p className="mt-2 text-sm text-foreground/75">
            Browse all reading entries, edit any row, or delete incorrect submissions.
          </p>

          {checkingSession ? (
            <p className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">
              Checking admin session...
            </p>
          ) : null}

          {!checkingSession && !sessionAuthorized ? (
            <p className="mt-4 rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">
              Admin tools are hidden. Sign in with an allowlisted Google account.
            </p>
          ) : null}

          {status.message ? (
            <p
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
                status.type === "error"
                  ? "border border-red-200 bg-red-50 text-red-800"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {status.message}
            </p>
          ) : null}

          {sessionAuthorized ? (
            <>
              <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-5">
                <label className="flex flex-col gap-1 lg:col-span-1">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Month</span>
                  <input
                    type="month"
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                    value={monthFilter}
                    onChange={(event) => {
                      setMonthFilter(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>

                <label className="flex flex-col gap-1 lg:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Member</span>
                  <select
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                    value={accountFilter}
                    onChange={(event) => {
                      setAccountFilter(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">All members</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nickname} ({member.wkUsername})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 lg:col-span-1">
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Page size</span>
                  <select
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </label>

                <div className="flex items-end gap-2 lg:col-span-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMonthFilter("");
                      setAccountFilter("all");
                      setPage(1);
                    }}
                    className="h-10 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
                    disabled={loading || saving}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void loadEntries();
                    }}
                    className="h-10 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
                    disabled={loading || saving}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-foreground/75">
                <span>
                  Total entries: <strong className="text-foreground">{pagination.total}</strong>
                </span>
                <span>
                  Page: <strong className="text-foreground">{pagination.page}</strong> / {pagination.pageCount}
                </span>
              </div>

              {loading ? <p className="mt-4 text-sm text-foreground/70">Loading...</p> : null}

              <AdminReadingEntriesTable
                entries={entries}
                editingEntryId={editingEntryId}
                draft={draft}
                loading={loading}
                saving={saving}
                onDraftChange={setDraft}
                onBeginEdit={beginEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => {
                  void saveEdit();
                }}
                onDeleteEntry={(entry) => {
                  void deleteEntry(entry);
                }}
              />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading || saving}
                  className="h-9 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}
                  disabled={page >= pagination.pageCount || loading || saving}
                  className="h-9 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}
