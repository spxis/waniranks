"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatDateShort, formatDateTimeShort } from "@/lib/timeFormat";

import AdminPanelHeader from "./AdminPanelHeader";
import AdminPaginationControls from "./AdminPaginationControls";

export type AdminAccount = {
  id: string;
  nickname: string;
  wkUsername: string;
  wkLevel: number;
  pendingReviews: number;
  lastSyncedAt: string;
  lastSyncStatus: string;
  isSyncing: boolean;
  syncLockUntil: string | null;
  joinedByName: string | null;
  joinedByEmail: string | null;
  inviteCodeUpdatedAt: string | null;
  createdAt: string;
};

type AdminAccountsSectionProps = {
  sessionAuthorized: boolean;
  accounts: AdminAccount[];
  loading: boolean;
  viewerEmail?: string | null;
  generatedInviteCodesByAccountId?: Record<string, string>;
  onRefreshOne: (accountId: string) => void;
  onAssignInviteCode: (accountId: string) => Promise<string | null>;
  onResetInviteCode: (accountId: string) => Promise<void>;
};

type SortBy = "nickname" | "wkLevel" | "pendingReviews" | "lastSyncedAt" | "createdAt";
type SortDir = "asc" | "desc";

function sortIndicator(activeSortBy: SortBy, sortBy: SortBy, sortDir: SortDir): string {
  if (activeSortBy !== sortBy) {
    return "<>";
  }

  return sortDir === "asc" ? "^" : "v";
}

function isManualRefreshOnCooldown(lastSyncedAt: string): boolean {
  const last = new Date(lastSyncedAt).getTime();
  return Date.now() - last < 60_000;
}

function lockLabel(account: AdminAccount): string | null {
  if (!account.isSyncing || !account.syncLockUntil) {
    return null;
  }

  const untilMs = new Date(account.syncLockUntil).getTime();
  if (Number.isNaN(untilMs)) {
    return "Locked";
  }

  const remainingMs = untilMs - Date.now();
  if (remainingMs <= 0) {
    return "Lock clearing";
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  return `Locked ${remainingSeconds}s`;
}

export default function AdminAccountsSection({
  sessionAuthorized,
  accounts,
  loading,
  viewerEmail = null,
  generatedInviteCodesByAccountId = {},
  onRefreshOne,
  onAssignInviteCode,
  onResetInviteCode,
}: AdminAccountsSectionProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<SortBy>("nickname");
  const [sortDir, setSortDir] = useState<SortDir>("asc");


  function toggleSort(nextSortBy: SortBy) {
    if (sortBy !== nextSortBy) {
      setSortBy(nextSortBy);
      setSortDir(nextSortBy === "lastSyncedAt" || nextSortBy === "createdAt" ? "desc" : "asc");
      return;
    }

    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  const sortedAccounts = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;
    return [...accounts].sort((left, right) => {
      let comparison = 0;

      if (sortBy === "nickname") {
        comparison = left.nickname.localeCompare(right.nickname);
      } else if (sortBy === "wkLevel") {
        comparison = left.wkLevel - right.wkLevel;
      } else if (sortBy === "pendingReviews") {
        comparison = left.pendingReviews - right.pendingReviews;
      } else if (sortBy === "lastSyncedAt") {
        comparison = left.lastSyncedAt.localeCompare(right.lastSyncedAt);
      } else if (sortBy === "createdAt") {
        comparison = left.createdAt.localeCompare(right.createdAt);
      }

      if (comparison === 0) {
        comparison = left.id.localeCompare(right.id);
      }

      return comparison * direction;
    });
  }, [accounts, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedAccounts.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedAccounts = useMemo(() => {
    const offset = (safePage - 1) * pageSize;
    return sortedAccounts.slice(offset, offset + pageSize);
  }, [pageSize, safePage, sortedAccounts]);

  if (!sessionAuthorized) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <AdminPanelHeader
        label="Users"
        title="Manage accounts"
        description="Refresh users, rotate invite codes, and open per-user admin history."
      />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        {accounts.length === 0 ? (
          <p className="p-4 text-sm text-foreground/70">No accounts yet.</p>
        ) : (
          <table className="min-w-245 w-full border-collapse text-sm">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-foreground/70">
              <tr className="border-b border-line">
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort("nickname")} className="font-bold">User {sortIndicator(sortBy, "nickname", sortDir)}</button></th>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort("wkLevel")} className="font-bold">Level {sortIndicator(sortBy, "wkLevel", sortDir)}</button></th>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort("pendingReviews")} className="font-bold">Due {sortIndicator(sortBy, "pendingReviews", sortDir)}</button></th>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort("createdAt")} className="font-bold">Joined {sortIndicator(sortBy, "createdAt", sortDir)}</button></th>
                <th className="px-3 py-2"><button type="button" onClick={() => toggleSort("lastSyncedAt")} className="font-bold">Sync {sortIndicator(sortBy, "lastSyncedAt", sortDir)}</button></th>
                <th className="px-3 py-2">Invite Code</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedAccounts.map((account) => {
                const syncLockLabel = lockLabel(account);
                const linkedEmail = account.joinedByEmail?.trim().toLowerCase() ?? null;
                const isMe = Boolean(viewerEmail && linkedEmail && linkedEmail === viewerEmail.trim().toLowerCase());
                const generatedInviteCode = generatedInviteCodesByAccountId[account.id] ?? null;

                return (
                  <tr key={account.id} className="border-b border-line/70 align-top hover:bg-surface-muted/40 last:border-b-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{account.nickname}</p>
                        {isMe ? (
                          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                            Me
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-foreground/65">
                        @{account.wkUsername}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-foreground/80">Lv {account.wkLevel}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-foreground/80">{account.pendingReviews}</td>
                    <td className="px-3 py-3 text-xs text-foreground/65">
                      <p>{formatDateShort(account.createdAt)}</p>
                      <p>{account.joinedByName ? `by ${account.joinedByName}` : ""}</p>
                      <p>{account.joinedByEmail ?? ""}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-foreground/65">
                      <p>{formatDateTimeShort(account.lastSyncedAt)}</p>
                      <p className="uppercase tracking-[0.08em]">{account.lastSyncStatus}</p>
                      {syncLockLabel ? <p>{syncLockLabel}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-foreground/75">
                      <p>
                        {account.inviteCodeUpdatedAt
                          ? `Set ${formatDateTimeShort(account.inviteCodeUpdatedAt)}`
                          : "Not set"}
                      </p>
                      {generatedInviteCode ? (
                        <div className="mt-1 flex items-center gap-2">
                          <code className="rounded border border-line bg-white px-2 py-0.5 text-[11px] font-bold tracking-[0.12em] text-slate-800">
                            {generatedInviteCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(generatedInviteCode).catch(() => {
                                // Ignore clipboard failures.
                              });
                            }}
                            className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-surface"
                          >
                            Copy
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading || isManualRefreshOnCooldown(account.lastSyncedAt)}
                          onClick={() => onRefreshOne(account.id)}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isManualRefreshOnCooldown(account.lastSyncedAt) ? "Wait" : "Refresh"}
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={async () => {
                            const code = await onAssignInviteCode(account.id);
                            if (code && typeof window !== "undefined") {
                              await navigator.clipboard.writeText(code).catch(() => {
                                // Ignore clipboard failures.
                              });
                            }
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Set Invite
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            void onResetInviteCode(account.id);
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset Invite
                        </button>
                        <Link
                          href={`/users/${encodeURIComponent(account.wkUsername)}`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-accent"
                        >
                          Open As User
                        </Link>
                        <Link
                          href={`/admin/users/${encodeURIComponent(account.id)}/history`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface"
                        >
                          History
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {accounts.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground/75">
            Page size
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-8 rounded border border-line bg-surface px-2"
              disabled={loading}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <AdminPaginationControls
            page={safePage}
            pageCount={pageCount}
            itemLabel="accounts"
            total={sortedAccounts.length}
            onFirst={() => setPage(1)}
            onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
            onNext={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            onLast={() => setPage(pageCount)}
            onPageChange={(nextPage) => setPage(nextPage)}
            disabled={loading}
          />
        </div>
      ) : null}
    </section>
  );
}
