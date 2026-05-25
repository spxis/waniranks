import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { isMonthKey } from "@/lib/readingSignoff";
import {
  getReadingSignoffEntryDelegate,
  getReadingSignoffDelegate,
  toAdminReadingSignoffEntryRecord,
  toAdminReadingSignoffRecord,
} from "./readingSignoffEntriesRoute.lib";

const querySchema = z.object({
  month: z
    .string()
    .optional()
    .refine((value) => value === undefined || isMonthKey(value), {
      message: "Invalid month key.",
    }),
  accountId: z.string().cuid().optional(),
  source: z.enum(["entry", "daily"]).default("entry"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
});

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-signoff-entries",
    method: "GET",
    request,
    execute: async () => {
      try {
        const url = new URL(request.url);
        const parsed = querySchema.safeParse({
          month: url.searchParams.get("month") ?? undefined,
          accountId: url.searchParams.get("accountId") ?? undefined,
          source: url.searchParams.get("source") ?? undefined,
          page: url.searchParams.get("page") ?? undefined,
          pageSize: url.searchParams.get("pageSize") ?? undefined,
        });

        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const readingSignoff = getReadingSignoffDelegate();

        if (parsed.data.source === "entry" && !readingSignoffEntry) {
          return NextResponse.json(
            { error: "Reading entries are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        if (parsed.data.source === "daily" && !readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const offset = (parsed.data.page - 1) * parsed.data.pageSize;

        const membersPromise = prisma.account.findMany({
          orderBy: [{ nickname: "asc" }],
          select: {
            id: true,
            nickname: true,
            wkUsername: true,
          },
        });

        let total = 0;
        let entries: ReturnType<typeof toAdminReadingSignoffEntryRecord>[] | ReturnType<typeof toAdminReadingSignoffRecord>[] = [];

        if (parsed.data.source === "entry" && readingSignoffEntry) {
          const where: Prisma.ReadingSignoffEntryWhereInput = {};
          if (parsed.data.month) {
            where.signoffDatePst = { startsWith: `${parsed.data.month}-` };
          }
          if (parsed.data.accountId) {
            where.accountId = parsed.data.accountId;
          }

          const [entryTotal, rows] = await Promise.all([
            readingSignoffEntry.count({ where }),
            readingSignoffEntry.findMany({
              where,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              skip: offset,
              take: parsed.data.pageSize,
            }),
          ]);

          total = entryTotal;
          const members = await membersPromise;
          const memberByAccountId = new Map(
            members.map((member) => [
              member.id,
              {
                nickname: member.nickname,
                wkUsername: member.wkUsername,
              },
            ]),
          );
          entries = rows.map((row) => toAdminReadingSignoffEntryRecord(row, memberByAccountId));

          const pageCount = Math.max(1, Math.ceil(total / parsed.data.pageSize));

          return NextResponse.json(
            {
              members,
              entries,
              pagination: {
                page: parsed.data.page,
                pageSize: parsed.data.pageSize,
                pageCount,
                total,
              },
            },
            { status: 200 },
          );
        }

        if (!readingSignoff) {
          return NextResponse.json(
            { error: "Reading check-ins are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const where: Prisma.ReadingSignoffWhereInput = {};
        if (parsed.data.month) {
          where.signoffDatePst = { startsWith: `${parsed.data.month}-` };
        }
        if (parsed.data.accountId) {
          where.accountId = parsed.data.accountId;
        }

        const [dailyTotal, rows, members] = await Promise.all([
          readingSignoff.count({ where }),
          readingSignoff.findMany({
            where,
            orderBy: [{ signoffDatePst: "desc" }, { updatedAt: "desc" }],
            skip: offset,
            take: parsed.data.pageSize,
          }),
          membersPromise,
        ]);

        total = dailyTotal;

        const memberByAccountId = new Map(
          members.map((member) => [
            member.id,
            {
              nickname: member.nickname,
              wkUsername: member.wkUsername,
            },
          ]),
        );

        const pageCount = Math.max(1, Math.ceil(total / parsed.data.pageSize));

        return NextResponse.json(
          {
            members,
            entries: rows.map((row) => toAdminReadingSignoffRecord(row, memberByAccountId)),
            pagination: {
              page: parsed.data.page,
              pageSize: parsed.data.pageSize,
              pageCount,
              total,
            },
          },
          { status: 200 },
        );
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not load check-ins." }, { status: 500 });
      }
    },
  });
}
