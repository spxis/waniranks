import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StudyHistoryTable from "@/app/shared/StudyHistoryTable";
import { canViewUserPage, resolveViewerMenuInfo } from "../userPageAuth";

type PageProps = {
  params: Promise<{ nickname: string }>;
};

export default async function UserHistoryPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const viewerMenuInfo = await resolveViewerMenuInfo({
    viewerEmail,
    sessionName: session?.user?.name?.trim() ?? null,
  });

  const { nickname } = await params;
  const userKey = decodeURIComponent(nickname);

  const account = await prisma.account.findFirst({
    where: { wkUsername: userKey },
    select: { id: true, nickname: true, wkUsername: true },
  });

  if (!account) {
    notFound();
  }

  const canViewThisPage = canViewUserPage({
    viewerEmail,
    viewerMenuInfo,
    targetWkUsername: account.wkUsername,
  });
  if (!canViewThisPage) {
    notFound();
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/users/${encodeURIComponent(account.wkUsername)}`} className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.12em] text-foreground">
            Back to user page
          </Link>
          <Link href="/" className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.12em] text-foreground">
            Leaderboard
          </Link>
        </div>

        <StudyHistoryTable
          endpoint={`/api/study/${account.id}/history`}
          showUserColumn={false}
          heading={`${account.nickname} Study Submission History`}
        />
      </main>
    </div>
  );
}
