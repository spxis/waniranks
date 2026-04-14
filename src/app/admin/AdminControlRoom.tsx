import Link from "next/link";

import AdminStatusBadge from "./AdminStatusBadge";
import type { AdminControlRoomProps } from "./AdminControlRoom.types";

export default function AdminControlRoom({
  nickname,
  token,
  adminKey,
  rememberDevice,
  sessionAuthorized,
  checkingSession,
  googleConfigured,
  signedIn,
  emailAllowed,
  userName,
  userEmail,
  status,
  loading,
  jlptRefreshing,
  jlptEnriching,
  onSetNickname,
  onSetToken,
  onSetAdminKey,
  onSetRememberDevice,
  onAddAccount,
  onCompleteGoogleSignOut,
  onRefreshAll,
  onRefreshJlptList,
  onEnrichJlptKanji,
  onClearAdminSession,
}: AdminControlRoomProps) {
  return (
    <section className="animate-enter rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] backdrop-blur sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Control room</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl leading-[0.95] text-foreground sm:text-5xl">Admin Panel</h1>
        <AdminStatusBadge
          checkingSession={checkingSession}
          sessionAuthorized={sessionAuthorized}
          signedIn={signedIn}
          emailAllowed={emailAllowed}
        />
      </div>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Manage family accounts, rotate tokens, and push fresh stats to the leaderboard.
      </p>

      {googleConfigured ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/api/auth/signin/google?callbackUrl=/admin&prompt=select_account"
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
          >
            Sign in with Google
          </Link>
          <button
            type="button"
            onClick={onCompleteGoogleSignOut}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
          >
            Sign out completely
          </button>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold">{signedIn ? `Signed in: ${userName ?? "Google user"}` : "Not signed in"}</p>
        <p className="mt-1 text-xs">{userEmail ?? "No Google account in session."}</p>
        {!checkingSession && signedIn && !emailAllowed ? (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            This Google account is not on admin allowlist.
          </p>
        ) : null}
      </div>

      {sessionAuthorized ? (
        <form onSubmit={onAddAccount} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              Admin API key
            </span>
            <input
              type="password"
              value={adminKey}
              onChange={(event) => onSetAdminKey(event.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder={sessionAuthorized ? "Already remembered on this device" : "Paste admin key"}
            />
            <p className="mt-1.5 text-xs font-semibold text-slate-500">
              {checkingSession
                ? "Checking admin session..."
                : sessionAuthorized
                  ? "Admin unlocked by Google sign-in or remembered device cookie."
                  : "Use Google sign-in (recommended) or API key once to unlock this browser/device."}
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              Family nickname
            </span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={32}
              value={nickname}
              onChange={(event) => onSetNickname(event.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder="e.g. John"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              WaniKani API token
            </span>
            <input
              type="password"
              required
              value={token}
              onChange={(event) => onSetToken(event.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-muted px-4 py-3 text-base text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              placeholder="Paste personal token"
            />
          </label>

          <label className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => onSetRememberDevice(event.target.checked)}
              className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
            />
            Remember admin access on this device for 30 days (stored as HttpOnly cookie)
          </label>

          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save account
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onRefreshAll}
              className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh all stats
            </button>
          </div>

          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading || jlptRefreshing || jlptEnriching}
              onClick={onRefreshJlptList}
              className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {jlptRefreshing ? "Refreshing JLPT..." : "Refresh JLPT List"}
            </button>
            <button
              type="button"
              disabled={loading || jlptRefreshing || jlptEnriching}
              onClick={onEnrichJlptKanji}
              className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {jlptEnriching ? "Enriching JLPT..." : "Enrich JLPT Data"}
            </button>
          </div>

          <button
            type="button"
            disabled={loading || !sessionAuthorized}
            onClick={onClearAdminSession}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-5 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Forget this device
          </button>
        </form>
      ) : (
        <div className="mt-7 rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-700">
          Admin tools hidden. Sign in with allowlisted Google account, or use admin API key.
        </div>
      )}

      {status.message ? (
        <p
          className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
            status.type === "error"
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
