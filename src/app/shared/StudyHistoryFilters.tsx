"use client";

import type { HistorySrsBucket } from "@/app/shared/studyHistoryTypes";

import { srsBucketBadgeClass, srsBucketLabel, titleCaseSrsBucket } from "./studyHistoryUi";

type Props = {
  pageSize: number;
  setPageSize: (value: number) => void;
  setPage: (value: number) => void;
  resultFilter: "all" | "correct" | "wrong" | "skipped";
  setResultFilter: (value: "all" | "correct" | "wrong" | "skipped") => void;
  levelFilter: number | "all";
  setLevelFilter: (value: number | "all") => void;
  availableLevels: number[];
  srsBucketFilter: HistorySrsBucket | "all";
  setSrsBucketFilter: (value: HistorySrsBucket | "all") => void;
  availableSrsBuckets: HistorySrsBucket[];
};

export default function StudyHistoryFilters({
  pageSize,
  setPageSize,
  setPage,
  resultFilter,
  setResultFilter,
  levelFilter,
  setLevelFilter,
  availableLevels,
  srsBucketFilter,
  setSrsBucketFilter,
  availableSrsBuckets,
}: Props) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line/70 bg-surface-muted/50 p-2.5 sm:p-3">
      <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">Page size</label>
      <select
        value={pageSize}
        onChange={(event) => {
          setPage(1);
          setPageSize(Number(event.target.value));
        }}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold shadow-sm"
      >
        {[10, 25, 50, 100].map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>

      <div className="ml-2 inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
        {(["all", "correct", "wrong", "skipped"] as const).map((value) => (
          <button
            key={`result-${value}`}
            type="button"
            onClick={() => {
              setResultFilter(value);
            }}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
              resultFilter === value
                ? value === "wrong"
                  ? "bg-red-600 text-white"
                  : value === "correct"
                    ? "bg-emerald-600 text-white"
                    : "bg-accent text-white"
                : "text-foreground/80 hover:bg-surface-muted"
            }`}
          >
            {value === "all" ? "All" : value}
          </button>
        ))}
      </div>

      <label className="ml-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/65 sm:text-sm">Level</label>
      <select
        value={String(levelFilter)}
        onChange={(event) => {
          const next = Number(event.target.value);
          setLevelFilter(Number.isInteger(next) && next > 0 ? next : "all");
        }}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold shadow-sm"
      >
        <option value="all">All</option>
        {availableLevels.map((level) => (
          <option key={`lvl-${level}`} value={level}>L{level}</option>
        ))}
      </select>

      <div className="ml-2 inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
        <button
          type="button"
          onClick={() => {
            setSrsBucketFilter("all");
          }}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
            srsBucketFilter === "all" ? "bg-accent text-white" : "text-foreground/80 hover:bg-surface-muted"
          }`}
        >
          SRS All
        </button>
        {availableSrsBuckets.filter((bucket) => bucket !== "unknown").map((bucket) => (
          <button
            key={`bucket-${bucket}`}
            type="button"
            onClick={() => {
              setSrsBucketFilter(bucket);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
              srsBucketFilter === bucket
                ? `${srsBucketBadgeClass(bucket)} ring-1 ring-offset-0`
                : "border-line text-foreground/75 hover:bg-surface-muted"
            }`}
            title={titleCaseSrsBucket(bucket)}
          >
            {srsBucketLabel(bucket)}
          </button>
        ))}
      </div>
    </div>
  );
}
