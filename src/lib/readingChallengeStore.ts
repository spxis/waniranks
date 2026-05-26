import { prisma } from "@/lib/prisma";
import { ACTIVE_READING_CHALLENGE } from "@/lib/readingChallengeRules";

type ReadingChallengeDelegate = {
  findFirst: (args: {
    where?: Record<string, unknown>;
    orderBy?: Array<Record<string, "asc" | "desc">>;
    select: Record<string, true>;
  }) => Promise<Record<string, unknown> | null>;
  findUnique: (args: {
    where: { slug: string };
    select: Record<string, true>;
  }) => Promise<Record<string, unknown> | null>;
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Array<Record<string, "asc" | "desc">>;
    select: Record<string, true>;
  }) => Promise<Array<Record<string, unknown>>>;
  create: (args: {
    data: {
      id: string;
      slug: string;
      name: string;
      description: string;
      status: string;
      startDatePst: string;
      goalDatePst: string;
      tripDatePst: string;
      targetBaseYen: number;
      currencyCode: string;
      scoringRules: unknown;
    };
    select: { id: true };
  }) => Promise<{ id: string }>;
  update: (args: {
    where: { id: string };
    data: { status: string };
    select: { id: true };
  }) => Promise<{ id: string }>;
  upsert: (args: {
    where: { slug: string };
    update: {
      name: string;
      description: string;
      status: string;
      startDatePst: string;
      goalDatePst: string;
      tripDatePst: string;
      targetBaseYen: number;
      currencyCode: string;
      scoringRules: unknown;
    };
    create: {
      id: string;
      slug: string;
      name: string;
      description: string;
      status: string;
      startDatePst: string;
      goalDatePst: string;
      tripDatePst: string;
      targetBaseYen: number;
      currencyCode: string;
      scoringRules: unknown;
    };
    select: { id: true };
  }) => Promise<{ id: string }>;
};

function getReadingChallengeDelegate(): ReadingChallengeDelegate | null {
  const delegate = (prisma as unknown as { readingChallenge?: ReadingChallengeDelegate }).readingChallenge;
  return delegate ?? null;
}

export type ReadingCampaignOption = {
  id: string;
  name: string;
  status: string;
  startDatePst: string;
  goalDatePst: string;
  tripDatePst: string;
  targetBaseYen: number;
};

export async function listReadingCampaignOptions(): Promise<ReadingCampaignOption[]> {
  const readingChallenge = getReadingChallengeDelegate();
  if (!readingChallenge) {
    return [];
  }

  const rows = await readingChallenge.findMany({
    where: {
      status: {
        in: ["active", "completed"],
      },
    },
    orderBy: [{ startDatePst: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startDatePst: true,
      goalDatePst: true,
      tripDatePst: true,
      targetBaseYen: true,
    },
  });

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: String(row.status),
    startDatePst: String(row.startDatePst),
    goalDatePst: String(row.goalDatePst),
    tripDatePst: String(row.tripDatePst),
    targetBaseYen: Number(row.targetBaseYen),
  }));
}

export async function resolveReadingCampaignSelection(preferredId?: string | null): Promise<{
  campaigns: ReadingCampaignOption[];
  selectedCampaignId: string | null;
}> {
  const campaigns = await listReadingCampaignOptions();
  const activeChallengeId = await ensureActiveReadingChallengeId();

  if (campaigns.length === 0) {
    return {
      campaigns,
      selectedCampaignId: preferredId ?? activeChallengeId,
    };
  }

  const preferred = preferredId && campaigns.some((campaign) => campaign.id === preferredId) ? preferredId : null;
  const active = activeChallengeId && campaigns.some((campaign) => campaign.id === activeChallengeId)
    ? activeChallengeId
    : null;

  return {
    campaigns,
    selectedCampaignId: preferred ?? active ?? campaigns[0].id,
  };
}

export async function ensureActiveReadingChallengeId(): Promise<string | null> {
  const readingChallenge = getReadingChallengeDelegate();
  if (!readingChallenge) {
    return null;
  }

  const existingActive = await readingChallenge.findFirst({
    where: { status: "active" },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true },
  });

  if (existingActive?.id) {
    return String(existingActive.id);
  }

  const challenge = ACTIVE_READING_CHALLENGE;
  const existingBySlug = await readingChallenge.findUnique({
    where: { slug: challenge.slug },
    select: { id: true },
  });

  if (existingBySlug?.id) {
    const activated = await readingChallenge.update({
      where: { id: String(existingBySlug.id) },
      data: { status: "active" },
      select: { id: true },
    });
    return activated.id;
  }

  const created = await readingChallenge.create({
    data: {
      id: challenge.id,
      slug: challenge.slug,
      name: challenge.name,
      description: challenge.description,
      status: challenge.status,
      startDatePst: challenge.startDatePst,
      goalDatePst: challenge.goalDatePst,
      tripDatePst: challenge.tripDatePst,
      targetBaseYen: challenge.targetBaseYen,
      currencyCode: challenge.currencyCode,
      scoringRules: challenge.scoringRules,
    },
    select: { id: true },
  });

  return created.id;
}
