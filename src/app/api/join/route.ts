import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { saveAccountFromToken } from "@/lib/accountUpsert";
import { authOptions } from "@/lib/auth";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

const joinSchema = z.object({
  nickname: z.string().trim().min(2).max(32),
  token: z.string().trim().min(10),
});

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/join",
    method: "POST",
    request: request,
    execute: async () => {

try {
                const session = await getServerSession(authOptions);
                const email = session?.user?.email ?? null;

                if (!email) {
                  return NextResponse.json({ error: "Sign in with Google first." }, { status: 401 });
                }

                const json = await request.json();
                const parsed = joinSchema.safeParse(json);

                if (!parsed.success) {
                  return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
                }

                const account = await saveAccountFromToken({
                  nickname: parsed.data.nickname,
                  token: parsed.data.token,
                  joinedByEmail: email,
                  joinedByName: session?.user?.name ?? null,
                });

                return NextResponse.json({ account }, { status: 201 });
              } catch (error) {
                console.error(error);

                if (error instanceof Error) {
                  if (
                    error.message.includes("already linked") ||
                    error.message.includes("already linked to")
                  ) {
                    return NextResponse.json({ error: error.message }, { status: 409 });
                  }
                }

                return NextResponse.json(
                  { error: "Could not join leaderboard. Confirm token and try again." },
                  { status: 500 },
                );
              }
    },
  });
}
