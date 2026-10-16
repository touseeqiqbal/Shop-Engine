import { isCmsConfigured } from "@/lib/db/config";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * /api/integrations/<provider>/<store's key>[/<action>] – where a provider reaches one store's connection: webhooks and
 * IPNs (action "webhook", the default), a shopper coming back from a payment page ("return"), a WhatsApp webhook
 * check (GET). The key is random per store and provider; the provider's own signature is checked by its module.
 */
async function handle(req: Request, ctx: { params: Promise<{ provider: string; key: string; action?: string[] }> }) {
  if (!isCmsConfigured) return new Response("Not found", { status: 404 });
  const { provider, key, action } = await ctx.params;
  const [{ payloadClient }, { connectionByWebhookKey }, { providerImpl }] = await Promise.all([import("@/lib/cms/catalog-source"), import("@/lib/integrations/server"), import("@/lib/integrations/providers")]);
  const payload = await payloadClient();
  const connection = await connectionByWebhookKey(payload, provider, key);
  const impl = connection ? await providerImpl(provider) : null;
  if (!connection || !impl?.inbound) return new Response("Not found", { status: 404 });
  // a provider can only post a reasonable amount
  const raw = req.method === "GET" || req.method === "HEAD" ? "" : (await req.text()).slice(0, 1_000_000);
  try {
    return await impl.inbound({ payload, connection }, { method: req.method, url: new URL(req.url), headers: req.headers, raw, action: (action ?? ["webhook"]).join("/") });
  } catch (e) {
    log.error("integrations.inbound_failed", e, { provider, store: connection.store, action: action?.join("/") ?? "webhook" });
    // 500 → most providers send it again later
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
