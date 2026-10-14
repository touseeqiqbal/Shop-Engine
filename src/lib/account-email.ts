import { createHmac, timingSafeEqual } from "node:crypto";
import { absoluteUrl } from "@/lib/site";

/**
 * Account emails (password reset, email verification): templates and the signed verify-email link.
 * Not "server-only" because the Payload config (Users → forgotPassword) uses the templates too.
 * Customer emails carry the store's own name and address (callers pass them); staff emails come from ShopEngine.
 */

/** Who a customer email comes from: the store's name and its own address (no trailing slash). */
export type EmailBrand = { name: string; origin: string };
/** The platform's name on staff (admin) emails. */
export const PLATFORM_EMAIL_NAME = "ShopEngine";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function accountEmail(opts: { brand: string; title: string; intro: string; button: { href: string; label: string }; note: string }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
  <tr><td style="background:linear-gradient(120deg,#3b82f6,#8b5cf6);background-color:#6366f1;padding:22px 28px">
    <p style="margin:0;color:#ffffff;font-size:20px;font-weight:800">${esc(opts.brand)}</p>
  </td></tr>
  <tr><td style="padding:28px">
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827">${esc(opts.title)}</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563">${esc(opts.intro)}</p>
    <a href="${esc(opts.button.href)}" style="display:inline-block;margin-top:20px;padding:12px 22px;border-radius:999px;background:#6366f1;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none">${esc(opts.button.label)}</a>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b7280">${esc(opts.note)}<br>Button not working? Copy this link: <span style="word-break:break-all">${esc(opts.button.href)}</span></p>
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = `${opts.title}\n\n${opts.intro}\n\n${opts.button.label}: ${opts.button.href}\n\n${opts.note}`;
  return { html, text };
}

/**
 * Password reset: customers reset on the storefront (their store's own address and name), staff in /cms (ShopEngine).
 * `newAccount` = a customer who so far only ordered as a guest – the same link finishes creating their account.
 */
export function resetPasswordEmail(token: string, role: string | null | undefined, newAccount: boolean, store: EmailBrand) {
  const staff = Boolean(role && role !== "customer");
  const name = staff ? PLATFORM_EMAIL_NAME : store.name;
  const href = staff ? absoluteUrl(`/cms/reset/${encodeURIComponent(token)}`) : `${store.origin}/account/reset-password?token=${encodeURIComponent(token)}`;
  if (newAccount)
    return accountEmail({
      brand: name,
      title: "Finish creating your account",
      intro: `Thanks for shopping with ${name}! Choose a password to finish your account – your orders are already in it, and next time checkout is faster.`,
      button: { href, label: "Choose my password" },
      note: "The link works for 1 hour. Didn't ask for an account? Just ignore this email.",
    });
  return accountEmail({
    brand: name,
    title: "Reset your password",
    intro: `Someone (hopefully you) asked to reset the password for your ${name} account. Choose a new password with the button below.`,
    button: { href, label: "Choose a new password" },
    note: "The link works for 1 hour. If you didn't ask for this, ignore this email – your password stays the same.",
  });
}

// ───────────────────────────── verify-email link ─────────────────────────────
// Stateless: the token signs (user id, email, expiry). Changing the email makes old links useless.

const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sign = (secret: string, id: string, email: string, exp: number) => createHmac("sha256", secret).update(`verify-email:${id}:${email.toLowerCase()}:${exp}`).digest("base64url");

export function createVerifyToken(secret: string, id: string | number, email: string) {
  const exp = Date.now() + VERIFY_TTL_MS;
  return `${id}.${exp}.${sign(secret, String(id), email, exp)}`;
}

/** Returns the user id when the token's signature is valid for this email, or why it isn't. */
export function readVerifyToken(token: string): { id: string; exp: number; sig: string } | null {
  const m = /^(\d+)\.(\d+)\.([A-Za-z0-9_-]{20,})$/.exec(token);
  return m ? { id: m[1], exp: Number(m[2]), sig: m[3] } : null;
}

export function checkVerifyToken(secret: string, t: { id: string; exp: number; sig: string }, email: string): "ok" | "expired" | "invalid" {
  const want = Buffer.from(sign(secret, t.id, email, t.exp));
  const got = Buffer.from(t.sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return "invalid";
  return t.exp < Date.now() ? "expired" : "ok";
}

export function verifyEmailEmail(token: string, store: EmailBrand, name?: string) {
  return accountEmail({
    brand: store.name,
    title: "Confirm your email",
    intro: `${name ? `Hi ${name.split(" ")[0]}, thanks` : "Thanks"} for creating your ${store.name} account. Please confirm this is your email address so we can send you order updates and password resets.`,
    button: { href: `${store.origin}/account/verify-email?token=${encodeURIComponent(token)}`, label: "Confirm my email" },
    note: "The link works for 7 days. If you didn't create an account, ignore this email.",
  });
}
