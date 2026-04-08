"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useEffect } from "react";
import { useState } from "react";

import { EMPTY_ITEM_SPREAD, isItemSpread } from "@/lib/itemSpread";

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
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  itemSpread: unknown;
  jlptCounts: unknown;
  lastActivityAt: string | null;
  score: number;
  lastSyncedAt: string;
  dailyDelta?: {
    score: number;
    reviewCount: number;
    wkLevel: number;
    radicalCount: number;
    vocabularyCount: number;
    burnedCount: number;
    levelKanjiLearned: number;
  } | null;
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

function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value > 0) {
    return `+${formatNumber(value)}`;
  }

  if (value < 0) {
    return `-${formatNumber(Math.abs(value))}`;
  }

  return "0";
}

function deltaClass(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "text-foreground/50";
  }

  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-red-700";
  }

  return "text-foreground/60";
}

function kanjiCountFromRow(row: LeaderboardRow): number {
  if (isItemSpread(row.itemSpread)) {
    return row.itemSpread.totals.kanji;
  }

  return 0;
}

function learnedKanjiFromRow(row: LeaderboardRow): number {
  if (!isItemSpread(row.itemSpread)) {
    return 0;
  }

  return (
    row.itemSpread.guru.kanji +
    row.itemSpread.master.kanji +
    row.itemSpread.enlightened.kanji +
    row.itemSpread.burned.kanji
  );
}

function jlptCountsFromRow(row: LeaderboardRow): {
  n1: { learned: number; total: number; percent: number };
  n2: { learned: number; total: number; percent: number };
  n3: { learned: number; total: number; percent: number };
  n4: { learned: number; total: number; percent: number };
  n5: { learned: number; total: number; percent: number };
} {
  const empty = {
    n1: { learned: 0, total: 0, percent: 0 },
    n2: { learned: 0, total: 0, percent: 0 },
    n3: { learned: 0, total: 0, percent: 0 },
    n4: { learned: 0, total: 0, percent: 0 },
    n5: { learned: 0, total: 0, percent: 0 },
  };

  if (!row.jlptCounts || typeof row.jlptCounts !== "object") {
    return empty;
  }

  const values = row.jlptCounts as Record<string, unknown>;

  function readLevel(levelKey: "n1" | "n2" | "n3" | "n4" | "n5") {
    const value = values[levelKey];
    if (typeof value === "number") {
      return { learned: value, total: 0, percent: 0 };
    }

    if (!value || typeof value !== "object") {
      return empty[levelKey];
    }

    const rec = value as Record<string, unknown>;
    const learned = typeof rec.learned === "number" ? rec.learned : 0;
    const total = typeof rec.total === "number" ? rec.total : 0;
    const percent =
      typeof rec.percent === "number"
        ? rec.percent
        : total > 0
          ? Math.round((learned / total) * 100)
          : 0;

    return { learned, total, percent };
  }

  return {
    n1: readLevel("n1"),
    n2: readLevel("n2"),
    n3: readLevel("n3"),
    n4: readLevel("n4"),
    n5: readLevel("n5"),
  };
}

function jlptCompletionClass(percent: number): string {
  if (percent >= 98) {
    return "border-emerald-600 bg-emerald-500 text-white";
  }

  if (percent >= 85) {
    return "border-emerald-300 bg-emerald-200 text-emerald-900";
  }

  if (percent >= 70) {
    return "border-emerald-200 bg-emerald-100 text-emerald-900";
  }

  if (percent >= 50) {
    return "border-amber-200 bg-amber-100 text-amber-900";
  }

  if (percent >= 25) {
    return "border-orange-200 bg-orange-100 text-orange-900";
  }

  if (percent > 0) {
    return "border-red-200 bg-red-100 text-red-900";
  }

  return "border-red-300 bg-red-200 text-red-900";
}

export default function LeaderboardTable({ rows }: Props) {
  const expandedStorageKey = "wr:leaderboard:expanded-rows";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showItemSpreadPanel, setShowItemSpreadPanel] = useState(true);
  const [showLevelProgressPanel, setShowLevelProgressPanel] = useState(true);
  const allRowIds = rows.map((row) => row.id);
  const allExpanded = rows.length > 0 && expanded.size === rows.length;
  const anyExpanded = expanded.size > 0;

  useEffect(() => {
    try {
      const expandedStored = window.localStorage.getItem(expandedStorageKey);
      const spread = window.localStorage.getItem("wr:leaderboard:item-spread-open");
      const progress = window.localStorage.getItem("wr:leaderboard:level-progress-open");

      if (expandedStored) {
        const parsed = JSON.parse(expandedStored) as string[];
        if (Array.isArray(parsed)) {
          setExpanded(new Set(parsed));
        }
      }

      if (spread === "0") {
        setShowItemSpreadPanel(false);
      }
      if (progress === "0") {
        setShowLevelProgressPanel(false);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [expandedStorageKey]);

  useEffect(() => {
    const validRowIds = new Set(rows.map((row) => row.id));
    setExpanded((prev) => {
      const filtered = new Set(Array.from(prev).filter((id) => validRowIds.has(id)));

      try {
        window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(filtered)));
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }

      return filtered;
    });
  }, [rows, expandedStorageKey]);

  function persistPanelState(key: string, value: boolean, setter: (next: boolean) => void) {
    setter(value);
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      try {
        window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors in restricted browsing modes.
      }

      return next;
    });
  }

  function expandAllRows() {
    const next = new Set(allRowIds);
    setExpanded(next);
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(next)));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  function collapseAllRows() {
    setExpanded(new Set());
    try {
      window.localStorage.setItem(expandedStorageKey, JSON.stringify([]));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={expandAllRows}
          disabled={rows.length === 0 || allExpanded}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          Expand All
        </button>
        <button
          type="button"
          onClick={collapseAllRows}
          disabled={!anyExpanded}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          Collapse All
        </button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full">
          <thead className="border-b border-line bg-surface-muted text-left text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Nickname</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Reviewed</th>
              <th className="px-4 py-3">Radicals</th>
              <th className="px-4 py-3">Kanji</th>
              <th className="px-4 py-3">Learned</th>
              <th className="px-4 py-3">Vocab</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Last Activity</th>
              <th className="px-4 py-3">More</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm text-foreground/90">
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                <tr key={row.id} className="transition hover:bg-surface-muted/80">
                  <td className="px-4 py-3 font-black">#{index + 1}</td>
                  <td className="px-4 py-3 text-lg font-black text-foreground">
                    <Link href={`/users/${encodeURIComponent(row.nickname)}`} className="hover:text-accent">
                      {row.nickname}
                    </Link>
                    <p className="text-xs font-semibold text-foreground/60">
                      <Link href={`/users/${encodeURIComponent(row.nickname)}`} className="hover:text-accent">
                        @{row.wkUsername}
                      </Link>
                    </p>
                  </td>
                  <td className="px-4 py-3 text-lg font-black text-accent">
                    <p>{row.wkLevel}</p>
                    <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.wkLevel)}`}>
                      {formatDelta(row.dailyDelta?.wkLevel)}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    <p>{formatNumber(row.reviewCount)}</p>
                    <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.reviewCount)}`}>
                      {formatDelta(row.dailyDelta?.reviewCount)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--radical">{formatNumber(row.radicalCount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--kanji">{formatNumber(kanjiCountFromRow(row))}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-foreground">{formatNumber(learnedKanjiFromRow(row))}</td>
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--vocabulary">{formatNumber(row.vocabularyCount)}</span>
                  </td>
                  <td className="px-4 py-3 text-lg font-black text-hot">
                    <p>{formatNumber(row.score)}</p>
                    <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.score)}`}>
                      {formatDelta(row.dailyDelta?.score)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.08em] text-foreground/60">
                    <p>{row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"}</p>
                    <p className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-foreground/50">
                      {formatSince(row.lastActivityAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggle(row.id)}
                      className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground"
                    >
                      {expanded.has(row.id) ? "Hide" : "Expand"}
                    </button>
                  </td>
                </tr>
                {expanded.has(row.id) ? (
                  <tr className="bg-surface-muted/40">
                    <td colSpan={11} className="px-4 py-4">
                      {(() => {
                        const spread = isItemSpread(row.itemSpread) ? row.itemSpread : EMPTY_ITEM_SPREAD;
                        const jlpt = jlptCountsFromRow(row);
                        const kanjiGoal = Math.ceil(row.levelKanjiTotal * 0.9);
                        const remainingToLevelUp = Math.max(0, kanjiGoal - row.levelKanjiGuruPlus);

                        return (
                      <div className="space-y-3">
                      <div className="grid gap-3 lg:grid-cols-[0.7fr_1.5fr_1.5fr_1fr]">
                        <div className="rounded-2xl border border-accent/25 bg-surface p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                            Due Now
                          </p>
                          <p className="mt-1 text-4xl font-black text-accent">
                            {formatNumber(row.pendingReviews)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-line bg-surface p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                            SRS Stages
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-foreground/70">Apprentice</p>
                              <p className="text-xl font-black leading-none text-foreground">{formatNumber(row.apprenticeCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-foreground/70">Guru</p>
                              <p className="text-xl font-black leading-none text-foreground">{formatNumber(row.guruCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-foreground/70">Master</p>
                              <p className="text-xl font-black leading-none text-foreground">{formatNumber(row.masterCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-foreground/70">Enlightened</p>
                              <p className="text-xl font-black leading-none text-foreground">{formatNumber(row.enlightenedCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-foreground/70">Burned</p>
                              <p className="text-xl font-black leading-none text-foreground">{formatNumber(row.burnedCount)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-line bg-surface p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                            JLPT Levels
                          </p>
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              {([
                                ["N5", jlpt.n5],
                                ["N4", jlpt.n4],
                                ["N3", jlpt.n3],
                              ] as const).map(([label, count]) => (
                                <div
                                  key={label}
                                  className={`rounded-xl border p-2 text-center ${jlptCompletionClass(count.percent)}`}
                                >
                                  <p className="text-[10px] font-bold uppercase opacity-90">{label}</p>
                                  <p className="text-lg font-black leading-none">
                                    {formatNumber(count.learned)}/{formatNumber(count.total)}
                                  </p>
                                  <p className="mt-1 text-[10px] font-semibold opacity-90">{count.percent}%</p>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {([
                                ["N2", jlpt.n2],
                                ["N1", jlpt.n1],
                              ] as const).map(([label, count]) => (
                                <div
                                  key={label}
                                  className={`rounded-xl border p-2 text-center ${jlptCompletionClass(count.percent)}`}
                                >
                                  <p className="text-[10px] font-bold uppercase opacity-90">{label}</p>
                                  <p className="text-lg font-black leading-none">
                                    {formatNumber(count.learned)}/{formatNumber(count.total)}
                                  </p>
                                  <p className="mt-1 text-[10px] font-semibold opacity-90">{count.percent}%</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-line bg-surface p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">
                            Level {row.wkLevel} Kanji
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
                              Learned: {formatNumber(row.levelKanjiLearned)}
                            </span>
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
                              Total: {formatNumber(row.levelKanjiTotal)}
                            </span>
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80">
                              Locked: {formatNumber(row.levelKanjiLocked)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1.8fr_1.2fr]">
                        <div className="rounded-2xl border border-line bg-surface p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Item Spread</p>
                            <button
                              type="button"
                              onClick={() =>
                                persistPanelState(
                                  "wr:leaderboard:item-spread-open",
                                  !showItemSpreadPanel,
                                  setShowItemSpreadPanel,
                                )
                              }
                              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
                            >
                              {showItemSpreadPanel ? "Collapse" : "Expand"}
                            </button>
                          </div>
                          {showItemSpreadPanel ? (
                            <>
                              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                                <span className="subject-pill subject-pill--radical">Radical</span>
                                <span className="subject-pill subject-pill--kanji">Kanji</span>
                                <span className="subject-pill subject-pill--vocabulary">Vocabulary</span>
                              </div>
                              <div className="mt-2 space-y-1">
                                {([
                                  ["Apprentice", spread.apprentice],
                                  ["Guru", spread.guru],
                                  ["Master", spread.master],
                                  ["Enlightened", spread.enlightened],
                                  ["Burned", spread.burned],
                                ] as const).map(([label, data]) => (
                                  <div key={label} className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.8fr_0.8fr] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground/80">
                                    <p>{label}</p>
                                    <p className="text-radical">{formatNumber(data.radical)}</p>
                                    <p className="text-kanji">{formatNumber(data.kanji)}</p>
                                    <p className="text-vocabulary">{formatNumber(data.vocabulary)}</p>
                                    <p className="text-right text-base font-black text-foreground">{formatNumber(data.total)}</p>
                                  </div>
                                ))}
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-line bg-surface p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Level Progress</p>
                            <button
                              type="button"
                              onClick={() =>
                                persistPanelState(
                                  "wr:leaderboard:level-progress-open",
                                  !showLevelProgressPanel,
                                  setShowLevelProgressPanel,
                                )
                              }
                              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground"
                            >
                              {showLevelProgressPanel ? "Collapse" : "Expand"}
                            </button>
                          </div>
                          {showLevelProgressPanel ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-foreground/80">Level {row.wkLevel}</p>
                              <div className="mt-3 h-2 rounded-full bg-surface-muted">
                                <div
                                  className="h-2 rounded-full bg-kanji"
                                  style={{ width: `${row.levelKanjiTotal === 0 ? 0 : Math.min(100, Math.round((row.levelKanjiGuruPlus / row.levelKanjiTotal) * 100))}%` }}
                                />
                              </div>
                              <p className="mt-2 text-sm font-semibold text-foreground/80">
                                Guru+ Kanji: {formatNumber(row.levelKanjiGuruPlus)}/{formatNumber(row.levelKanjiTotal)}
                              </p>
                              <p className="mt-1 text-sm text-foreground/70">
                                {row.levelKanjiGuruPlus >= kanjiGoal
                                  ? "Level-up gate passed; cleanup remains."
                                  : `Need ${formatNumber(remainingToLevelUp)} more Guru+ kanji to level up.`}
                              </p>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-line bg-surface p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">24h Change</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {([
                            ["Score", row.dailyDelta?.score],
                            ["Reviews", row.dailyDelta?.reviewCount],
                            ["Level", row.dailyDelta?.wkLevel],
                            ["Radicals", row.dailyDelta?.radicalCount],
                            ["Vocab", row.dailyDelta?.vocabularyCount],
                            ["Burned", row.dailyDelta?.burnedCount],
                            ["Learned Kanji", row.dailyDelta?.levelKanjiLearned],
                          ] as const).map(([label, delta]) => (
                            <div key={label} className="rounded-xl border border-line bg-surface-muted px-3 py-2">
                              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">{label}</p>
                              <p className={`mt-1 text-xl font-black ${deltaClass(delta)}`}>{formatDelta(delta)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      </div>
                        );
                      })()}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        {rows.map((row, index) => (
          <article key={row.id} className="rounded-2xl border border-line bg-surface/90 p-4 shadow-[0_10px_24px_rgba(8,16,36,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/users/${encodeURIComponent(row.nickname)}`} className="text-3xl font-black text-foreground hover:text-accent">
                  #{index + 1} {row.nickname}
                </Link>
                <p className="mt-0.5 text-sm text-foreground/60">
                  <Link href={`/users/${encodeURIComponent(row.nickname)}`} className="hover:text-accent">
                    @{row.wkUsername}
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-foreground"
              >
                {expanded.has(row.id) ? "Hide" : "More"}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-foreground/80">
              <div className="rounded-xl bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Level</p>
                <p className="mt-1 text-xl font-black text-accent">Lv {row.wkLevel}</p>
                <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.wkLevel)}`}>
                  {formatDelta(row.dailyDelta?.wkLevel)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Reviewed</p>
                <p className="mt-1 text-xl font-black text-foreground">{formatNumber(row.reviewCount)}</p>
                <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.reviewCount)}`}>
                  {formatDelta(row.dailyDelta?.reviewCount)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Score</p>
                <p className="mt-1 text-xl font-black text-hot">{formatNumber(row.score)}</p>
                <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.score)}`}>
                  {formatDelta(row.dailyDelta?.score)}
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Pending</p>
                <p className="mt-1 text-xl font-black text-accent">{formatNumber(row.pendingReviews)}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
              <span className="subject-pill subject-pill--radical">R {formatNumber(row.radicalCount)}</span>
              <span className="subject-pill subject-pill--kanji">K {formatNumber(kanjiCountFromRow(row))}</span>
              <span className="subject-pill subject-pill--vocabulary">V {formatNumber(row.vocabularyCount)}</span>
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 font-bold uppercase tracking-[0.08em] text-foreground/70">
                Learned {formatNumber(learnedKanjiFromRow(row))}
              </span>
            </div>

            <p className="mt-2 text-[11px] font-semibold text-foreground/60">
              Activity: {row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"} · {formatSince(row.lastActivityAt)}
            </p>
            {expanded.has(row.id) ? (
              <div className="mt-3 space-y-2 text-xs font-semibold text-foreground/80">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-muted p-2">Apprentice {formatNumber(row.apprenticeCount)}</div>
                  <div className="rounded-lg bg-surface-muted p-2">Guru {formatNumber(row.guruCount)}</div>
                  <div className="rounded-lg bg-surface-muted p-2">Master {formatNumber(row.masterCount)}</div>
                  <div className="rounded-lg bg-surface-muted p-2">Enlightened {formatNumber(row.enlightenedCount)}</div>
                  <div className="rounded-lg bg-surface-muted p-2">Burned {formatNumber(row.burnedCount)}</div>
                  <div className="rounded-lg bg-surface-muted p-2">Level Kanji {formatNumber(row.levelKanjiLearned)}/{formatNumber(row.levelKanjiTotal)}</div>
                </div>
                <div className="rounded-lg bg-surface-muted p-2">
                  Last sync {formatDate(row.lastSyncedAt)}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {(() => {
                    const jlpt = jlptCountsFromRow(row);
                    return ([
                      ["N5", jlpt.n5],
                      ["N4", jlpt.n4],
                      ["N3", jlpt.n3],
                      ["N2", jlpt.n2],
                      ["N1", jlpt.n1],
                    ] as const).map(([label, count]) => (
                      <div key={label} className={`rounded-lg border p-1 text-center ${jlptCompletionClass(count.percent)}`}>
                        <p className="text-[9px] font-bold uppercase">{label}</p>
                        <p className="text-[11px] font-black leading-none">{count.percent}%</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
