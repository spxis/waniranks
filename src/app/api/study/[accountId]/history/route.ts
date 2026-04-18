import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";
import { getStudyHistoryPage, parseStudyHistoryQuery } from "@/lib/studyHistoryView";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  if (!(await canAccessAccount(request, accountId))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = parseStudyHistoryQuery(url);
  const payload = await getStudyHistoryPage({ ...query, accountId });

  return NextResponse.json(payload);
}
