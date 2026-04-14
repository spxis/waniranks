import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { fetchAssignmentCount } from "../queue/queueRouteUtils";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

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

    const [reviews, lessons] = await Promise.all([
      fetchAssignmentCount("/assignments?immediately_available_for_review=true", token),
      fetchAssignmentCount("/assignments?immediately_available_for_lessons=true", token),
    ]);

    return NextResponse.json(
      {
        reviews,
        lessons,
        all: reviews + lessons,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
        },
      },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch study counts." }, { status: 500 });
  }
}