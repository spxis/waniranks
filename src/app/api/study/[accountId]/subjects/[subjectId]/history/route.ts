import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { STUDY_HISTORY_REFRESH_COOLDOWN_MS } from "@/lib/refreshPolicy";
import {
  captureSubjectReviewStatsFromApi,
  fetchSubjectReviewTransitionsFromApi,
  getSubjectHistory,
} from "@/lib/studyHistory";

type RouteContext = {
  params: Promise<{ accountId: string; subjectId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/study/[accountId]/subjects/[subjectId]/history",
    method: "GET",
    request,
    execute: async () => {
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
        const forceRefresh = ["1", "true", "yes"].includes((url.searchParams.get("force") ?? "").toLowerCase());
        const includeTransitions = ["1", "true", "yes"].includes((url.searchParams.get("transitions") ?? "").toLowerCase());

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

        if (refresh) {
          const latestSnapshot = await prisma.subjectReviewStatsSnapshot.findFirst({
            where: { accountId, subjectId },
            orderBy: { capturedAt: "desc" },
            select: { capturedAt: true },
          });

          const hasFreshLocalSnapshot =
            latestSnapshot !== null &&
            Date.now() - latestSnapshot.capturedAt.getTime() < STUDY_HISTORY_REFRESH_COOLDOWN_MS;

          if (!hasFreshLocalSnapshot || forceRefresh) {
            await captureSubjectReviewStatsFromApi({
              token,
              accountId,
              subjectId,
              source: "ondemand",
            });
          }
        }

        const [history, transitions] = await Promise.all([
          getSubjectHistory(accountId, subjectId),
          includeTransitions
            ? fetchSubjectReviewTransitionsFromApi({
                token,
                subjectId,
                limit: 400,
              })
            : Promise.resolve([]),
        ]);

        return NextResponse.json({ subjectId, history, transitions });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not load subject history." }, { status: 500 });
      }
    },
  });
}
