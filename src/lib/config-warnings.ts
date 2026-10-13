/** Settings that are wrong in a way that breaks emails, Google or payments – shown by /api/health and /cms. */
export function configWarnings(): string[] {
  const w: string[] = [];
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!url) w.push("NEXT_PUBLIC_SITE_URL is not set – links in emails and Google point to the wrong address.");
  else if (/YOUR-APP|example\.com|localhost/i.test(url) && process.env.NODE_ENV === "production" && process.env.STAGING !== "true")
    w.push(`NEXT_PUBLIC_SITE_URL is still "${url}" – set your real web address in Railway and redeploy.`);
  if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST && !process.env.RESEND_API_KEY) w.push("No email provider set (SMTP_* or RESEND_API_KEY) – no emails are sent.");
  if (process.env.TURNSTILE_SECRET_KEY && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) w.push("TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is not – the bot check is skipped.");
  return w;
}
