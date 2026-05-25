type UserReadingCheckinModalAdminDateFieldProps = {
  value: string;
  maxDate: string;
  onChange: (nextDateKey: string) => void;
};

export default function UserReadingCheckinModalAdminDateField({
  value,
  maxDate,
  onChange,
}: UserReadingCheckinModalAdminDateFieldProps) {
  return (
    <label className="mt-3 flex flex-col gap-1 sm:max-w-52">
      <span className="text-xs font-bold uppercase tracking-[0.08em] text-foreground/65">Check-in date (PST)</span>
      <input
        type="date"
        className="h-10 rounded-lg border border-line bg-surface-muted px-3 text-sm"
        value={value}
        max={maxDate}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-[11px] text-foreground/65">Admin only. This sets the challenge day key.</span>
    </label>
  );
}
