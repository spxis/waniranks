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
  createdAt: string;
};

type AdminAccountsSectionProps = {
  sessionAuthorized: boolean;
  accounts: AdminAccount[];
  loading: boolean;
  onRefreshOne: (accountId: string) => void;
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
}: AdminAccountsSectionProps) {
  if (!sessionAuthorized) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.08)] sm:p-8">
      <h2 className="text-2xl font-black text-foreground">Accounts</h2>
      <div className="mt-4 space-y-3">
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-600">No accounts yet.</p>
        ) : (
          accounts.map((account) => {
            const syncLockLabel = lockLabel(account);

            return (
              <article
                key={account.id}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-lg font-black text-foreground">{account.nickname}</p>
                  <p className="text-sm text-slate-600">
                    @{account.wkUsername} · Lv {account.wkLevel} · Due {account.pendingReviews}
                  </p>
                  <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                    Last sync {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(account.lastSyncedAt))} · {account.lastSyncStatus}
                  </p>
                  {syncLockLabel ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{syncLockLabel}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    Joined {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(account.createdAt))}
                    {account.joinedByName ? ` by ${account.joinedByName}` : ""}
                    {account.joinedByEmail ? ` (${account.joinedByEmail})` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading || isManualRefreshOnCooldown(account.lastSyncedAt)}
                  onClick={() => onRefreshOne(account.id)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isManualRefreshOnCooldown(account.lastSyncedAt) ? "Wait 1 minute" : "Refresh user"}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
