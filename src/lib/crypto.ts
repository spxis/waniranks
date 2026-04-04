import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes encoded in base64.");
  }

  return key;
}

export type EncryptedToken = {
  encrypted: string;
  iv: string;
  tag: string;
};

export function encryptToken(plainToken: string): EncryptedToken {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainToken, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptToken(payload: EncryptedToken): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const encrypted = Buffer.from(payload.encrypted, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}
