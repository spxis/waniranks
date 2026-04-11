import Link from "next/link";
import { Fragment } from "react";

import LeaderboardExpandedRow from "./LeaderboardExpandedRow";
import type { LeaderboardRow, LeaderboardTab, SortKey, SortState } from "../lib/leaderboardTypes";
import {
  deltaClass,
  formatDate,
  formatDelta,
  formatNumber,
  formatSince,
  kanjiCountFromRow,
  learnedKanjiFromRow,
  learnedPercent,
  learnedRadicalsFromRow,
  learnedVocabularyFromRow,
  stageCountForSubject,
  subjectLastGuruedAtFromRow,
  subjectLastGuruedItemFromRow,
  subjectTotalsForRow,
  subjectTypeForTab,
} from "../lib/leaderboardUtils";

type Props = {
  activeTab: LeaderboardTab;
  activeSort: SortState;
  sortedRows: LeaderboardRow[];
  filteredExpanded: Set<string>;
  canRefreshAdmin: boolean;
  refreshingRowIds: Set<string>;
  showItemSpreadPanel: boolean;
  showLevelProgressPanel: boolean;
  onRequestSort: (key: SortKey) => void;
  onToggleRow: (id: string) => void;
  onRefreshUser: (id: string) => Promise<void>;
  onToggleItemSpreadPanel: () => void;
  onToggleLevelProgressPanel: () => void;
};

function headerClassFor(activeSort: SortState, sortKey: SortKey): string {
  return activeSort.key !== sortKey ? "text-foreground/70" : "text-accent";
}

function sortIcon(activeSort: SortState, sortKey: SortKey): string {
  if (activeSort.key !== sortKey) {
    return "<>";
  }
  return activeSort.direction === "desc" ? "v" : "^";
}

export default function LeaderboardDesktop({
  activeTab,
  activeSort,
  sortedRows,
  filteredExpanded,
  canRefreshAdmin,
  refreshingRowIds,
  showItemSpreadPanel,
  showLevelProgressPanel,
  onRequestSort,
  onToggleRow,
  onRefreshUser,
  onToggleItemSpreadPanel,
  onToggleLevelProgressPanel,
}: Props) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full">
        <thead className="border-b border-line bg-surface-muted text-left text-xs font-bold uppercase tracking-[0.14em] text-foreground/70">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">
              <button type="button" onClick={() => onRequestSort("nickname")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "nickname")}`}>
                Nickname <span className="text-[10px]">{sortIcon(activeSort, "nickname")}</span>
              </button>
            </th>
            <th className="px-4 py-3">
              <button type="button" onClick={() => onRequestSort("wkLevel")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "wkLevel")}`}>
                Level <span className="text-[10px]">{sortIcon(activeSort, "wkLevel")}</span>
              </button>
            </th>
            {activeTab === "overall" ? (
              <th className="px-4 py-3">
                <button type="button" onClick={() => onRequestSort("reviewCount")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "reviewCount")}`}>
                  Reviewed <span className="text-[10px]">{sortIcon(activeSort, "reviewCount")}</span>
                </button>
              </th>
            ) : null}
            {activeTab === "overall" ? (
              <>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("radicalPercent")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "radicalPercent")}`}>Radicals (G+) <span className="text-[10px]">{sortIcon(activeSort, "radicalPercent")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("kanjiPercent")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "kanjiPercent")}`}>Kanji (G+) <span className="text-[10px]">{sortIcon(activeSort, "kanjiPercent")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("vocabularyPercent")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "vocabularyPercent")}`}>Vocab (G+) <span className="text-[10px]">{sortIcon(activeSort, "vocabularyPercent")}</span></button></th>
              </>
            ) : (
              <>
                {(() => {
                  const key = activeTab === "radicals" ? "radicalPercent" : activeTab === "kanji" ? "kanjiPercent" : "vocabularyPercent";
                  const label = activeTab === "radicals" ? "Radicals" : activeTab === "kanji" ? "Kanji" : "Vocab";
                  return (
                    <th className="px-4 py-3">
                      <button type="button" onClick={() => onRequestSort(key)} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, key)}`}>
                        {label} (G+) <span className="text-[10px]">{sortIcon(activeSort, key)}</span>
                      </button>
                    </th>
                  );
                })()}
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectApprentice")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectApprentice")}`}>Apprentice <span className="text-[10px]">{sortIcon(activeSort, "subjectApprentice")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectGuru")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectGuru")}`}>Guru <span className="text-[10px]">{sortIcon(activeSort, "subjectGuru")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectMaster")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectMaster")}`}>Master <span className="text-[10px]">{sortIcon(activeSort, "subjectMaster")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectEnlightened")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectEnlightened")}`}>Enlightened <span className="text-[10px]">{sortIcon(activeSort, "subjectEnlightened")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectBurned")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectBurned")}`}>Burned <span className="text-[10px]">{sortIcon(activeSort, "subjectBurned")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("subjectLastGuruedAt")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "subjectLastGuruedAt")}`}>Last Passed Guru <span className="text-[10px]">{sortIcon(activeSort, "subjectLastGuruedAt")}</span></button></th>
              </>
            )}
            {activeTab === "overall" ? (
              <>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("score")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "score")}`}>Score <span className="text-[10px]">{sortIcon(activeSort, "score")}</span></button></th>
                <th className="px-4 py-3"><button type="button" onClick={() => onRequestSort("lastActivityAt")} className={`inline-flex items-center gap-1 ${headerClassFor(activeSort, "lastActivityAt")}`}>Last Activity <span className="text-[10px]">{sortIcon(activeSort, "lastActivityAt")}</span></button></th>
              </>
            ) : null}
            <th className="px-4 py-3">More</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-sm text-foreground/90">
          {sortedRows.map((row, index) => (
            <Fragment key={row.id}>
              <tr className="transition hover:bg-surface-muted/80">
                <td className="px-4 py-3 font-black">#{index + 1}</td>
                <td className="px-4 py-3 text-lg font-black text-foreground">
                  <Link href={`/users/${encodeURIComponent(row.wkUsername)}`} className="hover:text-accent">{row.nickname}</Link>
                  <p className="text-xs font-semibold text-foreground/60"><Link href={`/users/${encodeURIComponent(row.wkUsername)}`} className="hover:text-accent">@{row.wkUsername}</Link></p>
                </td>
                <td className="px-4 py-3 text-lg font-black text-accent"><p>{row.wkLevel}</p><p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.wkLevel)}`}>{formatDelta(row.dailyDelta?.wkLevel)}</p></td>
                {activeTab === "overall" ? (
                  <td className="px-4 py-3 font-semibold"><p>{formatNumber(row.reviewCount)}</p><p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.reviewCount)}`}>{formatDelta(row.dailyDelta?.reviewCount)}</p></td>
                ) : null}
                {activeTab === "overall" ? (
                  <>
                    <td className="px-4 py-3"><span className="subject-pill subject-pill--radical">{formatNumber(learnedRadicalsFromRow(row))}</span><p className="mt-1 text-[10px] font-semibold text-foreground/60">/ {formatNumber(row.radicalCount)} ({learnedPercent(learnedRadicalsFromRow(row), row.radicalCount)}%)</p></td>
                    <td className="px-4 py-3"><span className="subject-pill subject-pill--kanji">{formatNumber(learnedKanjiFromRow(row))}</span><p className="mt-1 text-[10px] font-semibold text-foreground/60">/ {formatNumber(kanjiCountFromRow(row))} ({learnedPercent(learnedKanjiFromRow(row), kanjiCountFromRow(row))}%)</p></td>
                    <td className="px-4 py-3"><span className="subject-pill subject-pill--vocabulary">{formatNumber(learnedVocabularyFromRow(row))}</span><p className="mt-1 text-[10px] font-semibold text-foreground/60">/ {formatNumber(row.vocabularyCount)} ({learnedPercent(learnedVocabularyFromRow(row), row.vocabularyCount)}%)</p></td>
                  </>
                ) : (
                  (() => {
                    const subjectType = subjectTypeForTab(activeTab) ?? "radical";
                    const totals = subjectTotalsForRow(row, subjectType);
                    const lastItem = subjectLastGuruedItemFromRow(row, subjectType);
                    const lastAt = subjectLastGuruedAtFromRow(row, subjectType);

                    return (
                      <>
                        <td className="px-4 py-3"><span className={`subject-pill ${subjectType === "radical" ? "subject-pill--radical" : subjectType === "kanji" ? "subject-pill--kanji" : "subject-pill--vocabulary"}`}>{formatNumber(totals.learned)}</span><p className="mt-1 text-[10px] font-semibold text-foreground/60">/ {formatNumber(totals.total)} ({totals.percent}%)</p></td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{formatNumber(stageCountForSubject(row, subjectType, "apprentice"))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{formatNumber(stageCountForSubject(row, subjectType, "guru"))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{formatNumber(stageCountForSubject(row, subjectType, "master"))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{formatNumber(stageCountForSubject(row, subjectType, "enlightened"))}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground/80">{formatNumber(stageCountForSubject(row, subjectType, "burned"))}</td>
                        <td className="px-4 py-3 text-xs text-foreground/75"><p className="font-bold text-foreground">{lastItem?.label ?? "-"}</p><p className="mt-0.5 text-[11px]">{lastItem?.reading ?? ""}</p><p className="mt-1 text-[10px] text-foreground/60">{lastAt ? formatDate(lastAt) : "-"}</p></td>
                      </>
                    );
                  })()
                )}
                {activeTab === "overall" ? (
                  <>
                    <td className="px-4 py-3 text-lg font-black text-hot"><p>{formatNumber(row.score)}</p><p className={`mt-0.5 text-[10px] font-semibold ${deltaClass(row.dailyDelta?.score)}`}>{formatDelta(row.dailyDelta?.score)}</p></td>
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.08em] text-foreground/60"><p>{row.lastActivityAt ? formatDate(row.lastActivityAt) : "-"}</p><p className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-foreground/50">{formatSince(row.lastActivityAt)}</p></td>
                  </>
                ) : null}
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleRow(row.id)}
                    aria-label={filteredExpanded.has(row.id) ? "Collapse row" : "Expand row"}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-black text-foreground"
                  >
                    {filteredExpanded.has(row.id) ? "▾" : "▸"}
                  </button>
                </td>
              </tr>
              {filteredExpanded.has(row.id) ? (
                <tr className="bg-surface-muted/40">
                  <td colSpan={activeTab === "overall" ? 10 : 11} className="px-4 py-4">
                    <LeaderboardExpandedRow
                      row={row}
                      activeTab={activeTab}
                      canRefreshAdmin={canRefreshAdmin}
                      isRefreshing={refreshingRowIds.has(row.id)}
                      onRefreshUser={() => onRefreshUser(row.id)}
                      showItemSpreadPanel={showItemSpreadPanel}
                      showLevelProgressPanel={showLevelProgressPanel}
                      onToggleItemSpreadPanel={onToggleItemSpreadPanel}
                      onToggleLevelProgressPanel={onToggleLevelProgressPanel}
                    />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
