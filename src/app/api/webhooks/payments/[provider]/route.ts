import { handleGatewayWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/payments/<provider> – every payment provider plugin's webhook (lib/payments/gateways.ts):
 * signature checked by the provider's plugin, each event stored once, then handled. Unknown provider → 404.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return handleGatewayWebhook(provider, req);
}
