import { useEffect, useMemo, useState, type ReactNode } from "react";

import { usePersistedBoolean } from "@/lib/usePersistedBoolean";

import { formatDate } from "../lib/levelExplorerDisplay";
import {
  CorrectWrongTrendChart,
  ReviewActivityTrendChart,
  SrsProgressChart,
  SuccessFailureSplitChart,
  SuccessRateTrendChart,
  type ActivityPoint,
  type SuccessRatePoint,
  type TrendPoint,
} from "./LevelExplorerReviewStatsCharts";

type SubjectHistory = {
  latest: {
    percentageCorrect: number;
    meaningCorrect: number;
    meaningIncorrect: number;
    readingCorrect: number;
    readingIncorrect: number;
    capturedAt: string;
    source: string;
  } | null;
  trend: Array<{
    capturedAt: string;
    percentageCorrect: number;
    totalAnswers: number;
    correctAnswers: number;
    wrongAnswers: number;
    source: string;
  }>;
};

type ApiReviewTransition = {
  createdAt: string;
  startingSrsStage: number;
  endingSrsStage: number;
};

type CachedHistoryPayload = {
  fetchedAt: number;
  history: SubjectHistory | null;
  transitions: ApiReviewTransition[];
};

const HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const reviewStatsHistoryCache = new Map<string, CachedHistoryPayload>();

function formatGraphDateLabel(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function Collapsible({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/65">{label}</p>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground hover:bg-surface-muted"
          aria-expanded={open}
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export default function LevelExplorerReviewStatsCard({
  accountId,
  subjectId,
  currentSrsStage,
}: {
  accountId: string;
  subjectId: number;
  currentSrsStage: number;
  startedAt?: string | null;
}) {
  const cacheKey = `${accountId}:${subjectId}`;
  const openStateStorageKey = `wr:review-stats-open:${accountId}`;
  const [open, setOpen] = usePersistedBoolean(openStateStorageKey, {
    defaultValue: false,
    mode: "one-is-true",
  });

  const [history, setHistory] = useState<SubjectHistory | null>(null);
  const [transitions, setTransitions] = useState<ApiReviewTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const cached = reviewStatsHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) {
      queueMicrotask(() => {
        setHistory(cached.history);
        setTransitions(cached.transitions);
        setError(null);
        setLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      setHistory(null);
      setTransitions([]);
      setError(null);
      setLoading(true);
    });

    fetch(`/api/study/${accountId}/subjects/${subjectId}/history?refresh=1&transitions=1`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Could not load review stats");
        }
        return res.json() as Promise<{ history?: SubjectHistory; transitions?: ApiReviewTransition[] }>;
      })
      .then((data) => {
        const nextHistory = data.history ?? null;
        const nextTransitions = Array.isArray(data.transitions) ? data.transitions : [];
        setHistory(nextHistory);
        setTransitions(nextTransitions);
        reviewStatsHistoryCache.set(cacheKey, {
          fetchedAt: Date.now(),
          history: nextHistory,
          transitions: nextTransitions,
        });
      })
      .catch(() => {
        setError("Could not load review stats");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accountId, subjectId, cacheKey, refreshNonce]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onStudyReviewSubmitted = (event: Event) => {
      const custom = event as CustomEvent<{ accountId?: string; subjectId?: number }>;
      if (custom.detail?.accountId !== accountId) {
        return;
      }

      const targetSubjectId = custom.detail?.subjectId;
      if (typeof targetSubjectId === "number") {
        reviewStatsHistoryCache.delete(`${accountId}:${targetSubjectId}`);
      } else {
        for (const key of reviewStatsHistoryCache.keys()) {
          if (key.startsWith(`${accountId}:`)) {
            reviewStatsHistoryCache.delete(key);
          }
        }
      }

      if (targetSubjectId === subjectId || typeof targetSubjectId !== "number") {
        setRefreshNonce((prev) => prev + 1);
      }
    };

    window.addEventListener("wr:study-review-submitted", onStudyReviewSubmitted as EventListener);
    return () => {
      window.removeEventListener("wr:study-review-submitted", onStudyReviewSubmitted as EventListener);
    };
  }, [accountId, subjectId]);

  const totals = useMemo(() => {
    if (!history?.latest) return { correct: 0, wrong: 0 };
    return {
      correct: Math.max(0, history.latest.meaningCorrect + history.latest.readingCorrect),
      wrong: Math.max(0, history.latest.meaningIncorrect + history.latest.readingIncorrect),
    };
  }, [history?.latest]);

  const trendPoints = useMemo(() => {
    const rows = history?.trend ?? [];
    return rows
      .map((row) => {
        const timeMs = new Date(row.capturedAt).getTime();
        if (!Number.isFinite(timeMs)) return null;
        return {
          timeMs,
          label: formatGraphDateLabel(row.capturedAt),
          correct: Math.max(0, row.correctAnswers),
          wrong: Math.max(0, row.wrongAnswers),
        };
      })
      .filter((row): row is TrendPoint => row !== null)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(-60);
  }, [history?.trend]);

  const successRatePoints = useMemo(() => {
    const rows = history?.trend ?? [];
    return rows
      .map((row) => {
        const timeMs = new Date(row.capturedAt).getTime();
        if (!Number.isFinite(timeMs)) return null;

        const total = Math.max(1, row.correctAnswers + row.wrongAnswers);
        return {
          timeMs,
          label: formatGraphDateLabel(row.capturedAt),
          rate: Math.round((row.correctAnswers / total) * 100),
        };
      })
      .filter((row): row is SuccessRatePoint => row !== null)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(-60);
  }, [history?.trend]);

  const activityPoints = useMemo(() => {
    if (!transitions.length) {
      return [] as ActivityPoint[];
    }

    const byDay = new Map<string, number>();
    for (const row of transitions) {
      const parsed = new Date(row.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;

      const key = parsed.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([day, reviews]) => {
        const timeMs = new Date(`${day}T00:00:00.000Z`).getTime();
        if (!Number.isFinite(timeMs)) return null;
        return {
          timeMs,
          label: formatGraphDateLabel(day),
          reviews,
        };
      })
      .filter((row): row is ActivityPoint => row !== null)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(-90);
  }, [transitions]);

  return (
    <Collapsible open={open} onToggle={() => setOpen((prev) => !prev)} label="Review Stats">
      {loading ? <p className="text-xs text-foreground/60">Loading stats...</p> : null}
      {!loading && error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!loading && !error && !history?.latest ? <p className="text-xs text-foreground/60">No stats yet.</p> : null}

      {!loading && !error && history?.latest ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-bold">Latest Snapshot</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Correct %:</div>
              <div>{history.latest.percentageCorrect ?? "-"}</div>
              <div>Meaning Correct:</div>
              <div>{history.latest.meaningCorrect ?? "-"}</div>
              <div>Meaning Incorrect:</div>
              <div>{history.latest.meaningIncorrect ?? "-"}</div>
              <div>Reading Correct:</div>
              <div>{history.latest.readingCorrect ?? "-"}</div>
              <div>Reading Incorrect:</div>
              <div>{history.latest.readingIncorrect ?? "-"}</div>
              <div>Captured At:</div>
              <div>{history.latest.capturedAt ? formatDate(history.latest.capturedAt) : "-"}</div>
              <div>Source:</div>
              <div>{history.latest.source}</div>
              <div>Current SRS:</div>
              <div>{currentSrsStage}</div>
            </div>
          </div>

          <div className="space-y-3">
            <SuccessFailureSplitChart correct={totals.correct} wrong={totals.wrong} />
            <SrsProgressChart currentSrsStage={currentSrsStage} />
            <CorrectWrongTrendChart points={trendPoints} />
            <SuccessRateTrendChart points={successRatePoints} />
            <ReviewActivityTrendChart points={activityPoints} />
          </div>
        </div>
      ) : null}
    </Collapsible>
  );
}
