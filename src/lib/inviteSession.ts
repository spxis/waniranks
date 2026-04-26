import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const INVITE_SESSION_COOKIE_NAME = "umakuma_invite_session";
export const INVITE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type InviteSessionPayload = {
  accountId: string;
};

function getInviteSessionSecret(): string {
  const secret = process.env.INVITE_SESSION_SECRET ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("INVITE_SESSION_SECRET or AUTH_SECRET is required.");
  }

  return secret;
}

function createSignature(value: string): string {
  return createHmac("sha256", getInviteSessionSecret()).update(value).digest("hex");
}

function encodeSegment(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeSegment(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createInviteSessionToken(
  payload: InviteSessionPayload,
  now: Date = new Date(),
): string {
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const nonce = randomBytes(10).toString("hex");
  const payloadJson = JSON.stringify(payload);
  const payloadEncoded = encodeSegment(payloadJson);
  const body = `${issuedAtSeconds}.${nonce}.${payloadEncoded}`;
  const signature = createSignature(body);

  return `${body}.${signature}`;
}

export function verifyInviteSessionToken(
  token: string,
  now: Date = new Date(),
): InviteSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const [issuedAtRaw, nonce, payloadEncoded, signature] = parts;
  if (!issuedAtRaw || !nonce || !payloadEncoded || !signature) {
    return null;
  }

  const issuedAtSeconds = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAtSeconds)) {
    return null;
  }

  const currentSeconds = Math.floor(now.getTime() / 1000);
  if (currentSeconds - issuedAtSeconds > INVITE_SESSION_MAX_AGE_SECONDS) {
    return null;
  }
  if (issuedAtSeconds > currentSeconds + 60) {
    return null;
  }

  const body = `${issuedAtRaw}.${nonce}.${payloadEncoded}`;
  const expectedSignature = createSignature(body);

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeSegment(payloadEncoded)) as InviteSessionPayload;
    if (!payload || typeof payload.accountId !== "string" || payload.accountId.length === 0) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...valueParts] = cookie.trim().split("=");
    if (rawName === cookieName) {
      return valueParts.join("=");
    }
  }

  return null;
}
