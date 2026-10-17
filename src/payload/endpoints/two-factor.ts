import type { CollectionBeforeLoginHook, Endpoint, PayloadRequest } from "payload";
import { APIError, generatePayloadCookie } from "payload";
import { sql } from "@payloadcms/db-postgres";
import { decrypt, encrypt, hashCode, newBackupCodes, newSecret, otpauthUrl, twoFactorRequired, verifyTotp } from "../two-factor";
import { log } from "../../lib/log";
import { ipFromHeaders } from "../../lib/client-ip";
import { recordSecurityEvent } from "../../lib/security-events";
import { adminSeat, isPlatformAdminUser, type TenantUser } from "../tenancy";

/**
 * 2-step verification for /cms.
 *   GET  /cms-api/2fa/status     is it on / required for me
 *   POST /cms-api/2fa/setup      new secret + QR code (not active until confirmed). Already on → { code } of the
 *                                CURRENT app (or a backup code) is required: "move to a new phone"
 *   POST /cms-api/2fa/enable     { code } → turns it on (or switches to the new phone), returns 8 one-time backup codes
 *   POST /cms-api/2fa/backup-codes { code } → 8 new backup codes (the old ones stop working)
 *   POST /cms-api/2fa/disable    { code } (only when not required for your role)
 *   POST /cms-api/2fa/reset      { userId } owner only – for a lost phone
 *   POST /cms-api/2fa/login      { email, password, code? } – sign-in used by the /cms login screen
 * The Users beforeLogin hook (below) refuses any sign-in of a 2-step account without a valid code.
 */

type TwoFactor = { enabled?: boolean; secret?: string | null; pendingSecret?: string | null; lastStep?: number | null; backupCodes?: string[] | null; failedCodes?: number | null; lockedUntil?: string | null };
type U = { id: number; email: string; role?: string; platformRole?: string | null; twoFactor?: TwoFactor };

const me = (req: PayloadRequest) => req.user as unknown as U | null;
const load = async (req: PayloadRequest, id: number) => (await req.payload.findByID({ collection: "users", id, depth: 0, overrideAccess: true, showHiddenFields: true, req })) as unknown as U;
const save = (req: PayloadRequest, id: number, twoFactor: TwoFactor) =>
  req.payload.update({ collection: "users", id, data: { twoFactor } as never, overrideAccess: true, req, context: { twoFactorUpdate: true } });
const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** Checks a TOTP code or a backup code for a user; consumes it. */
async function checkCode(req: PayloadRequest, user: U, code: string): Promise<boolean> {
  const tf = user.twoFactor ?? {};
  const secret = tf.secret ? decrypt(tf.secret) : null;
  if (!secret) return false;
  const step = verifyTotp(secret, code, tf.lastStep ?? 0);
  if (step) {
    await save(req, user.id, { ...tf, lastStep: step });
    return true;
  }
  const h = hashCode(code);
  if (code.replace(/\W/g, "").length >= 8 && tf.backupCodes?.includes(h)) {
    await save(req, user.id, { ...tf, backupCodes: tf.backupCodes.filter((c) => c !== h) });
    log.warn("auth.2fa_backup_code_used", { user: user.id, left: (tf.backupCodes.length ?? 1) - 1 });
    return true;
  }
  return false;
}

const MAX_WRONG_CODES = 5;
const CODE_LOCK_MS = 15 * 60_000;

/**
 * One wrong code: +1 in ONE statement (parallel attempts can't lose counts); at 5 the account's codes are paused
 * for 15 minutes. Runs on its own connection, outside the sign-in's transaction (which is rolled back when the
 * code is wrong and may hold this row) – so it is started, not awaited.
 */
function countWrongCode(payload: PayloadRequest["payload"], userId: number) {
  const db = (payload.db as unknown as { drizzle: { execute: (q: unknown) => Promise<unknown> } }).drizzle;
  return db.execute(sql`
    UPDATE "payload"."cms_users" SET
      "two_factor_locked_until" = CASE WHEN COALESCE("two_factor_failed_codes", 0) + 1 >= ${MAX_WRONG_CODES} THEN now() + make_interval(mins => ${CODE_LOCK_MS / 60_000}) ELSE "two_factor_locked_until" END,
      "two_factor_failed_codes" = CASE WHEN COALESCE("two_factor_failed_codes", 0) + 1 >= ${MAX_WRONG_CODES} THEN 0 ELSE COALESCE("two_factor_failed_codes", 0) + 1 END
    WHERE "id" = ${userId}`);
}

/**
 * Users hook: a 2-step account can only sign in with a valid code (passed by /2fa/login).
 * Wrong codes are counted per ACCOUNT in the database: after 5 the account's codes are locked for 15 minutes,
 * whatever IP address the attempts come from.
 */
export const requireTwoFactor: CollectionBeforeLoginHook = async ({ user, req, context }) => {
  if (context?.storefront) return user; // storefront account sign-in (Auth.js) – never grants /cms
  // /cms and the REST API are for store teams and platform admins – a shopper's account gets no token here
  const seat = await adminSeat(req.payload, user as TenantUser, req);
  if (!seat.allowed) throw new APIError("ADMIN_NOT_ALLOWED", 403);
  const u = await load(req, Number((user as { id: number }).id));
  if (!u.twoFactor?.enabled) return user;
  const tf = u.twoFactor;
  if (tf.lockedUntil && Date.parse(tf.lockedUntil) > Date.now()) throw new APIError("TWO_FACTOR_LOCKED", 401);
  const code = typeof context?.twoFactorCode === "string" ? context.twoFactorCode : "";
  if (!code) throw new APIError("TWO_FACTOR_REQUIRED", 401);
  if (!(await checkCode(req, u, code))) {
    void countWrongCode(req.payload, u.id).catch((e) => log.error("auth.2fa_counter_failed", e, { user: u.id }));
    log.warn("auth.2fa_wrong_code", { user: u.id, failedBefore: Number(tf.failedCodes) || 0 });
    throw new APIError("TWO_FACTOR_WRONG", 401);
  }
  if (tf.failedCodes || tf.lockedUntil) {
    const fresh = await load(req, u.id); // checkCode may have just saved lastStep / used a backup code
    await save(req, u.id, { ...(fresh.twoFactor ?? {}), failedCodes: 0, lockedUntil: null });
  }
  return user;
};

const attempts = new Map<string, { n: number; reset: number }>();
function tooMany(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) {
    attempts.set(key, { n: 1, reset: now + 10 * 60_000 });
    return false;
  }
  a.n++;
  return a.n > 10;
}

const isLocked = (u: U) => Boolean(u.twoFactor?.lockedUntil && Date.parse(u.twoFactor.lockedUntil) > Date.now());
const WRONG_OR_LOCKED = (u: U) => (isLocked(u) ? "Too many wrong codes – 2-step for this account is paused for 15 minutes." : "That code isn't right. Use the newest code from your app, or a backup code.");

/** Checks a code for a signed-in 2-step action; wrong codes count towards the same 5-try account lock as sign-in. */
async function verifyOrCount(req: PayloadRequest, user: U, code: string): Promise<boolean> {
  if (isLocked(user)) return false;
  if (await checkCode(req, user, code)) return true;
  void countWrongCode(req.payload, user.id).catch((e) => log.error("auth.2fa_counter_failed", e, { user: user.id }));
  return false;
}

const status: Endpoint = {
  path: "/2fa/status",
  method: "get",
  handler: async (req) => {
    const u = me(req);
    if (!u) return bad("Sign in first.", 401);
    const full = await load(req, u.id);
    const seat = await adminSeat(req.payload, full as unknown as TenantUser, req);
    return Response.json({
      enabled: Boolean(full.twoFactor?.enabled),
      required: seat.needsTwoFactor && twoFactorRequired(),
      backupCodesLeft: full.twoFactor?.backupCodes?.length ?? 0,
    });
  },
};

const setup: Endpoint = {
  path: "/2fa/setup",
  method: "post",
  handler: async (req) => {
    const u = me(req);
    if (!u) return bad("Sign in first.", 401);
    const full = await load(req, u.id);
    if (full.twoFactor?.enabled) {
      // moving to a new phone: prove you still control the current one (or have a backup code)
      if (tooMany(`setup:${u.id}`)) return bad("Too many tries – wait 10 minutes.", 429);
      const body = (await req.json?.().catch(() => null)) as { code?: string } | null;
      if (!(await verifyOrCount(req, full, String(body?.code ?? "").trim()))) return bad(WRONG_OR_LOCKED(full));
    }
    const fresh = await load(req, u.id); // checkCode may have just saved lastStep / used a backup code
    const secret = newSecret();
    await save(req, u.id, { ...(fresh.twoFactor ?? {}), pendingSecret: encrypt(secret) });
    const url = otpauthUrl(secret, full.email);
    const QR = await import("qrcode");
    const qr = await QR.toDataURL(url, { margin: 1, width: 220 });
    return Response.json({ secret: secret.replace(/(.{4})/g, "$1 ").trim(), url, qr });
  },
};

const enable: Endpoint = {
  path: "/2fa/enable",
  method: "post",
  handler: async (req) => {
    const u = me(req);
    if (!u) return bad("Sign in first.", 401);
    if (tooMany(`enable:${u.id}`)) return bad("Too many tries – wait 10 minutes.", 429);
    const body = (await req.json?.().catch(() => null)) as { code?: string } | null;
    const full = await load(req, u.id);
    const secret = full.twoFactor?.pendingSecret ? decrypt(full.twoFactor.pendingSecret) : null;
    if (!secret) return bad("Start the setup again.");
    const step = verifyTotp(secret, String(body?.code ?? ""));
    if (!step) return bad("That code isn't right. Check the time on your phone and try the newest code.");
    const codes = newBackupCodes();
    const moved = Boolean(full.twoFactor?.enabled);
    await save(req, u.id, { enabled: true, secret: encrypt(secret), pendingSecret: null, lastStep: step, backupCodes: codes.map(hashCode), failedCodes: 0, lockedUntil: null });
    log.info(moved ? "auth.2fa_moved_to_new_phone" : "auth.2fa_enabled", { user: u.id });
    await recordSecurityEvent(req.payload, { kind: "two-factor-on", email: u.email, userId: u.id, ip: ipFromHeaders(req.headers), detail: moved ? "moved to a new phone" : null });
    return Response.json({ ok: true, backupCodes: codes });
  },
};

const backupCodes: Endpoint = {
  path: "/2fa/backup-codes",
  method: "post",
  handler: async (req) => {
    const u = me(req);
    if (!u) return bad("Sign in first.", 401);
    if (tooMany(`backup:${u.id}`)) return bad("Too many tries – wait 10 minutes.", 429);
    const body = (await req.json?.().catch(() => null)) as { code?: string } | null;
    const full = await load(req, u.id);
    if (!full.twoFactor?.enabled) return bad("Turn on 2-step verification first.");
    if (!(await verifyOrCount(req, full, String(body?.code ?? "").trim()))) return bad(WRONG_OR_LOCKED(full));
    const fresh = await load(req, u.id);
    const codes = newBackupCodes();
    await save(req, u.id, { ...(fresh.twoFactor ?? {}), backupCodes: codes.map(hashCode) });
    log.info("auth.2fa_backup_codes_renewed", { user: u.id });
    await recordSecurityEvent(req.payload, { kind: "backup-codes", email: u.email, userId: u.id, ip: ipFromHeaders(req.headers) });
    return Response.json({ ok: true, backupCodes: codes });
  },
};

const disable: Endpoint = {
  path: "/2fa/disable",
  method: "post",
  handler: async (req) => {
    const u = me(req);
    if (!u) return bad("Sign in first.", 401);
    if ((await adminSeat(req.payload, u as unknown as TenantUser, req)).needsTwoFactor && twoFactorRequired()) return bad("Owners, managers and platform admins must keep 2-step verification on.");
    if (tooMany(`disable:${u.id}`)) return bad("Too many tries – wait 10 minutes.", 429);
    const body = (await req.json?.().catch(() => null)) as { code?: string } | null;
    const full = await load(req, u.id);
    if (!(await verifyOrCount(req, full, String(body?.code ?? "").trim()))) return bad(WRONG_OR_LOCKED(full));
    await save(req, u.id, { enabled: false, secret: null, pendingSecret: null, lastStep: null, backupCodes: null });
    log.info("auth.2fa_disabled", { user: u.id });
    await recordSecurityEvent(req.payload, { kind: "two-factor-off", email: u.email, userId: u.id, ip: ipFromHeaders(req.headers) });
    return Response.json({ ok: true });
  },
};

const reset: Endpoint = {
  path: "/2fa/reset",
  method: "post",
  handler: async (req) => {
    const u = me(req);
    if (!u || !isPlatformAdminUser(u as unknown as TenantUser)) return bad("Only a platform admin (with 2-step verification on) can reset 2-step verification.", 403);
    const body = (await req.json?.().catch(() => null)) as { userId?: number } | null;
    const id = Number(body?.userId);
    if (!id || id === u.id) return bad("Choose another user (to change your own, use My account → Security).");
    await save(req, id, { enabled: false, secret: null, pendingSecret: null, lastStep: null, backupCodes: null });
    log.warn("auth.2fa_reset", { user: id, by: u.id });
    await recordSecurityEvent(req.payload, { kind: "two-factor-reset", userId: id, ip: ipFromHeaders(req.headers), detail: `by ${u.email ?? `user #${u.id}`}` });
    return Response.json({ ok: true });
  },
};

const login: Endpoint = {
  path: "/2fa/login",
  method: "post",
  handler: async (req) => {
    const ip = ipFromHeaders(req.headers); // the proxy's entry – a faked X-Forwarded-For can't dodge the limit
    if (tooMany(`login:${ip}`)) {
      await recordSecurityEvent(req.payload, { kind: "rate-limited", ip, detail: "/cms sign-in" });
      return bad("Too many sign-in attempts. Please wait 10 minutes.", 429);
    }
    const body = (await req.json?.().catch(() => null)) as { email?: string; password?: string; code?: string } | null;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!email || !password) return bad("Enter your email and password.");
    try {
      const res = await req.payload.login({ collection: "users", data: { email, password }, context: { twoFactorCode: String(body?.code ?? "").trim(), clientIp: ip } });
      const user = res.user as unknown as U;
      if (!user) return bad("This account can't open the admin.", 403);
      const cookie = generatePayloadCookie({ collectionAuthConfig: req.payload.collections.users.config.auth, cookiePrefix: req.payload.config.cookiePrefix, token: res.token! });
      log.info("auth.admin_login", { user: user.id, twoFactor: Boolean(user.twoFactor?.enabled) });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": cookie } });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "TWO_FACTOR_REQUIRED") return Response.json({ needCode: true });
      const kind = msg === "TWO_FACTOR_WRONG" ? "two-factor-failed" : msg === "TWO_FACTOR_LOCKED" ? "two-factor-locked" : msg === "ADMIN_NOT_ALLOWED" ? null : "sign-in-failed";
      if (kind) await recordSecurityEvent(req.payload, { kind, email, ip, detail: /locked/i.test(msg) && kind === "sign-in-failed" ? "account locked" : null });
      if (msg === "TWO_FACTOR_WRONG") return bad("That code isn't right. Use the newest code from your app, or a backup code.", 401);
      if (msg === "ADMIN_NOT_ALLOWED") return bad("This account can't open the admin. Shoppers sign in on the store; merchants create a store first (Account → Stores).", 403);
      if (msg === "TWO_FACTOR_LOCKED") return bad("Too many wrong codes – 2-step sign-in for this account is paused for 15 minutes.", 423);
      if (/locked/i.test(msg)) return bad("This account is locked for 15 minutes after too many wrong passwords.", 423);
      return bad("Email or password is wrong.", 401);
    }
  },
};

export const twoFactorEndpoints: Endpoint[] = [status, setup, enable, backupCodes, disable, reset, login];
