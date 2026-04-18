"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import InviteCodeAccessPanel from "../InviteCodeAccessPanel";

export default function LoginPage() {
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
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">Sign In To WaniRanks</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Use an invite code for direct access, or use Google for signup/admin workflows.
          </p>

          <div className="mt-5">
            <InviteCodeAccessPanel postLoginCallbackUrl="/join" />
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-surface-muted p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/70">Google Sign-In</p>
            <p className="mt-1 text-sm text-foreground/75">Needed for new signup and admin allowlisted access.</p>
            <button
              type="button"
              onClick={() => {
                void signIn("google", { callbackUrl: "/join" }, { prompt: "select_account" });
              }}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
            >
              Continue With Google
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
