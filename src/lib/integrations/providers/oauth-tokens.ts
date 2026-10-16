import { rememberForConnection } from "../server";
import { IntegrationError, type Ctx } from "../types";

/**
 * Access tokens of the integrations connected with a sign-in page (QuickBooks, Xero, Daraz): short-lived, renewed
 * with the refresh token – which some providers replace on every renewal, so the newest one is always kept.
 * One renewal at a time per connection. A refused renewal marks the connection "Needs attention" (connect again).
 */

export type Renewed = { accessToken: string; refreshToken?: string; expiresIn: number; state?: Record<string, unknown> };

const running = new Map<number, Promise<string>>();

export async function accessToken(ctx: Ctx, provider: string, renew: (refreshToken: string) => Promise<Renewed | "expired">): Promise<string> {
  const c = ctx.connection;
  const until = Number(c.state.accessExpiresAt ?? 0);
  if (c.secrets.accessToken && until > Date.now() + 90_000) return c.secrets.accessToken;
  const busy = running.get(c.id);
  if (busy) return busy;
  const work = (async () => {
    const refresh = c.secrets.refreshToken;
    if (!refresh) throw new IntegrationError(`${provider}: not signed in – connect again.`, 400);
    const r = await renew(refresh);
    if (r === "expired") {
      await rememberForConnection(ctx.payload, c, { status: "error", lastError: `${provider} sign-in has expired – open the integration and connect again.` });
      throw new IntegrationError(`${provider} sign-in has expired – connect again.`, 400);
    }
    const accessExpiresAt = Date.now() + r.expiresIn * 1000;
    const secrets = { accessToken: r.accessToken, ...(r.refreshToken ? { refreshToken: r.refreshToken } : {}) };
    await rememberForConnection(ctx.payload, c, { secrets, state: { accessExpiresAt, ...(r.state ?? {}) } });
    // this run goes on with the new token too
    c.secrets = { ...c.secrets, ...secrets };
    c.state = { ...c.state, accessExpiresAt, ...(r.state ?? {}) };
    return r.accessToken;
  })();
  running.set(c.id, work);
  try {
    return await work;
  } finally {
    running.delete(c.id);
  }
}

/** HTTP Basic credentials of ShopEngine's app with a provider (from the platform settings). */
export const basicAuth = (id: string | undefined, secret: string | undefined) => `Basic ${Buffer.from(`${id ?? ""}:${secret ?? ""}`).toString("base64")}`;
