/**
 * Settings that are wrong in a way that breaks emails, Google, payments or integrations – shown by /api/health and
 * /cms, and printed when the server starts (lib/startup-checks.ts). Never shows a value, only the names.
 */

const env = (k: string) => (process.env[k] ?? "").trim();
const isProd = () => process.env.NODE_ENV === "production";

/** Settings that only work together: some set and some missing means the feature is half switched on. */
const TOGETHER: { names: string[]; what: string }[] = [
  { names: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"], what: "photo storage" },
  { names: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], what: "Stripe payments" },
  { names: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"], what: "the QuickBooks integration" },
  { names: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"], what: "the Xero integration" },
  { names: ["DARAZ_APP_KEY", "DARAZ_APP_SECRET"], what: "the Daraz integration" },
  { names: ["AMAZON_SPAPI_APP_ID", "AMAZON_LWA_CLIENT_ID", "AMAZON_LWA_CLIENT_SECRET"], what: "the Amazon integration" },
  { names: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"], what: "the bot check (Turnstile)" },
];

/** Numbers that must be in range. */
const NUMBERS: { name: string; min: number; max: number }[] = [
  { name: "PLATFORM_FEE_PERCENT", min: 0, max: 50 },
  { name: "BILLING_GRACE_DAYS", min: 0, max: 90 },
  { name: "MAX_STORES_PER_USER", min: 1, max: 1000 },
  { name: "DB_POOL_MAX", min: 1, max: 200 },
  { name: "BACKUP_RETENTION_DAYS", min: 1, max: 3650 },
  { name: "SHOPPER_SESSION_DAYS", min: 1, max: 90 },
  { name: "SENTRY_TRACES_SAMPLE_RATE", min: 0, max: 1 },
];

/** Secrets that must be long enough to be safe (production only). */
const SECRETS: { name: string; min: number }[] = [
  { name: "PAYLOAD_SECRET", min: 32 },
  { name: "AUTH_SECRET", min: 32 },
  { name: "CRON_SECRET", min: 16 },
];

const absoluteUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};
const hostLike = (v: string) => /^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?$/i.test(v);

export function configWarnings(): string[] {
  const w: string[] = [];
  const url = env("NEXT_PUBLIC_SITE_URL");
  if (!url) w.push("NEXT_PUBLIC_SITE_URL is not set – links in emails and Google point to the wrong address.");
  else if (!absoluteUrl(url)) w.push("NEXT_PUBLIC_SITE_URL must be a full address like https://shop.example.com.");
  else if (/YOUR-APP|example\.com|localhost/i.test(url) && isProd() && process.env.STAGING !== "true")
    w.push(`NEXT_PUBLIC_SITE_URL is still "${url}" – set your real web address in Railway and redeploy.`);
  if (isProd() && !env("SMTP_HOST") && !env("RESEND_API_KEY")) w.push("No email provider set (SMTP_* or RESEND_API_KEY) – no emails are sent.");
  if ((env("SMTP_USER") || env("SMTP_PASS")) && !env("SMTP_HOST")) w.push("SMTP_USER / SMTP_PASS are set but SMTP_HOST is not – email (SMTP) is only half set up.");

  for (const g of TOGETHER) {
    const set = g.names.filter((n) => env(n));
    if (set.length && set.length < g.names.length) w.push(`${g.names.filter((n) => !env(n)).join(", ")} not set while ${set.join(", ")} is – ${g.what} is only half set up.`);
  }
  for (const n of NUMBERS) {
    const v = env(n.name);
    if (v && !(Number.isFinite(Number(v)) && Number(v) >= n.min && Number(v) <= n.max)) w.push(`${n.name} must be a number from ${n.min} to ${n.max}.`);
  }
  if (isProd()) for (const s of SECRETS) if (env(s.name) && env(s.name).length < s.min) w.push(`${s.name} is too short – use at least ${s.min} random characters.`);

  const root = env("PLATFORM_ROOT_DOMAIN");
  if (root && !hostLike(root)) w.push("PLATFORM_ROOT_DOMAIN must be a domain only, like shopengine.app (no https://, no path).");
  for (const h of env("MARKETING_HOSTS").split(",").map((x) => x.trim()).filter(Boolean)) if (!hostLike(h) && !/^localhost(:\d+)?$/.test(h)) w.push(`MARKETING_HOSTS: "${h}" isn't a domain.`);
  for (const k of ["MARKETING_SITE_URL", "INTEGRATIONS_OAUTH_BASE_URL", "BACKUP_HEARTBEAT_URL"]) if (env(k) && !absoluteUrl(env(k))) w.push(`${k} must be a full address starting with https://.`);
  if (env("PLATFORM_ALERT_EMAILS") && env("PLATFORM_ALERT_EMAILS").split(",").some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))) w.push("PLATFORM_ALERT_EMAILS must be email addresses separated by commas.");
  return w;
}
