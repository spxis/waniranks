"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InviteCodeAccessPanel from "../InviteCodeAccessPanel";

type SessionStatus = {
  signedIn?: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

function startGoogleSignIn(callbackPath: string) {
  const callbackUrl = encodeURIComponent(callbackPath);
  window.location.assign(`/api/auth/signin/google?callbackUrl=${callbackUrl}`);
}

export default function LoginPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const data = (await response.json()) as SessionStatus;
        if (cancelled) {
          return;
        }

        setSignedIn(Boolean(data.signedIn));
        setUserEmail(data.user?.email ?? null);
      } catch {
        if (!cancelled) {
          setSignedIn(false);
          setUserEmail(null);
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-2xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back to leaderboard
        </Link>

        <section className="rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">User Login</p>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">Welcome Back</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base">
            Start with your invite code for direct access to your study page. Google remains available for signup and admin workflows.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <InviteCodeAccessPanel postLoginCallbackUrl="/join" />

            <aside className="rounded-2xl border border-line bg-surface-muted p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Google Sign-In</p>
              <p className="mt-1 text-sm text-foreground/75">Needed for creating a new board account and admin allowlisted access.</p>
              {signedIn ? (
                <>
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    Already signed in{userEmail ? ` as ${userEmail}` : " with Google"}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/join"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
                    >
                      Continue to join
                    </Link>
                    <Link
                      href="/signout?callbackUrl=/login"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
                    >
                      Sign out
                    </Link>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    startGoogleSignIn("/join");
                  }}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
                >
                  Continue With Google
                </button>
              )}
              <p className="mt-3 text-xs text-foreground/65">
                Invite flow is for existing linked accounts. Google flow is for signup and admin tasks.
              </p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
