import { getServerSession } from "next-auth";

import { isAuthorizedAdmin } from "@/lib/admin";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function canAccessAccount(request: Request, accountId: string): Promise<boolean> {
  if (await isAuthorizedAdmin(request)) {
    return true;
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  if (!email) {
    return false;
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { joinedByEmail: true },
  });
  const linkedEmail = account?.joinedByEmail?.trim().toLowerCase() ?? null;

  return Boolean(linkedEmail && linkedEmail === email);
}
