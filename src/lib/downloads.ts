import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Download links for digital products: /download/<token>, where the token names the order and the file and is signed
 * with the server's secret – it can't be guessed or changed. The route also checks that the order is paid, that the
 * link hasn't expired and that the file wasn't downloaded too often.
 */

export type DownloadClaim = { order: number; file: number; exp: number };

const secret = () => {
  // the same secret as Payload (payload.config.ts) – its development stand-in outside production only
  const s = process.env.PAYLOAD_SECRET || process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-payload-secret-change-me" : "");
  if (!s) throw new Error("PAYLOAD_SECRET is not set");
  return createHmac("sha256", s).update("shopengine-downloads-v1").digest();
};
const b64 = (b: Buffer) => b.toString("base64url");

export function downloadToken(c: DownloadClaim, key: Buffer = secret()): string {
  const body = b64(Buffer.from(`${c.order}.${c.file}.${c.exp}`));
  return `${body}.${b64(createHmac("sha256", key).update(body).digest().subarray(0, 18))}`;
}

/** The claim inside a token, or null when it was changed, made up or has expired. */
export function readDownloadToken(token: string, now = Date.now(), key: Buffer = secret()): DownloadClaim | null {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig || body.length > 80) return null;
  const want = createHmac("sha256", key).update(body).digest().subarray(0, 18);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [order, file, exp] = Buffer.from(body, "base64url").toString().split(".").map(Number);
  if (![order, file, exp].every((n) => Number.isInteger(n) && n > 0)) return null;
  if (exp * 1000 < now) return null;
  return { order, file, exp };
}

export type DownloadSettings = { limit: number; days: number };
export const DOWNLOAD_DEFAULTS: DownloadSettings = { limit: 5, days: 30 };
