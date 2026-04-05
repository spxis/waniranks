"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toRomaji } from "wanakana";

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
    reading?: string | null;
  }>;
  visuallySimilar?: Array<{
    subjectId: number;
    label: string;
    reading?: string | null;
  }>;
  usedInVocabulary?: Array<{
    subjectId: number;
    label: string;
    reading?: string | null;
  }>;
  componentKanji?: Array<{
    subjectId: number;
    label: string;
    wkLevel?: number | null;
    reading?: string | null;
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
type ReviewTimingFilter = "all" | "overdue" | "next1h" | "next8h" | "next24h" | "next72h";

type RelatedReference = {
  subjectId: number;
  label: string;
  reading?: string | null;
};

type ExplorerUrlState = {
  levels: Set<number>;
  subjectId: number | null;
  srs: SrsFilter;
  type: TypeFilter;
  jlpt: JlptFilter;
  review: ReviewTimingFilter;
  showLocked: boolean;
  showBurned: boolean;
  stickyMerge: boolean;
};

function parseBooleanParam(input: string | null, fallback: boolean): boolean {
  if (input === "1") {
    return true;
  }

  if (input === "0") {
    return false;
  }

  return fallback;
}

function snapshotHasComponentKanjiData(snapshot: Snapshot): boolean {
  const vocabularyItems = snapshot.items.filter((item) => item.subjectType === "vocabulary");
  const kanjiItems = snapshot.items.filter((item) => item.subjectType === "kanji");

  return (
    vocabularyItems.every((item) =>
      Array.isArray(item.componentKanji) &&
      (item.componentKanji ?? []).every((related) => Object.hasOwn(related as object, "reading")),
    ) &&
    kanjiItems.every((item) =>
      (item.usedInVocabulary ?? []).every((related) => Object.hasOwn(related as object, "reading")) &&
      (item.radicals ?? []).every((related) => Object.hasOwn(related as object, "reading")) &&
      (item.visuallySimilar ?? []).every((related) => Object.hasOwn(related as object, "reading")),
    )
  );
}

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
      componentKanji: item.componentKanji ?? [],
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
      return "bg-slate-200 text-slate-700";
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

type NextReviewBadge = {
  label: string;
  className: string;
};

function formatNextReviewBadge(input: string | null | undefined): NextReviewBadge | null {
  if (!input) {
    return null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const deltaMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(deltaMs);

  if (deltaMs <= 0) {
    if (absMs < 15 * 60 * 1000) {
      return {
        label: "Due now",
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    if (absMs < 24 * 60 * 60 * 1000) {
      const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
      return {
        label: `Overdue ${hours}h`,
        className: "border-orange-300 bg-orange-50 text-orange-700",
      };
    }

    const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
    return {
      label: `Overdue ${days}d`,
      className: "border-red-300 bg-red-50 text-red-700",
    };
  }

  if (absMs < 15 * 60 * 1000) {
    return {
      label: "Due soon",
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absMs / (60 * 1000)));
    return {
      label: `In ${minutes}m`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(absMs / (60 * 60 * 1000)));
    return {
      label: `In ${hours}h`,
      className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    };
  }

  const days = Math.max(1, Math.round(absMs / (24 * 60 * 60 * 1000)));
  return {
    label: `In ${days}d`,
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  };
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

function glyphSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  return primaryReadingForDisplay(item);
}

function englishSubtitleForDisplay(item: LevelItem): string | null {
  if (item.subjectType === "radical") {
    return item.meanings[0] ?? null;
  }

  const reading = primaryReadingForDisplay(item);
  if (!reading) {
    return null;
  }

  const pronunciation = pronunciationForReading(reading);
  return pronunciation ? `${reading} / ${pronunciation}` : reading;
}

function glyphHasReading(item: LevelItem): boolean {
  return Boolean(glyphSubtitleForDisplay(item));
}

function pronunciationForReading(reading: string | null | undefined): string | null {
  if (!reading) {
    return null;
  }

  const trimmed = reading.trim();
  if (!trimmed || trimmed === "-") {
    return null;
  }

  const romaji = toRomaji(trimmed, { upcaseKatakana: false }).trim();
  if (!romaji || romaji === trimmed) {
    return null;
  }

  return romaji;
}

function ReadingWithPronunciation({
  reading,
  className,
}: {
  reading: string;
  className?: string;
}) {
  const pronunciation = pronunciationForReading(reading);

  if (!pronunciation) {
    return <span className={className}>{reading}</span>;
  }

  return (
    <span
      className={className}
      title={`Pronunciation: ${pronunciation}`}
      aria-label={`${reading} pronunciation ${pronunciation}`}
    >
      {reading}
    </span>
  );
}

function ReadingListWithPronunciation({
  readings,
  mode = "tooltip",
}: {
  readings: string[];
  mode?: "tooltip" | "inline" | "plain";
}) {
  if (readings.length === 0) {
    return <span>-</span>;
  }

  if (mode === "plain") {
    return <>{readings.join(", ")}</>;
  }

  if (mode === "inline") {
    return (
      <>
        {readings.map((reading, index) => {
          const pronunciation = pronunciationForReading(reading);
          const label = pronunciation ? `${reading} / ${pronunciation}` : reading;

          return (
            <Fragment key={`${reading}-${index}`}>
              {index > 0 ? ", " : null}
              <span>{label}</span>
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <>
      {readings.map((reading, index) => (
        <Fragment key={`${reading}-${index}`}>
          {index > 0 ? ", " : null}
          <ReadingWithPronunciation reading={reading} />
        </Fragment>
      ))}
    </>
  );
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
  const reviewTimingFilterStorageKey = `wr:explorer:${accountId}:review-timing-filter`;
  const showLockedStorageKey = `wr:explorer:${accountId}:show-locked`;
  const showBurnedStorageKey = `wr:explorer:${accountId}:show-burned`;
  const showPrimaryReadingEnglishStorageKey = `wr:explorer:${accountId}:show-primary-reading-english`;
  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set([initialSnapshot.level]));
  const [snapshotsByLevel, setSnapshotsByLevel] = useState<Map<number, Snapshot>>(
    new Map([[initialSnapshot.level, normalizeSnapshot(initialSnapshot)]]),
  );
  const [srsFilter, setSrsFilter] = useState<SrsFilter>(initialSrsFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [jlptFilter, setJlptFilter] = useState<JlptFilter>("all");
  const [reviewTimingFilter, setReviewTimingFilter] = useState<ReviewTimingFilter>("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    initialSnapshot.items[0]?.subjectId ?? null,
  );
  const [visibleTypes, setVisibleTypes] = useState({
    radical: true,
    kanji: true,
    vocabulary: true,
  });
  const [showLockedItems, setShowLockedItems] = useState(false);
  const [showBurnedItems, setShowBurnedItems] = useState(true);
  const [stickyMerge, setStickyMerge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [gridColumns, setGridColumns] = useState(1);
  const [showPrimaryReadingEnglish, setShowPrimaryReadingEnglish] = useState(true);
  const applyingUrlStateRef = useRef(false);
  const hasHydratedUrlStateRef = useRef(false);
  const pendingHistoryModeRef = useRef<"replace" | "push">("replace");

  function markHistoryPush() {
    pendingHistoryModeRef.current = "push";
  }

  function parseUrlState(search: string): ExplorerUrlState {
    const params = new URLSearchParams(search);

    const levelValues = (params.get("levels") ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= maxLevel);

    const levels = new Set(levelValues.length > 0 ? levelValues : [initialSnapshot.level]);

    const subjectRaw = Number(params.get("subject"));
    const subjectId = Number.isInteger(subjectRaw) && subjectRaw > 0 ? subjectRaw : null;

    const srsRaw = params.get("srs");
    const srsAllowed: SrsFilter[] = [
      "all",
      "apprentice",
      "guru",
      "master",
      "enlightened",
      "burned",
      "locked",
    ];
    const srs = srsAllowed.includes(srsRaw as SrsFilter) ? (srsRaw as SrsFilter) : "all";

    const typeRaw = params.get("type");
    const typeAllowed: TypeFilter[] = ["all", "radical", "kanji", "vocabulary"];
    const type = typeAllowed.includes(typeRaw as TypeFilter) ? (typeRaw as TypeFilter) : "all";

    const jlptRaw = params.get("jlpt");
    const jlptAllowed: JlptFilter[] = ["all", "n5", "n4", "n3", "n2", "n1"];
    const jlpt = jlptAllowed.includes(jlptRaw as JlptFilter) ? (jlptRaw as JlptFilter) : "all";

    const reviewRaw = params.get("review");
    const reviewAllowed: ReviewTimingFilter[] = ["all", "overdue", "next1h", "next8h", "next24h", "next72h"];
    const review = reviewAllowed.includes(reviewRaw as ReviewTimingFilter)
      ? (reviewRaw as ReviewTimingFilter)
      : "all";

    return {
      levels,
      subjectId,
      srs,
      type,
      jlpt,
      review,
      showLocked: parseBooleanParam(params.get("locked"), false),
      showBurned: parseBooleanParam(params.get("burned"), true),
      stickyMerge: parseBooleanParam(params.get("sticky"), false),
    };
  }

  function writeUrlState() {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const levelsList = Array.from(selectedLevels.values()).sort((a, b) => a - b);

    params.set("levels", levelsList.join(","));

    if (selectedSubjectId === null) {
      params.delete("subject");
    } else {
      params.set("subject", String(selectedSubjectId));
    }

    params.set("srs", srsFilter);
    params.set("type", typeFilter);
    params.set("jlpt", jlptFilter);
    params.set("review", reviewTimingFilter);
    params.set("locked", showLockedItems ? "1" : "0");
    params.set("burned", showBurnedItems ? "1" : "0");
    params.set("sticky", stickyMerge ? "1" : "0");

    const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) {
      pendingHistoryModeRef.current = "replace";
      return;
    }

    const mode = pendingHistoryModeRef.current;
    pendingHistoryModeRef.current = "replace";

    if (mode === "push") {
      window.history.pushState(null, "", next);
      return;
    }

    window.history.replaceState(null, "", next);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyFromUrl = () => {
      applyingUrlStateRef.current = true;
      const parsed = parseUrlState(window.location.search);

      setSelectedLevels(parsed.levels);
      setSelectedSubjectId(parsed.subjectId);
      setSrsFilter(parsed.srs);
      setTypeFilter(parsed.type);
      setJlptFilter(parsed.jlpt);
      setReviewTimingFilter(parsed.review);
      setShowLockedItems(parsed.showLocked);
      setShowBurnedItems(parsed.showBurned);
      setStickyMerge(parsed.stickyMerge);

      for (const level of parsed.levels.values()) {
        void ensureLevelLoaded(level);
      }

      window.setTimeout(() => {
        applyingUrlStateRef.current = false;
      }, 0);
    };

    applyFromUrl();
    hasHydratedUrlStateRef.current = true;

    const onPopState = () => {
      applyFromUrl();
    };

    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedUrlStateRef.current || applyingUrlStateRef.current) {
      return;
    }

    writeUrlState();
  }, [
    selectedLevels,
    selectedSubjectId,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
    showLockedItems,
    showBurnedItems,
    stickyMerge,
  ]);

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
      if (new URLSearchParams(window.location.search).has("subject")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("sticky")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("srs")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("type")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("jlpt")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("review")) {
        return;
      }

      const raw = window.localStorage.getItem(reviewTimingFilterStorageKey);
      if (!raw) {
        return;
      }

      const allowed: ReviewTimingFilter[] = ["all", "overdue", "next1h", "next8h", "next24h", "next72h"];
      if (allowed.includes(raw as ReviewTimingFilter)) {
        setReviewTimingFilter(raw as ReviewTimingFilter);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [reviewTimingFilterStorageKey]);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("locked")) {
        return;
      }

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
      if (new URLSearchParams(window.location.search).has("burned")) {
        return;
      }

      const raw = window.localStorage.getItem(showBurnedStorageKey);
      if (raw === "0") {
        setShowBurnedItems(false);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showBurnedStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(showPrimaryReadingEnglishStorageKey);
      if (raw === "0") {
        setShowPrimaryReadingEnglish(false);
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showPrimaryReadingEnglishStorageKey]);

  useEffect(() => {
    const computeColumns = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setGridColumns(3);
        return;
      }

      if (window.matchMedia("(min-width: 640px)").matches) {
        setGridColumns(2);
        return;
      }

      setGridColumns(1);
    };

    computeColumns();

    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    sm.addEventListener("change", computeColumns);
    lg.addEventListener("change", computeColumns);

    return () => {
      sm.removeEventListener("change", computeColumns);
      lg.removeEventListener("change", computeColumns);
    };
  }, []);

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
      window.localStorage.setItem(reviewTimingFilterStorageKey, reviewTimingFilter);
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [reviewTimingFilter, reviewTimingFilterStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(showLockedStorageKey, showLockedItems ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showLockedItems, showLockedStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(showBurnedStorageKey, showBurnedItems ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showBurnedItems, showBurnedStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(showPrimaryReadingEnglishStorageKey, showPrimaryReadingEnglish ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [showPrimaryReadingEnglish, showPrimaryReadingEnglishStorageKey]);

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
    markHistoryPush();

    const next = {
      ...visibleTypes,
      [type]: !visibleTypes[type],
    };
    setVisibleTypesAndPersist(next);
  }

  function setStickyMergeAndPersist(next: boolean) {
    markHistoryPush();

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
    markHistoryPush();

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
    markHistoryPush();

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

  async function ensureLevelLoaded(level: number, forceReload = false) {
    if (!forceReload && snapshotsByLevel.has(level)) {
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

  useEffect(() => {
    const current = snapshotsByLevel.get(initialSnapshot.level);
    if (!current) {
      return;
    }

    if (!snapshotHasComponentKanjiData(current)) {
      void ensureLevelLoaded(initialSnapshot.level, true);
    }
  }, [initialSnapshot.level, snapshotsByLevel]);

  async function toggleLevel(level: number) {
    markHistoryPush();

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
        const burnedPass = showBurnedItems ? true : item.status !== "burned";
        const reviewTimingPass = (() => {
          if (reviewTimingFilter === "all") {
            return true;
          }

          if (!item.availableAt || item.status === "burned") {
            return false;
          }

          const availableTime = new Date(item.availableAt).getTime();
          if (Number.isNaN(availableTime)) {
            return false;
          }

          const deltaMs = availableTime - Date.now();
          if (reviewTimingFilter === "overdue") {
            return deltaMs <= 0;
          }

          if (deltaMs < 0) {
            return false;
          }

          const windowMs =
            reviewTimingFilter === "next1h"
              ? 60 * 60 * 1000
              : reviewTimingFilter === "next8h"
                ? 8 * 60 * 60 * 1000
                : reviewTimingFilter === "next24h"
                  ? 24 * 60 * 60 * 1000
                  : 72 * 60 * 60 * 1000;

          return deltaMs <= windowMs;
        })();
        const visibilityPass =
          item.subjectType === "radical"
            ? visibleTypes.radical
            : item.subjectType === "kanji"
              ? visibleTypes.kanji
              : item.subjectType === "vocabulary"
                ? visibleTypes.vocabulary
                : true;

        return srsPass && typePass && jlptPass && lockedPass && burnedPass && reviewTimingPass && visibilityPass;
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
  }, [
    combinedSnapshot.items,
    srsFilter,
    typeFilter,
    jlptFilter,
    reviewTimingFilter,
    showLockedItems,
    showBurnedItems,
    visibleTypes,
  ]);

  const selectedItem = filteredItems.find((item) => item.subjectId === selectedSubjectId) ?? null;
  const selectedItemIndex = selectedItem
    ? filteredItems.findIndex((item) => item.subjectId === selectedItem.subjectId)
    : -1;
  const detailInsertIndex =
    selectedItemIndex >= 0
      ? Math.min(
          filteredItems.length - 1,
          Math.floor(selectedItemIndex / gridColumns) * gridColumns + (gridColumns - 1),
        )
      : -1;

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

  const reviewTimingCounts = useMemo(() => {
    const base = {
      overdue: 0,
      next1h: 0,
      next8h: 0,
      next24h: 0,
      next72h: 0,
    };

    for (const item of combinedSnapshot.items) {
      if (!item.availableAt || item.status === "burned") {
        continue;
      }

      const availableTime = new Date(item.availableAt).getTime();
      if (Number.isNaN(availableTime)) {
        continue;
      }

      const deltaMs = availableTime - Date.now();
      if (deltaMs <= 0) {
        base.overdue += 1;
      }

      if (deltaMs >= 0 && deltaMs <= 60 * 60 * 1000) {
        base.next1h += 1;
      }

      if (deltaMs >= 0 && deltaMs <= 8 * 60 * 60 * 1000) {
        base.next8h += 1;
      }

      if (deltaMs >= 0 && deltaMs <= 24 * 60 * 60 * 1000) {
        base.next24h += 1;
      }

      if (deltaMs >= 0 && deltaMs <= 72 * 60 * 60 * 1000) {
        base.next72h += 1;
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

  function glyphTextSizeClass(characters: string): string {
    const length = Array.from(characters).length;
    if (length >= 5) {
      return "text-4xl";
    }
    if (length >= 3) {
      return "text-5xl";
    }
    return "text-6xl";
  }

  const kanjiByCharacter = useMemo(() => {
    return new Map(
      combinedSnapshot.items
        .filter((item) => item.subjectType === "kanji")
        .map((item) => [item.characters, item]),
    );
  }, [combinedSnapshot.items]);

  const subjectById = useMemo(() => {
    return new Map(combinedSnapshot.items.map((item) => [item.subjectId, item]));
  }, [combinedSnapshot.items]);

  const vocabularyKanjiLinks = useMemo(() => {
    if (!selectedItem || selectedItem.subjectType !== "vocabulary") {
      return [] as Array<{ char: string; subjectId: number; reading: string; wkLevel: number | null }>;
    }

    const componentLinks = (selectedItem.componentKanji ?? [])
      .map((component) => {
        const found = subjectById.get(component.subjectId);
        return {
          char: component.label,
          subjectId: component.subjectId,
          reading:
            typeof component.reading === "string" && component.reading.length > 0
              ? component.reading
              : found
                ? (found.primaryReadings ?? [])[0] ?? "-"
                : "-",
          wkLevel:
            typeof component.wkLevel === "number"
              ? component.wkLevel
              : typeof found?.wkLevel === "number"
                ? found.wkLevel
                : null,
        };
      })
      .filter((item) => Boolean(item.char));

    if (componentLinks.length > 0) {
      return componentLinks;
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
          wkLevel: typeof found.wkLevel === "number" ? found.wkLevel : null,
        };
      })
      .filter(
        (value): value is { char: string; subjectId: number; reading: string; wkLevel: number | null } =>
          value !== null,
      );
  }, [selectedItem, kanjiByCharacter, subjectById]);

  async function jumpToKanji(subjectId: number, wkLevel: number | null) {
    markHistoryPush();

    setShowLockedItems(true);
    setShowBurnedItems(true);

    if (typeof wkLevel === "number") {
      await ensureLevelLoaded(wkLevel);
      setSelectedLevels((prev) => {
        if (stickyMerge) {
          const next = new Set(prev);
          next.add(wkLevel);
          return next;
        }

        return new Set([wkLevel]);
      });
    }

    setTypeFilter("kanji");
    setSrsFilter("all");
    setJlptFilter("all");
    setReviewTimingFilter("all");
    setSelectedSubjectId(subjectId);
  }

  function jumpToRelatedSubject(subjectId: number) {
    markHistoryPush();

    const found = subjectById.get(subjectId);
    if (!found) {
      return;
    }

    if (found.subjectType) {
      setTypeFilterAndEnsureVisible(found.subjectType);
    }

    setSrsFilter("all");
    setJlptFilter("all");

    if (found.status === "locked") {
      setShowLockedItems(true);
    }

    if (found.status === "burned") {
      setShowBurnedItems(true);
    }

    setSelectedSubjectId(found.subjectId);
  }

  function relatedReferenceCardClass(
    type: LevelItem["subjectType"],
    isClickable: boolean,
    size: "normal" | "large",
  ): string {
    const base =
      "rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70";
    const sizeClass = size === "large" ? "px-4 py-3" : "px-3 py-2";

    if (type === "radical") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-radical/50 bg-radical/10 text-radical hover:bg-radical/20" : "border-radical/30 bg-radical/5 text-radical/80"}`;
    }

    if (type === "kanji") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-kanji/50 bg-kanji/10 text-kanji hover:bg-kanji/20" : "border-kanji/30 bg-kanji/5 text-kanji/80"}`;
    }

    if (type === "vocabulary") {
      return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-vocabulary/50 bg-vocabulary/10 text-vocabulary hover:bg-vocabulary/20" : "border-vocabulary/30 bg-vocabulary/5 text-vocabulary/80"}`;
    }

    return `${base} ${sizeClass} ${isClickable ? "cursor-pointer border-line bg-white text-slate-700 hover:bg-slate-100" : "border-line bg-slate-50 text-slate-500"}`;
  }

  function renderRelatedReferenceCards(items: RelatedReference[], options?: { large?: boolean }) {
    if (items.length === 0) {
      return <p className="mt-2 text-slate-500">-</p>;
    }

    const size = options?.large ? "large" : "normal";

    function labelClass(label: string): string {
      if (size === "normal") {
        return "text-xl";
      }

      const length = Array.from(label).length;
      if (length <= 2) {
        return "text-4xl";
      }
      if (length <= 4) {
        return "text-3xl";
      }
      return "text-2xl";
    }

    const expandedItems = items.flatMap((item) => {
      const segments = item.label
        .split(/[、,]/)
        .map((segment) => segment.trim())
        .filter((segment) => Boolean(segment));

      if (segments.length <= 1) {
        return [item];
      }

      return segments.map((segment, index) => ({
        subjectId: item.subjectId,
        label: segment,
        reading: null,
        fallbackKey: `${item.subjectId}-${segment}-${index}`,
      }));
    });

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {expandedItems.map((entry, index) => {
          const item = {
            subjectId: entry.subjectId,
            label: entry.label,
            reading: "reading" in entry ? entry.reading : null,
          };
          const linked = subjectById.get(item.subjectId) ?? null;
          const isClickable = linked !== null;
          const relationType = linked?.subjectType;
          const reading = typeof item.reading === "string" && item.reading.trim() ? item.reading : null;
          const subtitle =
            showPrimaryReadingEnglish && reading
              ? pronunciationForReading(reading) ?? reading
              : null;
          const key =
            "fallbackKey" in entry && typeof entry.fallbackKey === "string"
              ? entry.fallbackKey
              : `${item.subjectId}-${item.label}-${index}`;

          if (!isClickable) {
            return (
              <span
                key={key}
                className={`${relatedReferenceCardClass(relationType, false, size)} inline-flex flex-col items-center`}
              >
                <span className={`${labelClass(item.label)} font-black leading-none`}>{item.label}</span>
                {subtitle ? (
                  <span className="mt-1 text-center text-sm font-semibold leading-none text-slate-600">
                    {subtitle}
                  </span>
                ) : null}
              </span>
            );
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => jumpToRelatedSubject(item.subjectId)}
              className={`${relatedReferenceCardClass(relationType, true, size)} inline-flex flex-col items-center`}
            >
              <span className={`${labelClass(item.label)} font-black leading-none`}>{item.label}</span>
              {subtitle ? (
                <span className="mt-1 text-center text-sm font-semibold leading-none text-slate-600">
                  {subtitle}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  function renderVocabularyKanjiCards() {
    if (vocabularyKanjiLinks.length === 0) {
      return <p className="mt-2 text-slate-500">-</p>;
    }

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {vocabularyKanjiLinks.map((item) => (
          (() => {
            const subtitle = showPrimaryReadingEnglish
              ? pronunciationForReading(item.reading) ?? item.reading
              : null;

            return (
          <button
            key={`${selectedItem?.subjectId ?? "vocab"}-${item.subjectId}`}
            type="button"
            onClick={() => jumpToKanji(item.subjectId, item.wkLevel)}
            className="inline-flex cursor-pointer flex-col rounded-xl border border-kanji/50 bg-kanji/10 px-4 py-3 text-left text-kanji transition hover:bg-kanji/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          >
            <span className="text-4xl font-black leading-none">{item.char}</span>
            {subtitle ? (
              <span className="mt-1 w-full text-center text-sm font-semibold leading-none text-slate-600">
                {subtitle}
              </span>
            ) : null}
          </button>
            );
          })()
        ))}
      </div>
    );
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
                  markHistoryPush();
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
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "Review All", combinedSnapshot.items.length],
            ["overdue", "Overdue", reviewTimingCounts.overdue],
            ["next1h", "Starts <= 1h", reviewTimingCounts.next1h],
            ["next8h", "Starts <= 8h", reviewTimingCounts.next8h],
            ["next24h", "Starts <= 24h", reviewTimingCounts.next24h],
            ["next72h", "Starts <= 72h", reviewTimingCounts.next72h],
          ] as const).map(([timing, label, count]) => {
            const disabled = timing !== "all" && count === 0;

            return (
              <button
                key={timing}
                type="button"
                onClick={() => {
                  markHistoryPush();
                  setReviewTimingFilter(timing);
                }}
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                  disabled ? disabledBadgeClass() : badgeClass(reviewTimingFilter === timing)
                }`}
              >
                {label} ({formatNumber(count)})
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
            onClick={() => {
              markHistoryPush();
              setVisibleTypesAndPersist({ radical: false, kanji: false, vocabulary: false });
            }}
            className="rounded-full border border-line bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-600"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => {
              markHistoryPush();
              setVisibleTypesAndPersist({ radical: true, kanji: true, vocabulary: true });
            }}
            className="rounded-full border border-line bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-700"
          >
            Expand all
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              markHistoryPush();
              setShowLockedItems((prev) => !prev);
            }}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              markHistoryPush();
              setShowBurnedItems((prev) => !prev);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] ${
              showBurnedItems
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-line bg-white text-slate-700"
            }`}
          >
            {showBurnedItems ? "Hide Burned" : "Show Burned"}
          </button>
          <p className="text-xs font-semibold text-slate-500">
            Burned items are visible by default.
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
            {filteredItems.map((item, index) => (
              <Fragment key={`${item.subjectType}-${item.subjectId}`}>
                <button
                  type="button"
                  onClick={() => {
                    markHistoryPush();
                    setSelectedSubjectId((prev) => (prev === item.subjectId ? null : item.subjectId));
                  }}
                  className={`rounded-2xl border p-3 text-left transition hover:brightness-95 ${typeCardClass(
                    item.subjectType,
                    selectedItem?.subjectId === item.subjectId,
                  )} ${lockedCardStateClass(item)}`}
                >
                  <div className="flex items-start justify-end gap-1">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className={subjectTypePillClass(item.subjectType)}>{item.subjectType}</span>
                      {item.subjectType === "kanji" && item.jlptLevel ? (
                        <span className="subject-pill border-line bg-white text-slate-700">
                          JLPT N{item.jlptLevel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-xl font-black leading-tight ${
                      item.status === "locked" || item.srsStage <= 0 ? "text-slate-500" : "text-slate-700"
                    }`}
                  >
                    {item.meanings.join(", ") || "-"}
                  </p>
                  <div
                    className={`mt-3 rounded-xl border ${
                      glyphHasReading(item)
                        ? "flex min-h-[6rem] w-full flex-col items-center justify-center px-3 py-2"
                        : "flex min-h-[6rem] w-full items-center justify-center px-3 py-3"
                    } ${typeGlyphBoxClass(item.subjectType)} ${
                      item.status === "locked" || item.srsStage <= 0 ? "opacity-60" : ""
                    }`}
                  >
                    <p className={`${glyphTextSizeClass(item.characters)} font-black leading-none whitespace-nowrap`}>
                      {item.characters}
                    </p>
                    {(() => {
                      const subtitle = glyphSubtitleForDisplay(item);
                      if (!subtitle) {
                        return null;
                      }

                      return (
                        <p className="mt-1 w-full text-center text-sm font-semibold text-slate-600 whitespace-nowrap">
                          <ReadingWithPronunciation reading={subtitle} />
                        </p>
                      );
                    })()}
                  </div>
                  <div className="mt-3 grid grid-cols-3 items-center gap-2">
                    <span
                      className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold uppercase ${statusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                    {item.status !== "burned" ? (
                      (() => {
                        const nextReviewBadge = formatNextReviewBadge(item.availableAt);
                        if (!nextReviewBadge) {
                          return <span />;
                        }

                        return (
                          <span
                            className={`justify-self-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.03em] ${nextReviewBadge.className}`}
                          >
                            {nextReviewBadge.label}
                          </span>
                        );
                      })()
                    ) : (
                      <span />
                    )}
                    <span className="justify-self-end rounded-full border border-line bg-white px-2 py-1 text-xs font-bold text-slate-700">
                      SRS {item.srsStage}
                    </span>
                  </div>
                </button>

                {selectedItem && index === detailInsertIndex ? (
                  <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-white p-5 sm:col-span-2 lg:col-span-3">
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-x-3">
                      <div className="row-span-2 inline-flex">
                        <div
                          className={`inline-flex rounded-2xl border ${
                            glyphHasReading(selectedItem)
                              ? "min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center px-4 py-3"
                              : "min-h-[5.75rem] min-w-[5.75rem] items-center justify-center px-4 py-3"
                          } ${typeGlyphBoxClass(selectedItem.subjectType)}`}
                        >
                          <div>
                            <h3 className="text-center text-4xl font-black leading-none text-current">{selectedItem.characters}</h3>
                            {(() => {
                              const subtitle = showPrimaryReadingEnglish
                                ? englishSubtitleForDisplay(selectedItem)
                                : glyphSubtitleForDisplay(selectedItem);
                              if (!subtitle) {
                                return null;
                              }

                              return (
                                <p className="mt-1 w-full text-center text-sm font-semibold text-slate-700">
                                  <ReadingWithPronunciation reading={subtitle} />
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
                        <span className={`subject-pill ${statusClass(selectedItem.status)}`}>{selectedItem.status}</span>
                        <span className={subjectTypePillClass(selectedItem.subjectType)}>{selectedItem.subjectType}</span>
                        <span className="subject-pill border-line bg-white text-slate-700">WK {selectedItem.wkLevel}</span>
                        {selectedItem.subjectType === "kanji" && selectedItem.jlptLevel ? (
                          <span className="subject-pill border-line bg-white text-slate-700">
                            JLPT N{selectedItem.jlptLevel}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-3xl font-black leading-tight text-foreground">
                          {selectedItem.meanings.join(", ") || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowPrimaryReadingEnglish((prev) => !prev)}
                        className="rounded-full border border-line bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700"
                      >
                        {showPrimaryReadingEnglish ? "Hide English" : "Show English"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Primary reading</p>
                        <p className="mt-1 font-semibold text-slate-800">
                          {selectedItem.subjectType === "radical"
                            ? "Not applicable"
                            : (
                                <ReadingListWithPronunciation
                                  readings={selectedItem.primaryReadings ?? []}
                                  mode={showPrimaryReadingEnglish ? "inline" : "plain"}
                                />
                              )}
                        </p>
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
                        <p className="text-xs font-bold uppercase text-slate-600">
                          {selectedItem.subjectType === "vocabulary" ? "Kanji" : "Radicals"}
                        </p>
                        {selectedItem.subjectType === "vocabulary"
                          ? renderVocabularyKanjiCards()
                          : renderRelatedReferenceCards(selectedItem.radicals ?? [], {
                              large: selectedItem.subjectType === "kanji",
                            })}
                      </article>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Visually similar</p>
                        {renderRelatedReferenceCards(selectedItem.visuallySimilar ?? [], {
                          large: selectedItem.subjectType === "kanji",
                        })}
                      </article>
                      <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
                        <p className="text-xs font-bold uppercase text-slate-600">Used in vocabulary</p>
                        {renderRelatedReferenceCards(selectedItem.usedInVocabulary ?? [], {
                          large: selectedItem.subjectType === "kanji",
                        })}
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
