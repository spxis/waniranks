import { NextResponse } from "next/server";

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getLevelKanjiSnapshot } from "@/lib/wanikani";

type RouteContext = {
  params: Promise<{ id: string; level: string }>;
};

const LEVEL_CACHE_MS = 24 * 60 * 60 * 1000;

function hasObjectRelationRows(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  const first = value[0];
  if (!first || typeof first !== "object") {
    return false;
  }

  const row = first as Record<string, unknown>;
  return typeof row.subjectId === "number" && typeof row.label === "string";
}

function snapshotHasDrilldownFields(items: unknown): boolean {
  if (!Array.isArray(items) || items.length === 0) {
    return true;
  }

  const first = items[0] as Record<string, unknown>;
  return (
    typeof first.subjectType === "string" &&
    Array.isArray(first.readings) &&
    hasObjectRelationRows(first.radicals) &&
    hasObjectRelationRows(first.visuallySimilar) &&
    hasObjectRelationRows(first.usedInVocabulary) &&
    hasObjectRelationRows(first.componentKanji) &&
    typeof first.meaningExplanation === "string" &&
    typeof first.readingExplanation === "string" &&
    Object.hasOwn(first, "jlptLevel")
  );
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id, level: rawLevel } = await context.params;
    const level = Number(rawLevel);

    if (!Number.isInteger(level) || level < 1 || level > 60) {
      return NextResponse.json({ error: "Invalid level." }, { status: 400 });
    }

    const cached = await prisma.levelSnapshot.findUnique({
      where: {
        accountId_level: {
          accountId: id,
          level,
        },
      },
      select: {
        level: true,
        kanjiTotal: true,
        kanjiLearned: true,
        kanjiGuruPlus: true,
        kanjiLocked: true,
        estimatedHoursRemaining: true,
        items: true,
        syncedAt: true,
      },
    });

    const now = Date.now();
    if (
      cached &&
      now - cached.syncedAt.getTime() < LEVEL_CACHE_MS &&
      snapshotHasDrilldownFields(cached.items)
    ) {
      return NextResponse.json({
        snapshot: {
          level: cached.level,
          kanjiTotal: cached.kanjiTotal,
          kanjiLearned: cached.kanjiLearned,
          kanjiGuruPlus: cached.kanjiGuruPlus,
          kanjiLocked: cached.kanjiLocked,
          estimatedHoursRemaining: cached.estimatedHoursRemaining,
          items: cached.items,
          syncedAt: cached.syncedAt,
          fromCache: true,
        },
      });
    }

    const account = await prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
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

    const snapshot = await getLevelKanjiSnapshot(token, level);

    const saved = await prisma.levelSnapshot.upsert({
      where: {
        accountId_level: {
          accountId: id,
          level,
        },
      },
      update: {
        kanjiTotal: snapshot.kanjiTotal,
        kanjiLearned: snapshot.kanjiLearned,
        kanjiGuruPlus: snapshot.kanjiGuruPlus,
        kanjiLocked: snapshot.kanjiLocked,
        estimatedHoursRemaining: snapshot.estimatedHoursRemaining,
        items: snapshot.items,
        syncedAt: new Date(),
      },
      create: {
        accountId: id,
        level,
        kanjiTotal: snapshot.kanjiTotal,
        kanjiLearned: snapshot.kanjiLearned,
        kanjiGuruPlus: snapshot.kanjiGuruPlus,
        kanjiLocked: snapshot.kanjiLocked,
        estimatedHoursRemaining: snapshot.estimatedHoursRemaining,
        items: snapshot.items,
        syncedAt: new Date(),
      },
      select: {
        level: true,
        kanjiTotal: true,
        kanjiLearned: true,
        kanjiGuruPlus: true,
        kanjiLocked: true,
        estimatedHoursRemaining: true,
        items: true,
        syncedAt: true,
      },
    });

    return NextResponse.json({
      snapshot: {
        level: saved.level,
        kanjiTotal: saved.kanjiTotal,
        kanjiLearned: saved.kanjiLearned,
        kanjiGuruPlus: saved.kanjiGuruPlus,
        kanjiLocked: saved.kanjiLocked,
        estimatedHoursRemaining: saved.estimatedHoursRemaining,
        items: saved.items,
        syncedAt: saved.syncedAt,
        fromCache: false,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch level snapshot." }, { status: 500 });
  }
}
