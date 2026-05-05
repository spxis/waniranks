import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { decryptToken } from "@/lib/crypto";
import { lookupRunInWaniKani } from "@/lib/news/newsKanjiLookup";
import { prisma } from "@/lib/prisma";
import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";

export const runtime = "nodejs";

const KANJI_RUN_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

const requestSchema = z.object({
  run: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/news/lookup-kanji",
    method: "POST",
    request: request,
    execute: async () => {

try {
                const session = await getServerSession(authOptions);
                const email = session?.user?.email?.trim().toLowerCase() ?? null;
                if (!email) {
                  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
                }

                const json = await request.json().catch(() => null);
                const parsed = requestSchema.safeParse(json);
                if (!parsed.success) {
                  return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
                }

                const run = parsed.data.run;
                if (!KANJI_RUN_REGEX.test(run)) {
                  return NextResponse.json({ error: "No kanji to look up." }, { status: 400 });
                }

                const account = await prisma.account.findFirst({
                  where: { joinedByEmail: email },
                  select: {
                    id: true,
                    tokenEncrypted: true,
                    tokenIv: true,
                    tokenTag: true,
                  },
                });

                if (!account) {
                  return NextResponse.json(
                    { error: "No linked WaniKani account." },
                    { status: 404 },
                  );
                }

                const token = decryptToken({
                  encrypted: account.tokenEncrypted,
                  iv: account.tokenIv,
                  tag: account.tokenTag,
                });

                const result = await lookupRunInWaniKani(run, token);

                return NextResponse.json({ accountId: account.id, result }, { status: 200 });
              } catch (error) {
                console.error("[news/lookup-kanji] failed", error);
                return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
              }
    },
  });
}
