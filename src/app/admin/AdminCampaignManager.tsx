"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAMPAIGN_STATUS_OPTIONS,
  campaignToForm,
  createDefaultCampaignForm,
  parseScoringRules,
  shouldConfirmActivation,
} from "./AdminCampaignManager.lib";
import type {
  CampaignForm,
  CampaignMutationResponse,
  CampaignRecord,
  CampaignStatus,
  CampaignsResponse,
} from "./AdminCampaignManager.types";

async function fetchCampaigns(): Promise<CampaignRecord[]> {
  const response = await fetch("/api/admin/reading-campaigns", { cache: "no-store" });
  const payload = (await response.json()) as CampaignsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not fetch campaigns.");
  }

  return payload.campaigns;
}

export default function AdminCampaignManager() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [editForm, setEditForm] = useState<CampaignForm>(createDefaultCampaignForm);
  const [createForm, setCreateForm] = useState<CampaignForm>(createDefaultCampaignForm);
  const [loading, setLoading] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const selectedCampaignIdRef = useRef(selectedCampaignId);

  useEffect(() => {
    selectedCampaignIdRef.current = selectedCampaignId;
  }, [selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const refreshCampaigns = useCallback(async (preferredCampaignId?: string) => {
    setLoading(true);
    try {
      const nextCampaigns = await fetchCampaigns();
      setCampaigns(nextCampaigns);
      if (nextCampaigns.length === 0) {
        setSelectedCampaignId("");
        setEditForm(createDefaultCampaignForm());
        return;
      }

      const fallbackCampaignId = nextCampaigns[0]?.id ?? "";
      const nextSelected =
        preferredCampaignId && nextCampaigns.some((campaign) => campaign.id === preferredCampaignId)
          ? preferredCampaignId
          : selectedCampaignIdRef.current
            && nextCampaigns.some((campaign) => campaign.id === selectedCampaignIdRef.current)
            ? selectedCampaignIdRef.current
            : fallbackCampaignId;
      setSelectedCampaignId(nextSelected);
      const selected = nextCampaigns.find((campaign) => campaign.id === nextSelected);
      if (selected) {
        setEditForm(campaignToForm(selected));
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not refresh campaigns.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!selectedCampaign) {
      return;
    }

    setEditForm(campaignToForm(selectedCampaign));
  }, [selectedCampaign]);

  function updateEditForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setEditForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateCreateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setCreateForm((previous) => ({ ...previous, [key]: value }));
  }

  async function saveCampaignEdits() {
    if (!selectedCampaign) {
      setStatus({ type: "error", message: "Pick a campaign to edit." });
      return;
    }

    setSavingEdit(true);
    setStatus({ type: "idle", message: "" });
    try {
      if (shouldConfirmActivation({
        nextStatus: editForm.status,
        currentCampaignId: selectedCampaign.id,
        campaigns,
      })) {
        const accepted = window.confirm(
          "Set this campaign as active and mark other active campaigns as completed?",
        );
        if (!accepted) {
          return;
        }
      }

      const response = await fetch("/api/admin/reading-campaigns", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedCampaign.id,
          slug: editForm.slug,
          name: editForm.name,
          description: editForm.description,
          status: editForm.status,
          currencyCode: editForm.currencyCode,
          startDatePst: editForm.startDatePst,
          goalDatePst: editForm.goalDatePst,
          tripDatePst: editForm.tripDatePst,
          targetBaseYen: editForm.targetBaseYen,
          scoringRules: parseScoringRules(editForm.scoringRulesText),
        }),
      });

      const payload = (await response.json()) as CampaignMutationResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save campaign.");
      }

      setStatus({ type: "ok", message: "Campaign saved." });
      await refreshCampaigns(payload.campaign.id);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not save campaign.",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function createCampaign() {
    setSavingCreate(true);
    setStatus({ type: "idle", message: "" });
    try {
      if (shouldConfirmActivation({ nextStatus: createForm.status, campaigns })) {
        const accepted = window.confirm(
          "Set this campaign as active and mark other active campaigns as completed?",
        );
        if (!accepted) {
          return;
        }
      }

      const response = await fetch("/api/admin/reading-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(createForm.id.trim() ? { id: createForm.id.trim() } : {}),
          slug: createForm.slug,
          name: createForm.name,
          description: createForm.description,
          status: createForm.status,
          currencyCode: createForm.currencyCode,
          startDatePst: createForm.startDatePst,
          goalDatePst: createForm.goalDatePst,
          tripDatePst: createForm.tripDatePst,
          targetBaseYen: createForm.targetBaseYen,
          scoringRules: parseScoringRules(createForm.scoringRulesText),
        }),
      });

      const payload = (await response.json()) as CampaignMutationResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create campaign.");
      }

      setStatus({ type: "ok", message: "Campaign created." });
      setCreateForm(createDefaultCampaignForm());
      await refreshCampaigns(payload.campaign.id);
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not create campaign.",
      });
    } finally {
      setSavingCreate(false);
    }
  }

  return (
    <section id="reading-campaigns" className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Reading campaigns</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Edit and create campaign definitions</h3>
          <p className="mt-1 text-sm text-foreground/70">
            Changes here are saved directly to the database and used by the reading check-in APIs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshCampaigns(selectedCampaignId || undefined);
          }}
          className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh campaigns"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-muted/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Edit existing</p>
          <label className="mt-3 block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor="campaign-picker">
            Campaign
          </label>
          <select
            id="campaign-picker"
            value={selectedCampaignId}
            onChange={(event) => setSelectedCampaignId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            disabled={campaigns.length === 0 || loading}
          >
            {campaigns.length === 0 ? <option value="">No campaigns found</option> : null}
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name} ({campaign.status})
              </option>
            ))}
          </select>

          <CampaignEditorForm form={editForm} onChange={updateEditForm} disabled={!selectedCampaign || savingEdit} />

          <button
            type="button"
            onClick={() => {
              void saveCampaignEdits();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-accent px-4 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:brightness-95 disabled:opacity-60"
            disabled={!selectedCampaign || savingEdit}
          >
            {savingEdit ? "Saving..." : "Save campaign changes"}
          </button>
        </div>

        <div className="rounded-xl border border-line bg-surface-muted/60 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Create campaign</p>
          <CampaignEditorForm form={createForm} onChange={updateCreateForm} disabled={savingCreate} includeIdInput />

          <button
            type="button"
            onClick={() => {
              void createCampaign();
            }}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-accent px-4 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:brightness-95 disabled:opacity-60"
            disabled={savingCreate}
          >
            {savingCreate ? "Creating..." : "Create campaign"}
          </button>
        </div>
      </div>

      {status.message ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : status.type === "ok"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-line bg-surface text-foreground/75"
          }`}
        >
          {status.message}
        </div>
      ) : null}
    </section>
  );
}

type CampaignEditorFormProps = {
  form: CampaignForm;
  onChange: <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => void;
  disabled: boolean;
  includeIdInput?: boolean;
};

function CampaignEditorForm({ form, onChange, disabled, includeIdInput = false }: CampaignEditorFormProps) {
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
            placeholder="challenge_40000_jpy"
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

      <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor={`campaign-rules-${includeIdInput ? "create" : "edit"}`}>
        Scoring rules (JSON)
        <textarea
          id={`campaign-rules-${includeIdInput ? "create" : "edit"}`}
          value={form.scoringRulesText}
          onChange={(event) => onChange("scoringRulesText", event.target.value)}
          className="mt-1 min-h-57.5 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
          disabled={disabled}
        />
      </label>
    </div>
  );
}
