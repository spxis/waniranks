import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { refreshAccountById } from "@/lib/sync";
import { postWaniKani } from "@/lib/wanikani/http";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

const reviewSchema = z.object({
  assignmentId: z.number().int().positive(),
  result: z.enum(["correct", "wrong"]),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = reviewSchema.safeParse(json);
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

    const incorrect = parsed.data.result === "wrong" ? 1 : 0;
    await postWaniKani("/reviews", token, {
      review: {
        assignment_id: parsed.data.assignmentId,
        incorrect_meaning_answers: incorrect,
        incorrect_reading_answers: incorrect,
      },
    });

    await refreshAccountById(accountId, true, true);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not submit review result." }, { status: 500 });
  }
}
