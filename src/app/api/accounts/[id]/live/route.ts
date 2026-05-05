import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { prisma } from "@/lib/prisma";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/accounts/[id]/live",
    method: "GET",
    request: request,
    execute: async () => {

try {
                const { id } = await context.params;
                if (!(await canAccessAccount(request, id))) {
                  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
                }

                const account = await prisma.account.findUnique({
                  where: { id },
                  select: {
                    lastSyncedAt: true,
                    lastActivityAt: true,
                    pendingReviews: true,
                    apprenticeCount: true,
                    guruCount: true,
                  },
                });

                if (!account) {
                  return NextResponse.json({ error: "Account not found." }, { status: 404 });
                }

                return NextResponse.json({
                  lastSyncedAt: account.lastSyncedAt,
                  lastActivityAt: account.lastActivityAt,
                  pendingReviews: account.pendingReviews,
                  apprenticeCount: account.apprenticeCount,
                  guruCount: account.guruCount,
                });
              } catch (error) {
                console.error(error);
                return NextResponse.json({ error: "Could not fetch account live data." }, { status: 500 });
              }
    },
  });
}
