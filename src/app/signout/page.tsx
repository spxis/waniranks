import Link from "next/link";
import SignOutActionButton from "./SignOutActionButton";

type PageProps = {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    clearAdmin?: string | string[];
  }>;
};

function normalizeCallbackUrl(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/")) {
    return "/";
  }

  return raw;
}

function hasClearAdminFlag(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1";
}

export default async function SignOutPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const callbackUrl = normalizeCallbackUrl(query.callbackUrl);
  const clearAdmin = hasClearAdminFlag(query.clearAdmin);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0" />
      <main className="relative mx-auto w-full max-w-xl space-y-5">
        <Link
          href={callbackUrl}
          className="inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
        >
          Back
        </Link>

        <section className="animate-enter rounded-[2rem] border border-line bg-surface/90 p-6 shadow-[0_24px_80px_rgba(15,111,255,0.15)] backdrop-blur sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Session</p>
          <h1 className="mt-2 text-4xl leading-[0.95] text-foreground sm:text-5xl">Sign out</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            This will end your Google session for UmaKuma{clearAdmin ? " and clear remembered admin access on this device" : ""}.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <SignOutActionButton callbackUrl={callbackUrl} clearAdmin={clearAdmin} />
            <Link
              href={callbackUrl}
              className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-surface-muted"
            >
              Cancel
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}