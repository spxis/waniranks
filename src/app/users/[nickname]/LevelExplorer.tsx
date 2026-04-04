"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type LevelItem = {
  subjectId: number;
  subjectType?: "kanji" | "radical" | "vocabulary";
  wkLevel?: number;
  characters: string;
  meanings: string[];
  readings?: string[];
  primaryReadings?: string[];
  radicals?: Array<{
    subjectId: number;
    label: string;
  }>;
  visuallySimilar?: Array<{
    subjectId: number;
    label: string;
  }>;
  usedInVocabulary?: Array<{
    subjectId: number;
    label: string;
  }>;
  meaningExplanation?: string;
  readingExplanation?: string;
  jlptLevel?: number | null;
  srsStage: number;
  status: "locked" | "apprentice" | "guru" | "master" | "enlightened" | "burned";
  startedAt?: string | null;
  passedAt?: string | null;
  availableAt: string | null;
};

type Snapshot = {
  level: number;
  kanjiTotal: number;
  kanjiLearned: number;
  kanjiGuruPlus: number;
  kanjiLocked: number;
  estimatedHoursRemaining: number | null;
  items: LevelItem[];
  syncedAt?: string;
};

type Props = {
  accountId: string;
  maxLevel: number;
  initialSnapshot: Snapshot;
  initialSrsFilter?: SrsFilter;
};

type SrsFilter = "all" | "apprentice" | "guru" | "master" | "enlightened" | "burned" | "locked";
type TypeFilter = "all" | "kanji" | "radical" | "vocabulary";
type JlptFilter = "all" | "n1" | "n2" | "n3" | "n4" | "n5";

function normalizeSnapshot(raw: Snapshot): Snapshot {
  return {
    ...raw,
    items: raw.items.map((item) => ({
      ...item,
      subjectType: item.subjectType ?? "kanji",
      wkLevel: item.wkLevel ?? raw.level,
      characters: item.characters ?? "?",
      meanings: item.meanings ?? [],
      readings: item.readings ?? [],
      primaryReadings: item.primaryReadings ?? [],
      radicals: item.radicals ?? [],
      visuallySimilar: item.visuallySimilar ?? [],
      usedInVocabulary: item.usedInVocabulary ?? [],
      meaningExplanation: item.meaningExplanation ?? "",
      readingExplanation: item.readingExplanation ?? "",
      jlptLevel: item.jlptLevel ?? null,
      startedAt: item.startedAt ?? null,
      passedAt: item.passedAt ?? null,
      availableAt: item.availableAt ?? null,
    })),
  };
}

function statusClass(status: LevelItem["status"]): string {
  switch (status) {
    case "locked":
      return "bg-slate-100 text-slate-600";
    case "apprentice":
      return "bg-pink-100 text-pink-700";
    case "guru":
      return "bg-violet-100 text-violet-700";
    case "master":
      return "bg-sky-100 text-sky-700";
    case "enlightened":
      return "bg-amber-100 text-amber-700";
    case "burned":
      return "bg-emerald-100 text-emerald-700";
  }
}

function formatNumber(input: number): string {
  return new Intl.NumberFormat("en-US").format(input);
}

function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "-";
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatNextReviewBadge(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const absolute = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    hour: "numeric",
  }).format(parsed);

  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);

  let relative = "soon";
  if (absMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
    relative = `${deltaMs >= 0 ? "in" : ""} ${minutes} minute${minutes === 1 ? "" : "s"}`.trim();
  } else if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
    relative = `${deltaMs >= 0 ? "in" : ""} ${hours} hour${hours === 1 ? "" : "s"}`.trim();
  } else {
    const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
    relative = `${deltaMs >= 0 ? "in" : ""} ${days} day${days === 1 ? "" : "s"}`.trim();
  }

  if (deltaMs < 0) {
    relative = `${relative} ago`;
  }

  return `Next review ${absolute} (${relative})`;
}

function stripHtml(input: string | undefined): string {
  if (!input) {
    return "";
  }

  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function primaryReadingForDisplay(item: LevelItem): string | null {
  const reading = (item.primaryReadings ?? [])[0] ?? null;
  if (reading) {
    return reading;
  }

  if (item.subjectType === "radical") {
    return null;
  }

  return "-";
}

function glyphHasReading(item: LevelItem): boolean {
  return Boolean(primaryReadingForDisplay(item));
}

export default function LevelExplorer({
  accountId,
  maxLevel,
  initialSnapshot,
  initialSrsFilter = "all",
}: Props) {
  const typeVisibilityStorageKey = `wr:explorer:${accountId}:type-visibility`;
  const selectedSubjectStorageKey = `wr:explorer:${accountId}:selected-subject`;
  const stickyMergeStorageKey = `wr:explorer:${accountId}:sticky-merge`;
  const srsFilterStorageKey = `wr:explorer:${accountId}:srs-filter`;
  const typeFilterStorageKey = `wr:explorer:${accountId}:type-filter`;
  const jlptFilterStorageKey = `wr:explorer:${accountId}:jlpt-filter`;
  const showLockedStorageKey = `wr:explorer:${accountId}:show-locked`;
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([initialSnapshot.level]));
  const [snapshotsByLevel, setSnapshotsByLevel] = useState<Map<number, Snapshot>>(
    new Map([[initialSnapshot.level, normalizeSnapshot(initialSnapshot)]]),
  );
  const [srsFilter, setSrsFilter] = useState<SrsFilter>(initialSrsFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [jlptFilter, setJlptFilter] = useState<JlptFilter>("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSnapshot.items[0]?.subjectId ?? null,
  );
  const [visibleTypes, setVisibleTypes] = useState({
    radical: true,
    kanji: true,
    vocabulary: true,
  });
  const [showLockedItems, setShowLockedItems] = useState(false);
  const [stickyMerge, setStickyMerge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(typeVisibilityStorageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<typeof visibleTypes>;
      setVisibleTypes((prev) => ({
        radical: parsed.radical ?? prev.radical,
        kanji: parsed.kanji ?? prev.kanji,
        vocabulary: parsed.vocabulary ?? prev.vocabulary,
      }));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [typeVisibilityStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(selectedSubjectStorageKey);
      if (!raw) {
        return;
      }

      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed > 0) {
        setSelectedSubjectId(parsed);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedSubjectStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(stickyMergeStorageKey);
      if (raw === "1") {
        setStickyMerge(true);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [stickyMergeStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(srsFilterStorageKey);
      if (!raw) {
        return;
      }

      const allowed: SrsFilter[] = [
        "all",
        "apprentice",
        "guru",
        "master",
        "enlightened",
        "burned",
        "locked",
      ];

      if (allowed.includes(raw as SrsFilter)) {
        setSrsFilter(raw as SrsFilter);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [srsFilterStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(typeFilterStorageKey);
      if (!raw) {
        return;
      }

      const allowed: TypeFilter[] = ["all", "radical", "kanji", "vocabulary"];
      if (allowed.includes(raw as TypeFilter)) {
        setTypeFilter(raw as TypeFilter);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [typeFilterStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(jlptFilterStorageKey);
      if (!raw) {
        return;
      }

      const allowed: JlptFilter[] = ["all", "n1", "n2", "n3", "n4", "n5"];
      if (allowed.includes(raw as JlptFilter)) {
        setJlptFilter(raw as JlptFilter);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [jlptFilterStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(showLockedStorageKey);
      if (raw === "1") {
        setShowLockedItems(true);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showLockedStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(srsFilterStorageKey, srsFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [srsFilter, srsFilterStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(typeFilterStorageKey, typeFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [typeFilter, typeFilterStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(jlptFilterStorageKey, jlptFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [jlptFilter, jlptFilterStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(showLockedStorageKey, showLockedItems ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showLockedItems, showLockedStorageKey]);

  useEffect(() => {
    try {
      if (selectedSubjectId === null) {
        window.localStorage.removeItem(selectedSubjectStorageKey);
      } else {
        window.localStorage.setItem(selectedSubjectStorageKey, String(selectedSubjectId));
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [selectedSubjectId, selectedSubjectStorageKey]);

  function setVisibleTypesAndPersist(next: typeof visibleTypes) {
    setVisibleTypes(next);
    try {
      window.localStorage.setItem(typeVisibilityStorageKey, JSON.stringify(next));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }

  function toggleVisibleType(type: "radical" | "kanji" | "vocabulary") {
    const next = {
      ...visibleTypes,
      [type]: !visibleTypes[type],
    };
    setVisibleTypesAndPersist(next);
  }

  function setStickyMergeAndPersist(next: boolean) {
    setStickyMerge(next);

    try {
      window.localStorage.setItem(stickyMergeStorageKey, next ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }

    if (!next) {
      const firstSelected = Array.from(selectedLevels.values()).sort((a, b) => a - b)[0] ?? initialSnapshot.level;
      setSelectedLevels(new Set([firstSelected]));
    }
  }

  function setTypeFilterAndEnsureVisible(nextType: TypeFilter) {
    setTypeFilter(nextType);

    if (nextType === "all") {
      return;
    }

    if (!visibleTypes[nextType]) {
      setVisibleTypesAndPersist({
        ...visibleTypes,
        [nextType]: true,
      });
    }
  }

  function setSrsFilterAndSyncLocked(nextStatus: SrsFilter) {
    setSrsFilter(nextStatus);
    if (nextStatus === "locked") {
      setShowLockedItems(true);
    }
  }

  const levelOptions = useMemo(() => {
    return Array.from({ length: maxLevel }, (_, index) => index + 1);
  }, [maxLevel]);

  const combinedSnapshot = useMemo(() => {
    const selected = Array.from(selectedLevels.values()).sort((a, b) => a - b);
    const snapshots = selected
      .map((level) => snapshotsByLevel.get(level))
      .filter((snapshot): snapshot is Snapshot => Boolean(snapshot));

    if (snapshots.length === 0) {
      return normalizeSnapshot(initialSnapshot);
    }

    const items = snapshots.flatMap((snapshot) => snapshot.items);
    const kanjiItems = items.filter((item) => item.subjectType === "kanji");

    return {
      level: selected[selected.length - 1],
      kanjiTotal: kanjiItems.length,
      kanjiLearned: kanjiItems.filter((item) => item.srsStage > 0).length,
      kanjiGuruPlus: kanjiItems.filter((item) => item.srsStage >= 5).length,
      kanjiLocked: kanjiItems.filter((item) => item.status === "locked").length,
      estimatedHoursRemaining: null,
      items,
      syncedAt: snapshots
        .map((snapshot) => snapshot.syncedAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .pop(),
    };
  }, [initialSnapshot, selectedLevels, snapshotsByLevel]);

  async function ensureLevelLoaded(level: number) {
    if (snapshotsByLevel.has(level)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/levels/${level}`, { cache: "no-store" });
      const data = (await response.json()) as { error?: string; snapshot?: Snapshot };

      if (!response.ok || !data.snapshot) {
        throw new Error(data.error ?? "Could not load level details.");
      }

      const normalized = normalizeSnapshot(data.snapshot);
      setSnapshotsByLevel((prev) => {
        const map = new Map(prev);
        map.set(level, normalized);
        return map;
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load level details.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleLevel(level: number) {
    setError("");

    if (!stickyMerge) {
      setSelectedLevels(new Set([level]));
      await ensureLevelLoaded(level);
      return;
    }

    const next = new Set(selectedLevels);
    if (next.has(level)) {
      if (next.size === 1) {
        return;
      }
      next.delete(level);
      setSelectedLevels(next);
      return;
    }

    next.add(level);
    setSelectedLevels(next);
    await ensureLevelLoaded(level);
  }

  const filteredItems = useMemo(() => {
    const typeOrder: Record<NonNullable<LevelItem["subjectType"]>, number> = {
      radical: 0,
      kanji: 1,
      vocabulary: 2,
    };

    return combinedSnapshot.items
      .filter((item) => {
        const srsPass = srsFilter === "all" ? true : item.status === srsFilter;
        const typePass = typeFilter === "all" ? true : item.subjectType === typeFilter;
        const jlptPass =
          jlptFilter === "all"
            ? true
            : item.subjectType === "kanji" && item.jlptLevel === Number(jlptFilter.slice(1));
        const lockedPass = showLockedItems ? true : item.status !== "locked";
        const visibilityPass =
          item.subjectType === "radical"
            ? visibleTypes.radical
            : item.subjectType === "kanji"
              ? visibleTypes.kanji
              : item.subjectType === "vocabulary"
                ? visibleTypes.vocabulary
                : true;

        return srsPass && typePass && jlptPass && lockedPass && visibilityPass;
      })
      .sort((a, b) => {
        const aOrder = a.subjectType ? typeOrder[a.subjectType] : 99;
        const bOrder = b.subjectType ? typeOrder[b.subjectType] : 99;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        if ((a.wkLevel ?? 0) !== (b.wkLevel ?? 0)) {
          return (a.wkLevel ?? 0) - (b.wkLevel ?? 0);
        }

        return a.subjectId - b.subjectId;
      });
  }, [combinedSnapshot.items, srsFilter, typeFilter, jlptFilter, showLockedItems, visibleTypes]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedSubjectId) ?? null;

  const counts = useMemo(() => {
    const base = {
      all: combinedSnapshot.items.length,
      apprentice: 0,
      guru: 0,
      master: 0,
      enlightened: 0,
      burned: 0,
      locked: 0,
      kanji: 0,
      radical: 0,
      vocabulary: 0,
    };

    for (const item of combinedSnapshot.items) {
      base[item.status] += 1;
      if (item.subjectType) {
        base[item.subjectType] += 1;
      }
    }

    return base;
  }, [combinedSnapshot.items]);

  const jlptCounts = useMemo(() => {
    const base = { n1: 0, n2: 0, n3: 0, n4: 0, n5: 0 };
    for (const item of combinedSnapshot.items) {
      if (item.subjectType !== "kanji" || !item.jlptLevel) {
        continue;
      }

      const key = `n${item.jlptLevel}` as keyof typeof base;
      if (key in base) {
        base[key] += 1;
      }
    }

    return base;
  }, [combinedSnapshot.items]);

  const selectedLevelList = Array.from(selectedLevels.values()).sort((a, b) => a - b);

  function badgeClass(active: boolean): string {
    return active
      ? "border-accent bg-accent text-white"
      : "border-line bg-white text-slate-700 hover:bg-surface-muted";
  }

  function typeBadgeClass(type: TypeFilter, active: boolean, disabled: boolean): string {
    if (disabled) {
      return disabledBadgeClass();
    }

    if (type === "radical") {
      return active
        ? "border-radical bg-radical text-white"
        : "border-radical/50 bg-radical/10 text-radical hover:bg-radical/20";
    }

    if (type === "kanji") {
      return active
        ? "border-kanji bg-kanji text-white"
        : "border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20";
    }

    if (type === "vocabulary") {
      return active
        ? "border-vocabulary bg-vocabulary text-white"
        : "border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20";
    }

    return badgeClass(active);
  }

  function subjectTypePillClass(type: LevelItem["subjectType"]): string {
    if (type === "radical") {
      return "subject-pill subject-pill--radical";
    }

    if (type === "kanji") {
      return "subject-pill subject-pill--kanji";
    }

    if (type === "vocabulary") {
      return "subject-pill subject-pill--vocabulary";
    }

    return "subject-pill";
  }

  function disabledBadgeClass(): string {
    return "cursor-not-allowed border-line bg-slate-100 text-slate-400";
  }

  function typeCardClass(type: LevelItem["subjectType"], selected: boolean): string {
    const selectedRing = selected ? "ring-2 ring-accent" : "";
    if (type === "radical") {
      return `border-radical/50 bg-white text-slate-800 ${selectedRing}`;
    }
    if (type === "kanji") {
      return `border-kanji/50 bg-white text-slate-800 ${selectedRing}`;
    }
    if (type === "vocabulary") {
      return `border-vocabulary/50 bg-white text-slate-800 ${selectedRing}`;
    }
    return `border-line bg-white text-slate-700 ${selectedRing}`;
  }

  function lockedCardStateClass(item: LevelItem): string {
    if (item.status !== "locked" && item.srsStage > 0) {
      return "";
    }

    return "bg-slate-50/80 text-slate-500";
  }

  function typeGlyphBoxClass(type: LevelItem["subjectType"]): string {
    if (type === "radical") {
      return "border-radical/50 bg-radical/15 text-radical";
    }
    if (type === "kanji") {
      return "border-kanji/50 bg-kanji/15 text-kanji";
    }
    if (type === "vocabulary") {
      return "border-vocabulary/50 bg-vocabulary/15 text-vocabulary";
    }
    return "border-line bg-white text-slate-700";
  }

  const kanjiByCharacter = useMemo(() => {
    return new Map(
      combinedSnapshot.items
        .filter((item) => item.subjectType === "kanji")
        .map((item) => [item.characters, item]),
    );
  }, [combinedSnapshot.items]);

  const vocabularyKanjiLinks = useMemo(() => {
    if (!selectedItem || selectedItem.subjectType !== "vocabulary") {
      return [] as Array<{ char: string; subjectId: number; reading: string }>;
    }

    return Array.from(selectedItem.characters)
      .map((char) => {
        const found = kanjiByCharacter.get(char);
        if (!found) {
          return null;
        }

        return {
          char,
          subjectId: found.subjectId,
          reading: (found.primaryReadings ?? [])[0] ?? "-",
        };
      })
      .filter((value): value is { char: string; subjectId: number; reading: string } => value !== null);
  }, [selectedItem, kanjiByCharacter]);

  function jumpToKanji(subjectId: number) {
    setTypeFilter("kanji");
    setSrsFilter("all");
    setSelectedSubjectId(subjectId);
  }

  return (
    <section id="explorer" className="overflow-hidden rounded-[2rem] border border-line bg-surface/90 shadow-[0_20px_55px_rgba(8,16,36,0.12)]">
      <header className="flex flex-col gap-3 border-b border-line bg-surface-muted px-5 py-4">
        <div>
          <h2 className="text-xl font-black text-foreground">Level Explorer</h2>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-600">
            Click one or more level badges to combine data
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
          {levelOptions.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${badgeClass(
                selectedLevels.has(level),
              )}`}
            >
              L{level}
            </button>
          ))}
          </div>
          <button
            type="button"
            onClick={() => setStickyMergeAndPersist(!stickyMerge)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              stickyMerge
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-slate-700"
            }`}
            aria-pressed={stickyMerge}
          >
            Sticky {stickyMerge ? "On" : "Off"}
          </button>
        </div>
      </header>

      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Selected levels</p>
          <p className="mt-1 text-2xl font-black text-foreground">{selectedLevelList.join(", ")}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Total Items</p>
          <p className="mt-1 text-2xl font-black text-foreground">{formatNumber(combinedSnapshot.items.length)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Kanji Learned</p>
          <p className="mt-1 text-2xl font-black text-accent">{formatNumber(combinedSnapshot.kanjiLearned)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Kanji Locked</p>
          <p className="mt-1 text-2xl font-black text-hot">{formatNumber(combinedSnapshot.kanjiLocked)}</p>
        </div>
      </div>

      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">JLPT mix (kanji in selected levels)</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {([
            ["N5", jlptCounts.n5],
            ["N4", jlptCounts.n4],
            ["N3", jlptCounts.n3],
            ["N2", jlptCounts.n2],
            ["N1", jlptCounts.n1],
          ] as const).map(([label, count]) => (
            <div key={label} className="rounded-xl border border-line bg-surface-muted p-2 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-600">{label}</p>
              <p className="text-2xl font-black text-foreground">{formatNumber(count)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-b border-line px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {(["all", "apprentice", "guru", "master", "enlightened", "burned", "locked"] as const).map(
            (status) => (
              (() => {
                const count = counts[status];
                const disabled = status !== "all" && count === 0;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSrsFilterAndSyncLocked(status)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                      disabled ? disabledBadgeClass() : badgeClass(srsFilter === status)
                    }`}
                  >
                    {status} ({formatNumber(count)})
                  </button>
                );
              })()
            ),
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "radical", "kanji", "vocabulary"] as const).map((type) => {
            const count = counts[type];
            const disabled = type !== "all" && count === 0;

            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilterAndEnsureVisible(type)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${typeBadgeClass(
                  type,
                  typeFilter === type,
                  disabled,
                )}`}
              >
                {type} ({formatNumber(count)})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "n5", "n4", "n3", "n2", "n1"] as const).map((level) => {
            const count = level === "all" ? counts.kanji : jlptCounts[level];
            const disabled = level !== "all" && count === 0;

            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setJlptFilter(level);
                  if (level !== "all") {
                    setTypeFilterAndEnsureVisible("kanji");
                  }
                }}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  disabled ? disabledBadgeClass() : badgeClass(jlptFilter === level)
                }`}
              >
                {level === "all" ? "JLPT All" : level.toUpperCase()} ({formatNumber(count)})
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">Collapse item types</p>
          {([
            ["radical", visibleTypes.radical],
            ["kanji", visibleTypes.kanji],
            ["vocabulary", visibleTypes.vocabulary],
          ] as const).map(([type, isVisible]) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleVisibleType(type)}
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
                isVisible ? typeBadgeClass(type, true, false) : "border-line bg-slate-100 text-slate-500"
              }`}
            >
              {isVisible ? `Hide ${type}` : `Show ${type}`}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVisibleTypesAndPersist({ radical: false, kanji: false, vocabulary: false })}
            className="rounded-full border border-line bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-600"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true })}
            className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
          >
            Expand all
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLockedItems((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              showLockedItems
                ? "border-slate-500 bg-slate-600 text-white"
                : "border-line bg-white text-slate-700"
            }`}
          >
            {showLockedItems ? "Hide Locked" : "Show Locked"}
          </button>
          <p className="text-xs font-semibold text-slate-500">
            Locked items are hidden by default.
          </p>
        </div>
      </div>

      {loading ? <p className="px-5 py-4 text-sm text-slate-600">Loading level data...</p> : null}
      {error ? <p className="px-5 py-4 text-sm text-red-700">{error}</p> : null}

      <div className="p-5">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-muted p-4 text-sm font-semibold text-slate-600">
            No items visible. Expand one or more types above.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <Fragment key={`${item.subjectType}-${item.subjectId}`}>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSubjectId((prev) => (prev === item.subjectId ? null : item.subjectId))
                  }
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    selectedItem?.subjectId === item.subjectId,
                  )} ${lockedCardStateClass(item)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`rounded-xl border ${
                          glyphHasReading(item)
                            ? "inline-flex min-h-[5.25rem] min-w-[5.25rem] flex-col items-center justify-center px-3 py-2"
                            : "inline-flex min-h-[5.25rem] min-w-[5.25rem] items-center justify-center px-3 py-3"
                        } ${typeGlyphBoxClass(item.subjectType)} ${
                          item.status === "locked" || item.srsStage <= 0 ? "opacity-60" : ""
                        }`}
                      >
                        <p className="text-4xl font-black leading-none">{item.characters}</p>
                        {primaryReadingForDisplay(item) ? (
                          <p className="mt-1 text-center text-sm font-semibold text-slate-600">
                            {primaryReadingForDisplay(item)}
                          </p>
                        ) : null}
                      </div>
                      <p
                        className={`line-clamp-2 text-xl font-black leading-tight ${
                          item.status === "locked" || item.srsStage <= 0 ? "text-slate-500" : "text-slate-700"
                        }`}
                      >
                        {item.meanings.join(", ") || "-"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                      {item.subjectType === "kanji" && item.jlptLevel ? (
                        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          JLPT N{item.jlptLevel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>
                      {item.status}
                    </span>
                    <span className="rounded-full border border-line bg-white px-2 py-1 text-xs font-bold text-slate-700">
                      SRS {item.srsStage}
                    </span>
                  </div>
                  {item.subjectType === "kanji" && item.status !== "burned" ? (
                    (() => {
                      const nextReviewBadge = formatNextReviewBadge(item.availableAt);
                      if (!nextReviewBadge) {
                        return null;
                      }

                      return (
                        <div className="mt-2 flex justify-center">
                          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {nextReviewBadge}
                          </span>
                        </div>
                      );
                    })()
                  ) : null}
                </button>

                {selectedItem?.subjectId === item.subjectId ? (
                  <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-white p-5 sm:col-span-2 lg:col-span-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-end gap-3">
                        <div
                          className={`inline-flex rounded-2xl border ${
                            glyphHasReading(selectedItem)
                              ? "min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center px-4 py-3"
                              : "min-h-[5.75rem] min-w-[5.75rem] items-center justify-center px-4 py-3"
                          } ${typeGlyphBoxClass(selectedItem.subjectType)}`}
                        >
                          <div>
                            <h3 className="text-4xl font-black leading-none text-current">{selectedItem.characters}</h3>
                            {primaryReadingForDisplay(selectedItem) ? (
                              <p className="mt-1 text-center text-sm font-semibold text-slate-700">
                                {primaryReadingForDisplay(selectedItem)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-2xl font-black leading-tight text-foreground">
                            {selectedItem.meanings.join(", ") || "-"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            WaniKani Level {selectedItem.wkLevel} · {selectedItem.subjectType}
                          </p>
                      </div>
                    </div>
                      {selectedItem.subjectType === "kanji" && selectedItem.jlptLevel ? (
                        <p className="inline-flex self-start rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-700">
                        JLPT N{selectedItem.jlptLevel}
                      </p>
                    ) : null}
                    </div>

                    {selectedItem.subjectType === "vocabulary" ? (
                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-600">
                          Kanji used in this vocabulary
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {vocabularyKanjiLinks.length === 0 ? (
                            <span className="rounded-full border border-line bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                              No linked kanji in selected levels
                            </span>
                          ) : (
                            vocabularyKanjiLinks.map((item) => (
                              <button
                                key={`${selectedItem.subjectId}-${item.subjectId}`}
                                type="button"
                                onClick={() => jumpToKanji(item.subjectId)}
                                className="rounded-xl border border-kanji/50 bg-kanji/15 px-4 py-2 text-kanji"
                              >
                                <p className="text-3xl font-black leading-none">{item.char}</p>
                                <p className="mt-1 text-center text-sm font-semibold text-slate-600">{item.reading}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">SRS state</p>
                        <p className="mt-1 font-semibold text-slate-800">{selectedItem.status}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Started</p>
                        <p className="mt-1 font-semibold text-slate-800">{formatDate(selectedItem.startedAt)}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Next review</p>
                        <p className="mt-1 font-semibold text-slate-800">{formatDate(selectedItem.availableAt)}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Passed</p>
                        <p className="mt-1 font-semibold text-slate-800">{formatDate(selectedItem.passedAt)}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm sm:col-span-2">
                        <p className="text-xs font-bold uppercase text-slate-600">Primary reading</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          {selectedItem.subjectType === "radical"
                            ? "Not applicable"
                            : (selectedItem.primaryReadings ?? []).join(", ") || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Meaning explanation</p>
                        <p className="mt-2 text-slate-800">{stripHtml(selectedItem.meaningExplanation) || "-"}</p>
                      </article>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Reading explanation</p>
                        <p className="mt-2 text-slate-800">{stripHtml(selectedItem.readingExplanation) || "-"}</p>
                      </article>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Radicals</p>
                        <p className="mt-2 text-slate-800">
                          {(selectedItem.radicals ?? []).map((item) => item.label).join(", ") || "-"}
                        </p>
                      </article>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Visually similar</p>
                        <p className="mt-2 text-slate-800">
                          {(selectedItem.visuallySimilar ?? []).map((item) => item.label).join(", ") || "-"}
                        </p>
                      </article>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Used in vocabulary</p>
                        <p className="mt-2 text-slate-800">
                          {(selectedItem.usedInVocabulary ?? []).map((item) => item.label).join(", ") || "-"}
                        </p>
                      </article>
                    </div>
                  </section>
                ) : null}
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
