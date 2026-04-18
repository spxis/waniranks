import jlptReadings from "@/data/jlptReadings.json";

import type { JlptItem, UserKanjiItem } from "../../explorerTypes";
import { jlptLevelPillClass } from "../../level-explorer/lib/levelExplorerDisplay";
import { formatDate, jlptHeading, readingLabel, stripReadingSeparators } from "../lib/jlptDisplay";
import { jlptStatusClass, parseWordExamples } from "../lib/jlptExplorerContentHelpers";
import JlptExplorerStatsPanel from "./JlptExplorerStatsPanel";
import type { JlptReadingsRecord, KanjiStats } from "./JlptExplorerContent.types";

type Props = {
  selectedItem: JlptItem;
  showEnglish: boolean;
  studyMode: boolean;
  userKanjiByChar: Map<string, UserKanjiItem>;
  statsOpen: boolean;
  kanjiStats: KanjiStats | null;
  kanjiStatsLoading: boolean;
  kanjiStatsError: string | null;
  onToggleStatsOpen: () => void;
};

export default function JlptExplorerDetailSection({
  selectedItem,
  showEnglish,
  studyMode,
  userKanjiByChar,
  statsOpen,
  kanjiStats,
  kanjiStatsLoading,
  kanjiStatsError,
  onToggleStatsOpen,
}: Props) {
  const selectedUserMatch = userKanjiByChar.get(selectedItem.kanji);
  const selectedPreload = (jlptReadings as JlptReadingsRecord)[selectedItem.kanji];
  const selectedDbReadings = [
    ...selectedItem.kunReadings,
    ...selectedItem.onReadings,
    ...selectedItem.nanoriReadings,
  ];
  const primary = selectedUserMatch
    ? (selectedUserMatch.primaryReadings ?? [])[0] ?? (selectedUserMatch.readings ?? [])[0] ?? null
    : selectedDbReadings[0] ?? selectedPreload?.readings?.[0] ?? null;
  const secondary = selectedUserMatch
    ? (selectedUserMatch.readings ?? []).filter((reading) => reading !== primary)
    : (selectedDbReadings.length > 0 ? selectedDbReadings : (selectedPreload?.readings ?? [])).filter(
        (reading) => reading !== primary,
      );
  const jsonMeanings = (selectedPreload?.meanings ?? []).filter((meaning) => meaning.trim().length > 0);
  const wordExamples = parseWordExamples(selectedItem.wordExamples);

  return (
    <section className="col-span-1 rounded-2xl border-2 border-accent/35 bg-surface p-5 sm:col-span-2 lg:col-span-4">
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-x-3">
        <div className="inline-flex sm:self-start">
          <div className="inline-flex min-h-[5.75rem] min-w-[5.75rem] flex-col items-center justify-center rounded-2xl border border-kanji/50 bg-kanji/10 px-4 py-3">
            <p className="text-center text-4xl font-black leading-none text-kanji">{selectedItem.kanji}</p>
            {!studyMode && primary ? (
              <p className="mt-1 w-full text-center text-sm font-semibold text-foreground/85">{readingLabel(primary, showEnglish)}</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap justify-start gap-1 sm:justify-end">
            <span className={`subject-pill ${jlptStatusClass(selectedUserMatch?.status)}`}>
              {selectedUserMatch?.status ?? "untracked"}
            </span>
            {typeof selectedUserMatch?.wkLevel === "number" ? (
              <span className="subject-pill border-line bg-surface text-foreground">L{selectedUserMatch.wkLevel}</span>
            ) : null}
            <span className={jlptLevelPillClass()}>N{selectedItem.nLevel}</span>
            {selectedUserMatch ? (
              <span className="subject-pill border-line bg-surface text-foreground">SRS {selectedUserMatch.srsStage ?? 0}</span>
            ) : null}
          </div>
          <div className="mt-2 min-w-0">
            <p className="text-4xl font-black leading-tight text-foreground">
              {studyMode
                ? "Kanji"
                : jlptHeading(
                    selectedItem.primaryMeaning,
                    selectedUserMatch?.meanings,
                    selectedItem.meanings.length > 0 ? selectedItem.meanings : (selectedPreload?.meanings ?? []),
                    selectedItem.kanji,
                  )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <JlptExplorerStatsPanel
          open={statsOpen}
          onToggle={onToggleStatsOpen}
          loading={kanjiStatsLoading}
          error={kanjiStatsError}
          kanjiStats={kanjiStats}
        />
        {!studyMode ? (
          <>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Primary reading</p>
              <p className="mt-1 font-semibold text-foreground/90">{readingLabel(primary, showEnglish)}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Secondary readings</p>
              <p className="mt-1 font-semibold text-foreground/90">
                {secondary.length > 0
                  ? secondary.map((reading) => readingLabel(reading, showEnglish)).join(", ")
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Kunyomi</p>
              <p className="mt-1 font-semibold text-foreground/90">
                {selectedItem.kunReadings.length > 0
                  ? selectedItem.kunReadings.map((reading) => stripReadingSeparators(reading)).join(", ")
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Onyomi</p>
              <p className="mt-1 font-semibold text-foreground/90">
                {selectedItem.onReadings.length > 0
                  ? selectedItem.onReadings.map((reading) => stripReadingSeparators(reading)).join(", ")
                  : "-"}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Stroke count</p>
              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.strokeCount ?? "-"}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Main meaning</p>
              <p className="mt-1 font-semibold text-foreground/90">{selectedItem.primaryMeaning ?? "-"}</p>
            </div>
          </>
        ) : null}
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Frequency rank</p>
          <p className="mt-1 font-semibold text-foreground/90">{selectedItem.frequencyRank ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">School grade</p>
          <p className="mt-1 font-semibold text-foreground/90">{selectedItem.schoolGrade ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Heisig keyword</p>
          <p className="mt-1 font-semibold text-foreground/90">{selectedItem.heisigKeyword ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Unicode</p>
          <p className="mt-1 font-semibold text-foreground/90">{selectedItem.unicodeHex ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
          <p className="text-xs font-bold uppercase text-foreground/70">Source JLPT</p>
          <p className="mt-1 font-semibold text-foreground/90">
            {selectedItem.sourceJlpt ? `N${selectedItem.sourceJlpt}` : "-"}
          </p>
        </div>
      </div>

      {selectedUserMatch ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Started</p>
            <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.startedAt)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Next review</p>
            <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.availableAt)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Passed</p>
            <p className="mt-1 font-semibold text-foreground/90">{formatDate(selectedUserMatch.passedAt)}</p>
          </div>
        </div>
      ) : null}

      {!studyMode ? (
        <div className="mt-4">
          <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Meaning explanation</p>
            {jsonMeanings.length > 0 ? (
              <ul className="mt-2 space-y-1 text-foreground/90">
                {jsonMeanings.map((meaning) => (
                  <li key={meaning}>- {meaning}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-foreground/90">-</p>
            )}
          </article>
        </div>
      ) : null}

      {!studyMode && selectedItem.notes.length > 0 ? (
        <div className="mt-4">
          <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Dictionary notes</p>
            <ul className="mt-2 space-y-1 text-foreground/90">
              {selectedItem.notes.map((note) => (
                <li key={note}>- {note}</li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      {!studyMode && wordExamples.length > 0 ? (
        <div className="mt-4">
          <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Used in words</p>
            <ul className="mt-2 space-y-2 text-foreground/90">
              {wordExamples.map((example, index) => (
                <li
                  key={`${selectedItem.kanji}-${example.written}-${example.pronounced}-${index}`}
                  className="rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <p className="text-base font-bold text-foreground">{example.written || "-"}</p>
                  <p className="text-xs font-semibold text-foreground/70">{example.pronounced || "-"}</p>
                  <p className="mt-1 text-sm text-foreground/85">{example.gloss || "-"}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
