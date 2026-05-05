import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { clearStudyQueueCache } from "@/lib/studyQueueCache";
import { putWaniKani } from "@/lib/wanikani/http";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

const lessonStartSchema = z.object({
  assignmentId: z.number().int().positive(),
});

export async function POST(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/study/[accountId]/lesson/start",
    method: "POST",
    request,
    execute: async () => {
      try {
        const { accountId } = await context.params;
        if (!(await canAccessAccount(request, accountId))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

    const json = await request.json();
    const parsed = lessonStartSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
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

    try {
      await putWaniKani(`/assignments/${parsed.data.assignmentId}/start`, token, {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "WaniKani API error";

      // Treat already-started conflicts as handled so study flow can continue.
      if (message.includes("422") || message.includes("409")) {
        clearStudyQueueCache(accountId);
        return NextResponse.json({ ok: true, skipped: true, reason: "already-started-or-unavailable" });
      }

      if (message.includes("429")) {
        return NextResponse.json({ error: "Rate limited by WaniKani. Please retry in a moment." }, { status: 429 });
      }

      return NextResponse.json({ error: message }, { status: 502 });
    }

    clearStudyQueueCache(accountId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
        return NextResponse.json({ error: "Could not start lesson." }, { status: 500 });
      }
    },
  });
}