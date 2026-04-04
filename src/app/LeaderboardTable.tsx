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
  lastActivityAt: string | null;
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

function formatSince(input: string | null): string {
  if (!input) {
    return "No activity yet";
  }

  const deltaMs = Date.now() - new Date(input).getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return "Just now";
  }

  const minutes = Math.floor(deltaMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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
              <th className="px-4 py-3">Last Activity</th>
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
                    <p>{row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"}</p>
                    <p className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-slate-400">
                      {formatSince(row.lastActivityAt)}
                    </p>
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
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Due Now: {formatNumber(row.pendingReviews)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Apprentice: {formatNumber(row.apprenticeCount)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Guru: {formatNumber(row.guruCount)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Master: {formatNumber(row.masterCount)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Enlightened: {formatNumber(row.enlightenedCount)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Burned: {formatNumber(row.burnedCount)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Level Kanji Learned: {formatNumber(row.levelKanjiLearned)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Level Kanji Total: {formatNumber(row.levelKanjiTotal)}
                        </span>
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                          Level Kanji Locked: {formatNumber(row.levelKanjiLocked)}
                        </span>
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
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              Activity: {row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"} · {formatSince(row.lastActivityAt)}
            </p>
            {expanded.has(row.id) ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
                <div className="rounded-lg bg-surface-muted p-2">Radicals {formatNumber(row.radicalCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Vocab {formatNumber(row.vocabularyCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Due {formatNumber(row.pendingReviews)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Burned {formatNumber(row.burnedCount)}</div>
                <div className="col-span-2 rounded-lg bg-surface-muted p-2">Last sync {formatDate(row.lastSyncedAt)}</div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
