import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { refreshAccountById } from "@/lib/sync";

export async function POST(request: Request) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const accounts = await prisma.account.findMany({ select: { id: true } });
    const results = await Promise.all(
      accounts.map((account) => refreshAccountById(account.id, false)),
    );

    const refreshed = results.filter((result) => result.refreshed).length;
    const skipped = results.length - refreshed;

    return NextResponse.json({ ok: true, refreshed, skipped });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
