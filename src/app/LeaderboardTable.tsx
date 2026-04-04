"use client";

import Link from "next/link";
import { Fragment } from "react";
import { useEffect } from "react";
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
  levelKanjiGuruPlus: number;
  levelKanjiLocked: number;
  itemSpread: unknown;
  jlptCounts: unknown;
  lastActivityAt: string | null;
  score: number;
  lastSyncedAt: string;
};

type Props = {
  rows: LeaderboardRow[];
};

type ItemSpreadRow = {
  radical: number;
  kanji: number;
  vocabulary: number;
  total: number;
};

type ItemSpread = {
  apprentice: ItemSpreadRow;
  guru: ItemSpreadRow;
  master: ItemSpreadRow;
  enlightened: ItemSpreadRow;
  burned: ItemSpreadRow;
  totals: ItemSpreadRow;
};

const EMPTY_ITEM_SPREAD: ItemSpread = {
  apprentice: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  guru: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  master: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  enlightened: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  burned: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
  totals: { radical: 0, kanji: 0, vocabulary: 0, total: 0 },
};

function isItemSpread(value: unknown): value is ItemSpread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys: Array<keyof ItemSpread> = [
    "apprentice",
    "guru",
    "master",
    "enlightened",
    "burned",
    "totals",
  ];

  return keys.every((key) => {
    const row = record[key];
    if (!row || typeof row !== "object") {
      return false;
    }

    const typedRow = row as Record<string, unknown>;
    return (
      typeof typedRow.radical === "number" &&
      typeof typedRow.kanji === "number" &&
      typeof typedRow.vocabulary === "number" &&
      typeof typedRow.total === "number"
    );
  });
}

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

function kanjiCountFromRow(row: LeaderboardRow): number {
  if (isItemSpread(row.itemSpread)) {
    return row.itemSpread.totals.kanji;
  }

  return 0;
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
              <th className="px-4 py-3">Kanji</th>
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
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--radical">{formatNumber(row.radicalCount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--kanji">{formatNumber(kanjiCountFromRow(row))}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="subject-pill subject-pill--vocabulary">{formatNumber(row.vocabularyCount)}</span>
                  </td>
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
                    <td colSpan={10} className="px-4 py-4">
                      {(() => {
                        const spread = isItemSpread(row.itemSpread) ? row.itemSpread : EMPTY_ITEM_SPREAD;
                        const jlpt = jlptCountsFromRow(row);
                        const kanjiGoal = Math.ceil(row.levelKanjiTotal * 0.9);
                        const remainingToLevelUp = Math.max(0, kanjiGoal - row.levelKanjiGuruPlus);

                        return (
                      <div className="space-y-3">
                      <div className="grid gap-3 lg:grid-cols-[0.7fr_1.5fr_1.5fr_1fr]">
                        <div className="rounded-2xl border border-accent/25 bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                            Due Now
                          </p>
                          <p className="mt-1 text-4xl font-black text-accent">
                            {formatNumber(row.pendingReviews)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-line bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                            SRS Stages
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-slate-600">Apprentice</p>
                              <p className="text-xl font-black leading-none text-slate-900">{formatNumber(row.apprenticeCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-slate-600">Guru</p>
                              <p className="text-xl font-black leading-none text-slate-900">{formatNumber(row.guruCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-slate-600">Master</p>
                              <p className="text-xl font-black leading-none text-slate-900">{formatNumber(row.masterCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-slate-600">Enlightened</p>
                              <p className="text-xl font-black leading-none text-slate-900">{formatNumber(row.enlightenedCount)}</p>
                            </div>
                            <div className="min-w-[84px] flex-1 rounded-xl border border-line bg-surface-muted p-2 text-center">
                              <p className="text-[10px] font-bold uppercase text-slate-600">Burned</p>
                              <p className="text-xl font-black leading-none text-slate-900">{formatNumber(row.burnedCount)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-line bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
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

                        <div className="rounded-2xl border border-line bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                            Level {row.wkLevel} Kanji
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                              Learned: {formatNumber(row.levelKanjiLearned)}
                            </span>
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                              Total: {formatNumber(row.levelKanjiTotal)}
                            </span>
                            <span className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                              Locked: {formatNumber(row.levelKanjiLocked)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1.8fr_1.2fr]">
                        <div className="rounded-2xl border border-line bg-white p-4">
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
                              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700"
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
                                  <div key={label} className="grid grid-cols-[1.1fr_0.7fr_0.7fr_0.8fr_0.8fr] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2 py-1 text-xs font-semibold text-slate-700">
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

                        <div className="rounded-2xl border border-line bg-white p-4">
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
                              className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700"
                            >
                              {showLevelProgressPanel ? "Collapse" : "Expand"}
                            </button>
                          </div>
                          {showLevelProgressPanel ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-slate-700">Level {row.wkLevel}</p>
                              <div className="mt-3 h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-kanji"
                                  style={{ width: `${row.levelKanjiTotal === 0 ? 0 : Math.min(100, Math.round((row.levelKanjiGuruPlus / row.levelKanjiTotal) * 100))}%` }}
                                />
                              </div>
                              <p className="mt-2 text-sm font-semibold text-slate-700">
                                Guru+ Kanji: {formatNumber(row.levelKanjiGuruPlus)}/{formatNumber(row.levelKanjiTotal)}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {row.levelKanjiGuruPlus >= kanjiGoal
                                  ? "Level-up gate passed; cleanup remains."
                                  : `Need ${formatNumber(remainingToLevelUp)} more Guru+ kanji to level up.`}
                              </p>
                            </>
                          ) : null}
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
                <div className="rounded-lg bg-surface-muted p-2">Kanji {formatNumber(kanjiCountFromRow(row))}</div>
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
