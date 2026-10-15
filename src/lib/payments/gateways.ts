import { gatewayInfo, gatewaySupports } from "./catalog";
import { storeLocale } from "../locale";
import type { PaymentGateway } from "./gateway-types";
import { stripeGateway } from "./stripe-gateway";

export { GatewayError, type PaymentGateway, type StartPaymentInput, type WebhookEvent, type WebhookResult } from "./gateway-types";

/**
 * Payment provider plugins (ShopEngine). A provider takes a shopper's payment on its own page and tells us when it is
 * paid; the store's money goes to the store's own account with that provider (connected by the owner).
 *
 * Every provider implements `PaymentGateway` and is registered below. The shop never trusts the browser: an order
 * becomes Paid only from the provider's verified webhook (or by asking the provider when reconciling), with the amount,
 * currency and account checked. Webhooks arrive at /api/webhooks/payments/<provider id> and are stored once per
 * event (payment-events) – see lib/payments/webhook.ts. How to add one: docs/PAYMENT-PLUGINS.md.
 */

type Doc = Record<string, unknown>;

const registry = new Map<string, PaymentGateway>();

/** Adds a provider (the built-in ones are registered below). */
export function registerGateway(g: PaymentGateway) {
  if (!gatewayInfo(g.id)) throw new Error(`Payment provider "${g.id}" must be described in lib/payments/catalog.ts too.`);
  registry.set(g.id, g);
}

export function getGateway(id: string | null | undefined): PaymentGateway | null {
  return (id && registry.get(id)) || null;
}

export function allGateways(): PaymentGateway[] {
  return [...registry.values()];
}

/** The provider a store has connected (Stores → Online payments), else the first one that works in its country. */
export function storeGateway(store: Doc | null | undefined): PaymentGateway | null {
  if (!store) return null;
  const chosen = getGateway(String(store.paymentsProvider || ""));
  if (chosen) return chosen;
  const loc = storeLocale(store as { country?: string; currency?: string });
  return allGateways().find((g) => gatewaySupports(g, loc.country, loc.currency)) ?? null;
}

/** Can this store take payments through this provider right now (keys set, account ready, its country and currency)? */
export function gatewayReady(id: string, store: Doc | null | undefined): boolean {
  const g = getGateway(id);
  if (!g || !store || !g.configured() || !g.ready(store)) return false;
  const loc = storeLocale(store as { country?: string; currency?: string });
  return gatewaySupports(g, loc.country, loc.currency);
}

// the built-in providers
registerGateway(stripeGateway);
