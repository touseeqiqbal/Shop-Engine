/**
 * Uptime monitor – runs as its OWN small Railway service (so it still works when the website is down).
 * Every CHECK_SECONDS it opens /api/health (database + CMS) and the home page. After FAILS_BEFORE_ALERT
 * failures in a row it sends an email and/or SMS; when the site is back it says so. While down it
 * reminds every REMIND_MINUTES.
 *
 * Env:
 *   SITE_URL            https://www.urkotechstore.com            (required)
 *   ALERT_EMAILS        owner@example.com,manager@example.com
 *   Email goes out like the website's: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE (used first),
 *                       or RESEND_API_KEY
 *   ALERT_FROM          "Urko Uptime <alerts@urkotechstore.com>"  (default EMAIL_FROM; with SMTP, an address the
 *                       mailbox may send as)
 *   ALERT_PHONES        03001234567,03211234567                   (SMS via the same gateway as the website)
 *   SMS_WEBHOOK_URL     POST { to, message }
 *   CHECK_SECONDS=60  FAILS_BEFORE_ALERT=2  REMIND_MINUTES=30  TIMEOUT_SECONDS=15
 *   STAGING_USER / STAGING_PASSWORD   only when watching the password-protected staging site
 *
 *   node scripts/uptime/monitor.mjs --once     single check (exit code 1 if down) – handy for testing
 */

const SITE = (process.env.SITE_URL || "").replace(/\/$/, "");
if (!SITE) {
  console.error("SITE_URL is required");
  process.exit(2);
}
const every = Number(process.env.CHECK_SECONDS || 60) * 1000;
const failsBeforeAlert = Number(process.env.FAILS_BEFORE_ALERT || 2);
const remindMs = Number(process.env.REMIND_MINUTES || 30) * 60_000;
const timeout = Number(process.env.TIMEOUT_SECONDS || 15) * 1000;
const auth = process.env.STAGING_USER ? { Authorization: "Basic " + Buffer.from(`${process.env.STAGING_USER}:${process.env.STAGING_PASSWORD}`).toString("base64") } : {};
const list = (v) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
// No way to tell anyone = a monitor that watches silently. Say so loudly at start.
const canEmail = list(process.env.ALERT_EMAILS).length && (process.env.SMTP_HOST || process.env.RESEND_API_KEY);
const canSms = list(process.env.ALERT_PHONES).length && process.env.SMS_WEBHOOK_URL;
if (!canEmail && !canSms) console.error("WARNING: no alert channel – set ALERT_EMAILS with SMTP_* or RESEND_API_KEY, and/or ALERT_PHONES with SMS_WEBHOOK_URL.");
const log = (event, fields = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));

async function probe(path, check) {
  const started = Date.now();
  try {
    const res = await fetch(SITE + path, { headers: { ...auth, "User-Agent": "UrkoUptime/1.0" }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
    const ms = Date.now() - started;
    const problem = await check(res);
    return { path, ok: !problem, ms, problem };
  } catch (e) {
    return { path, ok: false, ms: Date.now() - started, problem: e.name === "TimeoutError" ? `no answer in ${timeout / 1000}s` : e.message };
  }
}

async function checkSite() {
  let warnings = [];
  const results = await Promise.all([
    probe("/api/health", async (r) => {
      if (r.status !== 200) return `health HTTP ${r.status}${r.status === 503 ? " (database or CMS down)" : ""}`;
      const j = await r.json().catch(() => null);
      // the site is up but something is set up wrong (e.g. no email provider) – reported separately, see tick()
      if (Array.isArray(j?.warnings)) warnings = j.warnings.map(String);
      return j?.ok ? null : "health says not ok";
    }),
    probe("/", async (r) => (r.status === 200 ? null : `home page HTTP ${r.status}`)),
  ]);
  return { ok: results.every((r) => r.ok), results, warnings };
}

const FROM = process.env.ALERT_FROM || process.env.EMAIL_FROM || "Urko Uptime <info@urkotechstore.com>";
let smtp = null;

async function sendEmail(subject, text) {
  const to = list(process.env.ALERT_EMAILS);
  if (!to.length) return;
  if (process.env.SMTP_HOST) {
    try {
      if (!smtp) {
        const { default: nodemailer } = await import("nodemailer");
        const port = Number(process.env.SMTP_PORT || 587);
        smtp = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port,
          secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
          connectionTimeout: 10_000,
          socketTimeout: 10_000,
        });
      }
      await smtp.sendMail({ from: FROM, to, subject, text });
    } catch (e) {
      log("alert.email_failed", { error: String(e?.message ?? e) });
    }
    return;
  }
  if (!process.env.RESEND_API_KEY) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e) => ({ ok: false, status: e.message }));
  if (!res.ok) log("alert.email_failed", { status: res.status });
}

async function sendSms(message) {
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) return;
  for (const to of list(process.env.ALERT_PHONES)) {
    const intl = to.replace(/\D/g, "").replace(/^0/, "92");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: intl, message }), signal: AbortSignal.timeout(10_000) }).catch((e) => ({ ok: false, status: e.message }));
    if (!res.ok) log("alert.sms_failed", { status: res.status });
  }
}

async function alert(subject, text) {
  log("alert", { subject });
  await Promise.allSettled([sendEmail(subject, text), sendSms(`${subject}. ${text}`.slice(0, 300))]);
}

const host = SITE.replace(/^https?:\/\//, "");
let fails = 0;
let downSince = null;
let lastAlert = 0;
let lastWarnings = "";

async function tick() {
  const { ok, results, warnings } = await checkSite();
  const summary = results.map((r) => `${r.path} ${r.ok ? "ok" : r.problem} (${r.ms}ms)`).join(" · ");
  log(ok ? "check.ok" : "check.fail", { summary, ...(warnings.length ? { warnings } : {}) });
  // set-up warnings: one message when they appear or change, one when they're all fixed (not every minute)
  const warningKey = [...warnings].sort().join("\n");
  if (ok && warningKey !== lastWarnings) {
    if (warnings.length) await alert(`⚠️ ${host} needs attention`, `The site is up, but: ${warnings.join(" ")}`);
    else if (lastWarnings) await alert(`✅ ${host} set-up warnings fixed`, "The site no longer reports set-up warnings.");
    lastWarnings = warningKey;
  }
  if (ok) {
    if (downSince && lastAlert) await alert(`✅ ${host} is back up`, `Down for ${Math.round((Date.now() - downSince) / 60000)} min. ${summary}`);
    fails = 0;
    downSince = null;
    lastAlert = 0;
    return true;
  }
  fails++;
  downSince ??= Date.now();
  if (fails >= failsBeforeAlert && (!lastAlert || Date.now() - lastAlert >= remindMs)) {
    lastAlert = Date.now();
    await alert(`🔴 ${host} is DOWN`, `${summary}. Check Railway → web service → Deployments / Logs.`);
  }
  return false;
}

if (process.argv.includes("--once")) {
  const ok = await tick();
  process.exit(ok ? 0 : 1);
} else {
  log("monitor.start", { site: SITE, everySeconds: every / 1000 });
  await tick();
  setInterval(() => void tick().catch((e) => log("monitor.error", { error: e.message })), every);
}
