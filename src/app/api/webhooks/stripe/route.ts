import { handleGatewayWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe – Stripe's events (the address Stripe was first set up with; the same as
 * /api/webhooks/payments/stripe). Verified with STRIPE_WEBHOOK_SECRET (platform endpoint) or
 * STRIPE_CONNECT_WEBHOOK_SECRET ("connected accounts" endpoint); stored once per event id, then handled by the Stripe
 * plugin (lib/payments/stripe-gateway.ts): shoppers' payments settle orders, the platform's events are ShopEngine billing.
 */
export async function POST(req: Request) {
  return handleGatewayWebhook("stripe", req);
}
