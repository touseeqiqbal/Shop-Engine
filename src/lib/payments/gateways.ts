import { gatewayInfo, gatewaySupports } from "./catalog";
import { storeLocale } from "../locale";
import { GatewayError, type PaymentGateway } from "./gateway-types";
import { stripeGateway } from "./stripe-gateway";
import { openCheckoutUrl } from "./index";
import { INTEGRATIONS } from "../integrations/catalog";
import type { IntegrationInfo } from "../integrations/catalog-types";

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

/** ShopEngine's own platform providers (Stripe Connect) – connected per store from Stores → Online payments. */
const platformGateways = () => allGateways().filter((g) => gatewayInfo(g.id));

/** The platform provider a store has connected (Stores → Online payments), else the first one that works in its country. */
export function storeGateway(store: Doc | null | undefined): PaymentGateway | null {
  if (!store) return null;
  const chosen = getGateway(String(store.paymentsProvider || ""));
  if (chosen && gatewayInfo(chosen.id)) return chosen;
  const loc = storeLocale(store as { country?: string; currency?: string });
  return platformGateways().find((g) => gatewaySupports(g, loc.country, loc.currency)) ?? null;
}

/** Can this store take payments through this provider right now (keys set, account ready, its country and currency)? */
export function gatewayReady(id: string, store: Doc | null | undefined): boolean {
  const g = getGateway(id);
  if (!g || !store || !g.configured() || !g.ready(store)) return false;
  const loc = storeLocale(store as { country?: string; currency?: string });
  return gatewaySupports(g, loc.country, loc.currency);
}

/**
 * A provider connected with the store's OWN account (Integrations → Online payments: PayPal, JazzCash …). Its
 * updates come to /api/integrations/<provider>/<key>, not /api/webhooks/payments – see lib/integrations/payments.ts.
 */
function integrationGateway(info: IntegrationInfo): PaymentGateway {
  const engine = () => import("../integrations/payments");
  return {
    id: info.id,
    label: info.name,
    methods: [info.id],
    countries: info.countries,
    currencies: info.payment?.currencies,
    description: info.summary,
    configured: () => true,
    // per store: offered at checkout only while connected and switched on (lib/cms/commerce.ts)
    ready: () => true,
    start: async (payload, input) => (await engine()).startPayment(payload, info.id, input),
    resumeUrl: (payload, orderId) => openCheckoutUrl(payload, orderId),
    verifyWebhook() {
      throw new GatewayError("Updates for this provider go to the store's own integration address.", 404);
    },
    handleWebhook: async () => ({ status: "ignored", summary: { reason: "not used" } }),
    refund: async (payload, req, input) => (await engine()).refundPayment(payload, req, info.id, input),
    reconcile: async (payload, limit) => (await engine()).reconcilePayments(payload, info.id, limit),
  };
}

// the built-in providers
registerGateway(stripeGateway);
for (const info of INTEGRATIONS) if (info.category === "payments" && info.payment) registry.set(info.id, integrationGateway(info));
