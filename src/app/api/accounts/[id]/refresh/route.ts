import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { refreshAccountById } from "@/lib/sync";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isAuthorizedAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await refreshAccountById(id, true);

    return NextResponse.json(result, { status: result.refreshed ? 200 : 202 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
  }
}
