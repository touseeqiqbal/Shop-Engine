import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The store a team member previews drafts of (/api/preview sets it, for a store they work in): "<store>.<expiry>.<sig>",
 * signed with the server's secret. It used to be the bare store id – editing the cookie (or copying the Draft Mode
 * cookie to another store's address) opened any store's drafts and unpublished store.
 */

const secret = () => {
  // the same secret as Payload (payload.config.ts) – its development stand-in outside production only
  const s = process.env.PAYLOAD_SECRET || process.env.AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-payload-secret-change-me" : "");
  if (!s) throw new Error("PAYLOAD_SECRET is not set");
  return createHmac("sha256", s).update("shopengine-preview-v1").digest();
};
const sign = (body: string, key: Buffer) => createHmac("sha256", key).update(body).digest().subarray(0, 18).toString("base64url");

/** The cookie value for previewing `storeId` until `expiresAt` (ms). */
export function previewCookieValue(storeId: number, expiresAt: number, key: Buffer = secret()): string {
  const body = `${storeId}.${Math.floor(expiresAt / 1000)}`;
  return `${body}.${sign(body, key)}`;
}

/** The store a valid, unexpired cookie names – null when it was changed, made up or has expired. */
export function readPreviewCookie(value: string | null | undefined, now = Date.now(), key: Buffer = secret()): number | null {
  const [store, exp, sig] = String(value ?? "").split(".");
  if (!store || !exp || !sig || !/^\d{1,12}$/.test(store) || !/^\d{1,12}$/.test(exp)) return null;
  const want = Buffer.from(sign(`${store}.${exp}`, key));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  if (Number(exp) * 1000 < now) return null;
  return Number(store);
}
