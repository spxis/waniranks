"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useState } from "react";

type LeaderboardRow = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  reviewCount: number;
  burnedCount: number;
  pendingReviews: number;
  radicalCount: number;
  vocabularyCount: number;
  apprenticeCount: number;
  guruCount: number;
  masterCount: number;
  enlightenedCount: number;
  levelKanjiTotal: number;
  levelKanjiLearned: number;
  levelKanjiLocked: number;
  score: number;
  lastSyncedAt: string;
};

type Props = {
  rows: LeaderboardRow[];
};

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

function formatDate(input: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input));
}

export default function LeaderboardTable({ rows }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead className="border-b border-line bg-surface-muted text-left text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Nickname</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Reviewed</th>
              <th className="px-4 py-3">Radicals</th>
              <th className="px-4 py-3">Vocab</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Synced</th>
              <th className="px-4 py-3">More</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm text-slate-800">
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                <tr key={row.id} className="transition hover:bg-surface-muted/80">
                  <td className="px-4 py-3 font-black">#{index + 1}</td>
                  <td className="px-4 py-3 text-lg font-black text-foreground">
                    <Link href={`/users/${encodeURIComponent(row.nickname)}`} className="hover:text-accent">
                      {row.nickname}
                    </Link>
                    <p className="text-xs font-semibold text-slate-500">@{row.wkUsername}</p>
                  </td>
                  <td className="px-4 py-3 text-lg font-black text-accent">{row.wkLevel}</td>
                  <td className="px-4 py-3 font-semibold">{formatNumber(row.reviewCount)}</td>
                  <td className="px-4 py-3 font-semibold">{formatNumber(row.radicalCount)}</td>
                  <td className="px-4 py-3 font-semibold">{formatNumber(row.vocabularyCount)}</td>
                  <td className="px-4 py-3 text-lg font-black text-hot">{formatNumber(row.score)}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.08em] text-slate-500">
                    {formatDate(row.lastSyncedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(row.id)}
                      className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
                    >
                      {expanded.has(row.id) ? "Hide" : "Expand"}
                    </button>
                  </td>
                </tr>
                {expanded.has(row.id) ? (
                  <tr className="bg-surface-muted/40">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-line bg-white p-3 text-sm font-semibold text-slate-700">
                          Due now: {formatNumber(row.pendingReviews)}
                        </div>
                        <div className="rounded-xl border border-line bg-white p-3 text-sm font-semibold text-slate-700">
                          SRS A/G: {formatNumber(row.apprenticeCount)} / {formatNumber(row.guruCount)}
                        </div>
                        <div className="rounded-xl border border-line bg-white p-3 text-sm font-semibold text-slate-700">
                          SRS M/E/B: {formatNumber(row.masterCount)} / {formatNumber(row.enlightenedCount)} / {formatNumber(row.burnedCount)}
                        </div>
                        <div className="rounded-xl border border-line bg-white p-3 text-sm font-semibold text-slate-700">
                          Level Kanji: {formatNumber(row.levelKanjiLearned)} / {formatNumber(row.levelKanjiTotal)} (locked {formatNumber(row.levelKanjiLocked)})
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <article key={row.id} className="rounded-2xl border border-line bg-white/90 p-4">
            <div className="flex items-center justify-between">
              <p className="text-lg font-black text-foreground">#{index + 1} {row.nickname}</p>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
              >
                {expanded.has(row.id) ? "Hide" : "More"}
              </button>
            </div>
            <p className="text-xs text-slate-500">@{row.wkUsername}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-semibold text-slate-700">
              <div className="rounded-lg bg-surface-muted p-2">Lv {row.wkLevel}</div>
              <div className="rounded-lg bg-surface-muted p-2">R {formatNumber(row.reviewCount)}</div>
              <div className="rounded-lg bg-surface-muted p-2">S {formatNumber(row.score)}</div>
            </div>
            {expanded.has(row.id) ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                <div className="rounded-lg bg-surface-muted p-2">Radicals {formatNumber(row.radicalCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Vocab {formatNumber(row.vocabularyCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Due {formatNumber(row.pendingReviews)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Burned {formatNumber(row.burnedCount)}</div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
