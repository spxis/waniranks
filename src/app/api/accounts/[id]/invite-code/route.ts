import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { isAuthorizedAdmin } from "@/lib/admin";
import {
  generateInviteCode,
  hashInviteCode,
  isValidInviteCodeShape,
  normalizeInviteCode,
} from "@/lib/inviteCode";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  code: z.string().trim().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!(await isAuthorizedAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const requestedCode = parsed.data.code ? normalizeInviteCode(parsed.data.code) : null;
    if (requestedCode && !isValidInviteCodeShape(requestedCode)) {
      return NextResponse.json({ error: "Invite code must be 6 characters." }, { status: 400 });
    }

    const accountExists = await prisma.account.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!accountExists) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Retry a handful of times to avoid rare collisions for generated codes.
    let chosenCode = requestedCode;
    for (let attempt = 0; attempt < 8 && !chosenCode; attempt += 1) {
      const candidate = generateInviteCode();
      const existing = await prisma.account.findFirst({
        where: ({ inviteCodeHash: hashInviteCode(candidate) } as unknown) as Prisma.AccountWhereInput,
        select: { id: true },
      });
      if (!existing) {
        chosenCode = candidate;
      }
    }

    if (!chosenCode) {
      return NextResponse.json(
        { error: "Could not allocate a unique invite code. Please retry." },
        { status: 503 },
      );
    }

    const chosenHash = hashInviteCode(chosenCode);
    const existingForCode = await prisma.account.findFirst({
      where: ({
        inviteCodeHash: chosenHash,
        NOT: { id },
      } as unknown) as Prisma.AccountWhereInput,
      select: { id: true },
    });
    if (existingForCode) {
      return NextResponse.json({ error: "Invite code already in use." }, { status: 409 });
    }

    await prisma.account.update({
      where: { id },
      data: ({
        inviteCodeHash: chosenHash,
        inviteCodeUpdatedAt: new Date(),
      } as unknown) as Prisma.AccountUpdateInput,
    });

    return NextResponse.json({ ok: true, inviteCode: chosenCode });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not assign invite code." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!(await isAuthorizedAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const account = await prisma.account.findUnique({ where: { id }, select: { id: true } });
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    await prisma.account.update({
      where: { id },
      data: ({
        inviteCodeHash: null,
        inviteCodeUpdatedAt: null,
      } as unknown) as Prisma.AccountUpdateInput,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not reset invite code." }, { status: 500 });
  }
}
