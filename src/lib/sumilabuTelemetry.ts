type JsonObject = Record<string, unknown>;

type SumilabuSourceType = "app" | "server" | "job" | "deploy" | "device" | "service";

type EmitTelemetryInput = {
  event: string;
  status?: string;
  severity?: string;
  message?: string;
  durationMs?: number;
  sourceType?: SumilabuSourceType;
  tags?: JsonObject;
  metrics?: JsonObject;
  telemetry?: JsonObject;
};

const DEFAULT_URL = "https://api.sumilabu.com/api/v1/telemetry/events";
const REQUEST_TIMEOUT_MS = 800;

function getEnv(name: string): string | null {
  const value = process.env[name];
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getTelemetryConfig() {
  const ingestToken = getEnv("SUMILABU_INGEST_TOKEN");
  if (!ingestToken) {
    return null;
  }

  return {
    url: getEnv("SUMILABU_TELEMETRY_URL") ?? DEFAULT_URL,
    token: ingestToken,
    projectKey: getEnv("SUMILABU_PROJECT_KEY") ?? "umakuma",
    sourceType: (getEnv("SUMILABU_SOURCE_TYPE") as SumilabuSourceType | null) ?? "server",
    sourceId: getEnv("SUMILABU_SOURCE_ID") ?? "umakuma-web",
    displayName: getEnv("SUMILABU_DISPLAY_NAME") ?? "UmaKuma",
    service: getEnv("SUMILABU_SERVICE") ?? "next-api",
  };
}

export async function emitSumilabuTelemetry(input: EmitTelemetryInput): Promise<void> {
  const config = getTelemetryConfig();
  if (!config) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const host = getEnv("VERCEL_URL") ?? getEnv("HOSTNAME") ?? undefined;
  const environment = getEnv("VERCEL_ENV") ?? process.env.NODE_ENV ?? "production";

  const payload = {
    api_version: "v1",
    project_key: config.projectKey,
    source_type: input.sourceType ?? config.sourceType,
    source_id: config.sourceId,
    display_name: config.displayName,
    environment,
    host,
    service: config.service,
    event: input.event,
    status: input.status,
    severity: input.severity,
    message: input.message,
    duration_ms: input.durationMs,
    tags: input.tags,
    metrics: input.metrics,
    telemetry: input.telemetry,
    occurred_at: new Date().toISOString(),
  };

  try {
    await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // Telemetry must never break app traffic.
  } finally {
    clearTimeout(timeout);
  }
}
