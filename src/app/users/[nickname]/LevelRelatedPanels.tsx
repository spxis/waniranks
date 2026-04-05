import { ReactNode } from "react";

type Props = {
  hasPrimary: boolean;
  hasVisuallySimilar: boolean;
  hasUsedInVocabulary: boolean;
  primaryTitle: string;
  primaryContent: ReactNode;
  visuallySimilarContent: ReactNode;
  usedInVocabularyContent: ReactNode;
};

export default function LevelRelatedPanels({
  hasPrimary,
  hasVisuallySimilar,
  hasUsedInVocabulary,
  primaryTitle,
  primaryContent,
  visuallySimilarContent,
  usedInVocabularyContent,
}: Props) {
  if (!hasPrimary && !hasVisuallySimilar && !hasUsedInVocabulary) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {hasPrimary || hasVisuallySimilar ? (
        <div
          className={`grid gap-3 ${
            hasPrimary && hasVisuallySimilar ? "lg:grid-cols-2" : "lg:grid-cols-1"
          }`}
        >
          {hasPrimary ? (
            <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">{primaryTitle}</p>
              {primaryContent}
            </article>
          ) : null}

          {hasVisuallySimilar ? (
            <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p className="text-xs font-bold uppercase text-foreground/70">Visually similar</p>
              {visuallySimilarContent}
            </article>
          ) : null}
        </div>
      ) : null}

      {hasUsedInVocabulary ? (
        <div className="grid gap-3 lg:grid-cols-1">
          <article className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
            <p className="text-xs font-bold uppercase text-foreground/70">Used in vocabulary</p>
            {usedInVocabularyContent}
          </article>
        </div>
      ) : null}
    </div>
  );
}
