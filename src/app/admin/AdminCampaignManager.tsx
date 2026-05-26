"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AdminCampaignEditorForm from "./AdminCampaignEditorForm";
import AdminChallengeSimulator from "./AdminChallengeSimulator";
import { CAMPAIGN_AUTH_REQUIRED_MESSAGE, fetchCampaigns, parseSimulationChallenge } from "./AdminCampaignManager.data";
import {
  CAMPAIGN_CREATE_PICKER_VALUE,
  campaignToForm,
  cloneCampaignToDraftForm,
  createDefaultCampaignForm,
  parseScoringRules,
  pickDefaultCampaignId,
  statusConfirmationMessage,
  type CampaignEditorMode,
} from "./AdminCampaignManager.lib";
import type {
  CampaignForm,
  CampaignMutationResponse,
  CampaignRecord,
  CampaignStatusMutationResponse,
  CampaignStatus,
} from "./AdminCampaignManager.types";

type AdminCampaignManagerProps = {
  sessionAuthorized: boolean;
  checkingSession: boolean;
  initialCampaigns?: CampaignRecord[];
};

export default function AdminCampaignManager({
  sessionAuthorized,
  checkingSession,
  initialCampaigns = [],
}: AdminCampaignManagerProps) {
  const defaultCampaignId = pickDefaultCampaignId(initialCampaigns);
  const initialSelectedCampaign = initialCampaigns.find((campaign) => campaign.id === defaultCampaignId) ?? null;

  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(initialCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(defaultCampaignId);
  const [editorMode, setEditorMode] = useState<CampaignEditorMode>(initialSelectedCampaign ? "edit" : "create");
  const [form, setForm] = useState<CampaignForm>(
    initialSelectedCampaign ? campaignToForm(initialSelectedCampaign) : createDefaultCampaignForm(),
  );
  const [loading, setLoading] = useState(!checkingSession && sessionAuthorized && initialCampaigns.length === 0);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<CampaignStatus | null>(null);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const [loadError, setLoadError] = useState<string>("");

  const selectedCampaignIdRef = useRef(selectedCampaignId);
  const editorModeRef = useRef(editorMode);

  useEffect(() => {
    selectedCampaignIdRef.current = selectedCampaignId;
  }, [selectedCampaignId]);

  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const simulatorChallenge = useMemo(
    () => parseSimulationChallenge(form, selectedCampaignId),
    [form, selectedCampaignId],
  );

  const refreshCampaigns = useCallback(async (args?: { preferredCampaignId?: string; showSpinner?: boolean }) => {
    const preferredCampaignId = args?.preferredCampaignId;
    const showSpinner = args?.showSpinner ?? true;

    if (!sessionAuthorized) {
      setCampaigns([]);
      setSelectedCampaignId("");
      setEditorMode("create");
      setForm(createDefaultCampaignForm());
      setLoadError(CAMPAIGN_AUTH_REQUIRED_MESSAGE);
      setStatus({ type: "idle", message: "" });
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }
    setLoadError("");
    setStatus((previous) => (previous.type === "ok" ? previous : { type: "idle", message: "" }));

    try {
      const nextCampaigns = await fetchCampaigns();
      setCampaigns(nextCampaigns);

      if (nextCampaigns.length === 0) {
        setSelectedCampaignId("");
        setEditorMode("create");
        setForm(createDefaultCampaignForm());
        return;
      }

      const fallbackCampaignId = pickDefaultCampaignId(nextCampaigns);
      const nextSelectedCampaignId = preferredCampaignId && nextCampaigns.some((campaign) => campaign.id === preferredCampaignId)
        ? preferredCampaignId
        : selectedCampaignIdRef.current && nextCampaigns.some((campaign) => campaign.id === selectedCampaignIdRef.current)
          ? selectedCampaignIdRef.current
          : fallbackCampaignId;

      setSelectedCampaignId(nextSelectedCampaignId);

      const nextSelectedCampaign = nextCampaigns.find((campaign) => campaign.id === nextSelectedCampaignId) ?? null;
      const shouldEnterEditMode = editorModeRef.current === "edit" || Boolean(preferredCampaignId);
      if (nextSelectedCampaign && shouldEnterEditMode) {
        setEditorMode("edit");
        setForm(campaignToForm(nextSelectedCampaign));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not fetch campaigns.");
    } finally {
      setLoading(false);
    }
  }, [sessionAuthorized]);

  useEffect(() => {
    if (checkingSession) {
      return;
    }

    const hasInitialCampaigns = initialCampaigns.length > 0;
    void refreshCampaigns({ showSpinner: !hasInitialCampaigns });
  }, [checkingSession, initialCampaigns.length, refreshCampaigns]);

  function updateForm<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function beginCreateCampaign() {
    setEditorMode("create");
    setSelectedCampaignId("");
    setForm(createDefaultCampaignForm());
    setStatus({ type: "idle", message: "" });
  }

  function beginCloneCampaign() {
    if (!selectedCampaign) {
      setStatus({ type: "error", message: "Pick a campaign to clone first." });
      return;
    }

    setEditorMode("create");
    setSelectedCampaignId("");
    setForm(cloneCampaignToDraftForm(selectedCampaign));
    setStatus({ type: "ok", message: "Draft clone ready. Update details and save." });
  }

  function handleCampaignPick(nextValue: string) {
    if (nextValue === CAMPAIGN_CREATE_PICKER_VALUE) {
      beginCreateCampaign();
      return;
    }

    const nextSelectedCampaign = campaigns.find((campaign) => campaign.id === nextValue) ?? null;
    if (!nextSelectedCampaign) {
      return;
    }

    setEditorMode("edit");
    setSelectedCampaignId(nextSelectedCampaign.id);
    setForm(campaignToForm(nextSelectedCampaign));
    setStatus({ type: "idle", message: "" });
  }

  async function saveCampaign() {
    const isEdit = editorMode === "edit";
    const targetCampaignId = selectedCampaign?.id ?? "";

    if (isEdit && !targetCampaignId) {
      setStatus({ type: "error", message: "Pick a campaign to edit first." });
      return;
    }

    const shouldConfirmStatusChange = isEdit
      ? Boolean(selectedCampaign && selectedCampaign.status !== form.status)
      : form.status !== "draft";

    if (shouldConfirmStatusChange) {
      const accepted = window.confirm(statusConfirmationMessage({
        nextStatus: form.status,
        currentCampaignId: targetCampaignId || undefined,
        campaigns,
      }));

      if (!accepted) {
        return;
      }
    }

    setSaving(true);
    setStatus({ type: "idle", message: "" });

    try {
      const payload = {
        ...(isEdit ? { id: targetCampaignId } : {}),
        ...(editorMode === "create" && form.id.trim() ? { id: form.id.trim() } : {}),
        slug: form.slug,
        name: form.name,
        description: form.description,
        status: form.status,
        currencyCode: form.currencyCode,
        startDatePst: form.startDatePst,
        goalDatePst: form.goalDatePst,
        tripDatePst: form.tripDatePst,
        targetBaseYen: form.targetBaseYen,
        scoringRules: parseScoringRules(form.scoringRulesText),
      };

      const response = await fetch("/api/admin/reading-campaigns", {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as CampaignMutationResponse;
      if (!response.ok) {
        throw new Error(responsePayload.error ?? (isEdit ? "Could not save campaign." : "Could not create campaign."));
      }

      setStatus({ type: "ok", message: isEdit ? "Campaign saved." : "Campaign created." });
      setEditorMode("edit");
      await refreshCampaigns({ preferredCampaignId: responsePayload.campaign.id, showSpinner: false });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : editorMode === "edit" ? "Could not save campaign." : "Could not create campaign.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function updateCampaignStatus(nextStatus: CampaignStatus) {
    if (!selectedCampaign) {
      setStatus({ type: "error", message: "Pick a campaign first." });
      return;
    }

    if (nextStatus === selectedCampaign.status) {
      setStatus({ type: "ok", message: "Campaign already has this status." });
      return;
    }

    const accepted = window.confirm(statusConfirmationMessage({
      nextStatus,
      currentCampaignId: selectedCampaign.id,
      campaigns,
    }));
    if (!accepted) {
      return;
    }

    setStatusUpdating(nextStatus);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/admin/reading-campaigns/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: selectedCampaign.id, status: nextStatus }),
      });

      const payload = (await response.json()) as CampaignStatusMutationResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update campaign status.");
      }

      setStatus({ type: "ok", message: `Campaign status set to ${payload.campaign.status}.` });
      await refreshCampaigns({ preferredCampaignId: payload.campaign.id, showSpinner: false });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not update campaign status.",
      });
    } finally {
      setStatusUpdating(null);
    }
  }

  const formDisabled = saving || Boolean(statusUpdating) || loading || !sessionAuthorized || checkingSession;

  return (
    <section id="reading-campaigns" className="rounded-2xl border border-line bg-surface/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/60">Reading campaigns</p>
          <h3 className="mt-1 text-xl font-black text-foreground">Manage campaign definitions</h3>
          <p className="mt-1 text-sm text-foreground/70">
            Edit an existing campaign, or create a draft for experiments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshCampaigns({ preferredCampaignId: selectedCampaignId || undefined });
          }}
          className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition hover:bg-surface-muted"
          disabled={loading || !sessionAuthorized || checkingSession}
        >
          {loading ? "Refreshing..." : "Refresh campaigns"}
        </button>
      </div>

      {loadError ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            loadError === CAMPAIGN_AUTH_REQUIRED_MESSAGE
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {loadError}
        </div>
      ) : null}

      {!checkingSession && sessionAuthorized && campaigns.length === 0 && !loadError ? (
        <div className="mt-3 rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm text-foreground/75">
          No campaigns exist yet. Create your first draft campaign.
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-line bg-surface-muted/60 p-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="block text-xs font-bold uppercase tracking-widest text-foreground/70" htmlFor="campaign-picker">
            Campaign
            <select
              id="campaign-picker"
              value={editorMode === "create" ? CAMPAIGN_CREATE_PICKER_VALUE : selectedCampaignId}
              onChange={(event) => handleCampaignPick(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              disabled={formDisabled}
            >
              <option value={CAMPAIGN_CREATE_PICKER_VALUE}>Create a new draft campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name} ({campaign.status})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={beginCreateCampaign}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-widest text-slate-700 transition hover:bg-surface-muted disabled:opacity-60"
            disabled={formDisabled}
          >
            New draft
          </button>
          <button
            type="button"
            onClick={beginCloneCampaign}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-xs font-bold uppercase tracking-widest text-slate-700 transition hover:bg-surface-muted disabled:opacity-60"
            disabled={formDisabled || !selectedCampaign || editorMode === "create"}
          >
            Clone selected
          </button>
        </div>

        {editorMode === "edit" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void updateCampaignStatus("active");
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-emerald-50 px-3 text-xs font-bold uppercase tracking-widest text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
              disabled={!selectedCampaign || formDisabled}
            >
              {statusUpdating === "active" ? "Updating..." : "Set active"}
            </button>
            <button
              type="button"
              onClick={() => {
                void updateCampaignStatus("completed");
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-amber-50 px-3 text-xs font-bold uppercase tracking-widest text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
              disabled={!selectedCampaign || formDisabled}
            >
              {statusUpdating === "completed" ? "Updating..." : "Set completed"}
            </button>
            <button
              type="button"
              onClick={() => {
                void updateCampaignStatus("archived");
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-slate-100 px-3 text-xs font-bold uppercase tracking-widest text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
              disabled={!selectedCampaign || formDisabled}
            >
              {statusUpdating === "archived" ? "Updating..." : "Set archived"}
            </button>
            <button
              type="button"
              onClick={() => {
                void updateCampaignStatus("draft");
              }}
              className="inline-flex h-9 items-center justify-center rounded-full border border-line bg-blue-50 px-3 text-xs font-bold uppercase tracking-widest text-blue-800 transition hover:bg-blue-100 disabled:opacity-60"
              disabled={!selectedCampaign || formDisabled}
            >
              {statusUpdating === "draft" ? "Updating..." : "Set draft"}
            </button>
          </div>
        ) : null}

        <AdminCampaignEditorForm
          form={form}
          onChange={updateForm}
          disabled={formDisabled || (editorMode === "edit" && !selectedCampaign)}
          includeIdInput={editorMode === "create"}
        />

        <button
          type="button"
          onClick={() => {
            void saveCampaign();
          }}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line bg-accent px-4 text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:brightness-95 disabled:opacity-60"
          disabled={formDisabled || (editorMode === "edit" && !selectedCampaign)}
        >
          {saving ? "Saving..." : editorMode === "edit" ? "Save campaign changes" : "Create campaign"}
        </button>
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

      {simulatorChallenge ? <AdminChallengeSimulator challenge={simulatorChallenge} /> : null}
      {!simulatorChallenge ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Simulator preview is paused until campaign fields and scoring rules are valid JSON.
        </div>
      ) : null}
    </section>
  );
}
