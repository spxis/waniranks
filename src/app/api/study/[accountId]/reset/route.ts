import { NextResponse } from "next/server";
import { z } from "zod";

import { canAccessAccount } from "@/lib/accountAccess";
import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { clearStudyQueueCache } from "@/lib/studyQueueCache";
import { fetchAllCollectionPages, putWaniKani } from "@/lib/wanikani/http";
import type { WaniKaniCollectionResponse } from "@/lib/wanikani/types";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

const resetSchema = z
  .object({
    assignmentIds: z.array(z.number().int().positive()).optional(),
    subjectIds: z.array(z.number().int().positive()).optional(),
  })
  .refine(
    (value) =>
      (Array.isArray(value.assignmentIds) && value.assignmentIds.length > 0) ||
      (Array.isArray(value.subjectIds) && value.subjectIds.length > 0),
    {
      message: "Provide at least one assignmentId or subjectId.",
    },
  );

function dedupePositive(values: number[] | undefined): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)));
}

function chunk(values: number[], chunkSize: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

async function assignmentIdsFromSubjectIds(token: string, subjectIds: number[]): Promise<number[]> {
  const assignments = new Set<number>();

  for (const subjectChunk of chunk(subjectIds, 150)) {
    if (subjectChunk.length === 0) {
      continue;
    }

    const response = await fetchAllCollectionPages(
      `/assignments?subject_ids=${subjectChunk.join(",")}`,
      token,
    );

    for (const row of (response as WaniKaniCollectionResponse).data) {
      if (typeof row.id === "number" && Number.isInteger(row.id) && row.id > 0) {
        assignments.add(row.id);
      }
    }
  }

  return Array.from(assignments.values());
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { accountId } = await context.params;
    if (!(await canAccessAccount(request, accountId))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const json = await request.json();
    const parsed = resetSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        tokenEncrypted: true,
        tokenIv: true,
        tokenTag: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const token = decryptToken({
      encrypted: account.tokenEncrypted,
      iv: account.tokenIv,
      tag: account.tokenTag,
    });

    const directAssignmentIds = dedupePositive(parsed.data.assignmentIds);
    const subjectIds = dedupePositive(parsed.data.subjectIds);
    const derivedAssignmentIds =
      subjectIds.length > 0 ? await assignmentIdsFromSubjectIds(token, subjectIds) : [];
    const assignmentIds = Array.from(new Set([...directAssignmentIds, ...derivedAssignmentIds]));

    if (assignmentIds.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          processed: 0,
          reset: 0,
          skipped: 0,
          failed: 0,
          reason: "no-matching-assignments",
        },
        { status: 200 },
      );
    }

    let reset = 0;
    let skipped = 0;
    let failed = 0;
    let rateLimited = false;

    for (const assignmentId of assignmentIds) {
      try {
        await putWaniKani(`/assignments/${assignmentId}/reset`, token, {});
        reset += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "WaniKani API error";

        if (message.includes("422") || message.includes("409") || message.includes("404")) {
          skipped += 1;
          continue;
        }

        if (message.includes("429")) {
          rateLimited = true;
          break;
        }

        failed += 1;
      }
    }

    clearStudyQueueCache(accountId);

    if (rateLimited) {
      return NextResponse.json(
        {
          error: "Rate limited by WaniKani. Please retry in a moment.",
          processed: reset + skipped + failed,
          reset,
          skipped,
          failed,
        },
        { status: 429 },
      );
    }

    return NextResponse.json({
      ok: failed === 0,
      processed: assignmentIds.length,
      reset,
      skipped,
      failed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not reset assignment(s)." }, { status: 500 });
  }
}