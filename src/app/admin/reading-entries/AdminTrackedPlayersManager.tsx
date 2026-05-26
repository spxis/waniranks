import Link from "next/link";

import type { AdminReadingEntryMember } from "./AdminReadingEntries.types";

type AdminTrackedPlayersManagerProps = {
  members: AdminReadingEntryMember[];
  trackedMemberSet: Set<string>;
  trackingLoading: boolean;
  loading: boolean;
  saving: boolean;
  trackingUpdatingAccountId: string | null;
  onRefreshRoster: () => void;
  onToggleTrackedMember: (memberId: string, tracked: boolean) => void;
};

export default function AdminTrackedPlayersManager({
  members,
  trackedMemberSet,
  trackingLoading,
  loading,
  saving,
  trackingUpdatingAccountId,
  onRefreshRoster,
  onToggleTrackedMember,
}: AdminTrackedPlayersManagerProps) {
  const controlsDisabled = trackingLoading || loading || saving || Boolean(trackingUpdatingAccountId);

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Tracked players</p>
          <p className="mt-1 text-sm text-foreground/75">Choose who appears in the reading challenge leaderboard.</p>
        </div>
        <button
          type="button"
          onClick={onRefreshRoster}
          className="h-9 rounded-full border border-line bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80"
          disabled={controlsDisabled}
        >
          {trackingLoading ? "Refreshing..." : "Refresh roster"}
        </button>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/70">
          {loading ? "Loading members..." : "No members yet. Add users first in Account operations."}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((member) => {
            const tracked = trackedMemberSet.has(member.id);
            const updating = trackingUpdatingAccountId === member.id;

            return (
              <div key={member.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onToggleTrackedMember(member.id, !tracked);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                    tracked
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-line bg-surface text-foreground/70"
                  }`}
                  disabled={controlsDisabled}
                >
                  {member.nickname}: {updating ? "Saving..." : tracked ? "On" : "Off"}
                </button>

                <Link
                  href={`/users/${encodeURIComponent(member.wkUsername)}?dashboard=read`}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-foreground/80 hover:bg-surface"
                >
                  Open challenge
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
