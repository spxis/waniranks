"use client";

import { useCallback, useEffect, useState } from "react";

import { getStoredPositiveInt, setLocalStorageItem } from "@/lib/clientStorage";
import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";

import AdminPaginationControls from "./AdminPaginationControls";

type Attempt = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: "correct" | "wrong" | "skipped";
  submittedAt: string;
};

type HistoryData = {
  attempts: Attempt[];
  totals: Record<string, number>;
  accountCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

const HISTORY_PAGE_STORAGE_KEY = "admin-study-history:page";
const HISTORY_PAGE_SIZE_STORAGE_KEY = "admin-study-history:page-size";
const HISTORY_PAGE_SIZE_OPTIONS = [20, 30, 50] as const;

function toLocalDateTimeInput(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function AdminStudyHistory({ sessionAuthorized }: { sessionAuthorized: boolean }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [paginationReady, setPaginationReady] = useState(false);

  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<"correct" | "wrong" | "skipped">("correct");
  const [editSubmittedAt, setEditSubmittedAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/study-history?lite=1&page=${page}&pageSize=${pageSize}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load study history.");
      }

      const payload = (await response.json()) as HistoryData;
      setData(payload);

      if (payload.pagination.page !== page) {
        setPage(payload.pagination.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    if (!sessionAuthorized) {
      setPaginationReady(true);
      return;
    }

    const storedPage = getStoredPositiveInt(HISTORY_PAGE_STORAGE_KEY);
    if (storedPage !== null) {
      setPage(storedPage);
    }

    const storedPageSize = getStoredPositiveInt(HISTORY_PAGE_SIZE_STORAGE_KEY);
    if (
      storedPageSize !== null &&
      HISTORY_PAGE_SIZE_OPTIONS.includes(storedPageSize as (typeof HISTORY_PAGE_SIZE_OPTIONS)[number])
    ) {
      setPageSize(storedPageSize);
    }

    setPaginationReady(true);
  }, [sessionAuthorized]);

  useEffect(() => {
    if (!paginationReady) {
      return;
    }

    setLocalStorageItem(HISTORY_PAGE_STORAGE_KEY, String(page));
    setLocalStorageItem(HISTORY_PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [page, pageSize, paginationReady]);

  useEffect(() => {
    if (!sessionAuthorized || !paginationReady) {
      return;
    }

    void load();
  }, [load, paginationReady, sessionAuthorized]);

  async function saveAttempt() {
    if (!editingAttemptId) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatus("");

    try {
      const response = await fetch(`/api/admin/study-history/${encodeURIComponent(editingAttemptId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          result: editResult,
          submittedAt: new Date(editSubmittedAt).toISOString(),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update study attempt.");
      }

      setStatus("Study attempt updated.");
      setEditingAttemptId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update study attempt.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAttempt(attempt: Attempt) {
    const confirmed = window.confirm(`Delete this study attempt for ${attempt.nickname}?`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatus("");

    try {
      const response = await fetch(`/api/admin/study-history/${encodeURIComponent(attempt.id)}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete study attempt.");
      }

      if (editingAttemptId === attempt.id) {
        setEditingAttemptId(null);
      }

      setStatus("Study attempt deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete study attempt.");
    } finally {
      setSaving(false);
    }
  }

  if (!sessionAuthorized) {
    return null;
  }

  const resultColor: Record<string, string> = {
    correct: "text-emerald-600",
    wrong: "text-red-500",
    skipped: "text-amber-500",
  };

  const typeColor: Record<string, string> = {
    radical: "border border-sky-200 bg-sky-50 text-sky-700",
    kanji: "border border-pink-200 bg-pink-50 text-pink-700",
    vocabulary: "border border-violet-200 bg-violet-50 text-violet-700",
  };

  const totals = data?.totals ?? {};
  const totalAttempts = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const pageCount = data?.pagination.totalPages ?? 1;
  const hasNext = data?.pagination.hasNext ?? false;

  return (
    <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Study submission history</h2>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-foreground/70">Use smaller pages for faster loading and cleaner edits.</p>
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground/75">
            Page size
            <select
              value={pageSize}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
              className="h-8 rounded border border-line bg-surface px-2"
              disabled={loading || saving}
            >
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {status ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {status}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Total: <strong>{totalAttempts}</strong>
          </span>
          <span>
            Correct: <strong className="text-emerald-600">{totals.correct ?? 0}</strong>
          </span>
          <span>
            Wrong: <strong className="text-red-500">{totals.wrong ?? 0}</strong>
          </span>
          {(totals.skipped ?? 0) > 0 ? (
            <span>
              Skipped: <strong className="text-amber-500">{totals.skipped}</strong>
            </span>
          ) : null}
          <span>
            Accounts: <strong>{data?.accountCount ?? 0}</strong>
          </span>
        </div>

        <div className="relative min-h-96 max-h-128 overflow-auto rounded-xl border border-line">
          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end bg-white/45 p-3">
              <p className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-foreground/75">
                Loading...
              </p>
            </div>
          ) : null}

          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="sticky top-0 bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-foreground/70">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Assignment</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50 bg-surface">
              {!data || data.attempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-foreground/70">
                    {loading ? "Loading study attempts..." : "No study attempts found."}
                  </td>
                </tr>
              ) : null}

              {data?.attempts.map((attempt) => (
                <tr key={attempt.id} className="hover:bg-surface-muted/40">
                  <td className="whitespace-nowrap px-3 py-2 text-foreground/65">
                    {editingAttemptId === attempt.id ? (
                      <input
                        type="datetime-local"
                        className="h-9 rounded border border-line bg-white px-2 text-xs"
                        value={editSubmittedAt}
                        onChange={(event) => setEditSubmittedAt(event.target.value)}
                      />
                    ) : (
                      <>
                        <p className="font-semibold text-foreground/85">{formatDateTimeShort(attempt.submittedAt)}</p>
                        <p className="text-[10px] uppercase tracking-[0.08em] text-foreground/55">
                          {formatRelativeFromNow(attempt.submittedAt, {
                            style: "short",
                            allowFuture: false,
                            noValueLabel: "-",
                            invalidLabel: "-",
                          })}
                        </p>
                      </>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <p className="font-semibold text-foreground/90">{attempt.nickname}</p>
                    <p className="text-[11px] text-foreground/60">@{attempt.wkUsername}</p>
                  </td>

                  <td className={`px-3 py-2 font-bold ${resultColor[attempt.result] ?? ""}`}>
                    {editingAttemptId === attempt.id ? (
                      <select
                        className="h-9 rounded border border-line bg-white px-2 text-xs"
                        value={editResult}
                        onChange={(event) => setEditResult(event.target.value as "correct" | "wrong" | "skipped")}
                      >
                        <option value="correct">correct</option>
                        <option value="wrong">wrong</option>
                        <option value="skipped">skipped</option>
                      </select>
                    ) : (
                      attempt.result
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${typeColor[attempt.subjectType] ?? "border border-gray-200 bg-gray-50 text-gray-600"}`}
                    >
                      {attempt.subjectType}
                    </span>
                  </td>

                  <td className="px-3 py-2 font-mono">{attempt.subjectId}</td>
                  <td className="px-3 py-2 font-mono text-foreground/65">{attempt.assignmentId}</td>

                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {editingAttemptId === attempt.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void saveAttempt();
                            }}
                            disabled={saving || loading}
                            className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAttemptId(null)}
                            disabled={saving || loading}
                            className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAttemptId(attempt.id);
                            setEditResult(attempt.result);
                            setEditSubmittedAt(toLocalDateTimeInput(attempt.submittedAt));
                          }}
                          disabled={saving || loading}
                          className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                        >
                          Edit
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          void deleteAttempt(attempt);
                        }}
                        disabled={saving || loading}
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdminPaginationControls
          page={data?.pagination.page ?? page}
          pageCount={pageCount}
          itemLabel="attempts"
          total={data?.pagination.total ?? 0}
          onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => {
            if (hasNext) {
              setPage((prev) => prev + 1);
            }
          }}
          disabled={loading || saving}
        />
      </div>
    </section>
  );
}
