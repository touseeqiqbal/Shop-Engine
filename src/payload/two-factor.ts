import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 2-step verification (TOTP, RFC 6238 – works with Google Authenticator, Microsoft Authenticator, Authy …).
 * Secrets are stored encrypted with a key derived from PAYLOAD_SECRET; backup codes are stored hashed.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

/** 6-digit code for a 30-second time step */
export function totp(secret: string, step = Math.floor(Date.now() / 30000)): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Accepts the current code or the one before / after (clock drift). Returns the matching step, or null. */
export function verifyTotp(secret: string, code: string, notBeforeStep = 0): number | null {
  const c = code.replace(/\D/g, "");
  if (c.length !== 6) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1]) {
    if (step <= notBeforeStep) continue; // a code can't be used twice
    const expected = totp(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

const key = () => createHash("sha256").update(`${process.env.PAYLOAD_SECRET ?? ""}:urko-2fa`).digest();

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(blob: string): string | null {
  try {
    const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const hashCode = (code: string) => createHash("sha256").update(`${process.env.PAYLOAD_SECRET ?? ""}:${code.replace(/[^a-z0-9]/gi, "").toLowerCase()}`).digest("hex");

/** 8 one-time backup codes like "k4m9-2xqp" */
export function newBackupCodes(): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => {
    const b = randomBytes(8);
    const s = [...b].map((x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export const otpauthUrl = (secret: string, account: string, issuer = "ShopEngine") =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

export const TWO_FACTOR_ROLES = new Set(["owner", "manager"]);
export const twoFactorRequired = () => process.env.TWO_FACTOR_REQUIRED !== "false";
