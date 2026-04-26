import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "umakuma_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_API_KEY;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY is required.");
  }
  return secret;
}

function createSignature(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

export function createAdminSessionToken(now: Date = new Date()): string {
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const nonce = randomBytes(16).toString("hex");
  const payload = `${issuedAtSeconds}.${nonce}`;
  const signature = createSignature(payload);

  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string, now: Date = new Date()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [issuedAtRaw, nonce, signature] = parts;
  if (!issuedAtRaw || !nonce || !signature) {
    return false;
  }

  const issuedAtSeconds = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtSeconds)) {
    return false;
  }

  const currentSeconds = Math.floor(now.getTime() / 1000);
  if (currentSeconds - issuedAtSeconds > ADMIN_SESSION_MAX_AGE_SECONDS) {
    return false;
  }

  if (issuedAtSeconds > currentSeconds + 60) {
    return false;
  }

  const payload = `${issuedAtRaw}.${nonce}`;
  const expectedSignature = createSignature(payload);

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
