"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function LevelExplorer({
  accountId,
  maxLevel,
  initialSnapshot,
  initialSrsFilter = "all",
}: Props) {
  const typeVisibilityStorageKey = `wr:explorer:${accountId}:type-visibility`;
  const selectedSubjectStorageKey = `wr:explorer:${accountId}:selected-subject`;
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([initialSnapshot.level]));
  const [snapshotsByLevel, setSnapshotsByLevel] = useState<Map<number, Snapshot>>(
    new Map([[initialSnapshot.level, normalizeSnapshot(initialSnapshot)]]),
  );
  const [srsFilter, setSrsFilter] = useState<SrsFilter>(initialSrsFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSnapshot.items[0]?.subjectId ?? null,
  );
  const [visibleTypes, setVisibleTypes] = useState({
    radical: true,
    kanji: true,
    vocabulary: true,
  });
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

  async function toggleLevel(level: number) {
    setError("");
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

  const filteredItems = useMemo(() => {
    return combinedSnapshot.items.filter((item) => {
      const srsPass = srsFilter === "all" ? true : item.status === srsFilter;
      const typePass = typeFilter === "all" ? true : item.subjectType === typeFilter;
      const visibilityPass =
        item.subjectType === "radical"
          ? visibleTypes.radical
          : item.subjectType === "kanji"
            ? visibleTypes.kanji
            : item.subjectType === "vocabulary"
              ? visibleTypes.vocabulary
              : true;

      return srsPass && typePass && visibilityPass;
    });
  }, [combinedSnapshot.items, srsFilter, typeFilter, visibleTypes]);

  const selectedItem =
    filteredItems.find((item) => item.subjectId === selectedSubjectId) ?? filteredItems[0] ?? null;

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
                    onClick={() => setSrsFilter(status)}
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
          {(["all", "kanji", "radical", "vocabulary"] as const).map((type) => {
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
              <button
                key={`${item.subjectType}-${item.subjectId}`}
                type="button"
                onClick={() => setSelectedSubjectId(item.subjectId)}
                className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                  item.subjectType,
                  selectedItem?.subjectId === item.subjectId,
                )}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={`rounded-xl border px-4 py-2 ${typeGlyphBoxClass(item.subjectType)}`}>
                    <p className="text-4xl font-black leading-none">{item.characters}</p>
                    {primaryReadingForDisplay(item) ? (
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {primaryReadingForDisplay(item)}
                      </p>
                    ) : null}
                  </div>
                  <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">{item.meanings.join(", ") || "-"}</p>
                <p className="mt-1 text-xs text-slate-600">{(item.readings ?? []).join(", ") || "-"}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="rounded-full border border-line bg-white px-2 py-1 text-xs font-bold text-slate-700">
                    SRS {item.srsStage}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedItem ? (
        <section className="border-t border-line bg-white/80 p-5">
          <div className={`inline-flex rounded-2xl border px-4 py-3 ${typeGlyphBoxClass(selectedItem.subjectType)}`}>
            <div>
              <h3 className="text-4xl font-black leading-none text-current">{selectedItem.characters}</h3>
              {primaryReadingForDisplay(selectedItem) ? (
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {primaryReadingForDisplay(selectedItem)}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-600">
            WaniKani Level {selectedItem.wkLevel} · {selectedItem.subjectType}
          </p>

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
                      <p className="mt-1 text-xs font-semibold text-slate-600">{item.reading}</p>
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
    </section>
  );
}
