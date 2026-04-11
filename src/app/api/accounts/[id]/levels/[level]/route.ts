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

function hasReadingMetadataRows(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  for (const row of value) {
    if (!row || typeof row !== "object") {
      return false;
    }

    if (!Object.hasOwn(row, "reading")) {
      return false;
    }
  }

  return true;
}

function hasWkLevelMetadataRows(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  for (const row of value) {
    if (!row || typeof row !== "object") {
      return false;
    }

    if (!Object.hasOwn(row, "wkLevel")) {
      return false;
    }
  }

  return true;
}

function snapshotHasDrilldownFields(items: unknown): boolean {
  if (!Array.isArray(items) || items.length === 0) {
    return true;
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return false;
    }

    const row = item as Record<string, unknown>;
    const baseValid =
      typeof row.subjectType === "string" &&
      Array.isArray(row.readings) &&
      hasObjectRelationRows(row.radicals) &&
      hasObjectRelationRows(row.visuallySimilar) &&
      hasObjectRelationRows(row.usedInVocabulary) &&
      hasObjectRelationRows(row.componentKanji) &&
      typeof row.meaningExplanation === "string" &&
      typeof row.readingExplanation === "string" &&
      Object.hasOwn(row, "jlptLevel");

    if (!baseValid) {
      return false;
    }

    if (!hasReadingMetadataRows(row.radicals)) {
      return false;
    }

    if (!hasWkLevelMetadataRows(row.radicals)) {
      return false;
    }

    if (!hasReadingMetadataRows(row.visuallySimilar)) {
      return false;
    }

    if (!hasWkLevelMetadataRows(row.visuallySimilar)) {
      return false;
    }

    if (row.subjectType === "kanji" && !hasReadingMetadataRows(row.usedInVocabulary)) {
      return false;
    }

    if (row.subjectType === "kanji" && !hasWkLevelMetadataRows(row.usedInVocabulary)) {
      return false;
    }

    if (row.subjectType === "vocabulary" && !hasReadingMetadataRows(row.componentKanji)) {
      return false;
    }
  }

  return true;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "");
    const offsetParam = Number(url.searchParams.get("offset") ?? "");
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : null;
    const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

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
      const items = cached.items as unknown[];
      const pagedItems = limit === null ? items : items.slice(offset, offset + limit);

      return NextResponse.json({
        snapshot: {
          level: cached.level,
          kanjiTotal: cached.kanjiTotal,
          kanjiLearned: cached.kanjiLearned,
          kanjiGuruPlus: cached.kanjiGuruPlus,
          kanjiLocked: cached.kanjiLocked,
          estimatedHoursRemaining: cached.estimatedHoursRemaining,
          items: pagedItems,
          syncedAt: cached.syncedAt,
          fromCache: true,
        },
        pagination: {
          offset,
          limit: limit ?? items.length,
          total: items.length,
          hasMore: limit === null ? false : offset + limit < items.length,
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

    const savedItems = saved.items as unknown[];
    const pagedItems = limit === null ? savedItems : savedItems.slice(offset, offset + limit);

    return NextResponse.json({
      snapshot: {
        level: saved.level,
        kanjiTotal: saved.kanjiTotal,
        kanjiLearned: saved.kanjiLearned,
        kanjiGuruPlus: saved.kanjiGuruPlus,
        kanjiLocked: saved.kanjiLocked,
        estimatedHoursRemaining: saved.estimatedHoursRemaining,
        items: pagedItems,
        syncedAt: saved.syncedAt,
        fromCache: false,
      },
      pagination: {
        offset,
        limit: limit ?? savedItems.length,
        total: savedItems.length,
        hasMore: limit === null ? false : offset + limit < savedItems.length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not fetch level snapshot." }, { status: 500 });
  }
}
