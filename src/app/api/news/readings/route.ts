import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { logNewsApiPerf } from "@/lib/news/newsApiPerf";
import { readingKanaForRun } from "@/lib/news/newsReadingKana";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export const runtime = "nodejs";

const requestSchema = z.object({
  runs: z.array(z.string().trim().min(1).max(40)).min(1).max(300),
});

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/news/readings",
    method: "POST",
    request: request,
    execute: async () => {

const startedAtMs = Date.now();
              const respond = (body: unknown, status: number, meta?: Record<string, number | string | boolean | null>) => {
                logNewsApiPerf("/api/news/readings", startedAtMs, status, meta);
                return NextResponse.json(body, { status });
              };

              try {
                const session = await getServerSession(authOptions);
                if (!session?.user?.email) {
                  return respond({ error: "Unauthorized." }, 401);
                }

                const json = await request.json().catch(() => null);
                const parsed = requestSchema.safeParse(json);
                if (!parsed.success) {
                  return respond({ error: "Invalid request payload." }, 400);
                }

                const uniqueRuns = Array.from(new Set(parsed.data.runs.map((run) => run.trim()).filter(Boolean)));

                const entries = await Promise.all(
                  uniqueRuns.map(async (run) => {
                    const reading = await readingKanaForRun(run).catch(() => null);
                    return [run, reading] as const;
                  }),
                );

                return respond(
                  { readings: Object.fromEntries(entries) },
                  200,
                  { runs: uniqueRuns.length },
                );
              } catch (error) {
                console.error("[news/readings] failed", error);
                return respond({ error: "Couldn't build readings." }, 500);
              }
    },
  });
}
