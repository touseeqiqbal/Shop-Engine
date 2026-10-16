/**
 * The integrations a store can connect (/cms → Integrations) – client-safe descriptions only (what the admin shows and
 * which settings each needs). The code that talks to each provider is in lib/integrations/providers/.
 *
 * Every store connects its OWN account with each provider (its own API keys / login), so its money, parcels and
 * messages are its own. Keys are stored encrypted (lib/integrations/secrets.ts) and never shown again in full.
 */
import type { IntegrationInfo } from "./catalog-types";
import { SHIPPING } from "./catalog/shipping";
import { PAYMENTS } from "./catalog/payments";
import { MESSAGING } from "./catalog/messaging";
import { MARKETING } from "./catalog/marketing";
import { EMAIL_MARKETING } from "./catalog/email-marketing";
import { ACCOUNTING } from "./catalog/accounting";
import { CHAT } from "./catalog/chat";
import { MARKETPLACES } from "./catalog/marketplaces";

export { CATEGORIES, type FieldType, type IntegrationCategory, type IntegrationField, type IntegrationInfo } from "./catalog-types";

export const INTEGRATIONS: IntegrationInfo[] = [...SHIPPING, ...PAYMENTS, ...MESSAGING, ...MARKETING, ...EMAIL_MARKETING, ...ACCOUNTING, ...CHAT, ...MARKETPLACES];

export const integrationInfo = (id: string | null | undefined) => INTEGRATIONS.find((i) => i.id === id) ?? null;

/** How long a store-connected payment page (PayPal, JazzCash …) takes payments – the order is reserved meanwhile. */
export const PAYMENT_PAGE_MINUTES = 60;

/** Is this order payment method one of the online payment integrations (an order's `paymentMethod`)? */
export const isPaymentIntegration = (id: string | null | undefined) => integrationInfo(id)?.category === "payments";

/** Does it work for a store in this country? */
export const availableIn = (info: IntegrationInfo, country: string) => !info.countries || info.countries.includes(country);

/** The public (non-secret) settings of an integration, with defaults. */
export function publicConfig(info: IntegrationInfo, values: Record<string, unknown> | null | undefined): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of info.fields) {
    if (f.type === "secret") continue;
    const v = values?.[f.key];
    out[f.key] = f.type === "checkbox" ? v === true || v === "true" || (v == null && f.default === "true") : typeof v === "string" ? v : (f.default ?? "");
  }
  return out;
}
