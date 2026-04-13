import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { captureSubjectReviewStatsFromApi, getSubjectHistory } from "@/lib/studyHistory";

type RouteContext = {
  params: Promise<{ accountId: string; subjectId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { accountId, subjectId: rawSubjectId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const subjectId = Number(rawSubjectId);
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      return NextResponse.json({ error: "Invalid subject ID." }, { status: 400 });
    }

    const url = new URL(request.url);
    const refresh = ["1", "true", "yes"].includes((url.searchParams.get("refresh") ?? "").toLowerCase());

    if (refresh) {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: {
          tokenEncrypted: true,
          tokenIv: true,
          tokenTag: true,
        },
      });

      if (!account) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }

      const token = decryptToken({
        encrypted: account.tokenEncrypted,
        iv: account.tokenIv,
        tag: account.tokenTag,
      });

      await captureSubjectReviewStatsFromApi({
        token,
        accountId,
        subjectId,
        source: "ondemand",
      });
    }

    const history = await getSubjectHistory(accountId, subjectId);
    return NextResponse.json({ subjectId, history });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not load subject history." }, { status: 500 });
  }
}
