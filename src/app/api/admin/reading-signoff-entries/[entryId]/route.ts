import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { isPstDateKey } from "@/lib/readingSignoff";
import {
  getReadingSignoffDelegate,
  getReadingSignoffEntryDelegate,
  recalculateReadingSignoffForDay,
} from "../readingSignoffEntriesRoute.lib";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

const paramsSchema = z.object({
  entryId: z.string().cuid(),
});

const patchBodySchema = z.object({
  signoffDatePst: z.string().refine((value) => isPstDateKey(value), {
    message: "Invalid signoff date.",
  }),
  submittedAt: z.string().datetime({ offset: true }).optional(),
  bookTitle: z.string().trim().min(1).max(180),
  pagesRead: z.number().int().min(0).max(2000),
  minutesRead: z.number().int().min(0).max(1440),
  didWanikaniReviews: z.boolean(),
  reviewsLeft: z.number().int().min(0).max(20_000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-signoff-entries/[entryId]",
    method: "PATCH",
    request,
    execute: async () => {
      try {
        const parsedParams = paramsSchema.safeParse(await context.params);
        if (!parsedParams.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        const parsedBody = patchBodySchema.safeParse(await request.json());
        if (!parsedBody.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const readingSignoff = getReadingSignoffDelegate();
        if (!readingSignoffEntry || !readingSignoff) {
          return NextResponse.json(
            { error: "Reading entries are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const existingEntry = await readingSignoffEntry.findUnique({
          where: {
            id: parsedParams.data.entryId,
          },
        });

        if (existingEntry) {
          const previousDatePst = existingEntry.signoffDatePst;

          const updated = await readingSignoffEntry.update({
            where: {
              id: existingEntry.id,
            },
            data: {
              signoffDatePst: parsedBody.data.signoffDatePst,
              createdAt: parsedBody.data.submittedAt ? new Date(parsedBody.data.submittedAt) : undefined,
              bookTitle: parsedBody.data.bookTitle.trim(),
              pagesRead: parsedBody.data.pagesRead,
              minutesRead: parsedBody.data.minutesRead,
              didWanikaniReviews: parsedBody.data.didWanikaniReviews,
            },
          });

          await recalculateReadingSignoffForDay(
            updated.accountId,
            updated.signoffDatePst,
            readingSignoffEntry,
            readingSignoff,
          );

          if (previousDatePst !== updated.signoffDatePst) {
            await recalculateReadingSignoffForDay(
              updated.accountId,
              previousDatePst,
              readingSignoffEntry,
              readingSignoff,
            );
          }

          return NextResponse.json(
            {
              entry: {
                id: updated.id,
                accountId: updated.accountId,
                signoffDatePst: updated.signoffDatePst,
                bookTitle: updated.bookTitle,
                pagesRead: updated.pagesRead,
                minutesRead: updated.minutesRead,
                didWanikaniReviews: updated.didWanikaniReviews,
                reviewWorkDone: updated.reviewWorkDone,
                reviewCorrect: updated.reviewCorrect,
                reviewIncorrect: updated.reviewIncorrect,
                reviewSuccessPercent: updated.reviewSuccessPercent,
                createdAt: updated.createdAt.toISOString(),
              },
            },
            { status: 200 },
          );
        }

        const existingSignoff = await readingSignoff.findUnique({
          where: {
            id: parsedParams.data.entryId,
          },
        });

        if (!existingSignoff) {
          return NextResponse.json({ error: "Entry not found." }, { status: 404 });
        }

        if (existingSignoff.signoffDatePst !== parsedBody.data.signoffDatePst) {
          const conflicting = await readingSignoff.findUnique({
            where: {
              accountId_signoffDatePst: {
                accountId: existingSignoff.accountId,
                signoffDatePst: parsedBody.data.signoffDatePst,
              },
            },
          });

          if (conflicting && conflicting.id !== existingSignoff.id) {
            return NextResponse.json(
              { error: "A check-in already exists for that account and date." },
              { status: 409 },
            );
          }
        }

        const previousDatePst = existingSignoff.signoffDatePst;
        const updatedSignoff = await readingSignoff.update({
          where: {
            id: existingSignoff.id,
          },
          data: {
            signoffDatePst: parsedBody.data.signoffDatePst,
              createdAt: parsedBody.data.submittedAt ? new Date(parsedBody.data.submittedAt) : undefined,
            bookTitle: parsedBody.data.bookTitle.trim(),
            pagesRead: parsedBody.data.pagesRead,
            minutesRead: parsedBody.data.minutesRead,
            didWanikaniReviews: parsedBody.data.didWanikaniReviews,
            reviewsLeft: parsedBody.data.reviewsLeft ?? existingSignoff.reviewsLeft,
          },
        });

        if (previousDatePst !== updatedSignoff.signoffDatePst) {
          await readingSignoffEntry.updateMany({
            where: {
              accountId: existingSignoff.accountId,
              signoffDatePst: previousDatePst,
            },
            data: {
              signoffDatePst: updatedSignoff.signoffDatePst,
            },
          });
        }

        return NextResponse.json(
          {
            entry: {
              id: updatedSignoff.id,
              accountId: updatedSignoff.accountId,
              signoffDatePst: updatedSignoff.signoffDatePst,
              bookTitle: updatedSignoff.bookTitle,
              pagesRead: updatedSignoff.pagesRead,
              minutesRead: updatedSignoff.minutesRead,
              didWanikaniReviews: updatedSignoff.didWanikaniReviews,
              reviewWorkDone: 0,
              reviewCorrect: 0,
              reviewIncorrect: 0,
              reviewSuccessPercent: null,
              createdAt: updatedSignoff.createdAt.toISOString(),
            },
          },
          { status: 200 },
        );
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not update reading entry." }, { status: 500 });
      }
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-signoff-entries/[entryId]",
    method: "DELETE",
    request,
    execute: async () => {
      try {
        const parsedParams = paramsSchema.safeParse(await context.params);
        if (!parsedParams.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const readingSignoffEntry = getReadingSignoffEntryDelegate();
        const readingSignoff = getReadingSignoffDelegate();
        if (!readingSignoffEntry || !readingSignoff) {
          return NextResponse.json(
            { error: "Reading entries are not ready yet. Restart the dev server and try again." },
            { status: 503 },
          );
        }

        const existingEntry = await readingSignoffEntry.findUnique({
          where: {
            id: parsedParams.data.entryId,
          },
        });

        if (existingEntry) {
          await readingSignoffEntry.delete({
            where: {
              id: existingEntry.id,
            },
          });

          await recalculateReadingSignoffForDay(
            existingEntry.accountId,
            existingEntry.signoffDatePst,
            readingSignoffEntry,
            readingSignoff,
          );

          return NextResponse.json({ ok: true }, { status: 200 });
        }

        const existingSignoff = await readingSignoff.findUnique({
          where: {
            id: parsedParams.data.entryId,
          },
        });

        if (!existingSignoff) {
          return NextResponse.json({ error: "Entry not found." }, { status: 404 });
        }

        await readingSignoff.delete({
          where: {
            id: existingSignoff.id,
          },
        });

        await readingSignoffEntry.deleteMany({
          where: {
            accountId: existingSignoff.accountId,
            signoffDatePst: existingSignoff.signoffDatePst,
          },
        });

        return NextResponse.json({ ok: true }, { status: 200 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not delete reading entry." }, { status: 500 });
      }
    },
  });
}
