import { NextResponse } from "next/server";

import { isAuthorizedAdmin } from "@/lib/admin";
import { getAdminStudyHistoryPage, parseAdminStudyHistoryQuery } from "@/lib/studyHistoryAdminView";
import {
  getStudyHistoryPage,
  parseStudyHistoryQuery,
} from "@/lib/studyHistoryView";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/study-history",
    method: "GET",
    request,
    execute: async () => {
      if (!(await isAuthorizedAdmin(request))) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      const url = new URL(request.url);
      const useLitePayload = url.searchParams.get("lite") === "1";
      const payload = useLitePayload
        ? await getAdminStudyHistoryPage(parseAdminStudyHistoryQuery(url))
        : await getStudyHistoryPage(parseStudyHistoryQuery(url));

      return NextResponse.json(payload);
    },
  });
}
