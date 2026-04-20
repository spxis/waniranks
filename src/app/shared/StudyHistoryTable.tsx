"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { formatRelativeFromNow } from "@/lib/timeFormat";

type SortBy = "submittedAt" | "result" | "subjectType" | "subject" | "user";
type SortDir = "asc" | "desc";

type Attempt = {
  id: string;
  accountId: string;
  nickname: string;
  wkUsername: string;
  assignmentId: number;
  subjectId: number;
  subjectType: string;
  result: string;
  submittedAt: string;
  subjectLabel: string;
  subjectReading: string | null;
  subjectMeaning: string | null;
};

type HistoryPayload = {
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
  error?: string;
};

type Props = {
  endpoint: string;
  showUserColumn?: boolean;
  heading?: string;
  collapsible?: boolean;
  persistenceKey?: string;
};

function sortIcon(activeSortBy: SortBy, sortBy: SortBy, sortDir: SortDir): string {
  if (activeSortBy !== sortBy) {
    return "<>";
  }

  return sortDir === "desc" ? "v" : "^";
}

function formatHistoryDateCompact(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "-";
  }

  const monthDay = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).toLowerCase();

  return `${monthDay.toUpperCase()} (${time})`;
}

export default function StudyHistoryTable({
  endpoint,
  showUserColumn = false,
  heading = "Study Submission History",
  collapsible = true,
  persistenceKey,
}: Props) {
  const storageKey = persistenceKey ?? `wr:study-history:open:${endpoint}`;
  const [expanded, setExpanded] = useState(() => {
    if (!collapsible || typeof window === "undefined") {
      return true;
    }

    try {
      return window.localStorage.getItem(storageKey) !== "0";
    } catch {
      return true;
    }
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortBy>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });

    const glue = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${glue}${params.toString()}`;
  }, [endpoint, page, pageSize, sortBy, sortDir]);

  const { data, error, isLoading } = useSWR<HistoryPayload>(
    expanded ? query : null,
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as HistoryPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load study history.");
      }
      return payload;
    },
    { revalidateOnFocus: true },
  );

  const totals = data?.totals ?? {};
  const totalAttempts = Object.values(totals).reduce((sum, value) => sum + value, 0);

  useEffect(() => {
    if (!collapsible || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, expanded ? "1" : "0");
    } catch {
      // Ignore persistence failures.
    }
  }, [collapsible, expanded, storageKey]);

  function toggleSort(nextSortBy: SortBy) {
    setPage(1);
    if (sortBy !== nextSortBy) {
      setSortBy(nextSortBy);
      setSortDir(nextSortBy === "submittedAt" ? "desc" : "asc");
      return;
    }

    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  }

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
    <section className="rounded-2xl border border-line bg-surface/90 p-4 shadow-sm sm:p-5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-base font-bold uppercase tracking-[0.1em] text-foreground sm:text-lg"
        >
          {heading} {expanded ? "▲" : "▼"}
        </button>
      ) : (
        <h2 className="text-base font-bold uppercase tracking-[0.1em] text-foreground sm:text-lg">{heading}</h2>
      )}

      {!expanded ? null : (
        <>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm sm:text-base">
        <span>Total: <strong>{totalAttempts}</strong></span>
        <span>Correct: <strong className="text-emerald-600">{totals.correct ?? 0}</strong></span>
        <span>Wrong: <strong className="text-red-500">{totals.wrong ?? 0}</strong></span>
        {(totals.skipped ?? 0) > 0 ? <span>Skipped: <strong className="text-amber-500">{totals.skipped}</strong></span> : null}
        {showUserColumn ? <span>Accounts: <strong>{data?.accountCount ?? 0}</strong></span> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">Page size</label>
        <select
          value={pageSize}
          onChange={(event) => {
            setPage(1);
            setPageSize(Number(event.target.value));
          }}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {isLoading ? <p className="mt-4 text-base text-foreground/70">Loading...</p> : null}
      {error ? <p className="mt-4 text-base text-red-600">{error.message}</p> : null}

      {data ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-2 sm:hidden">
            {data.attempts.map((row) => (
              <article key={`mobile-${row.id}`} className="rounded-lg border border-line bg-surface-muted/40 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/70">{formatHistoryDateCompact(row.submittedAt)}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-foreground/50">
                      {formatRelativeFromNow(row.submittedAt, { style: "short", allowFuture: false, noValueLabel: "-", invalidLabel: "-" })}
                    </p>
                  </div>
                  {showUserColumn ? <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/65">{row.nickname}</p> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-black uppercase ${resultColor[row.result] ?? ""}`}>{row.result}</span>
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                    {row.subjectType}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-xl font-black leading-tight text-foreground">{row.subjectLabel}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground/80">{row.subjectReading ? row.subjectReading : "-"}</p>
                  <p className="mt-0.5 text-[11px] text-foreground/65">
                    {row.subjectMeaning ? row.subjectMeaning : "-"} · #{row.subjectId}
                  </p>
                  {row.subjectType === "kanji" ? (
                    <p className="mt-1">
                      <Link
                        href={`/users/${encodeURIComponent(row.wkUsername)}?tab=study&subject=${row.subjectId}`}
                        className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent hover:underline"
                      >
                        View details
                      </Link>
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden max-h-[42rem] overflow-auto rounded-lg border border-line sm:block">
            <table className="w-full text-left text-sm sm:text-base">
            <thead className="sticky top-0 bg-surface-muted text-xs uppercase tracking-wider text-muted sm:text-sm">
              <tr>
                <th className="w-[18%] px-3 py-2">
                  <button type="button" onClick={() => toggleSort("submittedAt")} className="font-bold">Time {sortIcon(sortBy, "submittedAt", sortDir)}</button>
                </th>
                {showUserColumn ? (
                  <th className="w-[14%] px-3 py-2">
                    <button type="button" onClick={() => toggleSort("user")} className="font-bold">User {sortIcon(sortBy, "user", sortDir)}</button>
                  </th>
                ) : null}
                <th className="w-[14%] px-3 py-2">
                  <button type="button" onClick={() => toggleSort("result")} className="font-bold">Result {sortIcon(sortBy, "result", sortDir)}</button>
                </th>
                <th className="hidden w-[10%] px-3 py-2 sm:table-cell">
                  <button type="button" onClick={() => toggleSort("subjectType")} className="font-bold">Type {sortIcon(sortBy, "subjectType", sortDir)}</button>
                </th>
                <th className="w-[34%] px-3 py-2">
                  <button type="button" onClick={() => toggleSort("subject")} className="font-bold">Subject {sortIcon(sortBy, "subject", sortDir)}</button>
                </th>
                <th className="hidden w-[10%] px-3 py-2 sm:table-cell">Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {data.attempts.map((row) => (
                <tr key={row.id} className="hover:bg-surface-muted/40">
                  <td className="px-3 py-2 align-top">
                    <p className="font-semibold text-foreground/85">{formatHistoryDateCompact(row.submittedAt)}</p>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-foreground/55">
                      {formatRelativeFromNow(row.submittedAt, { style: "short", allowFuture: false, noValueLabel: "-", invalidLabel: "-" })}
                    </p>
                  </td>
                  {showUserColumn ? <td className="px-3 py-2 align-top">{row.nickname}</td> : null}
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`font-bold uppercase ${resultColor[row.result] ?? ""}`}>{row.result}</span>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:hidden ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.subjectType}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 align-top sm:table-cell">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                      {row.subjectType}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-xl font-black leading-tight text-foreground sm:text-2xl">{row.subjectLabel}</p>
                    <p className="text-sm font-semibold text-foreground/80 sm:text-base">
                      {row.subjectReading ? row.subjectReading : "-"}
                    </p>
                    <p className="text-xs text-foreground/65 sm:text-sm">
                      {row.subjectMeaning ? ` · ${row.subjectMeaning}` : ""}
                      {` · #${row.subjectId}`}
                    </p>
                    {row.subjectType === "kanji" ? (
                      <p className="mt-1">
                        <Link
                          href={`/users/${encodeURIComponent(row.wkUsername)}?tab=study&subject=${row.subjectId}`}
                          className="text-xs font-bold uppercase tracking-[0.08em] text-accent hover:underline"
                        >
                          View details
                        </Link>
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2 align-top font-mono text-foreground/70 sm:table-cell">{row.assignmentId}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-foreground/70">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} rows
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!data.pagination.hasPrevious}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!data.pagination.hasNext}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-bold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
