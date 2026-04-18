import { NextResponse } from "next/server";

import { canAccessAccount } from "@/lib/accountAccess";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  if (!(await canAccessAccount(request, accountId))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // WaniKani v2 does not expose a per-assignment reset endpoint.
  // Previous behavior attempted a non-existent endpoint and surfaced noisy "Skipped" counts.
  return NextResponse.json(
    {
      error:
        "Per-item reset to lessons is not supported by the WaniKani API. Use account-level reset on WaniKani if needed.",
      supported: false,
      processed: 0,
      reset: 0,
      skipped: 0,
      failed: 0,
    },
    { status: 501 },
  );
}
