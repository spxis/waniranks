import Link from "next/link";
import { getServerSession } from "next-auth";

import StudyHistoryTable from "@/app/shared/StudyHistoryTable";
import { authOptions } from "@/lib/auth";
import UserHeaderMenu from "@/app/users/[nickname]/UserHeaderMenu";
import { resolveViewerMenuInfo } from "@/app/users/[nickname]/userPageAuth";

type PageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function AdminUserHistoryPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const viewerEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const viewerMenuInfo = await resolveViewerMenuInfo({
    viewerEmail,
    sessionName: session?.user?.name?.trim() ?? null,
  });
  const { accountId } = await params;

  return (
    <div className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <main className="relative mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.12em] text-foreground">
            Back to admin
          </Link>
          <div className="ml-auto">
            <UserHeaderMenu viewerMenuInfo={viewerMenuInfo} />
          </div>
        </div>

        <StudyHistoryTable
          endpoint={`/api/admin/study-history?accountId=${encodeURIComponent(accountId)}`}
          showUserColumn={true}
          heading="User Study Submission History"
        />
      </main>
    </div>
  );
}
