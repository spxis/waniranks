import Link from "next/link";

import { formatDateShort, formatDateTimeShort } from "@/lib/timeFormat";

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
  onRefreshOne: (accountId: string) => void;
  onAssignInviteCode: (accountId: string) => Promise<string | null>;
  onResetInviteCode: (accountId: string) => Promise<void>;
};

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
  onRefreshOne,
  onAssignInviteCode,
  onResetInviteCode,
}: AdminAccountsSectionProps) {
  if (!sessionAuthorized) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.08)] sm:p-8">
      <h2 className="text-2xl font-black text-foreground">Users</h2>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        Admin can impersonate by opening a user page and submitting study actions with that user token.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface-muted">
        {accounts.length === 0 ? (
          <p className="p-4 text-sm text-slate-600">No accounts yet.</p>
        ) : (
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Sync</th>
                <th className="px-3 py-2">Invite Code</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const syncLockLabel = lockLabel(account);

                return (
                  <tr key={account.id} className="border-b border-line/70 align-top last:border-b-0">
                    <td className="px-3 py-3">
                      <p className="font-black text-foreground">{account.nickname}</p>
                      <p className="text-xs text-slate-600">
                        @{account.wkUsername} · Lv {account.wkLevel} · Due {account.pendingReviews}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <p>{formatDateShort(account.createdAt)}</p>
                      <p>{account.joinedByName ? `by ${account.joinedByName}` : ""}</p>
                      <p>{account.joinedByEmail ?? ""}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <p>{formatDateTimeShort(account.lastSyncedAt)}</p>
                      <p className="uppercase tracking-[0.08em]">{account.lastSyncStatus}</p>
                      {syncLockLabel ? <p>{syncLockLabel}</p> : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">
                      {account.inviteCodeUpdatedAt
                        ? `Set ${formatDateTimeShort(account.inviteCodeUpdatedAt)}`
                        : "Not set"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading || isManualRefreshOnCooldown(account.lastSyncedAt)}
                          onClick={() => onRefreshOne(account.id)}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Set Invite
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            void onResetInviteCode(account.id);
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset Invite
                        </button>
                        <Link
                          href={`/users/${encodeURIComponent(account.wkUsername)}`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-3 text-[11px] font-black uppercase tracking-[0.08em] text-accent"
                        >
                          Open As User
                        </Link>
                        <Link
                          href={`/admin/users/${encodeURIComponent(account.id)}/history`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-800 transition hover:bg-surface"
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
    </section>
  );
}
