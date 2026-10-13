import "server-only";
import { clientIp } from "@/lib/rate-limit";
import { log } from "@/lib/log";

/**
 * Server check for the Cloudflare Turnstile token sent by a form. Always passes until both TURNSTILE_SECRET_KEY and
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY are set (so forms keep working before the keys are added). If Cloudflare itself can't be reached, the form is allowed
 * through (and logged) rather than blocking real customers – rate limits still apply.
 */
export async function verifyTurnstile(fd: FormData, action: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // without the site key the browser never shows the check, so demanding it would block every form
  // (config-warnings reports the half-set keys on /api/health and the /cms Home screen)
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  const token = String(fd.get("cf-turnstile-response") ?? "");
  if (!token) {
    log.warn("turnstile.missing", { action });
    return false;
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    const ip = await clientIp().catch(() => "");
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(5000) });
    const j = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!j.success) log.warn("turnstile.failed", { action, codes: j["error-codes"] });
    return Boolean(j.success);
  } catch (e) {
    log.error("turnstile.unreachable", e, { action });
    return true;
  }
}

export const BOT_MESSAGE = "Please complete the quick security check and try again.";
