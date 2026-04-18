import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { hashInviteCode, isValidInviteCodeShape, normalizeInviteCode } from "@/lib/inviteCode";
import {
  createInviteSessionToken,
  INVITE_SESSION_COOKIE_NAME,
  INVITE_SESSION_MAX_AGE_SECONDS,
  verifyInviteSessionToken,
} from "@/lib/inviteSession";
import { prisma } from "@/lib/prisma";

const inviteLoginSchema = z.object({
  code: z.string().trim().min(1),
});

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(INVITE_SESSION_COOKIE_NAME)?.value ?? null;
    if (!token) {
      return NextResponse.json({ signedIn: false });
    }

    const payload = verifyInviteSessionToken(token);
    if (!payload?.accountId) {
      cookieStore.delete(INVITE_SESSION_COOKIE_NAME);
      return NextResponse.json({ signedIn: false });
    }

    const account = await prisma.account.findUnique({
      where: { id: payload.accountId },
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
      },
    });

    if (!account) {
      cookieStore.delete(INVITE_SESSION_COOKIE_NAME);
      return NextResponse.json({ signedIn: false });
    }

    return NextResponse.json({
      signedIn: true,
      account: {
        id: account.id,
        nickname: account.nickname,
        wkUsername: account.wkUsername,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ signedIn: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = inviteLoginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const normalized = normalizeInviteCode(parsed.data.code);
    if (!isValidInviteCodeShape(normalized)) {
      return NextResponse.json({ error: "Invite code must be 6 characters." }, { status: 400 });
    }

    const inviteCodeHash = hashInviteCode(normalized);
    const account = await prisma.account.findFirst({
      where: ({ inviteCodeHash } as unknown) as Prisma.AccountWhereInput,
      select: {
        id: true,
        nickname: true,
        wkUsername: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Invite code is invalid." }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set({
      name: INVITE_SESSION_COOKIE_NAME,
      value: createInviteSessionToken({ accountId: account.id }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: INVITE_SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        nickname: account.nickname,
        wkUsername: account.wkUsername,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not sign in with invite code." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(INVITE_SESSION_COOKIE_NAME);

    return NextResponse.json({ signedIn: false });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not sign out invite session." }, { status: 500 });
  }
}
