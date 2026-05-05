"use client";

import SegmentedControl from "../shared/SegmentedControl";
import { hostnameOf } from "./newsReaderUtils";

type Mode = "article" | "site";

type Props = {
  mode: Mode;
  onChangeMode: (mode: Mode) => void;
  url: string;
  onChangeUrl: (value: string) => void;
  loading: boolean;
  discoverLoading: boolean;
  devSampleUrls: string[];
  onSubmit: (explicitSubmit: boolean) => void;
};

export default function NewsReaderForm({
  mode,
  onChangeMode,
  url,
  onChangeUrl,
  loading,
  discoverLoading,
  devSampleUrls,
  onSubmit,
}: Props) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter;
    const explicitSubmit =
      submitter instanceof HTMLButtonElement && submitter.dataset.submitIntent === "news-submit";
    onSubmit(explicitSubmit);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="news-url"
          className="block text-xs font-bold uppercase tracking-[0.14em] text-foreground/70"
        >
          {mode === "site" ? "Section / homepage URL" : "Article URL"}
        </label>
        <SegmentedControl
          ariaLabel="News mode"
          value={mode}
          onChange={onChangeMode}
          size="sm"
          options={[
            {
              value: "article",
              label: "Article",
              activeClassName: "bg-accent text-surface",
              inactiveClassName: "text-foreground/70 hover:text-accent",
            },
            {
              value: "site",
              label: "Site",
              activeClassName: "bg-accent text-surface",
              inactiveClassName: "text-foreground/70 hover:text-accent",
            },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="news-url"
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={url}
          onChange={(event) => onChangeUrl(event.target.value)}
          className="h-12 w-full rounded-full border border-line bg-surface px-5 text-sm text-foreground placeholder:text-foreground/40 focus:border-accent focus:outline-none sm:flex-1"
          required
        />
        <button
          type="submit"
          data-submit-intent="news-submit"
          disabled={(loading || discoverLoading) || !url.trim()}
          className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-accent px-6 text-sm font-bold uppercase tracking-[0.14em] text-surface transition hover:bg-accent-2 disabled:opacity-50"
        >
          {mode === "site"
            ? discoverLoading
              ? "Scanning..."
              : "Find articles"
            : loading
              ? "Reading..."
              : "Read"}
        </button>
      </div>
      <p className="text-xs text-foreground/60">
        You provide the link, so you take responsibility for the source. Articles you read are cached locally in your browser to avoid re-fetching the same page.
      </p>
      {devSampleUrls.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/55">Dev samples</span>
          {devSampleUrls.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => onChangeUrl(sample)}
              className="rounded-full border border-line bg-surface-muted px-3 py-1 text-[11px] font-semibold text-foreground/80 transition hover:border-accent hover:text-accent"
            >
              {hostnameOf(sample)}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
