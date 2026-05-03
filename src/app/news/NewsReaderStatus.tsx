type LoadingStateProps = {
  label: string;
};

type ErrorStateProps = {
  message: string;
};

export function NewsReaderLoadingState({ label }: LoadingStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-6 text-center text-sm font-semibold uppercase tracking-[0.14em] text-foreground/60">
      {label}
    </div>
  );
}

export function NewsReaderErrorState({ message }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-hot/60 bg-hot/10 p-4 text-sm text-foreground">
      {message}
    </div>
  );
}
