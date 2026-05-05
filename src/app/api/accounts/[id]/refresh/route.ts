import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { clearStudyQueueCache } from "@/lib/studyQueueCache";
import { refreshAccountById } from "@/lib/sync";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/accounts/[id]/refresh",
    method: "POST",
    request: request,
    execute: async () => {

try {
                if (!(await isAuthorizedAdmin(request))) {
                  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
                }

                const { id } = await context.params;
                const result = await refreshAccountById(id, true);
                clearStudyQueueCache(id);

                return NextResponse.json(result, { status: result.refreshed ? 200 : 202 });
              } catch (error) {
                console.error(error);
                return NextResponse.json({ error: "Refresh failed." }, { status: 500 });
              }
    },
  });
}
