"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAdminFeedback } from "@/app/admin/AdminFeedbackProvider";
import AdminPanelHeader from "@/app/admin/AdminPanelHeader";
import { getTodayDateInputValue } from "@/lib/readingSignoff";
import AdminPaginationControls from "@/app/admin/AdminPaginationControls";
import AdminReadingEntriesTable from "./AdminReadingEntriesTable";
import AdminTrackedPlayersManager from "./AdminTrackedPlayersManager";
import type { AdminReadingEntry, EntryEditDraft, ReadingEntriesResponse } from "./AdminReadingEntries.types";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}

function toDateTimeLocalInputValue(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDateTimeLocalInputValue(input: string): string | null {
  if (input.trim().length === 0) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

type AdminReadingEntriesClientProps = {
  embedded?: boolean;
  sessionAuthorized?: boolean;
  checkingSession?: boolean;
};

type TrackedMembersResponse = {
  trackedMemberAccountIds?: string[];
  error?: string;
};

export default function AdminReadingEntriesClient({
  embedded = false,
  sessionAuthorized: sessionAuthorizedProp,
  checkingSession: checkingSessionProp,
}: AdminReadingEntriesClientProps) {
  const { confirmAction, showToast } = useAdminFeedback();
  const hasSessionProps = typeof sessionAuthorizedProp === "boolean" && typeof checkingSessionProp === "boolean";
  const sessionAuthorized = hasSessionProps ? sessionAuthorizedProp : false;
  const checkingSession = hasSessionProps ? checkingSessionProp : true;

  const [monthFilter, setMonthFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"entry" | "daily">("entry");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReadingEntriesResponse | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryEditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingUpdatingAccountId, setTrackingUpdatingAccountId] = useState<string | null>(null);
  const [trackedMemberIds, setTrackedMemberIds] = useState<string[]>([]);

  const entries = data?.entries ?? [];
  const members = data?.members ?? [];
  const trackedMemberSet = useMemo(() => new Set(trackedMemberIds), [trackedMemberIds]);
  const pagination = data?.pagination ?? { page, pageSize, pageCount: 1, total: 0 };
  const localTimezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const trackingMonthKey = useMemo(() => (monthFilter.trim().length > 0 ? monthFilter.trim() : getTodayDateInputValue().slice(0, 7)), [monthFilter]);

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

    params.set("source", sourceFilter);

    return params.toString();
  }, [accountFilter, monthFilter, page, pageSize, sourceFilter]);

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
        throw new Error(getErrorMessage(payload, "Could not load check-ins."));
      }

      setData(payload);
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load check-ins." });
    } finally {
      setLoading(false);
    }
  }, [queryString, sessionAuthorized, showToast]);

  const loadTrackedMembers = useCallback(async () => {
    if (!sessionAuthorized) {
      setTrackedMemberIds([]);
      return;
    }

    setTrackingLoading(true);
    try {
      const response = await fetch(
        `/api/reading-signoffs?month=${encodeURIComponent(trackingMonthKey)}`,
        { cache: "no-store" },
      );

      const payload = (await response.json()) as TrackedMembersResponse;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not load tracked players."));
      }

      setTrackedMemberIds(payload.trackedMemberAccountIds ?? []);
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not load tracked players." });
    } finally {
      setTrackingLoading(false);
    }
  }, [sessionAuthorized, showToast, trackingMonthKey]);

  useEffect(() => {
    if (checkingSession || !sessionAuthorized) {
      return;
    }

    void Promise.all([loadEntries(), loadTrackedMembers()]);
  }, [checkingSession, loadEntries, loadTrackedMembers, sessionAuthorized]);

  async function toggleTrackedMember(memberId: string, tracked: boolean) {
    setTrackingUpdatingAccountId(memberId);

    try {
      const response = await fetch("/api/reading-signoffs", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: memberId,
          tracked,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not update tracked players."));
      }

      setTrackedMemberIds((prev) => {
        const next = new Set(prev);
        if (tracked) {
          next.add(memberId);
        } else {
          next.delete(memberId);
        }
        return Array.from(next);
      });

      showToast({
        tone: "success",
        message: tracked ? "Player added to tracked roster." : "Player removed from tracked roster.",
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update tracked players.",
      });
    } finally {
      setTrackingUpdatingAccountId(null);
    }
  }

  function beginEdit(entry: AdminReadingEntry) {
    setEditingEntryId(entry.id);
    setDraft({
      source: entry.source,
      signoffDatePst: entry.signoffDatePst,
      submittedAtLocal: toDateTimeLocalInputValue(entry.createdAt),
      bookTitle: entry.bookTitle,
      pagesRead: entry.pagesRead,
      minutesRead: entry.minutesRead,
      didWanikaniReviews: entry.didWanikaniReviews,
      reviewsLeft: entry.reviewsLeft,
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

    try {
      const submittedAt = draft.source === "entry"
        ? fromDateTimeLocalInputValue(draft.submittedAtLocal)
        : null;

      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(editingEntryId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signoffDatePst: draft.signoffDatePst,
          submittedAt: submittedAt ?? undefined,
          bookTitle: draft.bookTitle,
          pagesRead: draft.pagesRead,
          minutesRead: draft.minutesRead,
          didWanikaniReviews: draft.didWanikaniReviews,
          reviewsLeft: draft.reviewsLeft,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not update check-in."));
      }

      showToast({ tone: "success", message: "Check-in updated." });
      cancelEdit();
      await loadEntries();
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not update check-in." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: AdminReadingEntry) {
    const confirmed = await confirmAction({
      title: "Delete check-in",
      description: `Delete this check-in for ${entry.nickname} on ${entry.signoffDatePst}?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/reading-signoff-entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Could not delete check-in."));
      }

      showToast({ tone: "success", message: "Check-in deleted." });

      if (entries.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await loadEntries();
      }

      if (editingEntryId === entry.id) {
        cancelEdit();
      }
    } catch (error) {
      showToast({ tone: "error", message: error instanceof Error ? error.message : "Could not delete check-in." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <AdminPanelHeader
        label="Reading check-ins"
        title={embedded ? "Manage reading check-ins" : "All reading check-ins"}
        description="Browse daily reading check-ins across all members and correct incorrect submissions."
      />

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

      {sessionAuthorized ? (
        <>
          <AdminTrackedPlayersManager
            members={members}
            trackedMemberSet={trackedMemberSet}
            trackingLoading={trackingLoading}
            loading={loading}
            saving={saving}
            trackingUpdatingAccountId={trackingUpdatingAccountId}
            onRefreshRoster={() => {
              void loadTrackedMembers();
            }}
            onToggleTrackedMember={(memberId, tracked) => {
              void toggleTrackedMember(memberId, tracked);
            }}
          />

          <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-6">
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
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">View</span>
                  <select
                    className="h-10 rounded-lg border border-line bg-surface px-3 text-sm"
                    value={sourceFilter}
                    onChange={(event) => {
                      setSourceFilter(event.target.value as "entry" | "daily");
                      setPage(1);
                    }}
                  >
                    <option value="entry">Individual logs</option>
                    <option value="daily">Daily totals</option>
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
                      setSourceFilter("entry");
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

          <p className="mt-2 text-xs text-foreground/65">
            Times use your local timezone ({localTimezoneLabel}) and are stored in UTC.
          </p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-foreground/75">
                <span>
                  Total check-ins: <strong className="text-foreground">{pagination.total}</strong>
                </span>
                <span>
                  Page: <strong className="text-foreground">{pagination.page}</strong> / {pagination.pageCount}
                </span>
              </div>

              <AdminReadingEntriesTable
                entries={entries}
                editingEntryId={editingEntryId}
                draft={draft}
                loading={loading}
                saving={saving}
                localTimezoneLabel={localTimezoneLabel}
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

              <AdminPaginationControls
                page={pagination.page}
                pageCount={pagination.pageCount}
                itemLabel="check-ins"
                total={pagination.total}
                onFirst={() => setPage(1)}
                onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
                onNext={() => setPage((prev) => Math.min(pagination.pageCount, prev + 1))}
                onLast={() => setPage(pagination.pageCount)}
                onPageChange={(nextPage) => setPage(nextPage)}
                disabled={loading || saving}
              />
        </>
      ) : null}
    </section>
  );
}
