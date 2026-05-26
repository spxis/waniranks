import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiRouteTelemetry } from "@/lib/apiRouteTelemetry";
import { isAuthorizedAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { readingChallengeMutationSchema } from "@/lib/readingChallengeValidation";

const campaignMutationSchema = readingChallengeMutationSchema;

const patchBodySchema = campaignMutationSchema.extend({
  id: z.string().min(1).max(120),
});

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "P2002" || error.message.includes("Unique constraint");
}

async function deactivateOtherActiveCampaigns(campaignId: string): Promise<void> {
  await prisma.readingChallenge.updateMany({
    where: {
      id: { not: campaignId },
      status: "active",
    },
    data: {
      status: "completed",
    },
  });
}

export async function GET(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-campaigns",
    method: "GET",
    request,
    execute: async () => {
      try {
        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const campaigns = await prisma.readingChallenge.findMany({
          orderBy: [{ startDatePst: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            status: true,
            currencyCode: true,
            startDatePst: true,
            goalDatePst: true,
            tripDatePst: true,
            targetBaseYen: true,
            scoringRules: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return NextResponse.json({ campaigns }, { status: 200 });
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Could not fetch campaigns." }, { status: 500 });
      }
    },
  });
}

export async function POST(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-campaigns",
    method: "POST",
    request,
    execute: async () => {
      try {
        const parsed = campaignMutationSchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const created = await prisma.readingChallenge.create({
          data: {
            ...(parsed.data.id ? { id: parsed.data.id } : {}),
            slug: parsed.data.slug,
            name: parsed.data.name,
            description: parsed.data.description,
            status: parsed.data.status,
            currencyCode: parsed.data.currencyCode,
            startDatePst: parsed.data.startDatePst,
            goalDatePst: parsed.data.goalDatePst,
            tripDatePst: parsed.data.tripDatePst,
            targetBaseYen: parsed.data.targetBaseYen,
            scoringRules: parsed.data.scoringRules,
          },
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            status: true,
            currencyCode: true,
            startDatePst: true,
            goalDatePst: true,
            tripDatePst: true,
            targetBaseYen: true,
            scoringRules: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (created.status === "active") {
          await deactivateOtherActiveCampaigns(created.id);
        }

        return NextResponse.json({ campaign: created }, { status: 201 });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ error: "Campaign id or slug is already used." }, { status: 409 });
        }

        console.error(error);
        return NextResponse.json({ error: "Could not create campaign." }, { status: 500 });
      }
    },
  });
}

export async function PATCH(request: Request) {
  return withApiRouteTelemetry({
    route: "/api/admin/reading-campaigns",
    method: "PATCH",
    request,
    execute: async () => {
      try {
        const parsed = patchBodySchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
        }

        if (!(await isAuthorizedAdmin(request))) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
        }

        const updated = await prisma.readingChallenge.update({
          where: { id: parsed.data.id },
          data: {
            slug: parsed.data.slug,
            name: parsed.data.name,
            description: parsed.data.description,
            status: parsed.data.status,
            currencyCode: parsed.data.currencyCode,
            startDatePst: parsed.data.startDatePst,
            goalDatePst: parsed.data.goalDatePst,
            tripDatePst: parsed.data.tripDatePst,
            targetBaseYen: parsed.data.targetBaseYen,
            scoringRules: parsed.data.scoringRules,
          },
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            status: true,
            currencyCode: true,
            startDatePst: true,
            goalDatePst: true,
            tripDatePst: true,
            targetBaseYen: true,
            scoringRules: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (updated.status === "active") {
          await deactivateOtherActiveCampaigns(updated.id);
        }

        return NextResponse.json({ campaign: updated }, { status: 200 });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ error: "Campaign id or slug is already used." }, { status: 409 });
        }

        console.error(error);
        return NextResponse.json({ error: "Could not update campaign." }, { status: 500 });
      }
    },
  });
}
