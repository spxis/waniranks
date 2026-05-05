import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { getStudyHistoryPage, parseStudyHistoryQuery } from "@/lib/studyHistoryView";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/study-history",
    method: "GET",
    request: request,
    execute: async () => {

if (!(await isAuthorizedAdmin(request))) {
                return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
              }

              const url = new URL(request.url);
              const query = parseStudyHistoryQuery(url);
              const payload = await getStudyHistoryPage(query);

              return NextResponse.json(payload);
    },
  });
}
