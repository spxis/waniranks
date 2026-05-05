import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { refreshDueAccounts } from "@/lib/sync";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/leaderboard/refresh",
    method: "POST",
    request: request,
    execute: async () => {

try {
                if (!(await isAuthorizedAdmin(request))) {
                  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
                }

                const { refreshed, skipped } = await refreshDueAccounts(200);

                return NextResponse.json({ ok: true, refreshed, skipped });
              } catch (error) {
                console.error(error);
                return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
              }
    },
  });
}
