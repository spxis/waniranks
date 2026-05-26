"use client";

import { useCallback, useEffect, useState } from "react";

import { getStoredPositiveInt, setLocalStorageItem } from "@/lib/clientStorage";
import { formatDateTimeShort, formatRelativeFromNow } from "@/lib/timeFormat";

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
  const [status, setStatus] = useState<string>("");
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
      const res = await fetch(`/api/admin/study-history?lite=1&page=${page}&pageSize=${pageSize}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load study history.");
      const payload = (await res.json()) as HistoryData;
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
    if (storedPageSize !== null && HISTORY_PAGE_SIZE_OPTIONS.includes(storedPageSize as (typeof HISTORY_PAGE_SIZE_OPTIONS)[number])) {
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
  }, [load, sessionAuthorized, paginationReady]);

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

  if (!sessionAuthorized) return null;

  const resultColor: Record<string, string> = {
    correct: "text-emerald-600",
    wrong: "text-red-500",
    skipped: "text-amber-500",
  };

  const typeColor: Record<string, string> = {
    radical: "bg-sky-100 text-sky-700",
    kanji: "bg-pink-100 text-pink-700",
    vocabulary: "bg-violet-100 text-violet-700",
  };

  return (
    <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Study Submission History</h2>

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

          {loading && <p className="text-sm text-muted">Loading...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}

          {data && (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  Total:{" "}
                  <strong>
                    {Object.values(data.totals).reduce((a, b) => a + b, 0)}
                  </strong>
                </span>
                <span>
                  Correct:{" "}
                  <strong className="text-emerald-600">{data.totals.correct ?? 0}</strong>
                </span>
                <span>
                  Wrong: <strong className="text-red-500">{data.totals.wrong ?? 0}</strong>
                </span>
                {(data.totals.skipped ?? 0) > 0 && (
                  <span>
                    Skipped:{" "}
                    <strong className="text-amber-500">{data.totals.skipped}</strong>
                  </span>
                )}
                <span>
                  Accounts: <strong>{data.accountCount}</strong>
                </span>
              </div>

              <div className="max-h-128 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-muted text-[0.65rem] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-2 py-1.5">Time</th>
                      <th className="px-2 py-1.5">User</th>
                      <th className="px-2 py-1.5">Result</th>
                      <th className="px-2 py-1.5">Type</th>
                      <th className="px-2 py-1.5">Subject</th>
                      <th className="px-2 py-1.5">Assignment</th>
                      <th className="px-2 py-1.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {data.attempts.map((a) => (
                      <tr key={a.id} className="hover:bg-surface-muted/40">
                        <td className="whitespace-nowrap px-2 py-1 text-muted">
                          {editingAttemptId === a.id ? (
                            <input
                              type="datetime-local"
                              className="h-8 rounded border border-line bg-surface px-2 text-xs"
                              value={editSubmittedAt}
                              onChange={(event) => setEditSubmittedAt(event.target.value)}
                            />
                          ) : (
                            <>
                              <p className="font-semibold text-foreground/85">{formatDateTimeShort(a.submittedAt)}</p>
                              <p className="text-[10px] uppercase tracking-[0.08em] text-foreground/55">
                                {formatRelativeFromNow(a.submittedAt, {
                                  style: "short",
                                  allowFuture: false,
                                  noValueLabel: "-",
                                  invalidLabel: "-",
                                })}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <p>{a.nickname}</p>
                          <p className="text-[10px] text-foreground/55">@{a.wkUsername}</p>
                        </td>
                        <td className={`px-2 py-1 font-bold ${resultColor[a.result] ?? ""}`}>
                          {editingAttemptId === a.id ? (
                            <select
                              className="h-8 rounded border border-line bg-surface px-2 text-xs"
                              value={editResult}
                              onChange={(event) => setEditResult(event.target.value as "correct" | "wrong" | "skipped")}
                            >
                              <option value="correct">correct</option>
                              <option value="wrong">wrong</option>
                              <option value="skipped">skipped</option>
                            </select>
                          ) : a.result}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-bold uppercase ${typeColor[a.subjectType] ?? "bg-gray-100 text-gray-600"}`}
                          >
                            {a.subjectType}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono">{a.subjectId}</td>
                        <td className="px-2 py-1 font-mono text-muted">{a.assignmentId}</td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap gap-1">
                            {editingAttemptId === a.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void saveAttempt();
                                  }}
                                  disabled={saving || loading}
                                  className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingAttemptId(null)}
                                  disabled={saving || loading}
                                  className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAttemptId(a.id);
                                  setEditResult(a.result);
                                  setEditSubmittedAt(toLocalDateTimeInput(a.submittedAt));
                                }}
                                disabled={saving || loading}
                                className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
                              >
                                Edit
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                void deleteAttempt(a);
                              }}
                              disabled={saving || loading}
                              className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-red-700"
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

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/65">
                <p>
                  Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total.toLocaleString("en-US")} total attempts
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={!data.pagination.hasPrevious || loading || saving}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={!data.pagination.hasNext || loading || saving}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
      </div>
    </section>
  );
}
