import crypto from "crypto";

/**
 * App-level AES-256-GCM encryption for secrets stored in the DB (e.g. webhook
 * signing secrets on IntegrationConnection). Format:
 * base64( iv[12] | authTag[16] | ciphertext ).
 *
 * Key derivation, in order of preference:
 *  1. ENCRYPTION_KEY is a 32-byte key encoded as 64 hex chars or 44 base64
 *     chars -> used directly as the AES-256 key. This is the recommended
 *     production setup (no KDF weakness). Generate with `openssl rand -hex 32`.
 *  2. Otherwise it is treated as a passphrase and stretched with scrypt over a
 *     fixed application salt. scrypt is memory-hard, unlike the previous bare
 *     single-round SHA-256, so a leaked DB dump is far costlier to brute-force.
 *
 * NOTE: switching an existing *passphrase* deployment from the old SHA-256
 * derivation to scrypt changes the derived key, so previously-encrypted secrets
 * must be re-entered. Production deployments should use a raw 32-byte key (path
 * 1), which is unaffected.
 */
const SCRYPT_SALT = Buffer.from("signalstory.enc.kdf.v1");

function tryDecodeRawKey(secret: string): Buffer | null {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, "hex");
  if (/^[A-Za-z0-9+/]{43}=$/.test(secret)) {
    const b = Buffer.from(secret, "base64");
    if (b.length === 32) return b;
  }
  return null;
}

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is missing or too short — set a random 32-byte value (openssl rand -hex 32)",
    );
  }
  const raw = tryDecodeRawKey(secret);
  if (raw) return raw;
  // Passphrase fallback: memory-hard KDF instead of a single SHA-256 round.
  return crypto.scryptSync(secret, SCRYPT_SALT, 32);
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
