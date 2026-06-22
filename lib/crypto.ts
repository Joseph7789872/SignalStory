import crypto from "crypto";

/**
 * App-level AES-256-GCM encryption for secrets stored in the DB (e.g. webhook
 * signing secrets on IntegrationConnection). The key is derived from the
 * ENCRYPTION_KEY env var via SHA-256, so any sufficiently-random passphrase
 * works. Format: base64( iv[12] | authTag[16] | ciphertext ).
 */
function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is missing or too short — set a random 32+ char value in .env",
    );
  }
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
