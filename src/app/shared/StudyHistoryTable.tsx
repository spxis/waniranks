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
  wkLevel: number | null;
  srsStage: number | null;
};

type HistoryPayload = {
  attempts: Attempt[];
  totals: Record<string, number>;
  accountCount: number;
  availableLevels: number[];
  availableSrs: number[];
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

function resultIcon(result: string): { icon: string; className: string; label: string } {
  if (result === "correct") {
    return { icon: "✓", className: "text-emerald-600", label: "Correct" };
  }

  if (result === "wrong") {
    return { icon: "✕", className: "text-red-600", label: "Wrong" };
  }

  return { icon: "•", className: "text-amber-600", label: "Skipped" };
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
  const [resultFilter, setResultFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [srsFilter, setSrsFilter] = useState<number | "all">("all");

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });

    if (resultFilter !== "all") {
      params.set("result", resultFilter);
    }
    if (levelFilter !== "all") {
      params.set("level", String(levelFilter));
    }
    if (srsFilter !== "all") {
      params.set("srs", String(srsFilter));
    }

    const glue = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${glue}${params.toString()}`;
  }, [endpoint, levelFilter, page, pageSize, resultFilter, sortBy, sortDir, srsFilter]);

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
    setPage(1);
  }, [resultFilter, levelFilter, srsFilter]);

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

        <label className="ml-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">Result</label>
        <select
          value={resultFilter}
          onChange={(event) => {
            const next = event.target.value;
            setResultFilter(
              next === "correct" || next === "wrong" || next === "skipped" ? next : "all",
            );
          }}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold"
        >
          <option value="all">All</option>
          <option value="correct">Correct</option>
          <option value="wrong">Wrong</option>
          <option value="skipped">Skipped</option>
        </select>

        <label className="ml-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">Level</label>
        <select
          value={String(levelFilter)}
          onChange={(event) => {
            const next = Number(event.target.value);
            setLevelFilter(Number.isInteger(next) && next > 0 ? next : "all");
          }}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold"
        >
          <option value="all">All</option>
          {(data?.availableLevels ?? []).map((level) => (
            <option key={`lvl-${level}`} value={level}>L{level}</option>
          ))}
        </select>

        <label className="ml-2 text-xs font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">SRS</label>
        <select
          value={String(srsFilter)}
          onChange={(event) => {
            const next = Number(event.target.value);
            setSrsFilter(Number.isInteger(next) && next > 0 ? next : "all");
          }}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold"
        >
          <option value="all">All</option>
          {(data?.availableSrs ?? []).map((srs) => (
            <option key={`srs-${srs}`} value={srs}>SRS {srs}</option>
          ))}
        </select>
      </div>

      {isLoading ? <p className="mt-4 text-base text-foreground/70">Loading...</p> : null}
      {error ? <p className="mt-4 text-base text-red-600">{error.message}</p> : null}

      {data ? (
        <div className="mt-3 space-y-3">
          <div className="sm:hidden overflow-hidden rounded-lg border border-line">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-surface-muted text-[10px] uppercase tracking-[0.08em] text-foreground/65">
                <tr>
                  <th className="w-[40%] px-2 py-1.5 font-bold">Time</th>
                  <th className="w-[60%] px-2 py-1.5 font-bold">Subject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {data.attempts.map((row) => (
                  <tr key={`mobile-${row.id}`} className="bg-surface hover:bg-surface-muted/40 align-top">
                    <td className="px-2 py-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-foreground/75 leading-tight">{formatHistoryDateCompact(row.submittedAt)}</p>
                        {(() => {
                          const meta = resultIcon(row.result);
                          return (
                            <>
                              <span className={`text-base font-black leading-none ${meta.className}`} title={meta.label} aria-hidden>
                                {meta.icon}
                              </span>
                              <span className="sr-only">{meta.label}</span>
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-[10px] uppercase tracking-[0.06em] text-foreground/50 leading-tight">
                        {formatRelativeFromNow(row.submittedAt, { style: "short", allowFuture: false, noValueLabel: "-", invalidLabel: "-" })}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-bold uppercase ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                          {row.subjectType}
                        </span>
                        {typeof row.wkLevel === "number" ? (
                          <span className="inline-block rounded border border-line px-1 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                            L{row.wkLevel}
                          </span>
                        ) : null}
                        {typeof row.srsStage === "number" ? (
                          <span className="inline-block rounded border border-line px-1 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                            SRS {row.srsStage}
                          </span>
                        ) : null}
                      </div>
                      {showUserColumn ? (
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/60 leading-tight">{row.nickname}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-baseline gap-1.5 leading-tight">
                        {row.subjectType === "kanji" ? (
                          <Link
                            href={`/users/${encodeURIComponent(row.wkUsername)}?tab=study&subject=${row.subjectId}&viewer=detail`}
                            className="text-lg font-black text-accent hover:underline"
                          >
                            {row.subjectLabel}
                          </Link>
                        ) : (
                          <p className="text-lg font-black text-foreground">{row.subjectLabel}</p>
                        )}
                        <p className="min-w-0 truncate text-[13px] font-semibold text-foreground/85">{row.subjectReading ? row.subjectReading : "-"}</p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-tight text-foreground/70">
                        {row.subjectMeaning ? row.subjectMeaning : "-"} · #{row.subjectId}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <div className="flex flex-wrap items-start gap-1.5">
                      {(() => {
                        const meta = resultIcon(row.result);
                        return (
                          <>
                            <span className={`text-base font-black leading-none ${meta.className}`} title={meta.label} aria-hidden>
                              {meta.icon}
                            </span>
                            <span className="sr-only">{meta.label}</span>
                          </>
                        );
                      })()}
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase sm:hidden ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.subjectType}
                      </span>
                      {typeof row.wkLevel === "number" ? (
                        <span className="inline-block rounded border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                          L{row.wkLevel}
                        </span>
                      ) : null}
                      {typeof row.srsStage === "number" ? (
                        <span className="inline-block rounded border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                          SRS {row.srsStage}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 align-top sm:table-cell">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase ${typeColor[row.subjectType] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.subjectType}
                      </span>
                      {typeof row.wkLevel === "number" ? (
                        <span className="inline-block rounded border border-line px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                          L{row.wkLevel}
                        </span>
                      ) : null}
                      {typeof row.srsStage === "number" ? (
                        <span className="inline-block rounded border border-line px-2 py-0.5 text-[10px] font-bold uppercase text-foreground/80">
                          SRS {row.srsStage}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.subjectType === "kanji" ? (
                      <Link
                        href={`/users/${encodeURIComponent(row.wkUsername)}?tab=study&subject=${row.subjectId}&viewer=detail`}
                        className="text-xl font-black leading-tight text-accent hover:underline sm:text-2xl"
                      >
                        {row.subjectLabel}
                      </Link>
                    ) : (
                      <p className="text-xl font-black leading-tight text-foreground sm:text-2xl">{row.subjectLabel}</p>
                    )}
                    <p className="text-base font-semibold text-foreground/85 sm:text-lg">
                      {row.subjectReading ? row.subjectReading : "-"}
                    </p>
                    <p className="text-sm text-foreground/70 sm:text-base">
                      {row.subjectMeaning ? row.subjectMeaning : "-"}
                      {` · #${row.subjectId}`}
                    </p>
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
