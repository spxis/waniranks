import { createHash, randomBytes } from "node:crypto";

const INVITE_CODE_LENGTH = 6;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getInviteCodeSecret(): string {
  return process.env.INVITE_CODE_SECRET ?? process.env.AUTH_SECRET ?? "umakuma-invite-code-fallback";
}

export function normalizeInviteCode(input: string): string {
  return input.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, INVITE_CODE_LENGTH);
}

export function isValidInviteCodeShape(input: string): boolean {
  return /^[A-Z0-9]{6}$/.test(input);
}

export function hashInviteCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  const digest = createHash("sha256")
    .update(`${getInviteCodeSecret()}::${normalized}`)
    .digest("hex");

  return digest;
}

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let result = "";

  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    result += INVITE_ALPHABET[bytes[index] % INVITE_ALPHABET.length];
  }

  return result;
}
