import Link from "next/link";

import type { LeaderboardRow, LeaderboardTab } from "../lib/leaderboardTypes";
import {
  deltaClass,
  formatDate,
  formatDelta,
  formatNumber,
  formatSince,
  jlptCompletionClass,
  jlptCountsFromRow,
  kanjiCountFromRow,
  learnedKanjiFromRow,
  learnedPercent,
  learnedRadicalsFromRow,
  learnedVocabularyFromRow,
} from "../lib/leaderboardUtils";

type Props = {
  activeTab: LeaderboardTab;
  sortedRows: LeaderboardRow[];
  canViewAllUserPages: boolean;
  viewerWkUsername: string | null;
  filteredExpanded: Set<string>;
  onToggleRow: (id: string) => void;
  canRefreshAdmin: boolean;
  refreshingRowIds: Set<string>;
  onRefreshUser: (id: string) => Promise<void>;
};

export default function LeaderboardMobile({
  activeTab,
  sortedRows,
  canViewAllUserPages,
  viewerWkUsername,
  filteredExpanded,
  onToggleRow,
  canRefreshAdmin,
  refreshingRowIds,
  onRefreshUser,
}: Props) {
  const normalizedViewerWkUsername = viewerWkUsername?.trim().toLowerCase() ?? null;

  function canViewRowPage(rowWkUsername: string): boolean {
    if (canViewAllUserPages) {
      return true;
    }

    if (!normalizedViewerWkUsername) {
      return false;
    }

    return rowWkUsername.trim().toLowerCase() === normalizedViewerWkUsername;
  }

  return (
    <div className="space-y-4 md:hidden">
      {sortedRows.map((row, index) => (
        <article key={row.id} className="rounded-2xl border border-line bg-surface/90 p-4 shadow-[0_10px_24px_rgba(8,16,36,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {canViewRowPage(row.wkUsername) ? (
                <>
                  <Link href={`/users/${encodeURIComponent(row.wkUsername)}`} className="text-3xl font-black text-foreground hover:text-accent">
                    #{index + 1} {row.nickname}
                  </Link>
                  <p className="mt-0.5 text-sm text-foreground/60">
                    <Link href={`/users/${encodeURIComponent(row.wkUsername)}`} className="hover:text-accent">
                      @{row.wkUsername}
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-foreground">#{index + 1} {row.nickname}</p>
                  <p className="mt-0.5 text-sm text-foreground/60">@{row.wkUsername}</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onToggleRow(row.id)}
              aria-label={filteredExpanded.has(row.id) ? "Collapse row" : "Expand row"}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-black text-foreground"
            >
              {filteredExpanded.has(row.id) ? "▾" : "▸"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold text-foreground/80">
            <div className="rounded-xl bg-surface-muted px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Level</p>
              <p className="mt-1 text-xl font-black text-accent">Lv {row.wkLevel}</p>
              <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.wkLevel)}`}>{formatDelta(row.dailyDelta?.wkLevel)}</p>
            </div>
            {activeTab === "overall" ? (
              <>
                <div className="rounded-xl bg-surface-muted px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Reviewed</p>
                  <p className="mt-1 text-xl font-black text-foreground">{formatNumber(row.reviewCount)}</p>
                  <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.reviewCount)}`}>{formatDelta(row.dailyDelta?.reviewCount)}</p>
                </div>
                <div className="rounded-xl bg-surface-muted px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Score</p>
                  <p className="mt-1 text-xl font-black text-hot">{formatNumber(row.score)}</p>
                  <p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.score)}`}>{formatDelta(row.dailyDelta?.score)}</p>
                </div>
              </>
            ) : null}
            <div className="rounded-xl bg-surface-muted px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/60">Pending</p>
              <p className="mt-1 text-xl font-black text-accent">{formatNumber(row.pendingReviews)}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
            <span className="subject-pill subject-pill--radical">
              R {formatNumber(learnedRadicalsFromRow(row))}/{formatNumber(row.radicalCount)} ({learnedPercent(learnedRadicalsFromRow(row), row.radicalCount)}%)
            </span>
            <span className="subject-pill subject-pill--kanji">
              K {formatNumber(learnedKanjiFromRow(row))}/{formatNumber(kanjiCountFromRow(row))} ({learnedPercent(learnedKanjiFromRow(row), kanjiCountFromRow(row))}%)
            </span>
            <span className="subject-pill subject-pill--vocabulary">
              V {formatNumber(learnedVocabularyFromRow(row))}/{formatNumber(row.vocabularyCount)} ({learnedPercent(learnedVocabularyFromRow(row), row.vocabularyCount)}%)
            </span>
          </div>

          {activeTab === "overall" ? (
            <p className="mt-2 text-[11px] font-semibold text-foreground/60">
              Activity: {row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"} · {formatSince(row.lastActivityAt)}
            </p>
          ) : null}

          {filteredExpanded.has(row.id) ? (
            <div className="mt-3 space-y-2 text-xs font-semibold text-foreground/80">
              {canRefreshAdmin ? (
                <button
                  type="button"
                  disabled={refreshingRowIds.has(row.id)}
                  onClick={() => {
                    void onRefreshUser(row.id);
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-white px-4 text-[11px] font-black uppercase tracking-[0.1em] text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshingRowIds.has(row.id) ? "Refreshing..." : "Refresh user"}
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-muted p-2">Apprentice {formatNumber(row.apprenticeCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Guru {formatNumber(row.guruCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Master {formatNumber(row.masterCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Enlightened {formatNumber(row.enlightenedCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Burned {formatNumber(row.burnedCount)}</div>
                <div className="rounded-lg bg-surface-muted p-2">Level Kanji {formatNumber(row.levelKanjiLearned)}/{formatNumber(row.levelKanjiTotal)}</div>
              </div>
              <div className="rounded-lg bg-surface-muted p-2">Last updated {formatDate(row.lastSyncedAt)} · {formatSince(row.lastSyncedAt)}</div>
              <div className="rounded-lg bg-surface-muted p-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/70">Last Gurued</p>
                <p className="mt-1">R {row.lastRadicalGuruedAt ? formatDate(row.lastRadicalGuruedAt) : "-"}</p>
                <p>K {row.lastKanjiGuruedAt ? formatDate(row.lastKanjiGuruedAt) : "-"}</p>
                <p>V {row.lastVocabularyGuruedAt ? formatDate(row.lastVocabularyGuruedAt) : "-"}</p>
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
  );
}
