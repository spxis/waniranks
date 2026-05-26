import { CAMPAIGN_STATUS_OPTIONS } from "./AdminCampaignManager.lib";
import AdminScoringRulesBuilder from "./AdminScoringRulesBuilder";
import type { CampaignForm, CampaignStatus } from "./AdminCampaignManager.types";

type Props = {
  form: CampaignForm;
  onChange: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  disabled: boolean;
  includeIdInput?: boolean;
};

export default function AdminCampaignEditorForm({
  form,
  onChange,
  disabled,
  includeIdInput = false,
}: Props) {
  return (
    <div className="mt-3 space-y-3">
      {includeIdInput ? (
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor="campaign-id">
          Campaign id (optional)
          <input
            id="campaign-id"
            type="text"
            value={form.id}
            onChange={(event) => onChange("id", event.target.value)}
            placeholder="challenge_target_jpy"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-slug-${includeIdInput ? "create" : "edit"}`}>
          Slug
          <input
            id={`campaign-slug-${includeIdInput ? "create" : "edit"}`}
            type="text"
            value={form.slug}
            onChange={(event) => onChange("slug", event.target.value)}
            placeholder="fall-2026-reading-push"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-status-${includeIdInput ? "create" : "edit"}`}>
          Status
          <select
            id={`campaign-status-${includeIdInput ? "create" : "edit"}`}
            value={form.status}
            onChange={(event) => onChange("status", event.target.value as CampaignStatus)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          >
            {CAMPAIGN_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-name-${includeIdInput ? "create" : "edit"}`}>
        Name
        <input
          id={`campaign-name-${includeIdInput ? "create" : "edit"}`}
          type="text"
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          disabled={disabled}
        />
      </label>

      <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-description-${includeIdInput ? "create" : "edit"}`}>
        Description
        <input
          id={`campaign-description-${includeIdInput ? "create" : "edit"}`}
          type="text"
          value={form.description}
          onChange={(event) => onChange("description", event.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          disabled={disabled}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-start-${includeIdInput ? "create" : "edit"}`}>
          Start date (PST)
          <input
            id={`campaign-start-${includeIdInput ? "create" : "edit"}`}
            type="date"
            value={form.startDatePst}
            onChange={(event) => onChange("startDatePst", event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-goal-${includeIdInput ? "create" : "edit"}`}>
          Goal date (PST)
          <input
            id={`campaign-goal-${includeIdInput ? "create" : "edit"}`}
            type="date"
            value={form.goalDatePst}
            onChange={(event) => onChange("goalDatePst", event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-trip-${includeIdInput ? "create" : "edit"}`}>
          Trip date (PST)
          <input
            id={`campaign-trip-${includeIdInput ? "create" : "edit"}`}
            type="date"
            value={form.tripDatePst}
            onChange={(event) => onChange("tripDatePst", event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-target-${includeIdInput ? "create" : "edit"}`}>
          Target base yen
          <input
            id={`campaign-target-${includeIdInput ? "create" : "edit"}`}
            type="number"
            value={form.targetBaseYen}
            min={0}
            step={100}
            onChange={(event) => onChange("targetBaseYen", Number(event.target.value || 0))}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={disabled}
          />
        </label>
      </div>

      <div className="space-y-2">
        <AdminScoringRulesBuilder
          value={form.scoringRulesText}
          disabled={disabled}
          onChange={(nextValue) => onChange("scoringRulesText", nextValue)}
        />

        <details className="rounded-lg border border-line bg-surface p-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-foreground/70">
            Advanced JSON editor
          </summary>
          <label className="mt-2 block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-rules-${includeIdInput ? "create" : "edit"}`}>
            Scoring rules JSON
            <textarea
              id={`campaign-rules-${includeIdInput ? "create" : "edit"}`}
              value={form.scoringRulesText}
              onChange={(event) => onChange("scoringRulesText", event.target.value)}
              className="mt-1 min-h-57.5 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
              disabled={disabled}
            />
          </label>
        </details>
      </div>
    </div>
  );
}
